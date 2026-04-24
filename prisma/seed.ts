import { PrismaClient, Role, Category } from "@prisma/client";
import bcrypt from "bcryptjs";
import { QUIET_MONTH_REASON } from "../lib/student-effective-points";
import { applyQuietMonthReductionForStudent } from "../lib/quiet-month-reduction";

const prisma = new PrismaClient();

function daysAgo(days: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

async function main() {
  console.log("🌱 Seeding database...");

  // Create classes
  const classes = await Promise.all([
    prisma.class.upsert({ where: { id: "cls-x-mipa1" }, update: {}, create: { id: "cls-x-mipa1", name: "X MIPA 1", grade: "X", major: "MIPA", year: "2025/2026" } }),
    prisma.class.upsert({ where: { id: "cls-x-mipa2" }, update: {}, create: { id: "cls-x-mipa2", name: "X MIPA 2", grade: "X", major: "MIPA", year: "2025/2026" } }),
    prisma.class.upsert({ where: { id: "cls-xi-ipa1" }, update: {}, create: { id: "cls-xi-ipa1", name: "XI IPA 1", grade: "XI", major: "IPA", year: "2025/2026" } }),
    prisma.class.upsert({ where: { id: "cls-xi-ips2" }, update: {}, create: { id: "cls-xi-ips2", name: "XI IPS 2", grade: "XI", major: "IPS", year: "2025/2026" } }),
    prisma.class.upsert({ where: { id: "cls-xii-ipa1" }, update: {}, create: { id: "cls-xii-ipa1", name: "XII IPA 1", grade: "XII", major: "IPA", year: "2025/2026" } }),
    prisma.class.upsert({ where: { id: "cls-xii-ips1" }, update: {}, create: { id: "cls-xii-ips1", name: "XII IPS 1", grade: "XII", major: "IPS", year: "2025/2026" } }),
  ]);

  // Create violation types
  await Promise.all([
    prisma.violationType.upsert({ where: { id: "vt-001" }, update: {}, create: { id: "vt-001", name: "Terlambat masuk sekolah", category: Category.RINGAN, points: 5, description: "Per kejadian, lebih dari 15 menit" } }),
    prisma.violationType.upsert({ where: { id: "vt-002" }, update: {}, create: { id: "vt-002", name: "Tidak memakai atribut lengkap", category: Category.RINGAN, points: 10, description: "Seragam, dasi, sabuk, atau sepatu tidak sesuai" } }),
    prisma.violationType.upsert({ where: { id: "vt-003" }, update: {}, create: { id: "vt-003", name: "Tidak mengerjakan PR / tugas", category: Category.RINGAN, points: 8, description: "Per mata pelajaran" } }),
    prisma.violationType.upsert({ where: { id: "vt-004" }, update: {}, create: { id: "vt-004", name: "Membawa HP saat KBM", category: Category.SEDANG, points: 15, description: "HP akan disita sementara oleh guru" } }),
    prisma.violationType.upsert({ where: { id: "vt-005" }, update: {}, create: { id: "vt-005", name: "Membolos jam pelajaran", category: Category.SEDANG, points: 25, description: "Per jam pelajaran yang dibolos" } }),
    prisma.violationType.upsert({ where: { id: "vt-006" }, update: {}, create: { id: "vt-006", name: "Berkelahi / perkelahian", category: Category.BERAT, points: 50, description: "Wajib laporan ke orang tua / wali" } }),
    prisma.violationType.upsert({ where: { id: "vt-007" }, update: {}, create: { id: "vt-007", name: "Membawa / mengonsumsi rokok", category: Category.BERAT, points: 75, description: "Sidang komite sekolah" } }),
  ]);

  // Super admin
  const superAdminPwd = await bcrypt.hash("Admin@1234", 12);
  await prisma.user.upsert({
    where: { email: "admin@sman1contoh.sch.id" },
    update: {},
    create: {
      email: "admin@sman1contoh.sch.id",
      name: "Drs. Hartanto",
      password: superAdminPwd,
      role: Role.SUPER_ADMIN,
      nip: "197012011990031001",
    },
  });

  // Teacher
  const teacherPwd = await bcrypt.hash("Guru@1234", 12);
  await prisma.user.upsert({
    where: { email: "s.rahayu@sman1contoh.sch.id" },
    update: {},
    create: {
      email: "s.rahayu@sman1contoh.sch.id",
      name: "Siti Rahayu, S.Pd",
      password: teacherPwd,
      role: Role.TEACHER,
      nip: "198505152010012002",
      classId: "cls-xii-ipa1",
    },
  });

  // Students
  const studentPwd = await bcrypt.hash("Siswa@1234", 12);
  const students = [
    { email: "0051234567@siswa.sman1contoh.sch.id", name: "Ahmad Fauzan", nisn: "0051234567", classId: "cls-xii-ipa1" },
    { email: "0052345678@siswa.sman1contoh.sch.id", name: "Rizky Santoso", nisn: "0052345678", classId: "cls-xi-ips2" },
    { email: "0053456789@siswa.sman1contoh.sch.id", name: "Dewi Wulandari", nisn: "0053456789", classId: "cls-x-mipa1" },
    { email: "0054567890@siswa.sman1contoh.sch.id", name: "Nadia Safitri", nisn: "0054567890", classId: "cls-xi-ipa1" },
    { email: "0055678901@siswa.sman1contoh.sch.id", name: "Bima Irawan", nisn: "0055678901", classId: "cls-xii-ips1" },
  ];

  for (const s of students) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: { ...s, password: studentPwd, role: Role.STUDENT },
    });
  }

  // Sample violation records
  const ahmad = await prisma.user.findUnique({ where: { email: "0051234567@siswa.sman1contoh.sch.id" } });
  const rizky = await prisma.user.findUnique({ where: { email: "0052345678@siswa.sman1contoh.sch.id" } });

  if (ahmad) {
    const existing = await prisma.violationRecord.count({ where: { studentId: ahmad.id } });
    if (existing === 0) {
      await prisma.violationRecord.createMany({
        data: [
          { studentId: ahmad.id, violationTypeId: "vt-001", points: 5, session: "Masuk Pagi", notes: "Kemacetan", date: new Date("2026-04-14"), createdByName: "Siti Rahayu" },
          { studentId: ahmad.id, violationTypeId: "vt-002", points: 10, session: "Umum", date: new Date("2026-04-10"), createdByName: "Siti Rahayu" },
          { studentId: ahmad.id, violationTypeId: "vt-004", points: 15, session: "Jam 3-4", notes: "HP disita guru Fisika", date: new Date("2026-04-03"), createdByName: "Siti Rahayu" },
          { studentId: ahmad.id, violationTypeId: "vt-005", points: 25, session: "Jam 5-6", date: new Date("2026-03-22"), createdByName: "Siti Rahayu" },
        ],
      });
    }
  }

  if (rizky) {
    const existing = await prisma.violationRecord.count({ where: { studentId: rizky.id } });
    if (existing === 0) {
      await prisma.violationRecord.createMany({
        data: [
          { studentId: rizky.id, violationTypeId: "vt-006", points: 50, session: "Istirahat", notes: "Insiden di kantin", date: new Date("2026-04-15"), createdByName: "Drs. Hartanto" },
          { studentId: rizky.id, violationTypeId: "vt-005", points: 25, session: "Jam 7-8", date: new Date("2026-04-08"), createdByName: "Siti Rahayu" },
          { studentId: rizky.id, violationTypeId: "vt-004", points: 15, session: "Jam 1-2", date: new Date("2026-04-02"), createdByName: "Siti Rahayu" },
          { studentId: rizky.id, violationTypeId: "vt-002", points: 10, session: "Umum", date: new Date("2026-03-20"), createdByName: "Siti Rahayu" },
        ],
      });
    }
  }

  // --- Dummy: pengurangan 25% setelah ≥30 hari tanpa pelanggaran baru ---
  const demoTenang = await prisma.user.upsert({
    where: { email: "0051111111@siswa.sman1contoh.sch.id" },
    update: {},
    create: {
      email: "0051111111@siswa.sman1contoh.sch.id",
      name: "Ali Pratama (Demo Periode Tenang)",
      nisn: "0051111111",
      classId: "cls-x-mipa1",
      password: studentPwd,
      role: Role.STUDENT,
    },
  });
  const demoAktif = await prisma.user.upsert({
    where: { email: "0052222222@siswa.sman1contoh.sch.id" },
    update: {},
    create: {
      email: "0052222222@siswa.sman1contoh.sch.id",
      name: "Bima Sakti (Demo Masih Aktif)",
      nisn: "0052222222",
      classId: "cls-x-mipa2",
      password: studentPwd,
      role: Role.STUDENT,
    },
  });
  const demoManual = await prisma.user.upsert({
    where: { email: "0053333333@siswa.sman1contoh.sch.id" },
    update: {},
    create: {
      email: "0053333333@siswa.sman1contoh.sch.id",
      name: "Citra Lestari (Demo Potongan Manual)",
      nisn: "0053333333",
      classId: "cls-xi-ipa1",
      password: studentPwd,
      role: Role.STUDENT,
    },
  });

  if ((await prisma.violationRecord.count({ where: { studentId: demoTenang.id } })) === 0) {
    await prisma.violationRecord.createMany({
      data: [
        {
          studentId: demoTenang.id,
          violationTypeId: "vt-005",
          points: 25,
          session: "Jam 3-4",
          notes: "Demo: pelanggaran terakhir >30 hari lalu",
          date: daysAgo(38),
          createdByName: "Sistem (seed)",
        },
        {
          studentId: demoTenang.id,
          violationTypeId: "vt-004",
          points: 15,
          session: "Jam 1-2",
          date: daysAgo(40),
          createdByName: "Sistem (seed)",
        },
      ],
    });
  }
  const adjTenang = await prisma.pointAdjustment.count({
    where: { studentId: demoTenang.id, reason: QUIET_MONTH_REASON },
  });
  if (adjTenang === 0) {
    const applied = await applyQuietMonthReductionForStudent(demoTenang.id);
    if (applied) {
      console.log(
        `   Demo periode tenang: ${demoTenang.name} bruto ${applied.grossTotalBefore} → potong ${applied.pointsDelta} → efektif ${applied.effectiveAfter}`
      );
    }
  }

  if ((await prisma.violationRecord.count({ where: { studentId: demoAktif.id } })) === 0) {
    await prisma.violationRecord.create({
      data: {
        studentId: demoAktif.id,
        violationTypeId: "vt-006",
        points: 50,
        session: "Istirahat",
        notes: "Demo: pelanggaran baru-baru ini (tidak dapat potongan)",
        date: daysAgo(5),
        createdByName: "Sistem (seed)",
      },
    });
  }

  if ((await prisma.violationRecord.count({ where: { studentId: demoManual.id } })) === 0) {
    await prisma.violationRecord.createMany({
      data: [
        {
          studentId: demoManual.id,
          violationTypeId: "vt-007",
          points: 75,
          session: "Umum",
          notes: "Demo: histori lama",
          date: daysAgo(60),
          createdByName: "Sistem (seed)",
        },
        {
          studentId: demoManual.id,
          violationTypeId: "vt-002",
          points: 10,
          session: "Umum",
          date: daysAgo(55),
          createdByName: "Sistem (seed)",
        },
      ],
    });
  }
  const adjManual = await prisma.pointAdjustment.count({
    where: { studentId: demoManual.id, reason: QUIET_MONTH_REASON },
  });
  if (adjManual === 0) {
    const manualAgg = await prisma.violationRecord.aggregate({
      where: { studentId: demoManual.id },
      _sum: { points: true },
    });
    const manualGross = manualAgg._sum.points ?? 0;
    if (manualGross > 0) {
      const cut = Math.round(manualGross * 0.25);
      await prisma.pointAdjustment.create({
        data: {
          studentId: demoManual.id,
          pointsDelta: -cut,
          reason: QUIET_MONTH_REASON,
          grossTotalBefore: manualGross,
        },
      });
      console.log(
        `   Demo bukti manual: ${demoManual.name} bruto ${manualGross} → potong -${cut} (disimpan di seed)`
      );
    }
  }

  console.log("✅ Seeding complete!");
  console.log("\nAkun Login:");
  console.log("Super Admin: admin@sman1contoh.sch.id / Admin@1234");
  console.log("Guru:        s.rahayu@sman1contoh.sch.id / Guru@1234");
  console.log("Siswa:       0051234567@siswa.sman1contoh.sch.id / Siswa@1234");
  console.log("\nDemo pengurangan 25% (bulan tenang, password Siswa@1234):");
  console.log("  Ali (otomatis lewat logic): 0051111111@siswa.sman1contoh.sch.id");
  console.log("  Bima (masih ada pelanggaran baru, tanpa potongan): 0052222222@siswa.sman1contoh.sch.id");
  console.log("  Citra (potongan disimpan di seed sebagai bukti): 0053333333@siswa.sman1contoh.sch.id");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
