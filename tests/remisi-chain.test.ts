import test from "node:test";
import assert from "node:assert/strict";
import { addMonthsClampYmd, computeRemisiPlan, type RemisiAdjustmentInput } from "../lib/remisi-chain";
import { buildQuietMonthReason } from "../lib/point-adjustment-reason";

function adj(partial: Partial<RemisiAdjustmentInput> & Pick<RemisiAdjustmentInput, "id" | "reason" | "pointsDelta" | "effectiveYmd">): RemisiAdjustmentInput {
  return {
    createdYmd: partial.effectiveYmd,
    reversalOfId: null,
    ...partial,
  };
}

test("addMonthsClamp: akhir bulan dan tahun kabisat", () => {
  assert.equal(addMonthsClampYmd("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonthsClampYmd("2026-01-31", 2), "2026-03-31");
  assert.equal(addMonthsClampYmd("2024-01-31", 1), "2024-02-29");
});

test("rantai dua tahap dari 100 poin", () => {
  const plan = computeRemisiPlan({
    incidents: [{ ymd: "2026-08-19", points: 100 }],
    adjustments: [],
    todayYmd: "2026-10-19",
  });
  assert.equal(plan.toReverse.length, 0);
  assert.deepEqual(
    plan.toCreate.map((s) => ({ step: s.step, dueYmd: s.dueYmd, pointsDelta: s.pointsDelta })),
    [
      { step: 1, dueYmd: "2026-09-19", pointsDelta: -25 },
      { step: 2, dueYmd: "2026-10-19", pointsDelta: -19 },
    ]
  );
});

test("pembulatan ke atas sampai poin 0", () => {
  const one = computeRemisiPlan({
    incidents: [{ ymd: "2026-08-19", points: 1 }],
    adjustments: [],
    todayYmd: "2026-09-19",
  });
  assert.equal(one.toCreate.length, 1);
  assert.equal(one.toCreate[0]!.pointsDelta, -1);

  const plan = computeRemisiPlan({
    incidents: [{ ymd: "2024-01-15", points: 100 }],
    adjustments: [],
    todayYmd: "2025-03-15",
  });
  const remainders: number[] = [];
  let eff = 100;
  for (const s of plan.toCreate) {
    eff += s.pointsDelta;
    remainders.push(eff);
  }
  assert.deepEqual(remainders, [75, 56, 42, 31, 23, 17, 12, 9, 6, 4, 3, 2, 1, 0]);
  assert.equal(plan.toCreate.length, 14);
  const last = plan.toCreate[13]!;
  assert.equal(last.effectiveBefore + last.pointsDelta, 0);
});

test("pelanggaran tepat di tanggal due tidak membatalkan tahap", () => {
  const plan = computeRemisiPlan({
    incidents: [
      { ymd: "2026-08-19", points: 100 },
      { ymd: "2026-09-19", points: 10 },
    ],
    adjustments: [],
    todayYmd: "2026-09-20",
  });
  assert.equal(plan.toCreate.length, 1);
  assert.equal(plan.toCreate[0]!.anchorYmd, "2026-08-19");
  assert.equal(plan.toCreate[0]!.step, 1);
  assert.equal(plan.toCreate[0]!.dueYmd, "2026-09-19");
  assert.equal(plan.next?.anchorYmd, "2026-09-19");
  assert.equal(plan.next?.step, 1);
});

test("rantai putus bila ada pelanggaran di antara anchor dan due", () => {
  const plan = computeRemisiPlan({
    incidents: [
      { ymd: "2026-08-19", points: 100 },
      { ymd: "2026-10-10", points: 5 },
    ],
    adjustments: [],
    todayYmd: "2026-10-20",
  });
  assert.equal(plan.toCreate.length, 1);
  assert.equal(plan.toCreate[0]!.anchorYmd, "2026-08-19");
  assert.equal(plan.toCreate[0]!.step, 1);
  assert.equal(plan.toCreate[0]!.dueYmd, "2026-09-19");
  assert.equal(plan.toCreate.some((s) => s.step === 2), false);
});

test("input susulan membatalkan tahap yang jadi tidak sah", () => {
  const plan = computeRemisiPlan({
    incidents: [
      { ymd: "2026-08-19", points: 100 },
      { ymd: "2026-10-10", points: 5 },
    ],
    adjustments: [
      adj({
        id: "s2",
        reason: buildQuietMonthReason("2026-08-19", 2),
        pointsDelta: -19,
        effectiveYmd: "2026-10-19",
      }),
    ],
    todayYmd: "2026-10-20",
  });
  const rev = plan.toReverse.find((r) => r.step === 2);
  assert.ok(rev);
  assert.equal(rev!.adjustmentId, "s2");
  assert.match(rev!.sebab, /2026-10-10/);
});

test("hapus pelanggaran anchor membatalkan tahapnya dan membuat tahap anchor sebelumnya", () => {
  const plan = computeRemisiPlan({
    incidents: [{ ymd: "2026-06-19", points: 100 }],
    adjustments: [
      adj({
        id: "lama",
        reason: buildQuietMonthReason("2026-08-19", 1),
        pointsDelta: -25,
        effectiveYmd: "2026-09-19",
      }),
    ],
    todayYmd: "2026-10-19",
  });
  assert.equal(plan.toReverse.length, 1);
  assert.equal(plan.toReverse[0]!.adjustmentId, "lama");
  assert.match(plan.toReverse[0]!.sebab, /berubah\/dihapus/);
  assert.deepEqual(
    plan.toCreate.map((s) => s.dueYmd),
    ["2026-07-19", "2026-08-19", "2026-09-19", "2026-10-19"]
  );
  assert.ok(plan.toCreate.every((s) => s.anchorYmd === "2026-06-19"));
});

test("remisi manual mengecilkan tahap berikutnya tanpa memutus rantai", () => {
  const plan = computeRemisiPlan({
    incidents: [{ ymd: "2026-08-19", points: 100 }],
    adjustments: [
      adj({
        id: "m1",
        reason: "MANUAL_CUSTOM|asOf:2026-09-25|Prestasi|",
        pointsDelta: -10,
        effectiveYmd: "2026-09-25",
      }),
    ],
    todayYmd: "2026-10-19",
  });
  assert.equal(plan.toReverse.length, 0);
  assert.equal(plan.toCreate[0]!.step, 1);
  assert.equal(plan.toCreate[0]!.pointsDelta, -25);
  assert.equal(plan.toCreate[1]!.step, 2);
  assert.equal(plan.toCreate[1]!.pointsDelta, -17);
});

test("baris lama tanpa step dianggap tahap 1 dan tidak pernah dibatalkan", () => {
  const kept = computeRemisiPlan({
    incidents: [{ ymd: "2026-08-19", points: 100 }],
    adjustments: [
      adj({
        id: "legacy",
        reason: "QUIET_MONTH_REDUCTION|anchor=2026-08-19",
        pointsDelta: -25,
        effectiveYmd: "2026-09-19",
      }),
    ],
    todayYmd: "2026-10-19",
  });
  assert.equal(kept.toReverse.length, 0);
  assert.equal(kept.toCreate.some((s) => s.step === 1), false);
  assert.equal(kept.toCreate.find((s) => s.step === 2)?.pointsDelta, -19);

  const invalid = computeRemisiPlan({
    incidents: [
      { ymd: "2026-08-19", points: 100 },
      { ymd: "2026-08-25", points: 1 },
    ],
    adjustments: [
      adj({
        id: "legacy",
        reason: "QUIET_MONTH_REDUCTION|anchor=2026-08-19",
        pointsDelta: -25,
        effectiveYmd: "2026-09-19",
      }),
    ],
    todayYmd: "2026-10-19",
  });
  assert.equal(invalid.toReverse.length, 0);
  assert.equal(invalid.toCreate.some((s) => s.anchorYmd === "2026-08-19"), false);
});

test("idempoten setelah toCreate diterapkan", () => {
  const first = computeRemisiPlan({
    incidents: [{ ymd: "2026-08-19", points: 100 }],
    adjustments: [],
    todayYmd: "2026-10-19",
  });
  const applied = first.toCreate.map((s, i) =>
    adj({
      id: `c${i}`,
      reason: buildQuietMonthReason(s.anchorYmd, s.step),
      pointsDelta: s.pointsDelta,
      effectiveYmd: s.dueYmd,
    })
  );
  const second = computeRemisiPlan({
    incidents: [{ ymd: "2026-08-19", points: 100 }],
    adjustments: applied,
    todayYmd: "2026-10-19",
  });
  assert.equal(second.toCreate.length, 0);
  assert.equal(second.toReverse.length, 0);
});

test("nominal tahap yang sudah tercatat tidak berubah meski ada remisi manual setelahnya", () => {
  const plan = computeRemisiPlan({
    incidents: [{ ymd: "2026-08-19", points: 100 }],
    adjustments: [
      adj({
        id: "s1",
        reason: buildQuietMonthReason("2026-08-19", 1),
        pointsDelta: -25,
        effectiveYmd: "2026-09-19",
      }),
      adj({
        id: "m1",
        reason: "MANUAL_CUSTOM|asOf:2026-09-25|Prestasi|",
        pointsDelta: -10,
        effectiveYmd: "2026-09-25",
      }),
    ],
    todayYmd: "2026-10-19",
  });
  assert.equal(plan.toReverse.some((r) => r.adjustmentId === "s1"), false);
  assert.equal(plan.toCreate.some((s) => s.step === 1), false);
  assert.equal(plan.toCreate.find((s) => s.step === 2)?.pointsDelta, -17);
});

test("baris lama catch-up yang dibuat terlambat dihitung pada jatuh tempo tahap 1", () => {
  const plan = computeRemisiPlan({
    incidents: [
      { ymd: "2026-01-01", points: 100 },
      { ymd: "2026-05-01", points: 0 },
    ],
    adjustments: [
      {
        id: "L1",
        reason: "QUIET_MONTH_REDUCTION|anchor=2026-01-01",
        pointsDelta: -25,
        effectiveYmd: "2026-06-10",
        createdYmd: "2026-06-10",
        reversalOfId: null,
      },
    ],
    todayYmd: "2026-07-01",
  });
  assert.deepEqual(
    plan.toCreate.map((s) => [s.anchorYmd, s.step, s.dueYmd, s.effectiveBefore, s.pointsDelta]),
    [
      ["2026-01-01", 2, "2026-03-01", 75, -19],
      ["2026-01-01", 3, "2026-04-01", 56, -14],
      ["2026-01-01", 4, "2026-05-01", 42, -11],
      ["2026-05-01", 1, "2026-06-01", 31, -8],
      ["2026-05-01", 2, "2026-07-01", 23, -6],
    ]
  );
});
