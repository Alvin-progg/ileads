// Shared by the head's school-wide dashboard and a teacher's personal
// dashboard — same criteria (lowest band on any instrument), just fed a
// smaller `rows` array when scoped to one teacher's grades.
import Link from "next/link";
import type { AtRiskRow } from "@/lib/dashboard/build-dashboard.ts";

export function AtRiskTable({ rows }: { rows: AtRiskRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-[13px] text-neutral-500">
        No learners currently at the lowest level on any instrument.
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
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-neutral-100 transition-colors hover:bg-neutral-50">
              <td className="px-3 py-1.5">{row.name}</td>
              <td className="px-3 py-1.5">{row.grade}</td>
              <td className="px-3 py-1.5">{row.instrument}</td>
              <td className="px-3 py-1.5">{row.language ?? "—"}</td>
              <td className="px-3 py-1.5">
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[12px] font-medium text-red-700">
                  {row.level}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
