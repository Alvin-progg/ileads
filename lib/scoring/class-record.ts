import { computeCrla } from "./crla.ts";
import type { CrlaInput, CrlaRules } from "./types.ts";

export type ClassRecordRow = {
  part1Total: number | null;
  readingLevel: string | null;
  /** Part 1 total as a fraction of the instrument's maximum. */
  percentScore: number | null;
  /** Fraction 0-1. Suppressed for Full Refresher learners. */
  fluency: number | null;
  /** Fraction 0-1. Suppressed for Full Refresher learners. */
  comprehensionPercent: number | null;
  /** Suppressed for Full Refresher learners. */
  wpm: number | null;
  readingProfile: string | null;
};

/**
 * The level whose learners have no reading measures to report: they never
 * reached the passage, so the Class Record leaves those cells blank.
 */
const SUPPRESSED_LEVEL = "Full Refresher";

/**
 * Derives one Class Record row from raw scores.
 *
 * Two behaviours are worth knowing before changing anything here:
 *
 * 1. Fluency, comprehension % and WPM are blanked when Part 1 lands on
 *    "Full Refresher" — and on that level ONLY. A Grade 1 Moderate Refresher
 *    is still forced to "Low Emerging Reader" by the profile ladder, yet keeps
 *    their reading measures on this record. The two rules disagree in the
 *    source workbook, and both are reproduced as written.
 *
 * 2. The Grade 2 sheet's WPM cell gates on a percentage cell instead of the
 *    level, so it never suppresses — a copy-paste error rather than a rule.
 *    Suppression is applied uniformly here instead, so Grade 2 does not behave
 *    inexplicably differently from Grades 1 and 3.
 */
export function toClassRecordRow(
  input: CrlaInput,
  rules: CrlaRules,
  language: string
): ClassRecordRow {
  const langRules = rules.languages[language];
  if (!langRules) {
    throw new Error(
      `No CRLA rules for language "${language}" (have: ${Object.keys(rules.languages).join(", ")})`
    );
  }

  const computed = computeCrla(input, rules, language);

  const percentScore =
    computed.part1Total === null
      ? null
      : computed.part1Total / langRules.part1.max;

  const comprehensionPercent =
    input.comprehensionCorrect === null
      ? null
      : input.comprehensionCorrect / langRules.comprehensionMax;

  const suppressed = computed.readingLevel === SUPPRESSED_LEVEL;

  return {
    part1Total: computed.part1Total,
    readingLevel: computed.readingLevel,
    percentScore,
    fluency: suppressed ? null : computed.fluency,
    comprehensionPercent: suppressed ? null : comprehensionPercent,
    wpm: suppressed ? null : computed.wpm,
    readingProfile: computed.readingProfile,
  };
}
