// Shared by the head's school-wide dashboard and a teacher's personal
// dashboard — same criteria (every learner not On Track on any instrument),
// just fed a smaller `rows` array when scoped to one teacher's grades.
import Link from "next/link";
import type { MonitoringRow } from "@/lib/dashboard/build-dashboard.ts";
import { TIER_META } from "@/lib/status-tiers";

export function MonitoringTable({ rows }: { rows: MonitoringRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-[13px] text-neutral-500">
        No learners currently need monitoring.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200">
      <table className="w-full border-collapse text-[13px]">
        <thead className="bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Learner</th>
            <th className="px-3 py-2 text-left font-medium">Grade</th>
            <th className="px-3 py-2 text-left font-medium">Instrument</th>
            <th className="px-3 py-2 text-left font-medium">Language</th>
            <th className="px-3 py-2 text-left font-medium">Level</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const meta = TIER_META[row.tier];
            return (
              <tr key={i} className="border-t border-neutral-100 transition-colors hover:bg-neutral-50">
                <td className="px-3 py-1.5">{row.name}</td>
                <td className="px-3 py-1.5">{row.grade}</td>
                <td className="px-3 py-1.5">{row.instrument}</td>
                <td className="px-3 py-1.5">{row.language ?? "—"}</td>
                <td className="px-3 py-1.5">{row.level}</td>
                <td className="px-3 py-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${meta.pill}`}>
                    {meta.label}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <Link
                    href={`/learners/${row.learnerId}/profile`}
                    className="text-emerald-700 hover:underline"
                  >
                    View profile →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
