import {
  addToTally,
  bump,
  countsBySex,
  emptyTally,
  percentRows,
  type BySex,
  type PercentRow,
  type Sex,
  type TallyRow,
} from "./summary.ts";

export type { BySex, PercentRow, Sex, TallyRow };

/**
 * The labels Phil-IRI's Word Reading / Comprehension / Overall levels can
 * produce. Fixed across grade and language — unlike CRLA, these cut-offs are
 * instrument-wide percentages, not grade-tuned point totals, so there is no
 * rules-driven label list to read.
 */
export const LEVELS = ["Independent", "Instructional", "Frustration"];

export type PhiliriSummaryEntry = {
  sex: Sex;
  wordReadingLevel: string | null;
  comprehensionLevel: string | null;
  overallLevel: string | null;
};

export type PhiliriSummary = {
  enrolled: number;
  /** Learners with a computed Overall Level. */
  assessed: number;
  enrolledBySex: BySex<number>;
  assessedBySex: BySex<number>;
  /** Learners with nothing encoded yet — kept visible so the tally reconciles. */
  unscored: TallyRow;
  wordReadingLevels: TallyRow[];
  comprehensionLevels: TallyRow[];
  overallLevels: TallyRow[];
  percents: {
    wordReadingLevels: PercentRow[];
    comprehensionLevels: PercentRow[];
    overallLevels: PercentRow[];
  };
};

/**
 * Counts learners per Word Reading Level, Comprehension Level and Overall
 * Level, split by sex. A learner counts as assessed once they have an
 * Overall Level; a level missing on only one side (e.g. comprehension not
 * yet encoded) still counts toward `assessed` via `overallLevel`, but is
 * simply absent from that side's tally rather than forced to zero.
 */
export function summarisePhiliri(entries: PhiliriSummaryEntry[]): PhiliriSummary {
  const wordReadingLevels = emptyTally(LEVELS);
  const comprehensionLevels = emptyTally(LEVELS);
  const overallLevels = emptyTally(LEVELS);
  const unscored: TallyRow = {
    label: "Not yet assessed",
    male: 0,
    female: 0,
    total: 0,
  };

  const assessedEntries: PhiliriSummaryEntry[] = [];

  for (const entry of entries) {
    if (entry.overallLevel === null) {
      bump(unscored, entry.sex);
      continue;
    }

    assessedEntries.push(entry);
    addToTally(overallLevels, entry.overallLevel, entry.sex);
    if (entry.wordReadingLevel !== null) {
      addToTally(wordReadingLevels, entry.wordReadingLevel, entry.sex);
    }
    if (entry.comprehensionLevel !== null) {
      addToTally(comprehensionLevels, entry.comprehensionLevel, entry.sex);
    }
  }

  const assessedBySex = countsBySex(assessedEntries);
  const wordReadingRows = [...wordReadingLevels.values()];
  const comprehensionRows = [...comprehensionLevels.values()];
  const overallRows = [...overallLevels.values()];

  return {
    enrolled: entries.length,
    assessed: assessedEntries.length,
    enrolledBySex: countsBySex(entries),
    assessedBySex,
    unscored,
    wordReadingLevels: wordReadingRows,
    comprehensionLevels: comprehensionRows,
    overallLevels: overallRows,
    percents: {
      wordReadingLevels: percentRows(wordReadingRows, assessedBySex),
      comprehensionLevels: percentRows(comprehensionRows, assessedBySex),
      overallLevels: percentRows(overallRows, assessedBySex),
    },
  };
}
