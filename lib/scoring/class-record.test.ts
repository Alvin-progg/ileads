// Class Record derivation and the class tally.
//
// Like crla.test.ts, expectations here follow the workbook's formulas rather
// than cached Excel output, since no filled CRLA scoresheet exists.

import { test } from "node:test";
import assert from "node:assert/strict";
import { toClassRecordRow } from "./class-record.ts";
import { summarise, type Sex } from "./class-summary.ts";
import { CRLA_G1, CRLA_G2, CRLA_G3 } from "./instruments.ts";
import type { CrlaInput } from "./types.ts";

const BLANK: CrlaInput = {
  task1: null,
  task2Low: null,
  task2High: null,
  storyNo: null,
  miscues: null,
  readingSeconds: null,
  comprehensionCorrect: null,
};
const input = (over: Partial<CrlaInput>): CrlaInput => ({ ...BLANK, ...over });

function close(actual: number | null, expected: number, label: string) {
  assert.ok(actual !== null, `${label}: expected a number, got null`);
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${label}: expected ~${expected}, got ${actual}`
  );
}

// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------

test("a Full Refresher reports no fluency, comprehension or WPM", () => {
  // Reading data is present, but the learner never cleared Part 1, so the
  // record leaves those cells blank.
  const row = toClassRecordRow(
    input({
      task1: 2,
      task2Low: 3, // total 5 -> Full Refresher
      storyNo: 1,
      miscues: 0,
      readingSeconds: 60,
      comprehensionCorrect: 5,
    }),
    CRLA_G1,
    "MT"
  );

  assert.equal(row.readingLevel, "Full Refresher");
  assert.equal(row.fluency, null);
  assert.equal(row.comprehensionPercent, null);
  assert.equal(row.wpm, null);
  // The level and its percentage are still reported.
  close(row.percentScore, 5 / 30, "percentScore");
});

test("a Grade 1 Moderate Refresher keeps its reading measures despite the profile gate", () => {
  // The two rules deliberately disagree: the profile ladder gates Moderate
  // Refresher to Low Emerging Reader, but the Class Record does not suppress it.
  const row = toClassRecordRow(
    input({
      task1: 6,
      task2Low: 10, // total 16 -> Moderate Refresher
      storyNo: 1,
      miscues: 0,
      readingSeconds: 60,
      comprehensionCorrect: 5,
    }),
    CRLA_G1,
    "MT"
  );

  assert.equal(row.readingLevel, "Moderate Refresher");
  assert.equal(row.readingProfile, "Low Emerging Reader", "gated by the ladder");
  close(row.fluency, 1, "fluency still reported");
  close(row.comprehensionPercent, 1, "comprehension still reported");
  close(row.wpm, 51, "WPM still reported");
});

test("suppression applies uniformly across grades", () => {
  // Grade 2's sheet has a copy-paste error that never suppresses its WPM; the
  // rule is applied consistently here instead.
  for (const [name, rules] of [
    ["G1", CRLA_G1],
    ["G2", CRLA_G2],
    ["G3", CRLA_G3],
  ] as const) {
    const row = toClassRecordRow(
      input({ task1: 1, task2Low: 1, storyNo: 1, miscues: 0, readingSeconds: 60 }),
      rules,
      "MT"
    );
    assert.equal(row.readingLevel, "Full Refresher", `${name} level`);
    assert.equal(row.wpm, null, `${name} WPM suppressed`);
    assert.equal(row.fluency, null, `${name} fluency suppressed`);
  }
});

// ---------------------------------------------------------------------------
// Denominators
// ---------------------------------------------------------------------------

test("percent score divides by the instrument's own maximum", () => {
  // Mother tongue is out of 30; Grade 3 English is out of 20.
  const mt = toClassRecordRow(
    input({ task1: 10, task2High: 10 }), // 10 + 10 credit + 10 = 30
    CRLA_G3,
    "MT"
  );
  close(mt.percentScore, 1, "MT full marks");

  const eng = toClassRecordRow(input({ task1: 10, task2Low: 10 }), CRLA_G3, "ENG");
  assert.equal(eng.part1Total, 20);
  close(eng.percentScore, 1, "ENG full marks out of 20");

  const engHalf = toClassRecordRow(input({ task1: 10, task2Low: 0 }), CRLA_G3, "ENG");
  close(engHalf.percentScore, 10 / 20, "ENG half marks");
});

test("comprehension percent divides by the grade's question count", () => {
  const ungated = { task1: 10, task2High: 10, storyNo: 1, miscues: 0 };

  close(
    toClassRecordRow(input({ ...ungated, comprehensionCorrect: 5 }), CRLA_G1, "MT")
      .comprehensionPercent,
    5 / 5,
    "G1 is out of 5"
  );
  close(
    toClassRecordRow(input({ ...ungated, comprehensionCorrect: 3 }), CRLA_G2, "MT")
      .comprehensionPercent,
    3 / 6,
    "G2 is out of 6"
  );
  close(
    toClassRecordRow(input({ ...ungated, comprehensionCorrect: 7 }), CRLA_G3, "MT")
      .comprehensionPercent,
    7 / 7,
    "G3 mother tongue is out of 7"
  );
  close(
    toClassRecordRow(input({ ...ungated, comprehensionCorrect: 3 }), CRLA_G3, "ENG")
      .comprehensionPercent,
    3 / 6,
    "G3 English is out of 6"
  );
});

test("an unscored learner reports nothing rather than zero", () => {
  const row = toClassRecordRow(BLANK, CRLA_G1, "MT");
  assert.equal(row.part1Total, null);
  assert.equal(row.readingLevel, null);
  assert.equal(row.percentScore, null);
  assert.equal(row.readingProfile, null);
});

// ---------------------------------------------------------------------------
// Class summary
// ---------------------------------------------------------------------------

const entry = (sex: Sex, readingLevel: string | null, readingProfile: string | null) => ({
  sex,
  readingLevel,
  readingProfile,
});

test("counts match a hand tally, split by sex", () => {
  // Hand tally of the ten learners below:
  //   Full Refresher      M1 F1  = 2
  //   Moderate Refresher  M1 F0  = 1
  //   Light Refresher     M0 F2  = 2
  //   Grade Ready         M2 F1  = 3
  //   not yet assessed    M1 F1  = 2
  const entries = [
    entry("M", "Full Refresher", "Low Emerging Reader"),
    entry("F", "Full Refresher", "Low Emerging Reader"),
    entry("M", "Moderate Refresher", "Low Emerging Reader"),
    entry("F", "Light Refresher", "Developing Reader"),
    entry("F", "Light Refresher", "Transitioning Reader"),
    entry("M", "Grade Ready", "Reading At Grade Level"),
    entry("M", "Grade Ready", "Reading At Grade Level"),
    entry("F", "Grade Ready", "Transitioning Reader"),
    entry("M", null, null),
    entry("F", null, null),
  ];

  const s = summarise(entries, CRLA_G1, "MT");
  const level = (label: string) => s.levels.find((l) => l.label === label)!;

  assert.deepEqual(level("Full Refresher"), {
    label: "Full Refresher",
    male: 1,
    female: 1,
    total: 2,
  });
  assert.deepEqual(level("Moderate Refresher"), {
    label: "Moderate Refresher",
    male: 1,
    female: 0,
    total: 1,
  });
  assert.deepEqual(level("Light Refresher"), {
    label: "Light Refresher",
    male: 0,
    female: 2,
    total: 2,
  });
  assert.deepEqual(level("Grade Ready"), {
    label: "Grade Ready",
    male: 2,
    female: 1,
    total: 3,
  });

  const profile = (label: string) => s.profiles.find((p) => p.label === label)!;
  assert.equal(profile("Low Emerging Reader").total, 3);
  assert.equal(profile("Transitioning Reader").total, 2);
  assert.equal(profile("Reading At Grade Level").total, 2);
  assert.equal(profile("Developing Reader").total, 1);
  assert.equal(profile("High Emerging Reader").total, 0, "empty bands still appear");
});

test("no learner is lost: assessed plus unscored equals the class", () => {
  const entries = [
    entry("M", "Grade Ready", "Reading At Grade Level"),
    entry("F", null, null),
    entry("M", null, null),
  ];

  const s = summarise(entries, CRLA_G1, "MT");
  assert.equal(s.enrolled, 3);
  assert.equal(s.assessed, 1);
  assert.equal(s.unscored.total, 2);
  assert.equal(s.assessed + s.unscored.total, s.enrolled);

  const levelTotal = s.levels.reduce((n, l) => n + l.total, 0);
  assert.equal(levelTotal, s.assessed, "level tally accounts for every assessed learner");
});

test("every band the instrument can produce gets a row, even at zero", () => {
  const s = summarise([], CRLA_G1, "MT");

  assert.deepEqual(
    s.levels.map((l) => l.label),
    ["Full Refresher", "Moderate Refresher", "Light Refresher", "Grade Ready"]
  );
  assert.deepEqual(s.profiles.map((p) => p.label), [
    "Low Emerging Reader",
    "High Emerging Reader",
    "Developing Reader",
    "Transitioning Reader",
    "Reading At Grade Level",
  ]);
  assert.ok(s.levels.every((l) => l.total === 0));
});

test("a learner with a level but no passage read counts in levels only", () => {
  // Part 1 done, Part 2 not attempted: the profile tally legitimately totals
  // less than the level tally.
  const s = summarise([entry("M", "Grade Ready", null)], CRLA_G1, "MT");
  assert.equal(s.assessed, 1);
  assert.equal(s.levels.find((l) => l.label === "Grade Ready")!.total, 1);
  assert.equal(s.profiles.reduce((n, p) => n + p.total, 0), 0);
});
