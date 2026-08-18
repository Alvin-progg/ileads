// Exam class statistics: Mean, population SD, MPS by sex.
//
// The Panay case reproduces files/PANAY-ES-MPS-SY-2025-2026.xlsx, sheet
// "GMRC", Grade 1, First Quarter row: Mean 24.71, MPS Male 86.67 / Female
// 79.17 / Total 82.38, back-solved to HPS 30 (Mean x 100 / MPS). The workbook
// has no raw scores, so these are dummy scores chosen to reproduce those exact
// three numbers, not a transcription.

import { test } from "node:test";
import assert from "node:assert/strict";
import { summariseExamSubject, type ExamEntry, type Sex } from "./exam-summary.ts";

const entry = (sex: Sex, score: number | null): ExamEntry => ({ sex, score });

function close(actual: number | null, expected: number, label: string) {
  assert.ok(actual !== null, `${label}: expected a number, got null`);
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${label}: expected ~${expected}, got ${actual}`
  );
}

// ---------------------------------------------------------------------------
// Panay Grade 1 GMRC, Q1 — HPS 30
// ---------------------------------------------------------------------------

test("reproduces the Panay Grade 1 GMRC Q1 row: Mean 24.71, MPS 86.67/79.17/82.38", () => {
  const entries = [
    entry("M", 25),
    entry("M", 26),
    entry("M", 27),
    entry("F", 23),
    entry("F", 24),
    entry("F", 24),
    entry("F", 24),
  ];

  const s = summariseExamSubject(entries, 30);

  assert.deepEqual(s.enrolledBySex, { male: 3, female: 4, total: 7 });
  assert.deepEqual(s.assessedBySex, { male: 3, female: 4, total: 7 });

  close(s.meanBySex.total, 24.71, "class mean");
  close(s.meanBySex.male, 26, "male mean");
  close(s.meanBySex.female, 23.75, "female mean");

  close(s.mpsBySex.male, 86.67, "male MPS");
  close(s.mpsBySex.female, 79.17, "female MPS");
  close(s.mpsBySex.total, 82.38, "total MPS");
});


test("MPS is null across the board when the subject has no HPS yet", () => {
  const entries = [entry("M", 20), entry("F", 18)];
  const s = summariseExamSubject(entries, null);

  assert.equal(s.mpsBySex.male, null);
  assert.equal(s.mpsBySex.female, null);
  assert.equal(s.mpsBySex.total, null);
  // Mean and SD do not depend on a ceiling, so they still compute.
  close(s.meanBySex.male, 20, "male mean unaffected");
  close(s.meanBySex.total, 19, "total mean unaffected");
});

test("a class with nobody assessed yields null means, not a divide-by-zero", () => {
  const entries = [entry("M", null), entry("F", null)];
  const s = summariseExamSubject(entries, 30);

  assert.equal(s.assessedBySex.total, 0);
  assert.equal(s.meanBySex.total, null);
  assert.equal(s.sdBySex.total, null);
  assert.equal(s.mpsBySex.total, null);
});

test("enrolled counts every learner; assessed only those with a score", () => {
  const entries = [entry("M", 20), entry("M", null), entry("F", 18)];
  const s = summariseExamSubject(entries, 30);

  assert.deepEqual(s.enrolledBySex, { male: 2, female: 1, total: 3 });
  assert.deepEqual(s.assessedBySex, { male: 1, female: 1, total: 2 });
});

test("population SD divides by N, not N-1", () => {
  // Scores 20, 22, 24, 26: mean 23, deviations -3,-1,1,3, squared 9+1+1+9=20,
  // population variance 20/4=5, SD sqrt(5) ~ 2.236.
  const entries = [entry("M", 20), entry("M", 22), entry("M", 24), entry("M", 26)];
  const s = summariseExamSubject(entries, 30);

  close(s.sdBySex.male, Math.sqrt(5), "population SD");
});
