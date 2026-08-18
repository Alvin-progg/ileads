import type { Predicate } from "./types.ts";

/**
 * True when `value` satisfies every bound present on `p`.
 *
 * The source instruments mix strictness deliberately (`<=25%` next to `<51%`,
 * `>75%` next to `<76%`), so each bound is applied exactly as written rather
 * than normalised into a tidier form.
 */
export function satisfies(value: number, p: Predicate): boolean {
  if (p.gt !== undefined && !(value > p.gt)) return false;
  if (p.gte !== undefined && !(value >= p.gte)) return false;
  if (p.lt !== undefined && !(value < p.lt)) return false;
  if (p.lte !== undefined && !(value <= p.lte)) return false;
  return true;
}

/** First band whose predicate the value satisfies; null if none do. */
export function firstMatchingLabel<T extends Predicate & { label: string }>(
  value: number,
  bands: T[]
): string | null {
  return bands.find((b) => satisfies(value, b))?.label ?? null;
}
