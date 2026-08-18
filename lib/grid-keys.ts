"use client";

/**
 * Enter/Arrow navigation for an entry grid.
 *
 * Cells opt in by carrying `data-row` and `data-col`; Tab is left to the
 * browser so horizontal movement follows the DOM. Disabled cells are skipped,
 * so keyboard-only entry never lands somewhere nothing can be typed.
 */
export function handleColumnKeyDown(
  e: React.KeyboardEvent,
  rowIndex: number,
  col: string,
  rowCount: number
) {
  const isDown = e.key === "Enter" ? !e.shiftKey : e.key === "ArrowDown";
  const isUp = e.key === "Enter" ? e.shiftKey : e.key === "ArrowUp";
  if (!isDown && !isUp) return;

  e.preventDefault();
  const step = isDown ? 1 : -1;

  for (let r = rowIndex + step; r >= 0 && r < rowCount; r += step) {
    const el = document.querySelector<HTMLElement>(
      `[data-row="${r}"][data-col="${col}"]`
    );
    if (el && !(el as HTMLInputElement).disabled) {
      el.focus();
      if (el instanceof HTMLInputElement) el.select();
      return;
    }
  }
}
