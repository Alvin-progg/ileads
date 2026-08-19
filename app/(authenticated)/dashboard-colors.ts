// Shared chart color roles for the school-head dashboard.
//
// STATUS and CATEGORICAL are deliberately separate palettes: STATUS encodes
// a state (complete/behind, above/below a threshold) and must never be
// reused for series identity; CATEGORICAL distinguishes unordered-by-value
// categories (e.g. DepEd levels) and is assigned by fixed index, never by
// sort order, so a chart can't silently relabel a level's color.

export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  critical: "#d03b3b",
} as const;

// 8-slot categorical ramp (dataviz skill default palette), colorblind-safe
// for adjacent pairs in grouped/stacked bars.
export const CATEGORICAL = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
] as const;

export const MUTED_TRACK = "#e1e0d9";
export const MUTED_TEXT = "#898781";

/** Class MPS at or above this fraction counts as having cleared mastery. */
export const EXAM_MASTERY_THRESHOLD = 75;

export function colorForLevel(index: number): string {
  return CATEGORICAL[index % CATEGORICAL.length];
}
