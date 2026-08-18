import type { CrlaRules } from "./types.ts";

export type Sex = "M" | "F";

export type TallyRow = {
  label: string;
  male: number;
  female: number;
  total: number;
};

export type ClassSummary = {
  enrolled: number;
  /** Learners with a computed Part 1 level. */
  assessed: number;
  /** Learners with nothing encoded yet — kept visible so the tally reconciles. */
  unscored: TallyRow;
  levels: TallyRow[];
  profiles: TallyRow[];
};

/**
 * The labels a grade's instrument can produce, in the order the rules declare
 * them, so a band with zero learners still prints its row instead of vanishing
 * from the tally.
 */
function levelLabels(rules: CrlaRules, language: string): string[] {
  return rules.languages[language].part1.levels.map((l) => l.label);
}

function profileLabels(rules: CrlaRules, language: string): string[] {
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

/**
 * Counts learners per reading level and per reading profile, split by sex.
 *
 * Learners with no computed level are counted as `unscored` rather than being
 * dropped, so `assessed + unscored.total` always equals the class size — a
 * tally that quietly loses learners is worse than no tally.
 */
export function summarise(
  entries: { sex: Sex; readingLevel: string | null; readingProfile: string | null }[],
  rules: CrlaRules,
  language: string
): ClassSummary {
  const levels = emptyTally(levelLabels(rules, language));
  const profiles = emptyTally(profileLabels(rules, language));
  const unscored: TallyRow = { label: "Not yet assessed", male: 0, female: 0, total: 0 };

  let assessed = 0;

  for (const entry of entries) {
    if (entry.readingLevel === null) {
      if (entry.sex === "M") unscored.male += 1;
      else unscored.female += 1;
      unscored.total += 1;
      continue;
    }

    assessed += 1;
    add(levels, entry.readingLevel, entry.sex);
    // A learner can hold a level without a profile (no passage read yet), so
    // the profile tally is allowed to total less than the level tally.
    if (entry.readingProfile !== null) {
      add(profiles, entry.readingProfile, entry.sex);
    }
  }

  return {
    enrolled: entries.length,
    assessed,
    unscored,
    levels: [...levels.values()],
    profiles: [...profiles.values()],
  };
}
