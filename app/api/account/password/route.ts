import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clearPasswordAttempts, passwordAttemptStatus, recordFailedPasswordAttempt } from "@/lib/account-rate-limit";
import { validateNewPassword } from "@/lib/password-policy";
import { canUserLogin } from "@/lib/user-status";
import { recordDataAccessLog } from "@/lib/access-log";
import { isSameOriginRequest } from "@/lib/same-origin";

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 403 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Content-Type harus application/json." }, { status: 415 });
  }
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 4_096) return NextResponse.json({ error: "Payload terlalu besar." }, { status: 413 });

  const rate = passwordAttemptStatus(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const currentPassword = body?.currentPassword;
  const next = validateNewPassword(body?.newPassword);
  if (typeof currentPassword !== "string" || !next.ok) {
    recordFailedPasswordAttempt(session.user.id);
    await recordDataAccessLog({
      session,
      action: "PASSWORD_CHANGE",
      summary: `Gagal ganti password akun sendiri`,
      targetType: "User",
      targetId: session.user.id,
      success: false,
      meta: {
        method: "self",
        actorRole: session.user.role ?? null,
        reason: next.ok ? "MISSING_CURRENT" : "INVALID_NEW_PASSWORD",
      },
    });
    return NextResponse.json({ error: next.ok ? "Password saat ini wajib diisi." : next.error }, { status: 400 });
  }
  if (currentPassword === next.value) {
    return NextResponse.json({ error: "Password baru harus berbeda dari password saat ini." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, status: true },
  });
  const currentIsValid =
    Boolean(user && canUserLogin(user.status)) && (await bcrypt.compare(currentPassword, user?.password ?? ""));
  if (!currentIsValid) {
    recordFailedPasswordAttempt(session.user.id);
    await recordDataAccessLog({
      session,
      action: "PASSWORD_CHANGE",
      summary: `Gagal ganti password akun sendiri — password lama salah`,
      targetType: "User",
      targetId: session.user.id,
      success: false,
      meta: {
        method: "self",
        actorRole: session.user.role ?? null,
        reason: "INVALID_CURRENT_PASSWORD",
      },
    });
    return NextResponse.json({ error: "Password saat ini tidak benar." }, { status: 400 });
  }

  const password = await bcrypt.hash(next.value, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      password,
      authVersion: { increment: 1 },
      passwordChangedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  clearPasswordAttempts(session.user.id);
  await recordDataAccessLog({
    session,
    action: "PASSWORD_CHANGE",
    summary: `Ganti password akun sendiri (${session.user.role || "user"})`,
    targetType: "User",
    targetId: session.user.id,
    meta: {
      method: "self",
      actorRole: session.user.role ?? null,
      actorId: session.user.id,
      passwordChanged: true,
    },
  });
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
  );
}
