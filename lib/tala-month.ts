// Months are carried as "YYYY-MM" in URLs and stored as the first of the month.

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonthParam(value: string | undefined): value is string {
  return value !== undefined && MONTH_RE.test(value);
}

/** Current month in Asia/Manila (en-CA formats as YYYY-MM-DD). */
export function currentMonth(): string {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
    .slice(0, 7);
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + by;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

/** The date stored in tala_results.month. */
export function monthStart(month: string): string {
  return `${month}-01`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
