import { firstMatchingLabel } from "./predicates.ts";
import type { RmaInput, RmaResult, RmaRules } from "./types.ts";

/**
 * Computes the RMA total, percentage and proficiency level from raw task scores.
 *
 * Missing tasks score zero — the instrument sums across the task columns and
 * has no "incomplete" state.
 *
 * `proficiencyLevel` comes back null for two different reasons, and callers
 * have to tell them apart:
 *
 * 1. `rules.levels` is empty — the grade's cut-offs have not been transcribed,
 *    so there is no level to report. Show it as not yet configured.
 * 2. The total is zero and `blankWhenTotalZero` is set — the instrument itself
 *    blanks the percentage, and with it the level.
 *
 * A task whose `max` is null is summed but left out of `taskMastery`: mastery
 * is a fraction of the task maximum, and inventing one would be a guess.
 */
export function computeRma(input: RmaInput, rules: RmaRules): RmaResult {
  const taskMastery: Record<string, boolean> = {};
  let total = 0;

  for (const task of rules.tasks) {
    const raw = input.taskScores[task.key] ?? 0;
    total += raw;
    if (task.max !== null) {
      taskMastery[task.key] = raw / task.max >= rules.taskMasteryThreshold;
    }
  }

  // A zero total blanks the percentage in the instrument, which in turn blanks
  // the level — so a zero-scoring learner lands in no band at all.
  if (rules.blankWhenTotalZero && total === 0) {
    return { total, percent: null, proficiencyLevel: null, taskMastery };
  }

  const percent = total / rules.max;

  return {
    total,
    percent,
    proficiencyLevel: firstMatchingLabel(percent, rules.levels),
    taskMastery,
  };
}
