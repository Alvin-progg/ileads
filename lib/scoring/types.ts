// Scoring engine types. Every cut-off lives in the rule objects (loaded from
// the scoring_rules table) — nothing numeric is baked into the engine code.

/** A numeric comparison. All present bounds must hold. */
export type Predicate = {
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
};

// ---------------------------------------------------------------------------
// CRLA
// ---------------------------------------------------------------------------

/**
 * How Part 1's total is derived.
 *
 * `task1_branch` — the MT/FIL model: a learner scoring below `branchAt` on
 * Task 1 takes the low form (total = task1 + task2Low); at or above it they
 * take the high form and receive `autoCredit` points automatically for the
 * low form they skipped (total = task1 + autoCredit + task2High).
 *
 * `sum` — the G3 English model: total = task1 + task2, with an optional
 * override that forces a total when task1 hits a given value (non-reader).
 */
export type CrlaTotalRule =
  | { mode: "task1_branch"; branchAt: number; autoCredit: number }
  | { mode: "sum"; zeroOverride?: { whenTask1: number; total: number } };

/** A Part 1 reading-level band. `min`/`max` are inclusive. */
export type CrlaLevelBand = {
  label: string;
  /** Restricts the band to one side of a `task1_branch` split. */
  branch?: "low" | "high";
  min?: number;
  max?: number;
};

/** One alternative within a profile rule: all present predicates must hold. */
export type ProfileClause = {
  fluency?: Predicate;
  comprehension?: Predicate;
};

/** A profile outcome, reached if ANY of its clauses match. */
export type ProfileRule = {
  label: string;
  any: ProfileClause[];
};

export type CrlaProfileRules = {
  /** Short-circuits Part 2 entirely for the listed Part 1 levels. */
  gate: { whenLevelIn: string[]; label: string };
  /** Evaluated in order; first match wins. */
  rules: ProfileRule[];
  /** Result when no rule matches. The instrument leaves this blank. */
  fallback: string | null;
};

/** Bounds for a raw-score field. Both ends inclusive. */
export type InputRange = { min?: number; max: number };

/**
 * Entry limits for the raw-score fields, taken from the scoresheet's own data
 * validation. These live with the cut-offs rather than in the UI so a revised
 * instrument changes both together.
 *
 * Miscues are absent on purpose: their ceiling is the chosen story's passage
 * length, already in `passages`, so it is derived per row instead of duplicated.
 */
export type CrlaInputLimits = {
  task1: InputRange;
  task2Low: InputRange;
  task2High: InputRange;
  storyNo: InputRange;
  /** The sheet caps reading time per grade (G1 1 min, G2 2, G3 3). */
  readingMinutes: InputRange;
  experienceRating: InputRange;
  observationLevels: string[];
};

export type CrlaLanguageRules = {
  part1: {
    max: number;
    total: CrlaTotalRule;
    levels: CrlaLevelBand[];
  };
  /** Total words in each passage, keyed by story number. */
  passages: Record<string, number>;
  /** Fallback passage length when the story number has no entry. */
  passageDefault?: number;
  comprehensionMax: number;
  inputs: CrlaInputLimits;
};

export type CrlaRules = {
  languages: Record<string, CrlaLanguageRules & { profile: CrlaProfileRules }>;
};

export type CrlaInput = {
  task1: number | null;
  task2Low: number | null;
  task2High: number | null;
  storyNo: number | null;
  miscues: number | null;
  /** Total reading time in seconds (the DB stores a single seconds column). */
  readingSeconds: number | null;
  comprehensionCorrect: number | null;
};

export type CrlaResult = {
  part1Total: number | null;
  readingLevel: string | null;
  wordsRead: number | null;
  wpm: number | null;
  /** Fraction 0–1, matching the instrument. Not a 0–100 percentage. */
  fluency: number | null;
  readingProfile: string | null;
};

// ---------------------------------------------------------------------------
// RMA
// ---------------------------------------------------------------------------

export type RmaTask = {
  key: string;
  label: string;
  /**
   * Points available for this task, or null when the instrument defines a
   * ceiling that no supplied file states (RMA grades 1-2). A null max means
   * the task cannot be range-checked or scored for mastery.
   */
  max: number | null;
};

/** A proficiency band, matched against the score fraction (0–1). */
export type RmaLevelBand = Predicate & { label: string };

export type RmaRules = {
  tasks: RmaTask[];
  /** Points available across every task. Known for every grade. */
  max: number;
  /**
   * The instrument blanks the percentage (and therefore the level) when the
   * total is zero, so a zero-scoring learner falls into no band at all.
   */
  blankWhenTotalZero: boolean;
  /** Fraction of a task's max that counts as mastery of that task. */
  taskMasteryThreshold: number;
  /**
   * Proficiency bands, in order. Empty when DepEd's cut-offs for the grade have
   * not been transcribed: callers must report the level as not yet configured
   * rather than computing one.
   */
  levels: RmaLevelBand[];
};

export type RmaInput = {
  /** Raw score per task key. Missing or null tasks score zero, as in the sheet. */
  taskScores: Record<string, number | null>;
};

export type RmaResult = {
  total: number | null;
  /** Fraction 0–1. */
  percent: number | null;
  proficiencyLevel: string | null;
  /** Keyed by task. Tasks with an unknown max are absent, never false. */
  taskMastery: Record<string, boolean>;
};
