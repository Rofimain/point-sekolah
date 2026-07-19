import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageData, APP_ROLES } from "@/lib/staff-roles";
import { auditGoogleReadiness } from "@/lib/google-account-link";

/** Audit kesiapan Google login — read-only, tanpa auto-migration. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roleParam = req.nextUrl.searchParams.get("role")?.trim() || "";
  const role = (APP_ROLES as readonly string[]).includes(roleParam) ? roleParam : undefined;
  const take = Number(req.nextUrl.searchParams.get("take") || "50");

  const report = await auditGoogleReadiness({ role, take: Number.isFinite(take) ? take : 50 });
  return NextResponse.json(report, {
    headers: { "Cache-Control": "no-store" },
  });
}
