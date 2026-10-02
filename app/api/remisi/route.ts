import { NextRequest, NextResponse } from "next/server";
import { requireExportRecords, isAuthFail } from "@/lib/api-auth";
import { queryRemisiHistory } from "@/lib/remisi-history";

export async function GET(req: NextRequest) {
  const auth = await requireExportRecords();
  if (isAuthFail(auth)) return auth.response;

  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") === "manual" ? "manual" : "auto";
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "20", 10) || 20));

  const data = await queryRemisiHistory({
    type,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    classId: sp.get("classId") || undefined,
    status: sp.get("status") || undefined,
    q: sp.get("q") || undefined,
    jenis: sp.get("jenis") || undefined,
  });

  const all = type === "manual" ? data.manualRows : data.autoRows;
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const rows = all.slice(start, start + pageSize);

  return NextResponse.json({
    from: data.from,
    to: data.to,
    summary: data.summary,
    jenisOptions: data.jenisOptions,
    page,
    pageSize,
    total,
    totalPages,
    rows,
  });
}
