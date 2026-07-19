import { Role } from "../generated/prisma/client";
import bcrypt from "bcryptjs";
import { QUIET_MONTH_REASON } from "../lib/student-effective-points";
import { applyQuietMonthReductionForStudent } from "../lib/quiet-month-reduction";
import { createPrismaClient } from "../lib/prisma";
import { DEFAULT_PRINT_TEMPLATES, PRINT_TEMPLATES_LAYOUT_VERSION } from "../lib/print-templates";
import { plainTextToDocumentHtml } from "../lib/document-html";
import { DEFAULT_PAGE_SETTINGS, serializePageSettings } from "../lib/document-page";
import { PASAL_15_VIOLATIONS, pasal15ToCreateInput } from "./pasal-15-violations";
import { DEFAULT_VIOLATION_BAGIAN } from "../lib/violation-sections";

const prisma = createPrismaClient();

function daysAgo(days: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

async function main() {
  console.log("🌱 Seeding database...");

  // Create classes
  const _classes = await Promise.all([
    prisma.class.upsert({ where: { id: "cls-x-mipa1" }, update: {}, create: { id: "cls-x-mipa1", name: "X MIPA 1", grade: "X", major: "MIPA", year: "2025/2026" } }),
    prisma.class.upsert({ where: { id: "cls-x-mipa2" }, update: {}, create: { id: "cls-x-mipa2", name: "X MIPA 2", grade: "X", major: "MIPA", year: "2025/2026" } }),
    prisma.class.upsert({ where: { id: "cls-xi-ipa1" }, update: {}, create: { id: "cls-xi-ipa1", name: "XI IPA 1", grade: "XI", major: "IPA", year: "2025/2026" } }),
    prisma.class.upsert({ where: { id: "cls-xi-ips2" }, update: {}, create: { id: "cls-xi-ips2", name: "XI IPS 2", grade: "XI", major: "IPS", year: "2025/2026" } }),
    prisma.class.upsert({ where: { id: "cls-xii-ipa1" }, update: {}, create: { id: "cls-xii-ipa1", name: "XII IPA 1", grade: "XII", major: "IPA", year: "2025/2026" } }),
    prisma.class.upsert({ where: { id: "cls-xii-ips1" }, update: {}, create: { id: "cls-xii-ips1", name: "XII IPS 1", grade: "XII", major: "IPS", year: "2025/2026" } }),
  ]);

  // Master bagian jenis pelanggaran
  for (const b of DEFAULT_VIOLATION_BAGIAN) {
    await prisma.violationBagian.upsert({
      where: { id: b.id },
      update: { label: b.label, sortOrder: b.sortOrder, active: true },
      create: { id: b.id, label: b.label, sortOrder: b.sortOrder, active: true },
    });
  }

  // Jenis pelanggaran per bagian (Kelakuan / Kerajinan / Kerapihan)
  for (const v of PASAL_15_VIOLATIONS) {
    const data = pasal15ToCreateInput(v);
    await prisma.violationType.upsert({
      where: { id: data.id },
      update: {
        name: data.name,
        section: data.section,
        category: data.category,
        points: data.points,
        description: data.description,
        sortOrder: data.sortOrder,
        active: true,
      },
      create: data,
    });
  }

  // Hapus contoh lama jika tidak dipakai riwayat
  for (const id of ["vt-001", "vt-002", "vt-003", "vt-004", "vt-005", "vt-006", "vt-007"]) {
    const usage = await prisma.violationRecord.count({ where: { violationTypeId: id } });
    if (usage === 0) {
      await prisma.violationType.deleteMany({ where: { id } });
    } else {
      await prisma.violationType.updateMany({ where: { id }, data: { active: false } });
    }
  }

  // Bersihkan jenis nonaktif tanpa riwayat
  const inactive = await prisma.violationType.findMany({
    where: { active: false },
    select: { id: true, _count: { select: { records: true } } },
  });
  for (const row of inactive) {
    if (row._count.records === 0) {
      await prisma.violationType.delete({ where: { id: row.id } });
    }
  }

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
          { studentId: ahmad.id, violationTypeId: "vt-p15-049", points: 5, session: "Masuk Pagi", notes: "Kemacetan", date: new Date("2026-04-14"), createdByName: "Siti Rahayu" },
          { studentId: ahmad.id, violationTypeId: "vt-p15-072", points: 10, session: "Umum", date: new Date("2026-04-10"), createdByName: "Siti Rahayu" },
          { studentId: ahmad.id, violationTypeId: "vt-p15-012a", points: 20, session: "Jam 3-4", notes: "Barang disita", date: new Date("2026-04-03"), createdByName: "Siti Rahayu" },
          { studentId: ahmad.id, violationTypeId: "vt-p15-057", points: 20, session: "Jam 5-6", date: new Date("2026-03-22"), createdByName: "Siti Rahayu" },
        ],
      });
    }
  }

  if (rizky) {
    const existing = await prisma.violationRecord.count({ where: { studentId: rizky.id } });
    if (existing === 0) {
      await prisma.violationRecord.createMany({
        data: [
          { studentId: rizky.id, violationTypeId: "vt-p15-034a", points: 75, session: "Istirahat", notes: "Insiden di kantin", date: new Date("2026-04-15"), createdByName: "Drs. Hartanto" },
          { studentId: rizky.id, violationTypeId: "vt-p15-057", points: 20, session: "Jam 7-8", date: new Date("2026-04-08"), createdByName: "Siti Rahayu" },
          { studentId: rizky.id, violationTypeId: "vt-p15-012a", points: 20, session: "Jam 1-2", date: new Date("2026-04-02"), createdByName: "Siti Rahayu" },
          { studentId: rizky.id, violationTypeId: "vt-p15-072", points: 10, session: "Umum", date: new Date("2026-03-20"), createdByName: "Siti Rahayu" },
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
          violationTypeId: "vt-p15-057",
          points: 20,
          session: "Jam 3-4",
          notes: "Demo: pelanggaran terakhir >30 hari lalu",
          date: daysAgo(38),
          createdByName: "Sistem (seed)",
        },
        {
          studentId: demoTenang.id,
          violationTypeId: "vt-p15-012a",
          points: 20,
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
        violationTypeId: "vt-p15-034a",
        points: 75,
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
          violationTypeId: "vt-p15-027",
          points: 75,
          session: "Umum",
          notes: "Demo: histori lama",
          date: daysAgo(60),
          createdByName: "Sistem (seed)",
        },
        {
          studentId: demoManual.id,
          violationTypeId: "vt-p15-072",
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

  const appSettingSeeds: Record<string, string> = {
    redaksi_print:
      "Dengan ini menyatakan bahwa data poin pelanggaran di bawah merupakan catatan resmi sekolah sesuai tata tertib yang berlaku. Dokumen ini dapat digunakan untuk arsip orang tua/wali dan tindak lanjut pembinaan.",
    sp1_points: "",
    sp2_points: "",
    sp3_points: "",
    skorsing_points: "",
  };
  for (const [key, value] of Object.entries(appSettingSeeds)) {
    await prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  for (const t of DEFAULT_PRINT_TEMPLATES) {
    await prisma.printTemplate.upsert({
      where: { slug: t.slug },
      update: {
        title: t.title,
        body: plainTextToDocumentHtml(t.body),
        pageSettings: serializePageSettings(DEFAULT_PAGE_SETTINGS),
        sortOrder: t.sortOrder,
      },
      create: {
        slug: t.slug,
        title: t.title,
        body: plainTextToDocumentHtml(t.body),
        pageSettings: serializePageSettings(DEFAULT_PAGE_SETTINGS),
        sortOrder: t.sortOrder,
      },
    });
  }
  await prisma.appSetting.upsert({
    where: { key: "print_templates_layout_v" },
    update: { value: PRINT_TEMPLATES_LAYOUT_VERSION },
    create: { key: "print_templates_layout_v", value: PRINT_TEMPLATES_LAYOUT_VERSION },
  });

  await prisma.user.upsert({
    where: { email: "piket@sman1contoh.sch.id" },
    update: { role: Role.ADMIN, active: true },
    create: {
      email: "piket@sman1contoh.sch.id",
      name: "Bidang Pertahanan Sekolah",
      password: teacherPwd,
      role: Role.ADMIN,
      nip: "198201011990032001",
    },
  });
  await prisma.user.upsert({
    where: { email: "walas.mipa1@sman1contoh.sch.id" },
    update: { role: Role.TEACHER, classId: null, active: true },
    create: {
      email: "walas.mipa1@sman1contoh.sch.id",
      name: "Wali Kelas X MIPA 1",
      password: teacherPwd,
      role: Role.TEACHER,
      nip: "198303031990033001",
    },
  });

  console.log("✅ Seeding complete!");
  console.log("\nAkun Login:");
  console.log("Super Admin: admin@sman1contoh.sch.id / Admin@1234");
  console.log("Guru:        s.rahayu@sman1contoh.sch.id / Guru@1234");
  console.log("Admin:       piket@sman1contoh.sch.id / Guru@1234");
  console.log("Guru:        walas.mipa1@sman1contoh.sch.id / Guru@1234");
  console.log("Siswa:       0051234567@siswa.sman1contoh.sch.id / Siswa@1234");
  console.log("\nDemo pengurangan 25% (bulan tenang, password Siswa@1234):");
  console.log("  Ali (otomatis lewat logic): 0051111111@siswa.sman1contoh.sch.id");
  console.log("  Bima (masih ada pelanggaran baru, tanpa potongan): 0052222222@siswa.sman1contoh.sch.id");
  console.log("  Citra (potongan disimpan di seed sebagai bukti): 0053333333@siswa.sman1contoh.sch.id");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
