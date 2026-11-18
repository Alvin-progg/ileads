import { share } from "./summary.ts";
import { completedTala10 } from "./tala.ts";
import type { TalaMovement, TalaRules } from "./types.ts";

export type TalaSummaryEntry = {
  profile: string | null;
  movement: TalaMovement | null;
  frequency: number | null;
};

export type TalaCount = { label: string; count: number; percent: number | null };

export type TalaSummary = {
  enrolled: number;
  /** Learners with a full profile. Percentages divide by this, not enrolled. */
  assessed: number;
  profiles: TalaCount[];
  programs: TalaCount[];
  movements: { label: TalaMovement; count: number }[];
  tala10: number;
  philiriEquivalent: TalaCount[];
};

const MOVEMENTS: TalaMovement[] = ["Moved up", "Maintained", "Moved down", "First record"];

export function summariseTala(
  entries: TalaSummaryEntry[],
  rules: TalaRules
): TalaSummary {
  const assessedEntries = entries.filter((e) => e.profile !== null);
  const assessed = assessedEntries.length;
  const count = (labels: string[]) =>
    assessedEntries.filter((e) => labels.includes(e.profile!)).length;
  const row = (label: string, n: number): TalaCount => ({
    label,
    count: n,
    percent: share(n, assessed),
  });

  return {
    enrolled: entries.length,
    assessed,
    profiles: rules.profiles.map((p) => row(p.label, count([p.label]))),
    programs: rules.profiles.map((p) => row(p.program, count([p.label]))),
    movements: MOVEMENTS.map((label) => ({
      label,
      count: entries.filter((e) => e.movement === label).length,
    })),
    tala10: entries.filter((e) => completedTala10(e.frequency, rules)).length,
    philiriEquivalent: rules.philiriEquivalent.map((c) =>
      row(c.category, count(c.profiles))
    ),
  };
}
