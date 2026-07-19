import { NextRequest, NextResponse } from "next/server";
import { requireManageData, isAuthFail } from "@/lib/api-auth";
import { APP_ROLES } from "@/lib/staff-roles";
import { auditGoogleReadiness } from "@/lib/google-account-link";

/** Audit kesiapan Google login — read-only, tanpa auto-migration. */
export async function GET(req: NextRequest) {
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;

  const roleParam = req.nextUrl.searchParams.get("role")?.trim() || "";
  const role = (APP_ROLES as readonly string[]).includes(roleParam) ? roleParam : undefined;
  const take = Number(req.nextUrl.searchParams.get("take") || "50");

  const report = await auditGoogleReadiness({ role, take: Number.isFinite(take) ? take : 50 });
  return NextResponse.json(report, {
    headers: { "Cache-Control": "no-store" },
  });
}
