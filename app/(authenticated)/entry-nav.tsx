"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TabGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-neutral-500">{label}</span>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}

/**
 * A button rather than a link: every switch has to flush unsaved rows first,
 * so navigation cannot be left to the browser.
 */
export function Tab({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      className={
        "rounded-md px-2.5 py-1 font-medium transition-colors disabled:opacity-50 " +
        (active
          ? "bg-emerald-600 text-white"
          : "text-neutral-600 hover:bg-neutral-100")
      }
    >
      {children}
    </button>
  );
}

/**
 * Navigation that waits for autosave.
 *
 * Switching grade, language or round unmounts the grid, and rows still inside
 * the debounce would go with it. A row that will not save keeps the teacher
 * where they are, with the retry banner and their typed values on screen.
 */
export function useGuardedNav(flushAllAndWait: () => Promise<boolean>) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function go(href: string) {
    if (leaving) return;
    setLeaving(true);
    const saved = await flushAllAndWait();
    if (!saved) {
      setLeaving(false);
      return;
    }
    router.push(href);
  }

  return { leaving, go };
}
