import { satisfies } from "./predicates.ts";
import type {
  CrlaInput,
  CrlaLanguageRules,
  CrlaProfileRules,
  CrlaResult,
  CrlaRules,
  CrlaTotalRule,
} from "./types.ts";

type LanguageRules = CrlaLanguageRules & { profile: CrlaProfileRules };

function part1Total(
  input: CrlaInput,
  rule: CrlaTotalRule
): { total: number | null; branch?: "low" | "high" } {
  const { task1, task2Low, task2High } = input;

  if (rule.mode === "sum") {
    // Blank only when Task 1 itself is blank.
    if (task1 === null) return { total: null };
    if (rule.zeroOverride && task1 === rule.zeroOverride.whenTask1) {
      return { total: rule.zeroOverride.total };
    }
    // Only one Task 2 column is in play for this model; sum tolerates either.
    return { total: task1 + (task2Low ?? 0) + (task2High ?? 0) };
  }

  // task1_branch: blank only when both Task 1 and the low form are blank.
  if (task1 === null && task2Low === null) return { total: null };

  const t1 = task1 ?? 0;
  if (t1 < rule.branchAt) {
    return { total: t1 + (task2Low ?? 0), branch: "low" };
  }
  return { total: t1 + rule.autoCredit + (task2High ?? 0), branch: "high" };
}

function readingLevelFor(
  total: number,
  branch: "low" | "high" | undefined,
  rules: LanguageRules
): string | null {
  const band = rules.part1.levels.find((l) => {
    if (l.branch !== undefined && l.branch !== branch) return false;
    if (l.min !== undefined && total < l.min) return false;
    if (l.max !== undefined && total > l.max) return false;
    return true;
  });
  return band?.label ?? null;
}

function passageWords(
  storyNo: number | null,
  rules: LanguageRules
): number | null {
  if (storyNo === null) return null;
  return rules.passages[String(storyNo)] ?? rules.passageDefault ?? null;
}

function readingProfileFor(
  readingLevel: string | null,
  fluency: number | null,
  comprehension: number,
  storyNo: number | null,
  profile: CrlaProfileRules
): string | null {
  if (readingLevel === null) return null;

  // Gated levels never reach Part 2.
  if (profile.gate.whenLevelIn.includes(readingLevel)) return profile.gate.label;

  // Part 2 needs a passage actually read.
  if (storyNo === null || storyNo <= 0 || fluency === null) return null;

  for (const rule of profile.rules) {
    const hit = rule.any.some(
      (clause) =>
        (clause.fluency === undefined || satisfies(fluency, clause.fluency)) &&
        (clause.comprehension === undefined ||
          satisfies(comprehension, clause.comprehension))
    );
    if (hit) return rule.label;
  }

  return profile.fallback;
}

/**
 * Computes every derived CRLA value from raw scores.
 *
 * Unscorable values come back as null rather than throwing or defaulting —
 * the instrument leaves those cells blank, and a row that cannot be scored
 * must stay visibly unscored.
 */
export function computeCrla(
  input: CrlaInput,
  rules: CrlaRules,
  language: string
): CrlaResult {
  const langRules = rules.languages[language];
  if (!langRules) {
    throw new Error(
      `No CRLA rules for language "${language}" (have: ${Object.keys(rules.languages).join(", ")})`
    );
  }

  const { total, branch } = part1Total(input, langRules.part1.total);
  const readingLevel =
    total === null ? null : readingLevelFor(total, branch, langRules);

  const words = passageWords(input.storyNo, langRules);
  const wordsRead = words === null ? null : words - (input.miscues ?? 0);
  const fluency = words === null || wordsRead === null ? null : wordsRead / words;

  const secs = input.readingSeconds;
  const wpm =
    input.storyNo !== null &&
    input.storyNo > 0 &&
    wordsRead !== null &&
    wordsRead > 0 &&
    secs !== null &&
    secs > 0
      ? (wordsRead / secs) * 60
      : null;

  const readingProfile = readingProfileFor(
    readingLevel,
    fluency,
    input.comprehensionCorrect ?? 0,
    input.storyNo,
    langRules.profile
  );

  return {
    part1Total: total,
    readingLevel,
    wordsRead,
    wpm,
    fluency,
    readingProfile,
  };
}
