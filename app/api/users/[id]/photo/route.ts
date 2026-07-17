import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseEvidenceImageDataUrl } from "@/lib/evidence-data-url";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id },
    select: { photoData: true, photoPresent: true },
  });
  if (!user?.photoPresent || !user.photoData?.trim()) {
    return NextResponse.json({ error: "Tidak ada foto" }, { status: 404 });
  }

  try {
    const parsed = parseEvidenceImageDataUrl(user.photoData);
    return new NextResponse(Buffer.from(parsed.bytes), {
      status: 200,
      headers: {
        "Content-Type": parsed.mime,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Foto tidak valid" }, { status: 500 });
  }
}
