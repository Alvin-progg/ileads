"use client";

import { useTourStore } from "@/lib/tour/store.ts";

export function TakeTourButton({
  className,
  onClick,
  children = "Take the tour",
}: {
  className?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const start = useTourStore((s) => s.start);
  return (
    <button
      type="button"
      onClick={() => {
        start();
        onClick?.();
      }}
      className={className}
    >
      {children}
    </button>
  );
}
