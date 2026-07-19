import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageData, canModifyUser, isAdminRole } from "@/lib/staff-roles";
import { unlinkGoogleAccount } from "@/lib/google-account-link";
import { recordDataAccessLog } from "@/lib/access-log";

/** PUTUS tautan Google (relink = user login Google lagi setelah unlink). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, googleSub: true },
  });
  if (!existing) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const adminEditingSelf = isAdminRole(session.user.role) && existing.id === session.user.id;
  if (!canModifyUser(session.user.role, existing.role) && !adminEditingSelf) {
    return NextResponse.json({ error: "Admin tidak boleh mengubah akun Admin atau Super Admin." }, { status: 403 });
  }

  const result = await unlinkGoogleAccount({
    userId: id,
    actor: { id: session.user.id, name: session.user.name },
    reason: "admin_unlink",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await recordDataAccessLog({
    session,
    action: "GOOGLE_UNLINK",
    summary: `Putus tautan Google user ${id}`,
    targetType: "User",
    targetId: id,
  });

  return NextResponse.json({ ok: true, unlinked: true });
}
