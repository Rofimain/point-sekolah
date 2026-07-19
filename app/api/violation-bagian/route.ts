import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageData, isStaffRole } from "@/lib/staff-roles";
import { slugifyBagianId } from "@/lib/violation-sections";
import { listViolationBagian } from "@/lib/violation-bagian";

export const dynamic = "force-dynamic";

/** Staf + siswa: daftar bagian aktif (untuk accordion / dropdown). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStaffRole(session.user.role) && session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await listViolationBagian();
  return NextResponse.json({ items: rows });
}

/** Admin: tambah bagian baru. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { label?: string; id?: string };
  const label = body.label?.trim() || "";
  if (label.length < 2) {
    return NextResponse.json({ error: "Nama bagian minimal 2 karakter" }, { status: 400 });
  }

  const id = (body.id?.trim() || slugifyBagianId(label)).toUpperCase();
  if (!/^[A-Z0-9_]{2,40}$/.test(id)) {
    return NextResponse.json(
      { error: "Kode bagian hanya huruf/angka/underscore (2–40 karakter)" },
      { status: 400 }
    );
  }

  const existing = await prisma.violationBagian.findUnique({ where: { id } });
  if (existing) {
    if (!existing.active) {
      const revived = await prisma.violationBagian.update({
        where: { id },
        data: { active: true, label },
      });
      return NextResponse.json(revived);
    }
    return NextResponse.json({ error: `Bagian dengan kode ${id} sudah ada` }, { status: 409 });
  }

  const maxSort = await prisma.violationBagian.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const row = await prisma.violationBagian.create({
    data: { id, label, sortOrder, active: true },
  });
  return NextResponse.json(row, { status: 201 });
}
