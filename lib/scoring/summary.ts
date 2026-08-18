// Shapes and arithmetic shared by every class summary (CRLA, RMA), so the two
// forms cannot drift apart in how they count, average or divide.

export type Sex = "M" | "F";

export type TallyRow = {
  label: string;
  male: number;
  female: number;
  total: number;
};

/** A count expressed as a fraction of that column's assessed learners. */
export type PercentRow = {
  label: string;
  male: number | null;
  female: number | null;
  total: number | null;
};

/** Anything reported per sex carries its own total column alongside M and F. */
export type BySex<T> = { male: T; female: T; total: T };

/** One row per label, all zero, so an empty band still prints its row. */
export function emptyTally(labels: string[]): Map<string, TallyRow> {
  return new Map(
    labels.map((label) => [label, { label, male: 0, female: 0, total: 0 }])
  );
}

/** Adds one learner to a row that stands on its own, outside a tally. */
export function bump(row: TallyRow, sex: Sex) {
  if (sex === "M") row.male += 1;
  else row.female += 1;
  row.total += 1;
}

export function addToTally(
  tally: Map<string, TallyRow>,
  label: string,
  sex: Sex
) {
  const row = tally.get(label);
  if (!row) return;
  bump(row, sex);
}

/** Mean of the values that exist. Null — never NaN — when none do. */
export function mean(values: (number | null | undefined)[]): number | null {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  if (present.length === 0) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}

/** Share of assessed learners in a band. Null when nobody was assessed. */
export function share(count: number, assessed: number): number | null {
  return assessed === 0 ? null : count / assessed;
}

export function percentRows(
  rows: TallyRow[],
  assessed: BySex<number>
): PercentRow[] {
  return rows.map((r) => ({
    label: r.label,
    male: share(r.male, assessed.male),
    female: share(r.female, assessed.female),
    total: share(r.total, assessed.total),
  }));
}

/**
 * Splits entries into the three reported columns.
 *
 * Deliberate divergence from the workbooks: they compute the Total average as
 * (male average + female average) / 2, which is wrong whenever the two sexes
 * have different assessed counts and blank whenever one of them is empty. Every
 * total here is taken over all the entries instead.
 */
export function bySex<T extends { sex: Sex }>(entries: T[]): BySex<T[]> {
  return {
    male: entries.filter((e) => e.sex === "M"),
    female: entries.filter((e) => e.sex === "F"),
    total: entries,
  };
}

export function countsBySex<T extends { sex: Sex }>(entries: T[]): BySex<number> {
  const groups = bySex(entries);
  return {
    male: groups.male.length,
    female: groups.female.length,
    total: groups.total.length,
  };
}
