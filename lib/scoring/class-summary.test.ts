// Class Summary: per-sex counts, Part 2 averages and the percent block.
//
// The counts themselves are covered in class-record.test.ts; this file covers
// what the district form adds on top of them. Expectations follow the
// workbook's Class Summary sheet, except where noted.

import { test } from "node:test";
import assert from "node:assert/strict";
import { summarise, type SummaryEntry } from "./class-summary.ts";
import { CRLA_G1 } from "./instruments.ts";

const entry = (over: Partial<SummaryEntry>): SummaryEntry => ({
  sex: "M",
  readingLevel: "Grade Ready",
  readingProfile: "Reading At Grade Level",
  fluency: null,
  comprehensionPercent: null,
  wpm: null,
  ...over,
});

function close(actual: number | null, expected: number, label: string) {
  assert.ok(actual !== null, `${label}: expected a number, got null`);
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${label}: expected ~${expected}, got ${actual}`
  );
}

const summary = (entries: SummaryEntry[]) => summarise(entries, CRLA_G1, "MT");

// ---------------------------------------------------------------------------
// Enrolled / assessed by sex
// ---------------------------------------------------------------------------

test("enrolled and assessed are reported per sex and reconcile with the class", () => {
  const s = summary([
    entry({ sex: "M" }),
    entry({ sex: "M" }),
    entry({ sex: "M", readingLevel: null, readingProfile: null }),
    entry({ sex: "F" }),
    entry({ sex: "F", readingLevel: null, readingProfile: null }),
  ]);

  assert.deepEqual(s.enrolledBySex, { male: 3, female: 2, total: 5 });
  assert.deepEqual(s.assessedBySex, { male: 2, female: 1, total: 3 });
  assert.equal(s.assessedBySex.total, s.assessed);
  assert.equal(s.assessedBySex.total + s.unscored.total, s.enrolledBySex.total);
});

// ---------------------------------------------------------------------------
// Averages
// ---------------------------------------------------------------------------

test("averages skip blank measures instead of counting them as zero", () => {
  // Three assessed learners, only two of whom read a passage.
  const s = summary([
    entry({ fluency: 0.8, comprehensionPercent: 0.6, wpm: 40 }),
    entry({ fluency: 0.6, comprehensionPercent: 0.4, wpm: 60 }),
    entry({ fluency: null, comprehensionPercent: null, wpm: null }),
  ]);

  close(s.averages.male.fluency, 0.7, "fluency");
  close(s.averages.male.comprehensionPercent, 0.5, "comprehension");
  close(s.averages.male.wpm, 50, "wpm");
});

test("a Full Refresher does not drag the averages down", () => {
  // Their measures arrive suppressed (null) from toClassRecordRow, so they
  // count towards assessed but not towards the averages.
  const s = summary([
    entry({ readingLevel: "Grade Ready", fluency: 0.9, wpm: 60 }),
    entry({
      readingLevel: "Full Refresher",
      readingProfile: "Low Emerging Reader",
      fluency: null,
      wpm: null,
    }),
  ]);

  assert.equal(s.assessed, 2);
  close(s.averages.total.fluency, 0.9, "fluency ignores the suppressed row");
  close(s.averages.total.wpm, 60, "wpm ignores the suppressed row");
});

test("an all-blank column averages to null, never NaN", () => {
  const s = summary([entry({}), entry({ sex: "F" })]);

  assert.equal(s.averages.male.fluency, null);
  assert.equal(s.averages.female.wpm, null);
  assert.equal(s.averages.total.comprehensionPercent, null);
});

test("the total average is the true mean, not the mean of the two sex means", () => {
  // The workbook computes Total as (male + female) / 2, which is wrong when
  // the sexes have different assessed counts. Three males at 90% and one
  // female at 50% average 80%, not 70%.
  const s = summary([
    entry({ sex: "M", fluency: 0.9 }),
    entry({ sex: "M", fluency: 0.9 }),
    entry({ sex: "M", fluency: 0.9 }),
    entry({ sex: "F", fluency: 0.5 }),
  ]);

  close(s.averages.male.fluency, 0.9, "male");
  close(s.averages.female.fluency, 0.5, "female");
  close(s.averages.total.fluency, 0.8, "weighted total");
});

test("a sex with nobody assessed leaves the total average intact", () => {
  // The workbook blanks the total here; a class of boys still has an average.
  const s = summary([entry({ sex: "M", wpm: 30 }), entry({ sex: "M", wpm: 50 })]);

  assert.equal(s.averages.female.wpm, null);
  close(s.averages.total.wpm, 40, "total");
});

// ---------------------------------------------------------------------------
// Percent block
// ---------------------------------------------------------------------------

test("percents divide each band by that column's assessed learners", () => {
  const s = summary([
    entry({ sex: "M", readingLevel: "Grade Ready" }),
    entry({ sex: "M", readingLevel: "Light Refresher", readingProfile: "Developing Reader" }),
    entry({ sex: "F", readingLevel: "Grade Ready" }),
    entry({ sex: "F", readingLevel: "Grade Ready" }),
    entry({ sex: "F", readingLevel: "Grade Ready" }),
  ]);

  const level = (label: string) => s.percents.levels.find((l) => l.label === label)!;

  close(level("Grade Ready").male, 1 / 2, "male Grade Ready");
  close(level("Grade Ready").female, 3 / 3, "female Grade Ready");
  close(level("Grade Ready").total, 4 / 5, "total Grade Ready");
  close(level("Light Refresher").male, 1 / 2, "male Light Refresher");
  close(level("Full Refresher").total, 0, "an empty band is 0%, not blank");

  const profile = (label: string) =>
    s.percents.profiles.find((p) => p.label === label)!;
  close(profile("Reading At Grade Level").total, 4 / 5, "profile share");
});

test("percents are null rather than a divide-by-zero when nobody was assessed", () => {
  const s = summary([
    entry({ sex: "M", readingLevel: null, readingProfile: null }),
    entry({ sex: "F", readingLevel: null, readingProfile: null }),
  ]);

  for (const row of [...s.percents.levels, ...s.percents.profiles]) {
    assert.equal(row.male, null, `${row.label} male`);
    assert.equal(row.female, null, `${row.label} female`);
    assert.equal(row.total, null, `${row.label} total`);
  }
});

test("every band keeps a percent row, in the instrument's order", () => {
  const s = summary([]);

  assert.deepEqual(
    s.percents.levels.map((l) => l.label),
    ["Full Refresher", "Moderate Refresher", "Light Refresher", "Grade Ready"]
  );
  assert.deepEqual(s.percents.profiles.map((p) => p.label), [
    "Low Emerging Reader",
    "High Emerging Reader",
    "Developing Reader",
    "Transitioning Reader",
    "Reading At Grade Level",
  ]);
});

// ---------------------------------------------------------------------------
// Counts still hold with the measures attached
// ---------------------------------------------------------------------------

test("adding measures does not disturb the counts", () => {
  const s = summary([
    entry({ sex: "M", readingLevel: "Full Refresher", readingProfile: "Low Emerging Reader" }),
    entry({ sex: "F", readingLevel: "Grade Ready", fluency: 0.9, wpm: 55 }),
    entry({ sex: "F", readingLevel: null, readingProfile: null }),
  ]);

  assert.equal(s.levels.find((l) => l.label === "Full Refresher")!.male, 1);
  assert.equal(s.levels.find((l) => l.label === "Grade Ready")!.female, 1);
  assert.equal(s.unscored.female, 1);
  assert.equal(
    s.levels.reduce((n, l) => n + l.total, 0),
    s.assessed,
    "level tally accounts for every assessed learner"
  );
});
