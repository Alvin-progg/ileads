import {
  bySex,
  countsBySex,
  mean,
  standardDeviation,
  type BySex,
  type Sex,
} from "./summary.ts";

export type { BySex, Sex };

export type ExamEntry = {
  sex: Sex;
  /** Null when this learner has no score for the subject/quarter yet. */
  score: number | null;
};

export type ExamSubjectSummary = {
  enrolledBySex: BySex<number>;
  assessedBySex: BySex<number>;
  meanBySex: BySex<number | null>;
  sdBySex: BySex<number | null>;
  /** Fraction 0-100. Null when the subject has no HPS set for this quarter. */
  mpsBySex: BySex<number | null>;
};

/**
 * Mean, population SD and MPS for one subject in one quarter, split by sex.
 *
 * MPS is null across the board when `hps` is null — the subject's ceiling has
 * never been set for this quarter, so there is nothing to divide by. That is
 * different from a class with nobody assessed yet, where mean/SD are also
 * null but for lack of any scores rather than lack of a ceiling.
 */
export function summariseExamSubject(
  entries: ExamEntry[],
  hps: number | null
): ExamSubjectSummary {
  const assessedEntries = entries.filter((e) => e.score !== null);
  const groups = bySex(assessedEntries);

  const scoresOf = (group: ExamEntry[]) =>
    group.map((e) => e.score as number);

  const meanBySex: BySex<number | null> = {
    male: mean(scoresOf(groups.male)),
    female: mean(scoresOf(groups.female)),
    total: mean(scoresOf(groups.total)),
  };

  const sdOf = (group: ExamEntry[]): number | null => {
    const scores = scoresOf(group);
    return scores.length === 0 ? null : standardDeviation(scores);
  };

  const mpsOf = (m: number | null): number | null =>
    hps === null || m === null ? null : (m / hps) * 100;

  return {
    enrolledBySex: countsBySex(entries),
    assessedBySex: countsBySex(assessedEntries),
    meanBySex,
    sdBySex: {
      male: sdOf(groups.male),
      female: sdOf(groups.female),
      total: sdOf(groups.total),
    },
    mpsBySex: {
      male: mpsOf(meanBySex.male),
      female: mpsOf(meanBySex.female),
      total: mpsOf(meanBySex.total),
    },
  };
}
