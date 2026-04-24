import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/** Daftar kelas sidebar — jarang berubah; cache mengurangi query tiap navigasi admin. */
export const getCachedSidebarClasses = unstable_cache(
  async () =>
    prisma.class.findMany({
      select: { id: true, name: true, grade: true },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    }),
  ["admin-sidebar-classes"],
  { revalidate: 120, tags: ["sidebar-classes"] }
);
