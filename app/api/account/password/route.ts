import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clearPasswordAttempts, passwordAttemptStatus, recordFailedPasswordAttempt } from "@/lib/account-rate-limit";
import { validateNewPassword } from "@/lib/password-policy";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 403 });
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
    return NextResponse.json(
      { error: next.ok ? "Password saat ini wajib diisi." : next.error },
      { status: 400 }
    );
  }
  if (currentPassword === next.value) {
    return NextResponse.json({ error: "Password baru harus berbeda dari password saat ini." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, active: true },
  });
  const currentIsValid = Boolean(user?.active) && (await bcrypt.compare(currentPassword, user?.password ?? ""));
  if (!currentIsValid) {
    recordFailedPasswordAttempt(session.user.id);
    return NextResponse.json({ error: "Password saat ini tidak benar." }, { status: 400 });
  }

  const password = await bcrypt.hash(next.value, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password, authVersion: { increment: 1 } },
  });
  clearPasswordAttempts(session.user.id);
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
  );
}
