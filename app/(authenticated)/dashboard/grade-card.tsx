// Shared by the head's school-wide dashboard (admin/page.tsx) and a
// teacher's personal dashboard (my-class/page.tsx) — one card renders one
// grade's worth of data, whichever page hands it one.
import type { GradeCardData } from "@/lib/dashboard/build-dashboard.ts";
import { EXAM_MASTERY_THRESHOLD } from "../dashboard-colors.ts";

export function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "warn" | "neutral";
}) {
  const style = {
    good: { text: "text-emerald-700", accent: "border-l-emerald-500", wash: "bg-emerald-50/40" },
    warn: { text: "text-amber-700", accent: "border-l-amber-500", wash: "bg-amber-50/40" },
    neutral: { text: "text-neutral-900", accent: "border-l-neutral-300", wash: "bg-white" },
  }[tone];

  return (
    <div
      className={`rounded-xl border border-l-4 border-neutral-200 p-4 ${style.accent} ${style.wash}`}
    >
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${style.text}`}>{value}</p>
    </div>
  );
}

/**
 * `dangerLabel` highlights the instrument's lowest band in red when it has
 * learners in it — the same visual language as the At-Risk table — so the
 * flag is visible here without having to cross-reference that table.
 */
export function LevelTags({
  rows,
  dangerLabel,
}: {
  rows: { label: string; total: number }[];
  dangerLabel?: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {rows.map((r) => {
        const isDanger = dangerLabel !== null && dangerLabel !== undefined && r.label === dangerLabel && r.total > 0;
        return (
          <span
            key={r.label}
            className={
              "rounded-full px-2 py-0.5 text-[11px] font-medium " +
              (isDanger ? "bg-red-50 text-red-700" : "bg-neutral-100 text-neutral-700")
            }
          >
            {r.label}: <span className="tabular-nums">{r.total}</span>
          </span>
        );
      })}
    </div>
  );
}

export function GradeCard({ card }: { card: GradeCardData }) {
  const { statusCounts } = card;
  const statusLine =
    statusCounts.transferred > 0 || statusCounts.dropped > 0
      ? `${statusCounts.enrolled} enrolled · ${statusCounts.transferred} transferred · ${statusCounts.dropped} dropped`
      : `${card.enrolled} enrolled`;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[15px] font-bold">Grade {card.grade}</h3>
        <p className="text-[12px] text-neutral-500">
          {statusLine}
          {card.teachers.length > 0 ? ` · ${card.teachers.join(", ")}` : ""}
        </p>
      </div>

      <div className="space-y-3">
        {card.crlaCard && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              CRLA
            </p>
            {card.crlaCard.map(({ language, summary, worstLabel }) => (
              <div key={language} className="mt-1">
                <p className="text-[12px] font-medium text-neutral-600">{language}</p>
                <LevelTags rows={summary.levels} dangerLabel={worstLabel} />
              </div>
            ))}
          </div>
        )}

        {card.rmaCard && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              RMA
            </p>
            {card.rmaCard.configured ? (
              <LevelTags rows={card.rmaCard.summary.levels} dangerLabel={card.rmaCard.worstLabel} />
            ) : (
              <p className="text-[12px] text-amber-700">
                Levels not configured for this grade ({card.rmaCard.summary.assessed} scored).
              </p>
            )}
          </div>
        )}

        {card.philiriCard && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Phil-IRI
            </p>
            {card.philiriCard.map(({ language, summary }) => (
              <div key={language} className="mt-1">
                <p className="text-[12px] font-medium text-neutral-600">{language}</p>
                <LevelTags rows={summary.overallLevels} dangerLabel="Frustration" />
              </div>
            ))}
          </div>
        )}

        {card.examCard && card.examCard.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Exam — class MPS
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {card.examCard.map((s) => {
                const tone =
                  s.mps === null
                    ? "bg-neutral-100 text-neutral-700"
                    : s.mps >= EXAM_MASTERY_THRESHOLD
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700";
                return (
                  <span
                    key={s.subject}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}
                    title={s.roundName ?? undefined}
                  >
                    {s.subject}: {s.mps !== null ? <span className="tabular-nums">{s.mps.toFixed(0)}%</span> : "not yet encoded"}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {!card.crlaCard && !card.rmaCard && !card.philiriCard && (!card.examCard || card.examCard.length === 0) && (
          <p className="text-[12px] text-neutral-400">No assessment modules configured.</p>
        )}
      </div>
    </div>
  );
}
