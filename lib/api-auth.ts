import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canExportRecords, canManageData, canManageUsers, isSuperAdmin } from "@/lib/staff-roles";

type AuthOk = { session: Session };
type AuthFail = { response: NextResponse };

/** Session wajib + role boleh kelola data operasional (catatan, pelanggaran, dll.). */
export async function requireManageData(): Promise<AuthOk | AuthFail> {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

/** Session wajib + role boleh export Excel catatan pelanggaran (staf termasuk Guru). */
export async function requireExportRecords(): Promise<AuthOk | AuthFail> {
  const session = await getServerSession(authOptions);
  if (!session || !canExportRecords(session.user.role)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

/** Session wajib + role boleh manajemen user. */
export async function requireManageUsers(): Promise<AuthOk | AuthFail> {
  const session = await getServerSession(authOptions);
  if (!session || !canManageUsers(session.user.role)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

/** Session wajib + SUPER_ADMIN. */
export async function requireSuperAdmin(): Promise<AuthOk | AuthFail> {
  const session = await getServerSession(authOptions);
  if (!session || !isSuperAdmin(session.user.role)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export function isAuthFail(result: AuthOk | AuthFail): result is AuthFail {
  return "response" in result;
}
