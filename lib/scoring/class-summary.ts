import type { CrlaRules } from "./types.ts";

export type Sex = "M" | "F";

export type TallyRow = {
  label: string;
  male: number;
  female: number;
  total: number;
};

/** A count expressed as a fraction of that column's assessed learners. */
export type PercentRow = {
  label: string;
  male: number | null;
  female: number | null;
  total: number | null;
};

/** Anything reported per sex carries its own total column alongside M and F. */
export type BySex<T> = { male: T; female: T; total: T };

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

function emptyTally(labels: string[]): Map<string, TallyRow> {
  return new Map(
    labels.map((label) => [label, { label, male: 0, female: 0, total: 0 }])
  );
}

function add(tally: Map<string, TallyRow>, label: string, sex: Sex) {
  const row = tally.get(label);
  if (!row) return;
  if (sex === "M") row.male += 1;
  else row.female += 1;
  row.total += 1;
}

/** Mean of the values that exist. Null — never NaN — when none do. */
function mean(values: (number | null | undefined)[]): number | null {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  if (present.length === 0) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}

function averagesOf(entries: SummaryEntry[]): Averages {
  return {
    fluency: mean(entries.map((e) => e.fluency)),
    comprehensionPercent: mean(entries.map((e) => e.comprehensionPercent)),
    wpm: mean(entries.map((e) => e.wpm)),
  };
}

/** Share of assessed learners in a band. Null when nobody was assessed. */
function share(count: number, assessed: number): number | null {
  return assessed === 0 ? null : count / assessed;
}

function percentRows(rows: TallyRow[], assessed: BySex<number>): PercentRow[] {
  return rows.map((r) => ({
    label: r.label,
    male: share(r.male, assessed.male),
    female: share(r.female, assessed.female),
    total: share(r.total, assessed.total),
  }));
}

/**
 * Counts learners per reading level and per reading profile, split by sex, and
 * averages the Part 2 measures over the learners who have them.
 *
 * Learners with no computed level are counted as `unscored` rather than being
 * dropped, so `assessed + unscored.total` always equals the class size — a
 * tally that quietly loses learners is worse than no tally.
 *
 * Deliberate divergence from the workbook: its Class Summary computes the
 * Total average as (male average + female average) / 2, which is wrong whenever
 * the two sexes have different assessed counts and blank whenever one of them
 * is empty. The true mean over all assessed learners is used here instead.
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
      if (entry.sex === "M") unscored.male += 1;
      else unscored.female += 1;
      unscored.total += 1;
      continue;
    }

    assessedEntries.push(entry);
    add(levels, entry.readingLevel, entry.sex);
    // A learner can hold a level without a profile (no passage read yet), so
    // the profile tally is allowed to total less than the level tally.
    if (entry.readingProfile !== null) {
      add(profiles, entry.readingProfile, entry.sex);
    }
  }

  const males = assessedEntries.filter((e) => e.sex === "M");
  const females = assessedEntries.filter((e) => e.sex === "F");

  const enrolledBySex: BySex<number> = {
    male: entries.filter((e) => e.sex === "M").length,
    female: entries.filter((e) => e.sex === "F").length,
    total: entries.length,
  };
  const assessedBySex: BySex<number> = {
    male: males.length,
    female: females.length,
    total: assessedEntries.length,
  };

  const levelRows = [...levels.values()];
  const profileRows = [...profiles.values()];

  return {
    enrolled: entries.length,
    assessed: assessedEntries.length,
    enrolledBySex,
    assessedBySex,
    unscored,
    levels: levelRows,
    profiles: profileRows,
    averages: {
      male: averagesOf(males),
      female: averagesOf(females),
      total: averagesOf(assessedEntries),
    },
    percents: {
      levels: percentRows(levelRows, assessedBySex),
      profiles: percentRows(profileRows, assessedBySex),
    },
  };
}
