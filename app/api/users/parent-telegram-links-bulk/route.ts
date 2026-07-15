import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageData } from "@/lib/staff-roles";
import { prisma } from "@/lib/prisma";
import { buildParentTelegramDeepLink, newParentLinkToken } from "@/lib/parent-telegram-link";

const MAX_IDS = 300;

export type ParentTelegramLinkRow = {
  id: string;
  name: string;
  nisn: string;
  className: string;
  url: string;
};

/**
 * Super Admin: token + tautan baru untuk banyak siswa sekaligus (urutan mengikuti ids).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  if (!bot) {
    return NextResponse.json(
      { error: "Set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME (username bot tanpa @) di server." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const raw = Array.isArray(body?.ids) ? body.ids : [];
  const trimmed = raw
    .filter((x: unknown): x is string => typeof x === "string" && Boolean(x.trim()))
    .map((x: string) => x.trim());
  const ids: string[] = Array.from(new Set(trimmed));

  if (ids.length < 1) {
    return NextResponse.json({ error: "Pilih minimal satu pengguna." }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Maksimal ${MAX_IDS} ID per permintaan.` }, { status: 400 });
  }

  const students = await prisma.user.findMany({
    where: { id: { in: ids }, role: "STUDENT" },
    select: {
      id: true,
      name: true,
      nisn: true,
      class: { select: { name: true, grade: true, major: true } },
    },
  });
  const byId = new Map(students.map((s) => [s.id, s]));

  type Row = { student: (typeof students)[0]; token: string };
  const rows: Row[] = [];
  let skipped = 0;

  for (const id of ids) {
    const student = byId.get(id);
    if (!student) {
      skipped++;
      continue;
    }
    rows.push({ student, token: newParentLinkToken() });
  }

  if (rows.length > 0) {
    await prisma.$transaction(
      rows.map((r) =>
        prisma.user.update({
          where: { id: r.student.id },
          data: { parentTelegramLinkToken: r.token },
        })
      )
    );
  }

  const links: ParentTelegramLinkRow[] = rows.map((r) => {
    const cl = r.student.class
      ? [r.student.class.grade, r.student.class.name, r.student.class.major].filter(Boolean).join(" ").trim()
      : "";
    return {
      id: r.student.id,
      name: r.student.name,
      nisn: r.student.nisn || "",
      className: cl,
      url: buildParentTelegramDeepLink(bot, r.token),
    };
  });

  return NextResponse.json({
    links,
    skippedCount: skipped,
    generatedCount: links.length,
  });
}
