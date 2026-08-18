import type { CrlaRules } from "./types.ts";
import {
  addToTally,
  bump,
  bySex,
  countsBySex,
  emptyTally,
  mean,
  percentRows,
  type BySex,
  type PercentRow,
  type Sex,
  type TallyRow,
} from "./summary.ts";

export type { BySex, PercentRow, Sex, TallyRow };

export type Averages = {
  /** Fraction 0-1. */
  fluency: number | null;
  /** Fraction 0-1. */
  comprehensionPercent: number | null;
  wpm: number | null;
};

/**
 * One learner's contribution to the tally. The measures are optional so the
 * counts-only callers keep working; a missing measure is skipped by the
 * averages rather than counted as zero.
 */
export type SummaryEntry = {
  sex: Sex;
  readingLevel: string | null;
  readingProfile: string | null;
  fluency?: number | null;
  comprehensionPercent?: number | null;
  wpm?: number | null;
};

export type ClassSummary = {
  enrolled: number;
  /** Learners with a computed Part 1 level. */
  assessed: number;
  enrolledBySex: BySex<number>;
  assessedBySex: BySex<number>;
  /** Learners with nothing encoded yet — kept visible so the tally reconciles. */
  unscored: TallyRow;
  levels: TallyRow[];
  profiles: TallyRow[];
  averages: BySex<Averages>;
  percents: { levels: PercentRow[]; profiles: PercentRow[] };
};

/**
 * The labels a grade's instrument can produce, in the order the rules declare
 * them, so a band with zero learners still prints its row instead of vanishing
 * from the tally.
 */
export function levelLabels(rules: CrlaRules, language: string): string[] {
  return rules.languages[language].part1.levels.map((l) => l.label);
}

export function profileLabels(rules: CrlaRules, language: string): string[] {
  const profile = rules.languages[language].profile;
  // The gate label comes first: it is the outcome for learners who never
  // reach Part 2, and it is not part of the ladder itself.
  return [profile.gate.label, ...profile.rules.map((r) => r.label)];
}

function averagesOf(entries: SummaryEntry[]): Averages {
  return {
    fluency: mean(entries.map((e) => e.fluency)),
    comprehensionPercent: mean(entries.map((e) => e.comprehensionPercent)),
    wpm: mean(entries.map((e) => e.wpm)),
  };
}

/**
 * Counts learners per reading level and per reading profile, split by sex, and
 * averages the Part 2 measures over the learners who have them.
 *
 * Learners with no computed level are counted as `unscored` rather than being
 * dropped, so `assessed + unscored.total` always equals the class size — a
 * tally that quietly loses learners is worse than no tally.
 *
 * Averages are true means over all assessed learners; see `bySex` in
 * summary.ts for why that differs from the workbook.
 */
export function summarise(
  entries: SummaryEntry[],
  rules: CrlaRules,
  language: string
): ClassSummary {
  const levels = emptyTally(levelLabels(rules, language));
  const profiles = emptyTally(profileLabels(rules, language));
  const unscored: TallyRow = { label: "Not yet assessed", male: 0, female: 0, total: 0 };

  const assessedEntries: SummaryEntry[] = [];

  for (const entry of entries) {
    if (entry.readingLevel === null) {
      bump(unscored, entry.sex);
      continue;
    }

    assessedEntries.push(entry);
    addToTally(levels, entry.readingLevel, entry.sex);
    // A learner can hold a level without a profile (no passage read yet), so
    // the profile tally is allowed to total less than the level tally.
    if (entry.readingProfile !== null) {
      addToTally(profiles, entry.readingProfile, entry.sex);
    }
  }

  const assessedGroups = bySex(assessedEntries);
  const assessedBySex = countsBySex(assessedEntries);
  const levelRows = [...levels.values()];
  const profileRows = [...profiles.values()];

  return {
    enrolled: entries.length,
    assessed: assessedEntries.length,
    enrolledBySex: countsBySex(entries),
    assessedBySex,
    unscored,
    levels: levelRows,
    profiles: profileRows,
    averages: {
      male: averagesOf(assessedGroups.male),
      female: averagesOf(assessedGroups.female),
      total: averagesOf(assessedGroups.total),
    },
    percents: {
      levels: percentRows(levelRows, assessedBySex),
      profiles: percentRows(profileRows, assessedBySex),
    },
  };
}
