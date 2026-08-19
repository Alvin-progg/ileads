// "Current" per-learner status for the school-head dashboard: whichever
// round a learner most recently has a record in, per tool (and per language
// for CRLA/Phil-IRI). Not a scoring rule — lives outside lib/scoring/ on
// purpose — just a different set of entries (latest-per-learner instead of
// one-specific-round) fed into the existing, unmodified summarise functions.

import { toClassRecordRow } from "../scoring/class-record.ts";
import { computeRma } from "../scoring/rma.ts";
import { computePhiliri } from "../scoring/philiri.ts";
import type { CrlaRules, PhiliriLanguageRules, RmaRules } from "../scoring/types.ts";
import type { SummaryEntry } from "../scoring/class-summary.ts";
import type { RmaSummaryEntry } from "../scoring/rma-summary.ts";
import type { PhiliriSummaryEntry } from "../scoring/philiri-summary.ts";

export type RoundRef = { id: number; sequence: number };
export type LearnerRef = { id: string; sex: "M" | "F" };

/** The row from the highest-sequence round each key (learner, or learner+language) appears in. */
function pickLatest<T extends { round_id: number }>(
  rows: T[],
  rounds: RoundRef[],
  keyOf: (row: T) => string
): Map<string, T> {
  const sequenceOf = new Map(rounds.map((r) => [r.id, r.sequence]));
  const best = new Map<string, T>();
  const bestSequence = new Map<string, number>();

  for (const row of rows) {
    const key = keyOf(row);
    const sequence = sequenceOf.get(row.round_id) ?? -1;
    const prevSequence = bestSequence.get(key);
    if (prevSequence === undefined || sequence > prevSequence) {
      best.set(key, row);
      bestSequence.set(key, sequence);
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// CRLA
// ---------------------------------------------------------------------------

export type CrlaRow = {
  learner_id: string;
  round_id: number;
  language: string;
  task1: number | null;
  task2l: number | null;
  task2h: number | null;
  story_no: number | null;
  miscues: number | null;
  reading_secs: number | null;
  comprehension_correct: number | null;
};

export type CrlaCurrentEntry = SummaryEntry & { learnerId: string };

/**
 * One entry per learner in `learners`, using each learner's latest-encoded
 * row for `language`. A learner with no row for this language still gets an
 * entry (null level) — the summary functions rely on that to keep their
 * "not yet assessed" tally reconciling against the full class.
 */
export function currentCrlaEntries(
  learners: LearnerRef[],
  rows: CrlaRow[],
  rounds: RoundRef[],
  rules: CrlaRules,
  language: string
): CrlaCurrentEntry[] {
  const latest = pickLatest(
    rows.filter((r) => r.language === language),
    rounds,
    (r) => r.learner_id
  );

  return learners.map((learner) => {
    const raw = latest.get(learner.id);
    if (!raw) {
      return {
        learnerId: learner.id,
        sex: learner.sex,
        readingLevel: null,
        readingProfile: null,
      };
    }

    const record = toClassRecordRow(
      {
        task1: raw.task1,
        task2Low: raw.task2l,
        task2High: raw.task2h,
        storyNo: raw.story_no,
        miscues: raw.miscues,
        readingSeconds: raw.reading_secs,
        comprehensionCorrect: raw.comprehension_correct,
      },
      rules,
      language
    );

    return {
      learnerId: learner.id,
      sex: learner.sex,
      readingLevel: record.readingLevel,
      readingProfile: record.readingProfile,
      fluency: record.fluency,
      comprehensionPercent: record.comprehensionPercent,
      wpm: record.wpm,
    };
  });
}

// ---------------------------------------------------------------------------
// RMA
// ---------------------------------------------------------------------------

export type RmaRow = {
  learner_id: string;
  round_id: number;
  task_scores: Record<string, number | null> | null;
};

export type RmaCurrentEntry = RmaSummaryEntry & { learnerId: string };

function hasAnyRmaScore(row: RmaRow): boolean {
  return Object.values(row.task_scores ?? {}).some((v) => typeof v === "number");
}

export function currentRmaEntries(
  learners: LearnerRef[],
  rows: RmaRow[],
  rounds: RoundRef[],
  rules: RmaRules
): RmaCurrentEntry[] {
  // A row with no task typed yet (e.g. an autosave draft that was cleared)
  // must not be mistaken for "assessed with a score of zero" — RMA sums
  // missing tasks as zero, so an untouched row and a genuine zero score are
  // otherwise indistinguishable.
  const latest = pickLatest(
    rows.filter(hasAnyRmaScore),
    rounds,
    (r) => r.learner_id
  );

  return learners.map((learner) => {
    const raw = latest.get(learner.id);
    if (!raw) {
      return {
        learnerId: learner.id,
        sex: learner.sex,
        total: null,
        percent: null,
        proficiencyLevel: null,
        taskMastery: {},
      };
    }

    const computed = computeRma({ taskScores: raw.task_scores ?? {} }, rules);
    return {
      learnerId: learner.id,
      sex: learner.sex,
      total: computed.total,
      percent: computed.percent,
      proficiencyLevel: computed.proficiencyLevel,
      taskMastery: computed.taskMastery,
    };
  });
}

// ---------------------------------------------------------------------------
// Phil-IRI
// ---------------------------------------------------------------------------

export type PhiliriRow = {
  learner_id: string;
  round_id: number;
  language: string;
  word_count: number | null;
  miscues: number | null;
  comprehension_items: number | null;
  comprehension_correct: number | null;
};

export type PhiliriCurrentEntry = PhiliriSummaryEntry & { learnerId: string };

export function currentPhiliriEntries(
  learners: LearnerRef[],
  rows: PhiliriRow[],
  rounds: RoundRef[],
  langRules: PhiliriLanguageRules,
  language: string
): PhiliriCurrentEntry[] {
  const latest = pickLatest(
    rows.filter((r) => r.language === language),
    rounds,
    (r) => r.learner_id
  );

  return learners.map((learner) => {
    const raw = latest.get(learner.id);
    if (!raw) {
      return {
        learnerId: learner.id,
        sex: learner.sex,
        wordReadingLevel: null,
        comprehensionLevel: null,
        overallLevel: null,
      };
    }

    const computed = computePhiliri(
      {
        wordCount: raw.word_count,
        miscues: raw.miscues,
        comprehensionItems: raw.comprehension_items,
        comprehensionCorrect: raw.comprehension_correct,
      },
      langRules
    );

    return {
      learnerId: learner.id,
      sex: learner.sex,
      wordReadingLevel: computed.wordReadingLevel,
      comprehensionLevel: computed.comprehensionLevel,
      overallLevel: computed.overallLevel,
    };
  });
}

/**
 * One entry per learner in `learners`, using each learner's row for a
 * specific round (not the latest) — for charts that need to compare rounds
 * (e.g. Phil-IRI Pre vs Post) instead of collapsing to current status.
 */
export function philiriEntriesForRound(
  learners: LearnerRef[],
  rows: PhiliriRow[],
  roundId: number,
  langRules: PhiliriLanguageRules,
  language: string
): PhiliriCurrentEntry[] {
  const byLearner = new Map(
    rows
      .filter((r) => r.round_id === roundId && r.language === language)
      .map((r) => [r.learner_id, r])
  );

  return learners.map((learner) => {
    const raw = byLearner.get(learner.id);
    if (!raw) {
      return {
        learnerId: learner.id,
        sex: learner.sex,
        wordReadingLevel: null,
        comprehensionLevel: null,
        overallLevel: null,
      };
    }

    const computed = computePhiliri(
      {
        wordCount: raw.word_count,
        miscues: raw.miscues,
        comprehensionItems: raw.comprehension_items,
        comprehensionCorrect: raw.comprehension_correct,
      },
      langRules
    );

    return {
      learnerId: learner.id,
      sex: learner.sex,
      wordReadingLevel: computed.wordReadingLevel,
      comprehensionLevel: computed.comprehensionLevel,
      overallLevel: computed.overallLevel,
    };
  });
}

export { pickLatest };

// ---------------------------------------------------------------------------
// Encoding progress tracker
// ---------------------------------------------------------------------------

/**
 * Distinct learner ids present per key (e.g. `${roundId}` or
 * `${roundId}:${language}`), for the encoding-progress tracker's numerator.
 * Presence-only — a learner with any row counts, since the tracker's job is
 * "has this round been touched for this learner," not re-scoring it.
 */
export function encodedLearnerIdsByKey<T>(
  rows: T[],
  keyOf: (row: T) => string,
  learnerIdOf: (row: T) => string
): Map<string, Set<string>> {
  const byKey = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = keyOf(row);
    const set = byKey.get(key) ?? new Set<string>();
    set.add(learnerIdOf(row));
    byKey.set(key, set);
  }
  return byKey;
}

export { hasAnyRmaScore };
