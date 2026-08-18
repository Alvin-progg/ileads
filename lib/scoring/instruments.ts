// Canonical instrument definitions, transcribed from the DepEd workbooks in
// FIles/. These are the values seeded into the scoring_rules table (see
// scripts/gen-scoring-rules-sql.mjs, which emits the migration from this file)
// and the same objects the unit tests run against — so a typo here fails a
// test rather than silently shipping wrong cut-offs.
//
// At runtime the engine reads rules from the DATABASE, not from this file.
// This is the seed source, not a fallback.
//
// Source of every number below: the Excel formulas themselves, not the prose
// on the Scoring Reference sheets (the two disagree in places).

import type {
  CrlaInputLimits,
  CrlaLanguageRules,
  CrlaRules,
  RmaRules,
  RmaTask,
} from "./types.ts";

// ---------------------------------------------------------------------------
// CRLA — shared shapes
// ---------------------------------------------------------------------------

/**
 * MT/FIL Part 1: IF(task1<7, task1+task2L, task1+10+task2H).
 * The +10 is automatic credit for the low form the learner skipped, so anyone
 * scoring 7+ on Task 1 starts at 17 and can never be a Full/Moderate Refresher.
 */
const MT_PART1: CrlaLanguageRules["part1"] = {
  max: 30,
  total: { mode: "task1_branch", branchAt: 7, autoCredit: 10 },
  levels: [
    { label: "Full Refresher", branch: "low", max: 10 },
    { label: "Moderate Refresher", branch: "low", min: 11 },
    { label: "Light Refresher", branch: "high", max: 26 },
    { label: "Grade Ready", branch: "high", min: 27 },
  ],
};

/**
 * Entry limits from the scoresheet's data validation. Task 1 and both Task 2
 * forms are scored out of 10; the reading-time cap is the only value that
 * varies by grade.
 */
function inputLimits(readingMinutesMax: number): CrlaInputLimits {
  return {
    task1: { min: 0, max: 10 },
    task2Low: { min: 0, max: 10 },
    task2High: { min: 0, max: 10 },
    storyNo: { min: 1, max: 2 },
    readingMinutes: { min: 0, max: readingMinutesMax },
    experienceRating: { min: 1, max: 5 },
    observationLevels: ["Level 1", "Level 2", "Level 3", "Level 4"],
  };
}

/**
 * Builds the Part 2 profile ladder. Every grade shares the same fluency
 * comparators — including their deliberate asymmetry (`<=0.50` beside `<0.51`,
 * `>0.75` beside `<0.76`) — and differs only in the comprehension thresholds
 * and which Part 1 levels bypass Part 2 entirely.
 */
function profileRules(opts: {
  gateLevels: string[];
  /** Comprehension bounds, in ladder order. */
  highEmergingLte: number;
  developingGte: number;
  developingLte: number;
  transitioningGte: number;
  transitioningLte: number;
  atGradeLevelGte: number;
}) {
  return {
    gate: { whenLevelIn: opts.gateLevels, label: "Low Emerging Reader" },
    rules: [
      {
        label: "High Emerging Reader",
        any: [
          { fluency: { lte: 0.25 } },
          {
            fluency: { gt: 0.25, lte: 0.5 },
            comprehension: { lte: opts.highEmergingLte },
          },
        ],
      },
      {
        label: "Developing Reader",
        any: [
          {
            fluency: { gt: 0.25, lt: 0.51 },
            comprehension: { gte: opts.developingGte },
          },
          {
            fluency: { gt: 0.5, lt: 0.76 },
            comprehension: { lte: opts.developingLte },
          },
        ],
      },
      {
        label: "Transitioning Reader",
        any: [
          {
            fluency: { gte: 0.51, lt: 0.76 },
            comprehension: { gte: opts.transitioningGte },
          },
          {
            fluency: { gt: 0.75 },
            comprehension: { lte: opts.transitioningLte },
          },
        ],
      },
      {
        label: "Reading At Grade Level",
        any: [
          {
            fluency: { gt: 0.75 },
            comprehension: { gte: opts.atGradeLevelGte },
          },
        ],
      },
    ],
    fallback: null,
  };
}

// Grade 1 is the odd one out: Moderate Refresher ALSO bypasses Part 2.
const G1_PROFILE = profileRules({
  gateLevels: ["Full Refresher", "Moderate Refresher"],
  highEmergingLte: 0,
  developingGte: 1,
  developingLte: 1,
  transitioningGte: 2,
  transitioningLte: 3,
  atGradeLevelGte: 4,
});

const G2_PROFILE = profileRules({
  gateLevels: ["Full Refresher"],
  highEmergingLte: 0,
  developingGte: 1,
  developingLte: 2,
  transitioningGte: 3,
  transitioningLte: 4,
  atGradeLevelGte: 5,
});

const G3_PROFILE = profileRules({
  gateLevels: ["Full Refresher"],
  highEmergingLte: 1,
  developingGte: 2,
  developingLte: 3,
  transitioningGte: 4,
  transitioningLte: 5,
  atGradeLevelGte: 6,
});

// ---------------------------------------------------------------------------
// CRLA — per grade
// ---------------------------------------------------------------------------

export const CRLA_G1: CrlaRules = {
  languages: {
    MT: {
      part1: MT_PART1,
      passages: { "1": 51, "2": 51 },
      passageDefault: 50,
      comprehensionMax: 5,
      inputs: inputLimits(1),
      profile: G1_PROFILE,
    },
  },
};

export const CRLA_G2: CrlaRules = {
  languages: {
    MT: {
      part1: MT_PART1,
      passages: { "1": 96, "2": 95 },
      passageDefault: 95,
      comprehensionMax: 6,
      inputs: inputLimits(2),
      profile: G2_PROFILE,
    },
    // The FIL sheet mirrors MT wholesale — same scale, same cut-offs.
    FIL: {
      part1: MT_PART1,
      passages: { "1": 96, "2": 95 },
      passageDefault: 95,
      comprehensionMax: 6,
      inputs: inputLimits(2),
      profile: G2_PROFILE,
    },
  },
};

export const CRLA_G3: CrlaRules = {
  languages: {
    MT: {
      part1: MT_PART1,
      passages: { "1": 121, "2": 121 },
      passageDefault: 120,
      comprehensionMax: 7,
      inputs: inputLimits(3),
      profile: G3_PROFILE,
    },
    FIL: {
      part1: MT_PART1,
      passages: { "1": 121, "2": 121 },
      passageDefault: 120,
      comprehensionMax: 7,
      inputs: inputLimits(3),
      profile: G3_PROFILE,
    },
    // English is a different instrument: 20-point scale, its own level
    // boundaries, a non-reader override, and Grade-2 comprehension thresholds.
    ENG: {
      part1: {
        max: 20,
        total: {
          mode: "sum",
          zeroOverride: { whenTask1: 0, total: 0 },
        },
        levels: [
          { label: "Full Refresher", max: 0 },
          { label: "Moderate Refresher", min: 1, max: 10 },
          { label: "Light Refresher", min: 11, max: 16 },
          { label: "Grade Ready", min: 17 },
        ],
      },
      passages: { "1": 100, "2": 100 },
      comprehensionMax: 6,
      inputs: inputLimits(2),
      profile: G2_PROFILE,
    },
  },
};

// ---------------------------------------------------------------------------
// RMA
// ---------------------------------------------------------------------------
// Grade 3 is the only fully transcribed instrument: per-task maxima and the
// band formula both come from its scoresheet.
//
// Grades 1 and 2 are seeded with what the supplied Key Stage 1 workbook does
// state — the task letters and the instrument total — and nothing else. Their
// per-task maxima appear in no supplied file (`max: null`) and neither does a
// band formula (`levels: []`), so a teacher can encode raw scores while the
// proficiency level and per-task mastery report as not yet configured. A
// guessed ladder would produce official-looking levels DepEd never defined.
//
// Grades 4–6 use a different domain-based instrument entirely and are absent;
// the loader raises a clear error for them.

/** Task letters with no stated maximum, for the grades that supply neither. */
function lettersOnly(letters: string[]): RmaTask[] {
  return letters.map((key) => ({ key, label: `Task ${key}`, max: null }));
}

export const RMA_G1: RmaRules = {
  tasks: lettersOnly(["A", "B", "C", "D", "E", "F", "G", "H"]),
  max: 35,
  blankWhenTotalZero: true,
  taskMasteryThreshold: 0.75,
  levels: [],
};

export const RMA_G2: RmaRules = {
  tasks: lettersOnly(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]),
  max: 25,
  blankWhenTotalZero: true,
  taskMasteryThreshold: 0.75,
  levels: [],
};

export const RMA_G3: RmaRules = {
  tasks: [
    { key: "A", label: "Task A: Fractions", max: 2 },
    { key: "B", label: "Task B: Mass Measurement", max: 1 },
    { key: "C", label: "Task C: Missing Number in Patterns", max: 2 },
    { key: "D", label: "Task D: Addition", max: 3 },
    { key: "E", label: "Task E: Subtraction", max: 3 },
    { key: "F", label: "Task F: Multiplication", max: 2 },
    { key: "G", label: "Task G: Division", max: 3 },
    { key: "H", label: "Task H: Geometric Representation", max: 4 },
  ],
  max: 20,
  blankWhenTotalZero: true,
  taskMasteryThreshold: 0.75,
  // Label strings are byte-exact: the district workbook's COUNTIFS match them
  // literally, so any drift silently zeroes the summary counts.
  levels: [
    { label: "Emerging (Not Proficient)", lt: 0.25 },
    { label: "Emerging (Low Proficient)", gte: 0.25, lt: 0.5 },
    { label: "Developing (Nearly Proficient)", gte: 0.5, lt: 0.75 },
    { label: "Transitioning (Proficient)", gte: 0.75, lt: 0.85 },
    { label: "At Grade Level (Highly Proficient)", gte: 0.85 },
  ],
};

/** Everything seeded into scoring_rules, keyed as (tool, grade_level, version). */
export const SEED_RULES = [
  { tool: "crla", grade_level: 1, version: "CRLA2v1", rules: CRLA_G1 },
  { tool: "crla", grade_level: 2, version: "CRLA2v1", rules: CRLA_G2 },
  { tool: "crla", grade_level: 3, version: "CRLA2v1", rules: CRLA_G3 },
  { tool: "rma", grade_level: 1, version: "RMA2v2", rules: RMA_G1 },
  { tool: "rma", grade_level: 2, version: "RMA2v2", rules: RMA_G2 },
  { tool: "rma", grade_level: 3, version: "RMA2v2", rules: RMA_G3 },
] as const;
