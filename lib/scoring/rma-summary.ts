import type { RmaRules } from "./types.ts";
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

/** One learner's row, as the Class Record already computed it. */
export type RmaSummaryEntry = {
  sex: Sex;
  /** Null when nothing has been encoded for this learner yet. */
  total: number | null;
  /** Fraction 0-1. Null when the instrument blanks it (a zero total). */
  percent: number | null;
  /** Null when the grade has no bands, or when the percentage is blank. */
  proficiencyLevel: string | null;
  /** Only tasks with a stated maximum appear here. */
  taskMastery: Record<string, boolean>;
};

export type RmaSummary = {
  enrolled: number;
  /** Learners with something encoded. */
  assessed: number;
  enrolledBySex: BySex<number>;
  assessedBySex: BySex<number>;
  /** Learners with nothing encoded yet — kept visible so the tally reconciles. */
  unscored: TallyRow;
  levels: TallyRow[];
  /**
   * Assessed learners with no level: either the grade has no bands yet, or the
   * instrument blanked the percentage. Keeps the level tally reconciling.
   */
  unlevelled: TallyRow;
  /** Per task, learners at or above the mastery threshold. */
  taskMastery: TallyRow[];
  /** Tasks whose maximum is unknown, so mastery cannot be counted. */
  masteryUnavailable: boolean;
  /** The workbook's "Overall Score Average" — mean raw total per column. */
  averageTotal: BySex<number | null>;
  percents: { levels: PercentRow[] };
};

/** Level labels in the order the rules declare them. Empty when unconfigured. */
export function proficiencyLabels(rules: RmaRules): string[] {
  return rules.levels.map((l) => l.label);
}

/**
 * Counts learners per proficiency level and per mastered task, split by sex,
 * and averages the raw totals.
 *
 * Two reconciliation rules matter here, both for the same reason — a tally that
 * loses learners is worse than no tally:
 *
 * 1. `assessed + unscored.total` always equals the class size.
 * 2. `levels + unlevelled` always equals `assessed`. A Grade 1 or 2 class lands
 *    entirely in `unlevelled` because those grades have no bands yet, and that
 *    has to be visible rather than silently missing from the form.
 *
 * Tasks with an unknown maximum are reported as no rows at all (see
 * `masteryUnavailable`), never as zero counts that would read as "nobody
 * mastered this".
 */
export function summariseRma(
  entries: RmaSummaryEntry[],
  rules: RmaRules
): RmaSummary {
  const levels = emptyTally(proficiencyLabels(rules));
  const unscored: TallyRow = {
    label: "Not yet assessed",
    male: 0,
    female: 0,
    total: 0,
  };
  const unlevelled: TallyRow = {
    label: rules.levels.length === 0 ? "Level not yet configured" : "No level",
    male: 0,
    female: 0,
    total: 0,
  };

  const masteredTasks = rules.tasks.filter((t) => t.max !== null);
  const mastery = emptyTally(masteredTasks.map((t) => t.label));

  const assessedEntries: RmaSummaryEntry[] = [];

  for (const entry of entries) {
    if (entry.total === null) {
      bump(unscored, entry.sex);
      continue;
    }

    assessedEntries.push(entry);

    if (entry.proficiencyLevel === null) {
      bump(unlevelled, entry.sex);
    } else {
      addToTally(levels, entry.proficiencyLevel, entry.sex);
    }

    for (const task of masteredTasks) {
      if (entry.taskMastery[task.key]) addToTally(mastery, task.label, entry.sex);
    }
  }

  const assessedGroups = bySex(assessedEntries);
  const assessedBySex = countsBySex(assessedEntries);
  const levelRows = [...levels.values()];

  return {
    enrolled: entries.length,
    assessed: assessedEntries.length,
    enrolledBySex: countsBySex(entries),
    assessedBySex,
    unscored,
    levels: levelRows,
    unlevelled,
    taskMastery: [...mastery.values()],
    masteryUnavailable: masteredTasks.length < rules.tasks.length,
    averageTotal: {
      male: mean(assessedGroups.male.map((e) => e.total)),
      female: mean(assessedGroups.female.map((e) => e.total)),
      total: mean(assessedGroups.total.map((e) => e.total)),
    },
    percents: { levels: percentRows(levelRows, assessedBySex) },
  };
}
