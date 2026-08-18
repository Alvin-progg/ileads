// RMA class summary: level tallies, per-task mastery, overall averages.
//
// The San Jose case reproduces the Class Summary sheet of
// files/Copy-of-RMA2_G3Scoresheet_v2-2025-2026.xlsx, which is the only RMA
// workbook with both raw scores and a filled summary.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRma } from "./rma.ts";
import { summariseRma, type RmaSummaryEntry, type Sex } from "./rma-summary.ts";
import { RMA_G1, RMA_G3 } from "./instruments.ts";

/** Builds an entry the way the Class Record page does: scores in, row out. */
function entry(sex: Sex, scores: Record<string, number> | null, rules = RMA_G3): RmaSummaryEntry {
  if (scores === null) {
    return { sex, total: null, percent: null, proficiencyLevel: null, taskMastery: {} };
  }
  const r = computeRma({ taskScores: scores }, rules);
  return {
    sex,
    total: r.total,
    percent: r.percent,
    proficiencyLevel: r.proficiencyLevel,
    taskMastery: r.taskMastery,
  };
}

const g3 = (sex: Sex, ...raw: number[]) =>
  entry(
    sex,
    Object.fromEntries(RMA_G3.tasks.map((t, i) => [t.key, raw[i] ?? 0]))
  );

function close(actual: number | null, expected: number, label: string) {
  assert.ok(actual !== null, `${label}: expected a number, got null`);
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${label}: expected ~${expected}, got ${actual}`
  );
}

const level = (s: ReturnType<typeof summariseRma>, label: string) =>
  s.levels.find((l) => l.label === label)!;

// ---------------------------------------------------------------------------
// Grade 3 — the fully configured instrument
// ---------------------------------------------------------------------------

test("level counts match a hand tally, split by sex", () => {
  // Totals chosen to land one learner in each band, plus a second Developing.
  const entries = [
    g3("M", 0, 0, 0, 0, 0, 0, 0, 4), //  4 -> 20% Emerging (Not Proficient)
    g3("F", 2, 1, 2, 0, 0, 0, 0, 0), //  5 -> 25% Emerging (Low Proficient)
    g3("M", 2, 1, 2, 3, 3, 2, 0, 0), // 13 -> 65% Developing
    g3("F", 2, 1, 2, 3, 2, 0, 0, 0), // 10 -> 50% Developing
    g3("F", 2, 1, 2, 3, 3, 2, 2, 0), // 15 -> 75% Transitioning
    g3("M", 2, 1, 2, 3, 3, 2, 3, 4), // 20 -> 100% At Grade Level
    entry("M", null),
    entry("F", null),
  ];

  const s = summariseRma(entries, RMA_G3);

  assert.equal(s.enrolled, 8);
  assert.equal(s.assessed, 6);
  assert.deepEqual(s.assessedBySex, { male: 3, female: 3, total: 6 });
  assert.deepEqual(s.enrolledBySex, { male: 4, female: 4, total: 8 });

  assert.deepEqual(level(s, "Emerging (Not Proficient)"), {
    label: "Emerging (Not Proficient)",
    male: 1,
    female: 0,
    total: 1,
  });
  assert.equal(level(s, "Emerging (Low Proficient)").female, 1);
  assert.equal(level(s, "Developing (Nearly Proficient)").total, 2);
  assert.equal(level(s, "Transitioning (Proficient)").female, 1);
  assert.equal(level(s, "At Grade Level (Highly Proficient)").male, 1);
});

test("no learner is lost: levels plus unlevelled equals assessed", () => {
  const entries = [
    g3("M", 2, 1, 2, 3, 3, 2, 3, 4),
    g3("F", 0, 0, 0, 0, 0, 0, 0, 0), // zero total: the instrument blanks it
    entry("M", null),
  ];

  const s = summariseRma(entries, RMA_G3);

  assert.equal(s.assessed, 2, "a zero-scoring learner was still assessed");
  assert.equal(s.unscored.total, 1);
  assert.equal(s.assessed + s.unscored.total, s.enrolled);

  const levelled = s.levels.reduce((n, l) => n + l.total, 0);
  assert.equal(levelled + s.unlevelled.total, s.assessed);
  assert.equal(s.unlevelled.female, 1, "the blanked row is visible, not dropped");
});

test("per-task mastery counts learners at or above the threshold", () => {
  // Task A is out of 2, so 2/2 masters and 1/2 does not at 75%.
  const entries = [
    g3("M", 2, 1, 0, 0, 0, 0, 0, 0),
    g3("F", 1, 1, 0, 0, 0, 0, 0, 0),
    g3("F", 2, 0, 0, 0, 0, 0, 0, 0),
  ];

  const s = summariseRma(entries, RMA_G3);
  const task = (label: string) => s.taskMastery.find((t) => t.label === label)!;

  assert.equal(s.masteryUnavailable, false);
  assert.deepEqual(task("Task A: Fractions"), {
    label: "Task A: Fractions",
    male: 1,
    female: 1,
    total: 2,
  });
  assert.equal(task("Task B: Mass Measurement").total, 2, "1/1 masters");
  assert.equal(task("Task H: Geometric Representation").total, 0, "nobody scored");
});

test("the overall average is the mean raw total, weighted across the class", () => {
  // Three males at 20 and one female at 4: the true mean is 16, not (20+4)/2.
  const entries = [
    g3("M", 2, 1, 2, 3, 3, 2, 3, 4),
    g3("M", 2, 1, 2, 3, 3, 2, 3, 4),
    g3("M", 2, 1, 2, 3, 3, 2, 3, 4),
    g3("F", 0, 0, 0, 0, 0, 0, 0, 4),
  ];

  const s = summariseRma(entries, RMA_G3);
  close(s.averageTotal.male, 20, "male");
  close(s.averageTotal.female, 4, "female");
  close(s.averageTotal.total, 16, "weighted total");
});

test("percents divide each band by that column's assessed learners", () => {
  const entries = [
    g3("M", 2, 1, 2, 3, 3, 2, 3, 4), // At Grade Level
    g3("M", 0, 0, 0, 0, 0, 0, 0, 4), // Emerging (Not Proficient)
    g3("F", 2, 1, 2, 3, 3, 2, 3, 4), // At Grade Level
  ];

  const s = summariseRma(entries, RMA_G3);
  const pct = (label: string) => s.percents.levels.find((l) => l.label === label)!;

  close(pct("At Grade Level (Highly Proficient)").male, 1 / 2, "male share");
  close(pct("At Grade Level (Highly Proficient)").female, 1, "female share");
  close(pct("At Grade Level (Highly Proficient)").total, 2 / 3, "total share");
  close(pct("Emerging (Not Proficient)").female, 0, "an empty band is 0%");
});

test("nothing encoded yields nulls rather than divide-by-zero", () => {
  const s = summariseRma([entry("M", null), entry("F", null)], RMA_G3);

  assert.equal(s.assessed, 0);
  assert.equal(s.averageTotal.total, null);
  for (const row of s.percents.levels) {
    assert.equal(row.male, null, `${row.label} male`);
    assert.equal(row.total, null, `${row.label} total`);
  }
});

// ---------------------------------------------------------------------------
// Grades 1-2 — task letters known, cut-offs and per-task maxima not
// ---------------------------------------------------------------------------

test("an unconfigured grade counts its learners but reports no level", () => {
  const g1 = (sex: Sex, ...raw: number[]) =>
    entry(
      sex,
      Object.fromEntries(RMA_G1.tasks.map((t, i) => [t.key, raw[i] ?? 0])),
      RMA_G1
    );

  const s = summariseRma([g1("M", 5, 4, 3), g1("F", 2, 1, 0), entry("F", null)], RMA_G1);

  assert.equal(s.assessed, 2, "raw scores still count as assessed");
  assert.equal(s.levels.length, 0, "no bands to tally into");
  assert.equal(s.unlevelled.total, 2);
  assert.equal(s.unlevelled.label, "Level not yet configured");
  assert.equal(s.assessed + s.unscored.total, s.enrolled);

  // The totals are still real: 12 and 3.
  close(s.averageTotal.male, 12, "male average");
  close(s.averageTotal.total, 7.5, "class average");
});

test("tasks with an unknown maximum report no mastery at all", () => {
  const g1 = entry("M", { A: 5, B: 4 }, RMA_G1);
  const s = summariseRma([g1], RMA_G1);

  assert.equal(s.masteryUnavailable, true);
  assert.deepEqual(s.taskMastery, [], "no zero rows that would read as failure");
});

// ---------------------------------------------------------------------------
// San Jose: the workbook's own Class Summary numbers
// ---------------------------------------------------------------------------

test("San Jose Grade 3 reproduces the workbook Class Summary", () => {
  // Rows 10-21 of the "G3 RMA Scoresheet" sheet, sex and Task A-H scores exactly
  // as recorded there: the first four learners male, the remaining eight female.
  const rows: [Sex, number[]][] = [
    ["M", [0, 1, 2, 3, 2, 1, 2, 2]], // 13
    ["M", [0, 1, 2, 2, 1, 0, 0, 1]], //  7
    ["M", [2, 0, 1, 3, 1, 1, 2, 3]], // 13
    ["M", [2, 1, 2, 3, 3, 2, 3, 4]], // 20
    ["F", [2, 0, 1, 3, 2, 0, 0, 3]], // 11
    ["F", [1, 0, 1, 1, 0, 0, 0, 0]], //  3
    ["F", [1, 0, 1, 1, 0, 0, 0, 0]], //  3
    ["F", [1, 0, 0, 1, 1, 0, 2, 3]], //  8
    ["F", [1, 0, 0, 2, 0, 0, 0, 3]], //  6
    ["F", [1, 1, 1, 3, 2, 1, 2, 3]], // 14
    ["F", [2, 0, 1, 3, 1, 1, 0, 2]], // 10
    ["F", [1, 0, 1, 1, 0, 0, 0, 0]], //  3
  ];

  const s = summariseRma(
    rows.map(([sex, raw]) => g3(sex, ...raw)),
    RMA_G3
  );

  assert.equal(s.assessed, 12);
  assert.deepEqual(s.assessedBySex, { male: 4, female: 8, total: 12 });

  // Class Summary row 11 (Male): 0 / 1 / 2 / 0 / 1.
  assert.equal(level(s, "Emerging (Not Proficient)").male, 0);
  assert.equal(level(s, "Emerging (Low Proficient)").male, 1);
  assert.equal(level(s, "Developing (Nearly Proficient)").male, 2);
  assert.equal(level(s, "Transitioning (Proficient)").male, 0);
  assert.equal(level(s, "At Grade Level (Highly Proficient)").male, 1);

  // Row 12 (Female): 3 / 2 / 3 / 0 / 0.
  assert.equal(level(s, "Emerging (Not Proficient)").female, 3);
  assert.equal(level(s, "Emerging (Low Proficient)").female, 2);
  assert.equal(level(s, "Developing (Nearly Proficient)").female, 3);
  assert.equal(level(s, "Transitioning (Proficient)").female, 0);
  assert.equal(level(s, "At Grade Level (Highly Proficient)").female, 0);

  // Row 14 (Total): 3 / 3 / 5 / 0 / 1.
  assert.equal(level(s, "Emerging (Not Proficient)").total, 3);
  assert.equal(level(s, "Emerging (Low Proficient)").total, 3);
  assert.equal(level(s, "Developing (Nearly Proficient)").total, 5);
  assert.equal(level(s, "Transitioning (Proficient)").total, 0);
  assert.equal(level(s, "At Grade Level (Highly Proficient)").total, 1);

  // Overall Score Average, cells W11 / W12 / W14.
  close(s.averageTotal.male, 13.25, "male average");
  close(s.averageTotal.female, 7.25, "female average");
  close(s.averageTotal.total, 9.25, "class average");

  // Per-task mastery, cells L11:S12 (learners at or above 75% of a task max).
  const task = (label: string) => s.taskMastery.find((t) => t.label === label)!;
  assert.deepEqual(
    [
      task("Task A: Fractions"),
      task("Task B: Mass Measurement"),
      task("Task D: Addition"),
    ].map((t) => [t.male, t.female]),
    [
      [2, 2],
      [3, 1],
      [3, 3],
    ]
  );
});
