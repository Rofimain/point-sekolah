import { NextRequest, NextResponse } from "next/server";
import { requireManageData, isAuthFail } from "@/lib/api-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/staff-roles";
import { APP_KEYS } from "@/lib/app-settings";
import { recordDataAccessLog } from "@/lib/access-log";

const ALLOWED_KEYS = new Set<string>(Object.values(APP_KEYS));

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isStaffRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await prisma.appSetting.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return NextResponse.json(map);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;
  const { session } = auth;
  const body = await req.json();
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const entries = Object.entries(body as Record<string, string>).filter(
    ([k, v]) => ALLOWED_KEYS.has(k) && typeof v === "string"
  );
  if (entries.length === 0) {
    return NextResponse.json({ error: "Tidak ada field yang diizinkan" }, { status: 400 });
  }
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );
  await recordDataAccessLog({
    session,
    action: "SETTING_UPDATE",
    summary: `Ubah pengaturan sekolah (${entries.map(([k]) => k).join(", ")})`,
    targetType: "AppSetting",
    meta: { keys: entries.map(([k]) => k) },
  });
  const rows = await prisma.appSetting.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return NextResponse.json(map);
}
