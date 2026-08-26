"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GRADE_LEVELS, gradeLabel } from "@/lib/grades";
import { saveTeacherGrades, setTeacherActive, setTeacherSpecial } from "./actions";

export function TeacherGradeRow({
  teacherId,
  fullName,
  active: initialActive,
  isSpecial,
  initialGrades,
}: {
  teacherId: string;
  fullName: string;
  active: boolean;
  isSpecial: boolean;
  initialGrades: number[];
}) {
  const [grades, setGrades] = useState(new Set(initialGrades));
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(initialActive);
  const [togglingActive, setTogglingActive] = useState(false);
  const [special, setSpecial] = useState(isSpecial);
  const [togglingSpecial, setTogglingSpecial] = useState(false);

  function toggle(grade: number) {
    setGrades((prev) => {
      const next = new Set(prev);
      if (next.has(grade)) next.delete(grade);
      else next.add(grade);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await saveTeacherGrades(teacherId, [...grades].sort());
    setSaving(false);

    if (error) toast.error(error);
    else toast.success(`${fullName}'s grades handled saved.`);
  }

  async function handleToggleActive() {
    const next = !active;
    setTogglingActive(true);
    const { error } = await setTeacherActive(teacherId, next);
    setTogglingActive(false);

    if (error) {
      toast.error(error);
      return;
    }
    setActive(next);
    toast.success(next ? `${fullName} reactivated.` : `${fullName} deactivated.`);
  }

  async function handleToggleSpecial() {
    const next = !special;
    setTogglingSpecial(true);
    const { error } = await setTeacherSpecial(teacherId, next);
    setTogglingSpecial(false);

    if (error) {
      toast.error(error);
      return;
    }
    setSpecial(next);
    toast.success(
      next
        ? `${fullName} marked as special teacher.`
        : `${fullName} is no longer marked special.`
    );
  }

  return (
    <div
      className={
        "flex flex-wrap items-center gap-4 border-b border-neutral-100 py-4 " +
        (active ? "" : "opacity-60")
      }
    >
      <div className="w-40 shrink-0">
        <p className="font-medium">{fullName}</p>
        <div className="flex flex-wrap gap-1">
          {!active && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
              Deactivated
            </span>
          )}
          {/* "Special", not "Kinder": the label is head-applied and may
              legitimately disagree with the grade pills beside it. */}
          {special && (
            <span
              title="Kindergarten teacher"
              className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700"
            >
              Special
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1.5" role="group" aria-label={`${fullName}'s grade levels`}>
        {GRADE_LEVELS.map((grade) => {
          const gradeActive = grades.has(grade);
          return (
            <button
              key={grade}
              type="button"
              aria-pressed={gradeActive}
              disabled={!active}
              onClick={() => toggle(grade)}
              className={
                "h-8 w-8 rounded-full text-[13px] font-medium transition-colors disabled:cursor-not-allowed " +
                (gradeActive
                  ? "bg-emerald-600 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200")
              }
            >
              {gradeLabel(grade)}
            </button>
          );
        })}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggleSpecial}
          disabled={!active || togglingSpecial}
          className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-55"
        >
          {togglingSpecial ? "…" : special ? "Unmark special" : "Mark special"}
        </button>
        <button
          type="button"
          onClick={handleToggleActive}
          disabled={togglingActive}
          className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-55"
        >
          {togglingActive ? "…" : active ? "Deactivate" : "Reactivate"}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !active}
          className="rounded-lg bg-neutral-900 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-neutral-800 disabled:opacity-55"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
