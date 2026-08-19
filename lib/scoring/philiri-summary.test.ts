// Phil-IRI class summary: Word Reading / Comprehension / Overall Level
// tallies, split by sex.
//
// No supplied file has both raw Phil-IRI scores and a filled Summary sheet
// for one class (files/SY-2022-2023-Phil-IRI-Pre-Test-Result.xlsx's Summary
// sheet is a school-wide, cross-grade rollup, not a single class), so unlike
// rma-summary.test.ts's "San Jose" case there is no one sheet to reproduce
// end to end. Each entry below is still computed from real, Excel-verified
// rows (see philiri.test.ts) — only the roster composition (who is in the
// same class) is synthetic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computePhiliri } from "./philiri.ts";
import { summarisePhiliri, type PhiliriSummaryEntry, type Sex } from "./philiri-summary.ts";
import { PHILIRI_G5 } from "./instruments.ts";

const RULES = PHILIRI_G5.languages.ENG;

function entry(
  sex: Sex,
  scores: { words: number; miscues: number; items: number; correct: number } | null
): PhiliriSummaryEntry {
  if (scores === null) {
    return { sex, wordReadingLevel: null, comprehensionLevel: null, overallLevel: null };
  }
  const r = computePhiliri(
    {
      wordCount: scores.words,
      miscues: scores.miscues,
      comprehensionItems: scores.items,
      comprehensionCorrect: scores.correct,
    },
    RULES
  );
  return {
    sex,
    wordReadingLevel: r.wordReadingLevel,
    comprehensionLevel: r.comprehensionLevel,
    overallLevel: r.overallLevel,
  };
}

const overall = (s: ReturnType<typeof summarisePhiliri>, label: string) =>
  s.overallLevels.find((l) => l.label === label)!;

test("level counts match a hand tally, split by sex", () => {
  const entries = [
    // Francis Golocino (M): WRS 97.3% Independent, CS 60% Instructional -> Instructional.
    entry("M", { words: 37, miscues: 1, items: 5, correct: 3 }),
    // Mico De Ocampo (M): WRS 94.9% Instructional, CS 33.3% Frustration -> Frustration.
    entry("M", { words: 59, miscues: 3, items: 6, correct: 2 }),
    // Samantha Ejorpe (F): WRS 100% Independent, CS 100% Independent -> Independent.
    entry("F", { words: 59, miscues: 0, items: 6, correct: 6 }),
    entry("M", null),
    entry("F", null),
  ];

  const s = summarisePhiliri(entries);

  assert.equal(s.enrolled, 5);
  assert.equal(s.assessed, 3);
  assert.deepEqual(s.assessedBySex, { male: 2, female: 1, total: 3 });
  assert.deepEqual(s.enrolledBySex, { male: 3, female: 2, total: 5 });
  assert.equal(s.unscored.total, 2);

  assert.equal(overall(s, "Independent").female, 1);
  assert.equal(overall(s, "Instructional").male, 1);
  assert.equal(overall(s, "Frustration").male, 1);
});

test("no learner is lost: overall levels plus unscored equals enrolled", () => {
  const entries = [
    entry("M", { words: 37, miscues: 1, items: 5, correct: 3 }),
    entry("F", null),
    entry("F", null),
  ];

  const s = summarisePhiliri(entries);

  assert.equal(s.assessed + s.unscored.total, s.enrolled);
  const tallied = s.overallLevels.reduce((n, l) => n + l.total, 0);
  assert.equal(tallied, s.assessed);
});

test("word reading and comprehension tallies stand on their own axis, not just overall", () => {
  const entries = [
    // Independent word reading, Instructional comprehension.
    entry("M", { words: 37, miscues: 1, items: 5, correct: 3 }),
  ];

  const s = summarisePhiliri(entries);
  const wordLevel = (label: string) => s.wordReadingLevels.find((l) => l.label === label)!;
  const compLevel = (label: string) => s.comprehensionLevels.find((l) => l.label === label)!;

  assert.equal(wordLevel("Independent").total, 1);
  assert.equal(compLevel("Instructional").total, 1);
  assert.equal(overall(s, "Instructional").total, 1, "overall takes the worse of the two");
});

test("percents divide each band by that column's assessed learners", () => {
  const entries = [
    entry("M", { words: 59, miscues: 0, items: 6, correct: 6 }), // Independent
    entry("M", { words: 59, miscues: 3, items: 6, correct: 2 }), // Frustration
    entry("F", { words: 59, miscues: 0, items: 6, correct: 6 }), // Independent
  ];

  const s = summarisePhiliri(entries);
  const pct = (label: string) => s.percents.overallLevels.find((l) => l.label === label)!;

  assert.equal(pct("Independent").male, 0.5);
  assert.equal(pct("Independent").female, 1);
  assert.equal(pct("Frustration").male, 0.5);
  assert.equal(pct("Independent").total, 2 / 3);
});

test("nothing encoded yields empty tallies and no unscored crash", () => {
  const s = summarisePhiliri([entry("M", null), entry("F", null)]);

  assert.equal(s.assessed, 0);
  assert.equal(s.unscored.total, 2);
  for (const row of s.overallLevels) {
    assert.equal(row.total, 0);
  }
  for (const row of s.percents.overallLevels) {
    assert.equal(row.male, null);
    assert.equal(row.total, null);
  }
});
