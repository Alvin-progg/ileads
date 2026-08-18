// RMA Grade 3 — verified against REAL EXCEL OUTPUT.
//
// Every expected total, percentage and level below is the value Excel itself
// cached in FIles/Copy-of-RMA2_G3Scoresheet_v2-2025-2026.xlsx (San Jose ES,
// School ID 107461, BoSY, 12 learners, sheet "G3 RMA Scoresheet" rows 10-21).
// Nothing here was derived by hand — if the engine disagrees with these, the
// engine is wrong, not the fixture.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRma } from "./rma.ts";
import { RMA_G3 } from "./instruments.ts";
import type { RmaInput } from "./types.ts";

const TASK_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

/** Builds an input from scores listed in Task A-H order. */
function scores(...values: number[]): RmaInput {
  return {
    taskScores: Object.fromEntries(TASK_KEYS.map((k, i) => [k, values[i]])),
  };
}

/** Excel caches binary-float artifacts (0.55000000000000004), so compare loosely. */
function assertClose(actual: number | null, expected: number, label: string) {
  assert.ok(actual !== null, `${label}: expected a number, got null`);
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${label}: expected ~${expected}, got ${actual}`
  );
}

const EXCEL_ROWS: {
  row: number;
  raw: number[];
  total: number;
  percent: number;
  level: string;
  note?: string;
}[] = [
  { row: 10, raw: [0, 1, 2, 3, 2, 1, 2, 2], total: 13, percent: 0.65, level: "Developing (Nearly Proficient)" },
  { row: 11, raw: [0, 1, 2, 2, 1, 0, 0, 1], total: 7, percent: 0.35, level: "Emerging (Low Proficient)" },
  { row: 12, raw: [2, 0, 1, 3, 1, 1, 2, 3], total: 13, percent: 0.65, level: "Developing (Nearly Proficient)" },
  {
    row: 13,
    raw: [2, 1, 2, 3, 3, 2, 3, 4],
    total: 20,
    percent: 1.0,
    level: "At Grade Level (Highly Proficient)",
    note: "perfect score — top band, open-ended upper bound",
  },
  {
    row: 14,
    raw: [2, 0, 1, 3, 2, 0, 0, 3],
    total: 11,
    percent: 0.55000000000000004,
    level: "Developing (Nearly Proficient)",
    note: "Excel cached a float artifact for 11/20",
  },
  { row: 15, raw: [1, 0, 1, 1, 0, 0, 0, 0], total: 3, percent: 0.15, level: "Emerging (Not Proficient)" },
  { row: 16, raw: [1, 0, 1, 1, 0, 0, 0, 0], total: 3, percent: 0.15, level: "Emerging (Not Proficient)" },
  { row: 17, raw: [1, 0, 0, 1, 1, 0, 2, 3], total: 8, percent: 0.4, level: "Emerging (Low Proficient)" },
  { row: 18, raw: [1, 0, 0, 2, 0, 0, 0, 3], total: 6, percent: 0.3, level: "Emerging (Low Proficient)" },
  { row: 19, raw: [1, 1, 1, 3, 2, 1, 2, 3], total: 14, percent: 0.7, level: "Developing (Nearly Proficient)" },
  {
    row: 20,
    raw: [2, 0, 1, 3, 1, 1, 0, 2],
    total: 10,
    percent: 0.5,
    level: "Developing (Nearly Proficient)",
    note: "EXACTLY on the 50% cut — Excel resolves upward, so the band is >=0.50 not >0.50",
  },
  { row: 21, raw: [1, 0, 1, 1, 0, 0, 0, 0], total: 3, percent: 0.15, level: "Emerging (Not Proficient)" },
];

for (const fixture of EXCEL_ROWS) {
  const suffix = fixture.note ? ` (${fixture.note})` : "";
  test(`RMA G3 row ${fixture.row} matches Excel${suffix}`, () => {
    const result = computeRma(scores(...fixture.raw), RMA_G3);
    assert.equal(result.total, fixture.total, "total");
    assertClose(result.percent, fixture.percent, "percent");
    assert.equal(result.proficiencyLevel, fixture.level, "proficiency level");
  });
}

test("RMA G3 per-task mastery flags match Excel", () => {
  // Flags read directly from the workbook's hidden Y..AF helper columns.
  const cases: { row: number; raw: number[]; flags: number[] }[] = [
    { row: 10, raw: [0, 1, 2, 3, 2, 1, 2, 2], flags: [0, 1, 1, 1, 0, 0, 0, 0] },
    { row: 12, raw: [2, 0, 1, 3, 1, 1, 2, 3], flags: [1, 0, 0, 1, 0, 0, 0, 1] },
    { row: 13, raw: [2, 1, 2, 3, 3, 2, 3, 4], flags: [1, 1, 1, 1, 1, 1, 1, 1] },
    { row: 14, raw: [2, 0, 1, 3, 2, 0, 0, 3], flags: [1, 0, 0, 1, 0, 0, 0, 1] },
    { row: 15, raw: [1, 0, 1, 1, 0, 0, 0, 0], flags: [0, 0, 0, 0, 0, 0, 0, 0] },
    // Task H = 3/4 = exactly 75%: the mastery flag fires at the boundary.
    { row: 17, raw: [1, 0, 0, 1, 1, 0, 2, 3], flags: [0, 0, 0, 0, 0, 0, 0, 1] },
    { row: 19, raw: [1, 1, 1, 3, 2, 1, 2, 3], flags: [0, 1, 0, 1, 0, 0, 0, 1] },
  ];

  for (const c of cases) {
    const { taskMastery } = computeRma(scores(...c.raw), RMA_G3);
    const actual = TASK_KEYS.map((k) => (taskMastery[k] ? 1 : 0));
    assert.deepEqual(actual, c.flags, `row ${c.row} mastery flags`);
  }
});

test("a zero total yields no percentage and no level, as the instrument does", () => {
  // Specified by the formula (percentage is gated on total > 0) but unexercised
  // by the real data, so it is asserted explicitly rather than assumed.
  const result = computeRma(scores(0, 0, 0, 0, 0, 0, 0, 0), RMA_G3);
  assert.equal(result.total, 0);
  assert.equal(result.percent, null);
  assert.equal(result.proficiencyLevel, null);
});

test("missing task scores count as zero rather than blocking scoring", () => {
  const result = computeRma({ taskScores: { A: 2, B: 1 } }, RMA_G3);
  assert.equal(result.total, 3);
  assertClose(result.percent, 0.15, "percent");
  assert.equal(result.proficiencyLevel, "Emerging (Not Proficient)");
});

test("proficiency band boundaries land on the documented side", () => {
  // Raw totals chosen to sit exactly on each cut: 5/20=25%, 10/20=50%,
  // 15/20=75%, 17/20=85%. All are exact in binary floating point.
  const at = (total: number) => {
    // Spread an arbitrary total across tasks within their maxima.
    const maxima = RMA_G3.tasks.map((t) => t.max);
    const out: number[] = [];
    let left = total;
    for (const m of maxima) {
      const take = Math.min(m, left);
      out.push(take);
      left -= take;
    }
    return computeRma(scores(...out), RMA_G3).proficiencyLevel;
  };

  assert.equal(at(4), "Emerging (Not Proficient)", "20% below the 25% cut");
  assert.equal(at(5), "Emerging (Low Proficient)", "exactly 25%");
  assert.equal(at(9), "Emerging (Low Proficient)", "45%, below the 50% cut");
  assert.equal(at(10), "Developing (Nearly Proficient)", "exactly 50%");
  assert.equal(at(14), "Developing (Nearly Proficient)", "70%, below the 75% cut");
  assert.equal(at(15), "Transitioning (Proficient)", "exactly 75%");
  assert.equal(at(16), "Transitioning (Proficient)", "80%, below the 85% cut");
  assert.equal(at(17), "At Grade Level (Highly Proficient)", "exactly 85%");
  assert.equal(at(20), "At Grade Level (Highly Proficient)", "100%");
});
