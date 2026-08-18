"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { gradeLabel } from "@/lib/grades";
import { archiveLearner, restoreLearner } from "./actions";

type Learner = {
  id: string;
  lrn: string;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  sex: "M" | "F";
  grade_level: number;
  status: "enrolled" | "transferred" | "dropped";
};

const statusStyles: Record<Learner["status"], string> = {
  enrolled: "bg-emerald-50 text-emerald-700",
  transferred: "bg-amber-50 text-amber-700",
  dropped: "bg-neutral-100 text-neutral-500",
};

export function LearnerTable({
  learners,
  allowedGrades,
}: {
  learners: Learner[];
  allowedGrades: number[];
}) {
  const [rows, setRows] = useState(learners);
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((l) => {
      if (gradeFilter !== "all" && String(l.grade_level) !== gradeFilter) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!q) return true;
      const name = `${l.first_name} ${l.middle_name ?? ""} ${l.last_name}`.toLowerCase();
      return name.includes(q) || l.lrn.includes(q);
    });
  }, [rows, query, gradeFilter, statusFilter]);

  async function handleArchive(id: string) {
    const { error } = await archiveLearner(id, "dropped");
    if (error) {
      toast.error(error);
      return;
    }
    setRows((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: "dropped" } : l))
    );
    toast.success("Learner archived.");
  }

  async function handleRestore(id: string) {
    const { error } = await restoreLearner(id);
    if (error) {
      toast.error(error);
      return;
    }
    setRows((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: "enrolled" } : l))
    );
    toast.success("Learner restored.");
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or LRN…"
          className="min-w-[220px] flex-1 rounded-[10px] border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-[14px] outline-none focus:border-emerald-600 focus:bg-white"
        />
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="rounded-[10px] border border-neutral-200 bg-neutral-50 px-3 py-2 text-[14px] outline-none focus:border-emerald-600"
        >
          <option value="all">All grades</option>
          {allowedGrades.map((g) => (
            <option key={g} value={g}>
              Grade {gradeLabel(g)}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-[10px] border border-neutral-200 bg-neutral-50 px-3 py-2 text-[14px] outline-none focus:border-emerald-600"
        >
          <option value="all">All statuses</option>
          <option value="enrolled">Enrolled</option>
          <option value="transferred">Transferred</option>
          <option value="dropped">Dropped</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-100">
        <table className="w-full text-left text-[14px]">
          <thead className="bg-neutral-50 text-[12px] uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">LRN</th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Sex</th>
              <th className="px-4 py-2.5 font-medium">Grade</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-t border-neutral-100">
                <td className="px-4 py-2.5 font-mono text-[13px] text-neutral-500">
                  {l.lrn}
                </td>
                <td className="px-4 py-2.5">
                  {l.last_name}, {l.first_name}
                  {l.middle_name ? ` ${l.middle_name}` : ""}
                </td>
                <td className="px-4 py-2.5">{l.sex}</td>
                <td className="px-4 py-2.5">{gradeLabel(l.grade_level)}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${statusStyles[l.status]}`}
                  >
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/learners/${l.id}`}
                      className="text-emerald-700 hover:underline"
                    >
                      Edit
                    </Link>
                    {l.status === "enrolled" ? (
                      <button
                        type="button"
                        onClick={() => handleArchive(l.id)}
                        className="text-neutral-500 hover:underline"
                      >
                        Archive
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRestore(l.id)}
                        className="text-neutral-500 hover:underline"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                  No learners match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
