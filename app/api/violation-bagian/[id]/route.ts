import { NextRequest, NextResponse } from "next/server";
import { requireManageData, isAuthFail } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { recordDataAccessLog } from "@/lib/access-log";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;
  const { session } = auth;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    label?: string;
    sortOrder?: number;
    active?: boolean;
  };

  const data: { label?: string; sortOrder?: number; active?: boolean } = {};
  if (typeof body.label === "string" && body.label.trim().length >= 2) data.label = body.label.trim();
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    data.sortOrder = Math.trunc(body.sortOrder);
  }
  if (typeof body.active === "boolean") data.active = body.active;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan" }, { status: 400 });
  }

  try {
    const row = await prisma.violationBagian.update({ where: { id }, data });
    await recordDataAccessLog({
      session,
      action: "BAGIAN_UPDATE",
      summary: `Ubah bagian ${row.label}`,
      targetType: "ViolationBagian",
      targetId: row.id,
    });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "Bagian tidak ditemukan" }, { status: 404 });
  }
}

/** Soft-delete (active=false). Tolak hard-delete jika masih dipakai jenis pelanggaran aktif. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;
  const { session } = auth;

  const { id } = await params;
  const usage = await prisma.violationType.count({ where: { section: id, active: true } });
  if (usage > 0) {
    return NextResponse.json(
      {
        error: `Masih dipakai ${usage} jenis pelanggaran aktif. Pindahkan jenis itu dulu, atau nonaktifkan bagian.`,
      },
      { status: 409 }
    );
  }

  try {
    const row = await prisma.violationBagian.update({
      where: { id },
      data: { active: false },
    });
    await recordDataAccessLog({
      session,
      action: "BAGIAN_DELETE",
      summary: `Nonaktifkan bagian ${row.label}`,
      targetType: "ViolationBagian",
      targetId: row.id,
    });
    return NextResponse.json({ ok: true, item: row });
  } catch {
    return NextResponse.json({ error: "Bagian tidak ditemukan" }, { status: 404 });
  }
}
