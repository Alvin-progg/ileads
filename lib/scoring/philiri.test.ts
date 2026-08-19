// Phil-IRI Oral Reading (G4-6) — verified against REAL EXCEL OUTPUT.
//
// Every expected score and level below is the value Excel itself cached in
// files/Phil-IRI-Form-Oral-Reading-1.xlsx (sheets "WRS - Filipino - Grade 5",
// "WRS - English - Grade 5", "CS - Filipino - G5", "CS - English-G5  ").
// Nothing here was derived by hand — if the engine disagrees with these, the
// engine is wrong, not the fixture.
//
// The band cut-offs (PHILIRI_G4/G5/G6 in instruments.ts) match the legend
// text printed on every sheet ("Independent = 97-100%", etc.) rather than the
// sheets' own formulas, which disagree with that legend at the 89-90 boundary
// (a template bug — see the comment above PHILIRI_BANDS).

import { test } from "node:test";
import assert from "node:assert/strict";
import { computePhiliri } from "./philiri.ts";
import { PHILIRI_G5 } from "./instruments.ts";
import type { PhiliriInput } from "./types.ts";

const RULES = PHILIRI_G5.languages.FIL;
const RULES_ENG = PHILIRI_G5.languages.ENG;

function wordInput(wordCount: number, miscues: number): PhiliriInput {
  return { wordCount, miscues, comprehensionItems: null, comprehensionCorrect: null };
}

function comprehensionInput(items: number, correct: number): PhiliriInput {
  return { wordCount: null, miscues: null, comprehensionItems: items, comprehensionCorrect: correct };
}

function assertClose(actual: number | null, expected: number, label: string) {
  assert.ok(actual !== null, `${label}: expected a number, got null`);
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: expected ~${expected}, got ${actual}`);
}

const WORD_READING_ROWS: {
  name: string;
  words: number;
  miscues: number;
  score: number;
  level: string;
}[] = [
  { name: "Ejay Sevilla, WRS Filipino Set A row10", words: 109, miscues: 3, score: 97.247706422018354, level: "Independent" },
  { name: "Crizzandra Amboy, WRS Filipino Set A row21", words: 109, miscues: 11, score: 89.908256880733944, level: "Frustration" },
  { name: "Ejay Sevilla, WRS Filipino Set B row10", words: 96, miscues: 4, score: 95.833333333333343, level: "Instructional" },
  { name: "Crizzandra Amboy, WRS Filipino Set B row21", words: 96, miscues: 9, score: 90.625, level: "Instructional" },
  { name: "Ejay Sevilla, WRS Filipino Set C row10", words: 93, miscues: 7, score: 92.473118279569889, level: "Instructional" },
  { name: "Mico De Ocampo, WRS English Set A row10", words: 59, miscues: 3, score: 94.915254237288138, level: "Instructional" },
  { name: "Francis Golocino, WRS English Set A row11", words: 37, miscues: 1, score: 97.297297297297305, level: "Independent" },
  { name: "Crizzandra Amboy, WRS English Set A row21", words: 59, miscues: 10, score: 83.050847457627114, level: "Frustration" },
  { name: "Samantha Ejorpe, WRS English Set A row22", words: 59, miscues: 0, score: 100, level: "Independent" },
];

for (const fixture of WORD_READING_ROWS) {
  test(`Word Reading Level: ${fixture.name}`, () => {
    const result = computePhiliri(wordInput(fixture.words, fixture.miscues), RULES);
    assertClose(result.wordReadingScore! * 100, fixture.score, "score");
    assert.equal(result.wordReadingLevel, fixture.level);
  });
}

const COMPREHENSION_ROWS: {
  name: string;
  items: number;
  correct: number;
  score: number;
  level: string;
}[] = [
  { name: "Ejay Sevilla, CS Filipino Set A row12", items: 6, correct: 6, score: 100, level: "Independent" },
  { name: "Crizzandra Amboy, CS Filipino Set A row23", items: 6, correct: 5, score: 83.333333333333343, level: "Independent" },
  { name: "Crizzandra Amboy, CS Filipino Set B row23", items: 6, correct: 4, score: 66.666666666666657, level: "Instructional" },
  { name: "Mico De Ocampo, CS English Set A row12", items: 6, correct: 2, score: 33.333333333333329, level: "Frustration" },
  { name: "Francis Golocino, CS English Set A row13", items: 5, correct: 3, score: 60, level: "Instructional" },
];

for (const fixture of COMPREHENSION_ROWS) {
  test(`Comprehension Level: ${fixture.name}`, () => {
    const result = computePhiliri(comprehensionInput(fixture.items, fixture.correct), RULES);
    assertClose(result.comprehensionScore! * 100, fixture.score, "score");
    assert.equal(result.comprehensionLevel, fixture.level);
  });
}

test("Overall Level resolves to the worse component when they differ (Mico De Ocampo, English)", () => {
  // Word Reading: 59 words, 3 miscues -> 94.9% -> Instructional.
  // Comprehension: 6 items, 2 correct -> 33.3% -> Frustration.
  // Overall must be Frustration — the worse of the two, not the average or
  // the higher-scoring side.
  const result = computePhiliri(
    { wordCount: 59, miscues: 3, comprehensionItems: 6, comprehensionCorrect: 2 },
    RULES_ENG
  );
  assert.equal(result.wordReadingLevel, "Instructional");
  assert.equal(result.comprehensionLevel, "Frustration");
  assert.equal(result.overallLevel, "Frustration");
});

test("Overall Level resolves to the worse component the other direction (Francis Golocino, English)", () => {
  // Word Reading: 37 words, 1 miscue -> 97.3% -> Independent.
  // Comprehension: 5 items, 3 correct -> 60% -> Instructional.
  // Overall must be Instructional, not Independent.
  const result = computePhiliri(
    { wordCount: 37, miscues: 1, comprehensionItems: 5, comprehensionCorrect: 3 },
    RULES_ENG
  );
  assert.equal(result.wordReadingLevel, "Independent");
  assert.equal(result.comprehensionLevel, "Instructional");
  assert.equal(result.overallLevel, "Instructional");
});

test("Overall Level is null unless both component levels are known", () => {
  const wordOnly = computePhiliri(wordInput(59, 3), RULES);
  assert.equal(wordOnly.wordReadingLevel, "Instructional");
  assert.equal(wordOnly.comprehensionLevel, null);
  assert.equal(wordOnly.overallLevel, null);
});

test("a zero word count yields no score and no level rather than dividing by zero", () => {
  const result = computePhiliri(wordInput(0, 0), RULES);
  assert.equal(result.wordReadingScore, null);
  assert.equal(result.wordReadingLevel, null);
});

test("the 89-90% boundary resolves deterministically to Frustration, unlike the raw template", () => {
  // The sampled workbook's own formulas disagree with each other here (the
  // Filipino tabs test >89 -> Frustration, the English tabs test <89, leaving
  // 89-90 undefined in both) and disagree with the printed legend ("89% and
  // below" implies <90). This is a synthetic value, not an Excel-cached row —
  // no real row in the sample landed in this gap — asserting the documented
  // resolution rather than assuming it.
  const result = computePhiliri(wordInput(1000, 105), RULES); // 89.5%
  assertClose(result.wordReadingScore! * 100, 89.5, "score");
  assert.equal(result.wordReadingLevel, "Frustration");
});
