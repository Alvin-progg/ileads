/**
 * Shown centered on screen while a tour step's `before` hook is mid-flight —
 * i.e. while the tour is navigating to the next page and waiting for it to
 * render. Sized and shaped like the tooltip it's about to be replaced by, so
 * the transition doesn't read as a blank flash.
 */
export function TourLoader() {
  return (
    <div className="w-[320px] animate-pulse rounded-xl border border-neutral-200 bg-white p-4 shadow-lg">
      <div className="mb-3 h-4 w-2/3 rounded bg-neutral-200" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-neutral-100" />
        <div className="h-3 w-full rounded bg-neutral-100" />
        <div className="h-3 w-4/5 rounded bg-neutral-100" />
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <div className="h-6 w-14 rounded-md bg-neutral-100" />
        <div className="h-6 w-16 rounded-md bg-emerald-100" />
      </div>
    </div>
  );
}
