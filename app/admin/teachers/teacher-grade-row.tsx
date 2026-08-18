"use client";

import { useState } from "react";
import { toast } from "sonner";
import { saveTeacherGrades } from "./actions";

const GRADE_LABELS = ["K", "1", "2", "3", "4", "5", "6"];

export function TeacherGradeRow({
  teacherId,
  fullName,
  initialGrades,
}: {
  teacherId: string;
  fullName: string;
  initialGrades: number[];
}) {
  const [grades, setGrades] = useState(new Set(initialGrades));
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-neutral-100 py-4">
      <p className="w-40 shrink-0 font-medium">{fullName}</p>
      <div className="flex gap-1.5" role="group" aria-label={`${fullName}'s grade levels`}>
        {GRADE_LABELS.map((label, grade) => {
          const active = grades.has(grade);
          return (
            <button
              key={grade}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(grade)}
              className={
                "h-8 w-8 rounded-full text-[13px] font-medium transition-colors " +
                (active
                  ? "bg-emerald-600 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200")
              }
            >
              {label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="ml-auto rounded-lg bg-neutral-900 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-neutral-800 disabled:opacity-55"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
