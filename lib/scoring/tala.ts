import type { TalaInput, TalaMovement, TalaResult, TalaRules } from "./types.ts";

/**
 * Each sign is reported as soon as its own input exists; profile and program
 * stay null until both do.
 */
export function computeTala(input: TalaInput, rules: TalaRules): TalaResult {
  const speed =
    input.wcpm === null ? null : input.wcpm >= rules.wcpmBenchmark ? "+" : "-";
  const comprehension =
    input.comprehensionCorrect === null
      ? null
      : input.comprehensionCorrect >= rules.comprehension.plusAt
        ? "+"
        : "-";

  const match =
    speed === null || comprehension === null
      ? undefined
      : rules.profiles.find(
          (p) => p.speed === speed && p.comprehension === comprehension
        );

  return {
    speed,
    comprehension,
    profile: match?.label ?? null,
    description: match?.description ?? null,
    program: match?.program ?? null,
  };
}

/** Compares profile positions in rules order (lowest to highest). */
export function computeTalaMovement(
  prevProfile: string | null,
  currProfile: string | null,
  rules: TalaRules
): TalaMovement | null {
  if (currProfile === null) return null;
  if (prevProfile === null) return "First record";
  const order = rules.profiles.map((p) => p.label);
  const diff = order.indexOf(currProfile) - order.indexOf(prevProfile);
  return diff > 0 ? "Moved up" : diff < 0 ? "Moved down" : "Maintained";
}

export function completedTala10(
  frequency: number | null,
  rules: TalaRules
): boolean {
  return frequency !== null && frequency >= rules.readingsPerMonth;
}
