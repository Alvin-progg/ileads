"use client";

/** Prints the record. Screen-only — the button must never appear on paper. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-[10px] bg-emerald-600 px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-emerald-700"
    >
      Print
    </button>
  );
}
