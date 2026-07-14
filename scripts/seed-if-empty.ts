import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  if (count > 0) {
    console.log(`[seed-if-empty] Skip — sudah ada ${count} user.`);
    return;
  }
  console.log("[seed-if-empty] Database kosong — menjalankan prisma db seed…");
  execSync("npx prisma db seed", { stdio: "inherit", cwd: process.cwd() });
}

main()
  .catch((err) => {
    console.error("[seed-if-empty] Gagal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
