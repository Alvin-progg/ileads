// CRLA — verified against the FORMULA SPECIFICATION, not against Excel output.
//
// This distinction matters. Unlike the RMA suite, no filled CRLA scoresheet
// exists in FIles/: all three CRLA2 templates ship blank (their computed cells
// cache the empty string) and CRLA-PANAY-ES-GRADES-1-3-BOSY.xlsx is a
// section-level rollup holding band COUNTS, not per-learner rows. So the
// expectations below are derived from the workbooks' own IF() ladders,
// transcribed verbatim — a faithful reading of the instrument, but NOT
// certified against numbers Excel actually produced.
//
// To upgrade this suite to the same standard as rma.test.ts, drop a filled
// CRLA scoresheet into FIles/ and replace these with real raw->level pairs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCrla } from "./crla.ts";
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

// ---------------------------------------------------------------------------
// Part 1 — total and reading level
// ---------------------------------------------------------------------------

test("Part 1 total branches on Task 1, with automatic credit for the skipped form", () => {
  // Below the branch point: total = task1 + task2Low.
  assert.equal(
    computeCrla(input({ task1: 3, task2Low: 2 }), CRLA_G1, "MT").part1Total,
    5
  );
  // At or above it: total = task1 + 10 + task2High. The +10 is credit for the
  // low form the learner never sat.
  assert.equal(
    computeCrla(input({ task1: 7, task2High: 0 }), CRLA_G1, "MT").part1Total,
    17
  );
  assert.equal(
    computeCrla(input({ task1: 10, task2High: 10 }), CRLA_G1, "MT").part1Total,
    30
  );
});

test("scoring 7 or more on Task 1 makes a Refresher level unreachable", () => {
  // Structural consequence of the +10 credit: the floor for the high branch is
  // 17, which is already past both Refresher bands.
  const worstHighBranch = computeCrla(
    input({ task1: 7, task2High: 0 }),
    CRLA_G1,
    "MT"
  );
  assert.equal(worstHighBranch.part1Total, 17);
  assert.equal(worstHighBranch.readingLevel, "Light Refresher");
});

test("reading level bands land on the documented boundaries", () => {
  const levelAt = (task1: number, low: number | null, high: number | null) =>
    computeCrla(
      input({ task1, task2Low: low, task2High: high }),
      CRLA_G1,
      "MT"
    ).readingLevel;

  assert.equal(levelAt(0, 10, null), "Full Refresher", "10 — top of Full");
  assert.equal(levelAt(1, 10, null), "Moderate Refresher", "11 — bottom of Moderate");
  assert.equal(levelAt(6, 10, null), "Moderate Refresher", "16 — top of Moderate");
  assert.equal(levelAt(7, null, 0), "Light Refresher", "17 — bottom of Light");
  assert.equal(levelAt(10, null, 6), "Light Refresher", "26 — top of Light");
  assert.equal(levelAt(10, null, 7), "Grade Ready", "27 — bottom of Grade Ready");
  assert.equal(levelAt(10, null, 10), "Grade Ready", "30 — maximum");
});

test("a wholly unscored Part 1 stays null rather than scoring zero", () => {
  const result = computeCrla(BLANK, CRLA_G1, "MT");
  assert.equal(result.part1Total, null);
  assert.equal(result.readingLevel, null);
  assert.equal(result.readingProfile, null);
});

// ---------------------------------------------------------------------------
// The Grade 1 gate — the difference most likely to be missed
// ---------------------------------------------------------------------------

test("Grade 1 sends BOTH Full and Moderate Refresher to Low Emerging Reader", () => {
  const perfectReading = { storyNo: 1, miscues: 0, comprehensionCorrect: 5 };

  const full = computeCrla(
    input({ task1: 2, task2Low: 2, ...perfectReading }),
    CRLA_G1,
    "MT"
  );
  assert.equal(full.readingLevel, "Full Refresher");
  assert.equal(full.readingProfile, "Low Emerging Reader");

  // Even with flawless fluency and full comprehension, a Grade 1 Moderate
  // Refresher never reaches Part 2.
  const moderate = computeCrla(
    input({ task1: 6, task2Low: 10, ...perfectReading }),
    CRLA_G1,
    "MT"
  );
  assert.equal(moderate.readingLevel, "Moderate Refresher");
  assert.equal(moderate.readingProfile, "Low Emerging Reader");
});

test("Grades 2 and 3 gate only Full Refresher, so Moderate reaches Part 2", () => {
  const moderateG2 = computeCrla(
    input({
      task1: 6,
      task2Low: 10,
      storyNo: 1,
      miscues: 0,
      comprehensionCorrect: 5,
    }),
    CRLA_G2,
    "MT"
  );
  assert.equal(moderateG2.readingLevel, "Moderate Refresher");
  assert.equal(
    moderateG2.readingProfile,
    "Reading At Grade Level",
    "same input that Grade 1 would gate must be scored on merit here"
  );

  const moderateG3 = computeCrla(
    input({
      task1: 6,
      task2Low: 10,
      storyNo: 1,
      miscues: 0,
      comprehensionCorrect: 7,
    }),
    CRLA_G3,
    "MT"
  );
  assert.equal(moderateG3.readingLevel, "Moderate Refresher");
  assert.equal(moderateG3.readingProfile, "Reading At Grade Level");
});

// ---------------------------------------------------------------------------
// Grade 3 English — a different instrument in the same workbook
// ---------------------------------------------------------------------------

test("Grade 3 English uses a 20-point scale with its own bands", () => {
  const levelAt = (task1: number, task2: number) =>
    computeCrla(input({ task1, task2Low: task2 }), CRLA_G3, "ENG");

  assert.equal(levelAt(0, 0).part1Total, 0);
  assert.equal(levelAt(0, 0).readingLevel, "Full Refresher", "0 only");
  assert.equal(levelAt(1, 0).readingLevel, "Moderate Refresher", "1 — bottom");
  assert.equal(levelAt(10, 0).readingLevel, "Moderate Refresher", "10 — top");
  assert.equal(levelAt(10, 1).readingLevel, "Light Refresher", "11 — bottom");
  assert.equal(levelAt(10, 6).readingLevel, "Light Refresher", "16 — top");
  assert.equal(levelAt(10, 7).readingLevel, "Grade Ready", "17 — bottom");
  assert.equal(levelAt(10, 10).readingLevel, "Grade Ready", "20 — maximum");
});

test("Grade 3 English forces a zero total when Task 1 is zero", () => {
  // The non-reader override: any Task 2 score is discarded.
  const result = computeCrla(
    input({ task1: 0, task2Low: 15, storyNo: 1, miscues: 0 }),
    CRLA_G3,
    "ENG"
  );
  assert.equal(result.part1Total, 0, "Task 2 must not rescue a Task 1 of zero");
  assert.equal(result.readingLevel, "Full Refresher");
  assert.equal(result.readingProfile, "Low Emerging Reader");
});

// ---------------------------------------------------------------------------
// Part 2 — fluency x comprehension, at the boundaries
// ---------------------------------------------------------------------------

// The English passages are exactly 100 words, so miscues map cleanly onto exact
// fluency percentages — the only variant where boundary values are hittable
// without floating-point slop.
function engProfile(miscues: number, comprehensionCorrect: number) {
  return computeCrla(
    input({
      task1: 10,
      task2Low: 10, // total 20 -> Grade Ready, so the gate never fires
      storyNo: 1,
      miscues,
      comprehensionCorrect,
    }),
    CRLA_G3,
    "ENG"
  ).readingProfile;
}

test("fluency at or below 25% is High Emerging regardless of comprehension", () => {
  assert.equal(engProfile(80, 0), "High Emerging Reader", "20%");
  assert.equal(engProfile(75, 6), "High Emerging Reader", "exactly 25%, full comprehension");
});

test("the 25-50% band splits on comprehension", () => {
  assert.equal(engProfile(74, 0), "High Emerging Reader", "26% with no comprehension");
  assert.equal(engProfile(74, 1), "Developing Reader", "26% with one correct");
  assert.equal(engProfile(50, 0), "High Emerging Reader", "exactly 50%, none correct");
  assert.equal(engProfile(50, 1), "Developing Reader", "exactly 50%, one correct");
});

test("the asymmetric 51%/76% comparators are honoured literally", () => {
  // The ladder mixes `<0.51` with `>0.50` and `<0.76` with `>0.75`; a tidied-up
  // 50/75 reading would put these on the wrong side.
  assert.equal(engProfile(49, 0), "Developing Reader", "exactly 51%, none correct");
  assert.equal(engProfile(49, 3), "Transitioning Reader", "exactly 51%, three correct");
  assert.equal(engProfile(25, 3), "Transitioning Reader", "exactly 75%");
  assert.equal(engProfile(24, 4), "Transitioning Reader", "76% with four correct");
  assert.equal(engProfile(24, 5), "Reading At Grade Level", "76% with five correct");
  assert.equal(engProfile(0, 6), "Reading At Grade Level", "100% with full comprehension");
});

test("comprehension thresholds shift per grade at identical fluency", () => {
  // Same reading performance, three different instruments. Grade 3 MT demands
  // more correct answers than Grade 2 for the same label.
  const readFully = (comprehensionCorrect: number) => ({
    task1: 10,
    task2High: 10, // Grade Ready, ungated
    storyNo: 1,
    miscues: 0, // 100% fluency
    comprehensionCorrect,
  });

  assert.equal(
    computeCrla(input(readFully(5)), CRLA_G2, "MT").readingProfile,
    "Reading At Grade Level",
    "Grade 2 needs 5"
  );
  assert.equal(
    computeCrla(input(readFully(5)), CRLA_G3, "MT").readingProfile,
    "Transitioning Reader",
    "Grade 3 needs 6, so 5 falls short"
  );
  assert.equal(
    computeCrla(input(readFully(6)), CRLA_G3, "MT").readingProfile,
    "Reading At Grade Level",
    "Grade 3 with 6"
  );
});

test("Part 2 stays null when no passage was read", () => {
  const result = computeCrla(
    input({ task1: 10, task2High: 10 }),
    CRLA_G3,
    "MT"
  );
  assert.equal(result.readingLevel, "Grade Ready");
  assert.equal(result.readingProfile, null, "no story number means no profile");
  assert.equal(result.fluency, null);
  assert.equal(result.wpm, null);
});

// ---------------------------------------------------------------------------
// Derived reading measures
// ---------------------------------------------------------------------------

test("words read and fluency come off the passage length for the story chosen", () => {
  // Grade 2 story 1 is 96 words, story 2 is 95 — the same miscue count gives
  // different fluency depending on which passage was used.
  const s1 = computeCrla(
    input({ task1: 10, task2High: 10, storyNo: 1, miscues: 6 }),
    CRLA_G2,
    "MT"
  );
  const s2 = computeCrla(
    input({ task1: 10, task2High: 10, storyNo: 2, miscues: 6 }),
    CRLA_G2,
    "MT"
  );

  assert.equal(s1.wordsRead, 90);
  assert.equal(s2.wordsRead, 89);
  assert.ok(s1.fluency !== null && Math.abs(s1.fluency - 90 / 96) < 1e-9);
  assert.ok(s2.fluency !== null && Math.abs(s2.fluency - 89 / 95) < 1e-9);
});

test("words per minute scales words read against elapsed time", () => {
  const at = (readingSeconds: number) =>
    computeCrla(
      input({
        task1: 10,
        task2Low: 10,
        storyNo: 1,
        miscues: 0,
        readingSeconds,
      }),
      CRLA_G3,
      "ENG"
    ).wpm;

  assert.equal(at(60), 100, "100 words in a minute");
  assert.equal(at(120), 50, "same words over two minutes");
  assert.equal(at(30), 200, "same words in half a minute");
});

test("words per minute is null without a recorded time", () => {
  const result = computeCrla(
    input({ task1: 10, task2Low: 10, storyNo: 1, miscues: 0 }),
    CRLA_G3,
    "ENG"
  );
  assert.equal(result.wpm, null);
  assert.equal(result.fluency, 1, "fluency still computes — it needs no timing");
});

// ---------------------------------------------------------------------------
// Entry limits
// ---------------------------------------------------------------------------

test("entry limits match the scoresheet's data validation", () => {
  const g1 = CRLA_G1.languages.MT.inputs;
  assert.equal(g1.task1.max, 10);
  assert.equal(g1.task2Low.max, 10);
  assert.equal(g1.task2High.max, 10);
  assert.deepEqual(g1.storyNo, { min: 1, max: 2 });
  assert.deepEqual(g1.experienceRating, { min: 1, max: 5 });
  assert.deepEqual(g1.observationLevels, [
    "Level 1",
    "Level 2",
    "Level 3",
    "Level 4",
  ]);
});

test("the reading time cap rises with the grade", () => {
  // The sheets allow 1, 2 and 3 minutes respectively; English caps at 2.
  assert.equal(CRLA_G1.languages.MT.inputs.readingMinutes.max, 1);
  assert.equal(CRLA_G2.languages.MT.inputs.readingMinutes.max, 2);
  assert.equal(CRLA_G3.languages.MT.inputs.readingMinutes.max, 3);
  assert.equal(CRLA_G3.languages.ENG.inputs.readingMinutes.max, 2);
});

test("comprehension ceilings differ per grade, matching the question counts", () => {
  assert.equal(CRLA_G1.languages.MT.comprehensionMax, 5);
  assert.equal(CRLA_G2.languages.MT.comprehensionMax, 6);
  assert.equal(CRLA_G3.languages.MT.comprehensionMax, 7);
  assert.equal(CRLA_G3.languages.ENG.comprehensionMax, 6);
});

test("an unknown language is rejected rather than silently mis-scored", () => {
  assert.throws(
    () => computeCrla(input({ task1: 5, task2Low: 5 }), CRLA_G1, "ENG"),
    /No CRLA rules for language "ENG"/
  );
});
