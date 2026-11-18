const bar = "animate-pulse rounded bg-neutral-200";

/** Heading + subtitle placeholder shared by every skeleton. */
function HeaderSkeleton() {
  return (
    <div className="mb-4 space-y-2">
      <div className={`${bar} h-7 w-64`} />
      <div className={`${bar} h-4 w-96 max-w-full`} />
    </div>
  );
}

/** Entry grids, class records, learners list. */
export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <main className="p-6" aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <div className={`${bar} mb-4 h-8 w-80 max-w-full`} />
      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <div className="h-9 bg-neutral-50" />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex gap-4 border-t border-neutral-100 px-3 py-2.5">
            <div className={`${bar} h-4 w-40`} />
            <div className={`${bar} h-4 flex-1`} />
            <div className={`${bar} h-4 w-16`} />
          </div>
        ))}
      </div>
    </main>
  );
}

/** /admin and /my-class: stat tiles plus grade cards. */
export function DashboardSkeleton() {
  return (
    <main className="p-6" aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${bar} h-20`} />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${bar} h-48`} />
        ))}
      </div>
    </main>
  );
}
