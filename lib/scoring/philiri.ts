import { firstMatchingLabel } from "./predicates.ts";
import type { PhiliriInput, PhiliriLanguageRules, PhiliriResult } from "./types.ts";

/**
 * Severity order for resolving Overall Level: Frustration is the worst
 * outcome, Independent the best. Overall Level takes whichever component
 * level is worse, never the higher-scoring one.
 */
const SEVERITY: Record<string, number> = {
  Frustration: 0,
  Instructional: 1,
  Independent: 2,
};

export function computePhiliri(
  input: PhiliriInput,
  rules: PhiliriLanguageRules
): PhiliriResult {
  const wordReadingScore =
    input.wordCount === null || input.wordCount === 0
      ? null
      : (input.wordCount - (input.miscues ?? 0)) / input.wordCount;
  const wordReadingLevel =
    wordReadingScore === null
      ? null
      : firstMatchingLabel(wordReadingScore * 100, rules.wordReadingLevels);

  const comprehensionScore =
    input.comprehensionItems === null || input.comprehensionItems === 0
      ? null
      : (input.comprehensionCorrect ?? 0) / input.comprehensionItems;
  const comprehensionLevel =
    comprehensionScore === null
      ? null
      : firstMatchingLabel(comprehensionScore * 100, rules.comprehensionLevels);

  let overallLevel: string | null = null;
  if (wordReadingLevel !== null && comprehensionLevel !== null) {
    overallLevel =
      SEVERITY[wordReadingLevel] <= SEVERITY[comprehensionLevel]
        ? wordReadingLevel
        : comprehensionLevel;
  }

  return {
    wordReadingScore,
    wordReadingLevel,
    comprehensionScore,
    comprehensionLevel,
    overallLevel,
  };
}
