"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { computeCrla } from "@/lib/scoring/crla.ts";
import type { CrlaRules } from "@/lib/scoring/types.ts";
import { saveCrlaRow, type CrlaRowValues } from "./actions.ts";
import { useRowAutosave, type SaveStatus } from "./use-row-autosave.ts";

export type Learner = {
  id: string;
  lrn: string;
  last_name: string;
  first_name: string;
};

/** What the teacher types. Time is split into minutes/seconds for entry. */
type RowValues = {
  task1: number | null;
  task2l: number | null;
  task2h: number | null;
  story_no: number | null;
  miscues: number | null;
  minutes: number | null;
  seconds: number | null;
  comprehension_correct: number | null;
  experience_rating: number | null;
  observation_level: string | null;
};

const EMPTY: RowValues = {
  task1: null,
  task2l: null,
  task2h: null,
  story_no: null,
  miscues: null,
  minutes: null,
  seconds: null,
  comprehension_correct: null,
  experience_rating: null,
  observation_level: null,
};

/** Input columns, in tab order. Used for Enter/Arrow navigation. */
const COLUMNS = [
  "task1",
  "task2l",
  "task2h",
  "story_no",
  "miscues",
  "minutes",
  "seconds",
  "comprehension_correct",
  "experience_rating",
  "observation_level",
] as const;
type ColumnKey = (typeof COLUMNS)[number];

function secondsToParts(total: number | null) {
  if (total === null) return { minutes: null, seconds: null };
  return { minutes: Math.floor(total / 60), seconds: total % 60 };
}

function partsToSeconds(minutes: number | null, seconds: number | null) {
  if (minutes === null && seconds === null) return null;
  return (minutes ?? 0) * 60 + (seconds ?? 0);
}

const cellInput =
  "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[13px] " +
  "outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/15 " +
  "disabled:bg-neutral-100 disabled:text-neutral-300";

const invalidInput = "border-red-400 bg-red-50 ring-2 ring-red-500/15";

const STATUS_LABEL: Record<SaveStatus, string> = {
  clean: "",
  dirty: "…",
  saving: "saving…",
  saved: "saved ✓",
  failed: "failed ↻",
};

const STATUS_STYLE: Record<SaveStatus, string> = {
  clean: "text-neutral-300",
  dirty: "text-neutral-400",
  saving: "text-amber-600",
  saved: "text-emerald-600",
  failed: "text-red-600 underline",
};

export function CrlaGrid({
  learners,
  rules,
  language,
  roundId,
  roundName,
  initialValues,
}: {
  learners: Learner[];
  rules: CrlaRules;
  language: string;
  roundId: number;
  roundName: string;
  initialValues: Record<string, CrlaRowValues>;
}) {
  const langRules = rules.languages[language];
  const limits = langRules.inputs;

  const [rows, setRows] = useState<Record<string, RowValues>>(() =>
    Object.fromEntries(
      learners.map((l) => {
        const saved = initialValues[l.id];
        if (!saved) return [l.id, EMPTY];
        const { minutes, seconds } = secondsToParts(saved.reading_secs);
        return [
          l.id,
          {
            task1: saved.task1,
            task2l: saved.task2l,
            task2h: saved.task2h,
            story_no: saved.story_no,
            miscues: saved.miscues,
            minutes,
            seconds,
            comprehension_correct: saved.comprehension_correct,
            experience_rating: saved.experience_rating,
            observation_level: saved.observation_level,
          },
        ];
      })
    )
  );

  const storagePrefix = `ileads:crla:${roundId}:${language}`;

  const autosave = useRowAutosave<CrlaRowValues>({
    storagePrefix,
    save: (learnerId, values) =>
      saveCrlaRow(learnerId, roundId, language, values),
  });

  const { readDrafts, queueSave, flushNow, flushAll } = autosave;

  // Drafts from a crash or reload while offline: restore them over the server
  // values and immediately try to flush, so reopening the page recovers work
  // rather than silently showing stale saved data.
  useEffect(() => {
    const drafts = readDrafts();
    const ids = Object.keys(drafts);
    if (ids.length === 0) return;

    setRows((prev) => {
      const next = { ...prev };
      for (const [id, v] of Object.entries(drafts)) {
        if (!next[id]) continue;
        const { minutes, seconds } = secondsToParts(v.reading_secs);
        next[id] = {
          task1: v.task1,
          task2l: v.task2l,
          task2h: v.task2h,
          story_no: v.story_no,
          miscues: v.miscues,
          minutes,
          seconds,
          comprehension_correct: v.comprehension_correct,
          experience_rating: v.experience_rating,
          observation_level: v.observation_level,
        };
      }
      return next;
    });

    for (const [id, v] of Object.entries(drafts)) queueSave(id, v);
    toast.info(
      `Recovered ${ids.length} unsaved row${ids.length === 1 ? "" : "s"} from your last session.`
    );
    // Runs once on mount: recovery is a load-time concern, not a live one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Passage length for the story chosen, needed for the miscue ceiling. */
  function passageWords(v: RowValues): number | null {
    if (v.story_no === null) return null;
    return langRules.passages[String(v.story_no)] ?? langRules.passageDefault ?? null;
  }

  /** Field-level problems, all bounds read from the rules. */
  function errorsFor(v: RowValues): Partial<Record<ColumnKey | "time", string>> {
    const e: Partial<Record<ColumnKey | "time", string>> = {};
    const range = (
      key: ColumnKey,
      value: number | null,
      min: number,
      max: number,
      label: string
    ) => {
      if (value === null) return;
      if (value < min || value > max) e[key] = `${label} must be ${min}–${max}.`;
    };

    range("task1", v.task1, limits.task1.min ?? 0, limits.task1.max, "Task 1");
    range("task2l", v.task2l, limits.task2Low.min ?? 0, limits.task2Low.max, "Task 2L");
    range("task2h", v.task2h, limits.task2High.min ?? 0, limits.task2High.max, "Task 2H");
    range("story_no", v.story_no, limits.storyNo.min ?? 1, limits.storyNo.max, "Story");
    range("minutes", v.minutes, limits.readingMinutes.min ?? 0, limits.readingMinutes.max, "Minutes");
    range("seconds", v.seconds, 0, 59, "Seconds");
    range("comprehension_correct", v.comprehension_correct, 0, langRules.comprehensionMax, "Comprehension");
    range(
      "experience_rating",
      v.experience_rating,
      limits.experienceRating.min ?? 1,
      limits.experienceRating.max,
      "Experience"
    );

    const words = passageWords(v);
    if (v.miscues !== null) {
      if (v.miscues < 0) e.miscues = "Miscues cannot be negative.";
      else if (words !== null && v.miscues > words) {
        e.miscues = `Miscues cannot exceed the passage length (${words}).`;
      }
    }

    // The scoresheet's cross-field rule: words read implies time was recorded.
    const secs = partsToSeconds(v.minutes, v.seconds);
    const wordsRead = words === null ? null : words - (v.miscues ?? 0);
    if (wordsRead !== null && wordsRead > 0 && v.story_no !== null && !secs) {
      e.time = "Enter the reading time.";
    }

    return e;
  }

  function toRowValues(v: RowValues, computedWordsRead: number | null): CrlaRowValues {
    return {
      task1: v.task1,
      task2l: v.task2l,
      task2h: v.task2h,
      story_no: v.story_no,
      miscues: v.miscues,
      words_read: computedWordsRead,
      reading_secs: partsToSeconds(v.minutes, v.seconds),
      comprehension_correct: v.comprehension_correct,
      experience_rating: v.experience_rating,
      observation_level: v.observation_level,
    };
  }

  function update(learnerId: string, patch: Partial<RowValues>) {
    setRows((prev) => {
      const next = { ...prev[learnerId], ...patch };
      const updated = { ...prev, [learnerId]: next };

      // A row with an invalid field is never sent — the value stays on screen
      // so nothing the teacher typed is discarded, but the save waits.
      if (Object.keys(errorsFor(next)).length === 0) {
        const result = computeCrla(toCrlaInput(next), rules, language);
        queueSave(learnerId, toRowValues(next, result.wordsRead));
      }
      return updated;
    });
  }

  function toCrlaInput(v: RowValues) {
    return {
      task1: v.task1,
      task2Low: v.task2l,
      task2High: v.task2h,
      storyNo: v.story_no,
      miscues: v.miscues,
      readingSeconds: partsToSeconds(v.minutes, v.seconds),
      comprehensionCorrect: v.comprehension_correct,
    };
  }

  /** Enter/Arrow move down a column; Tab is left to the browser. */
  function handleKeyDown(e: React.KeyboardEvent, rowIndex: number, col: ColumnKey) {
    const isDown = e.key === "Enter" ? !e.shiftKey : e.key === "ArrowDown";
    const isUp = e.key === "Enter" ? e.shiftKey : e.key === "ArrowUp";
    if (!isDown && !isUp) return;

    e.preventDefault();
    const step = isDown ? 1 : -1;

    // Skip rows where this column is disabled (the inactive Task 2 branch),
    // so keyboard-only entry never lands on an unusable cell.
    for (let r = rowIndex + step; r >= 0 && r < learners.length; r += step) {
      const el = document.querySelector<HTMLElement>(
        `[data-row="${r}"][data-col="${col}"]`
      );
      if (el && !(el as HTMLInputElement).disabled) {
        el.focus();
        if (el instanceof HTMLInputElement) el.select();
        return;
      }
    }
  }

  const numeric = (raw: string): number | null =>
    raw.trim() === "" ? null : Number(raw);

  const failedRows = useMemo(
    () => Object.values(autosave.statuses).filter((s) => s === "failed").length,
    [autosave.statuses]
  );

  return (
    <div>
      {failedRows > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          <span>
            {failedRows} row{failedRows === 1 ? "" : "s"} could not be saved. Retrying
            automatically — your work is kept and will be sent when the connection
            returns.
          </span>
          <button
            type="button"
            onClick={flushAll}
            className="ml-auto rounded border border-red-300 px-2 py-0.5 font-medium hover:bg-red-100"
          >
            Retry now
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 text-left font-medium">
                Learner
              </th>
              <th className="px-2 py-2 font-medium">Task 1</th>
              <th className="px-2 py-2 font-medium">Task 2L</th>
              <th className="px-2 py-2 font-medium">Task 2H</th>
              <th className="px-2 py-2 font-medium">Story</th>
              <th className="px-2 py-2 font-medium">Miscues</th>
              <th className="px-2 py-2 font-medium">Min</th>
              <th className="px-2 py-2 font-medium">Sec</th>
              <th className="px-2 py-2 font-medium">Compr.</th>
              <th className="px-2 py-2 font-medium">Exp.</th>
              <th className="px-2 py-2 font-medium">Observation</th>
              <th className="bg-emerald-50/60 px-2 py-2 font-medium">Words</th>
              <th className="bg-emerald-50/60 px-2 py-2 font-medium">Total</th>
              <th className="bg-emerald-50/60 px-2 py-2 font-medium">Reading Level</th>
              <th className="bg-emerald-50/60 px-2 py-2 font-medium">WPM</th>
              <th className="bg-emerald-50/60 px-2 py-2 font-medium">Fluency</th>
              <th className="bg-emerald-50/60 px-2 py-2 font-medium">Reading Profile</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {learners.map((learner, rowIndex) => {
              const v = rows[learner.id];
              const errors = errorsFor(v);
              const computed = computeCrla(toCrlaInput(v), rules, language);
              const status = autosave.statuses[learner.id] ?? "clean";

              // The instrument locks each Task 2 form to a Task 1 branch:
              // Task 2L is for Task 1 <= 6, Task 2H for Task 1 >= 7.
              const branchAt =
                langRules.part1.total.mode === "task1_branch"
                  ? langRules.part1.total.branchAt
                  : Infinity;
              const task2lDisabled = v.task1 !== null && v.task1 >= branchAt;
              const task2hDisabled = v.task1 === null || v.task1 < branchAt;

              const num = (
                col: ColumnKey,
                value: number | null,
                onChange: (n: number | null) => void,
                disabled = false
              ) => (
                <input
                  type="number"
                  inputMode="numeric"
                  data-row={rowIndex}
                  data-col={col}
                  disabled={disabled}
                  value={value ?? ""}
                  onChange={(e) => onChange(numeric(e.target.value))}
                  onBlur={() => flushNow(learner.id)}
                  onKeyDown={(e) => handleKeyDown(e, rowIndex, col)}
                  title={errors[col] ?? undefined}
                  aria-invalid={errors[col] ? true : undefined}
                  className={`${cellInput} ${errors[col] ? invalidInput : ""}`}
                />
              );

              return (
                <tr key={learner.id} className="border-t border-neutral-100">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1 text-left font-normal"
                  >
                    {learner.last_name}, {learner.first_name}
                  </th>

                  <td className="w-16 px-1">
                    {num("task1", v.task1, (n) => update(learner.id, { task1: n }))}
                  </td>
                  <td className="w-16 px-1">
                    {num(
                      "task2l",
                      v.task2l,
                      (n) => update(learner.id, { task2l: n }),
                      task2lDisabled
                    )}
                  </td>
                  <td className="w-16 px-1">
                    {num(
                      "task2h",
                      v.task2h,
                      (n) => update(learner.id, { task2h: n }),
                      task2hDisabled
                    )}
                  </td>
                  <td className="w-14 px-1">
                    {num("story_no", v.story_no, (n) => update(learner.id, { story_no: n }))}
                  </td>
                  <td className="w-16 px-1">
                    {num("miscues", v.miscues, (n) => update(learner.id, { miscues: n }))}
                  </td>
                  <td className="w-14 px-1">
                    {num("minutes", v.minutes, (n) => update(learner.id, { minutes: n }))}
                  </td>
                  <td className="w-14 px-1">
                    {num("seconds", v.seconds, (n) => update(learner.id, { seconds: n }))}
                  </td>
                  <td className="w-16 px-1">
                    {num("comprehension_correct", v.comprehension_correct, (n) =>
                      update(learner.id, { comprehension_correct: n })
                    )}
                  </td>
                  <td className="w-14 px-1">
                    {num("experience_rating", v.experience_rating, (n) =>
                      update(learner.id, { experience_rating: n })
                    )}
                  </td>
                  <td className="w-28 px-1">
                    <select
                      data-row={rowIndex}
                      data-col="observation_level"
                      value={v.observation_level ?? ""}
                      onChange={(e) =>
                        update(learner.id, {
                          observation_level: e.target.value || null,
                        })
                      }
                      onBlur={() => flushNow(learner.id)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "observation_level")}
                      className={cellInput}
                    >
                      <option value="">—</option>
                      {limits.observationLevels.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="bg-emerald-50/40 px-2 text-center tabular-nums text-neutral-600">
                    {computed.wordsRead ?? "—"}
                  </td>
                  <td className="bg-emerald-50/40 px-2 text-center font-medium tabular-nums">
                    {computed.part1Total ?? "—"}
                  </td>
                  <td className="whitespace-nowrap bg-emerald-50/40 px-2 text-center">
                    {computed.readingLevel ?? "—"}
                  </td>
                  <td className="bg-emerald-50/40 px-2 text-center tabular-nums">
                    {computed.wpm === null ? "—" : computed.wpm.toFixed(1)}
                  </td>
                  <td className="bg-emerald-50/40 px-2 text-center tabular-nums">
                    {computed.fluency === null
                      ? "—"
                      : `${(computed.fluency * 100).toFixed(0)}%`}
                  </td>
                  <td className="whitespace-nowrap bg-emerald-50/40 px-2 text-center">
                    {computed.readingProfile ?? "—"}
                  </td>

                  <td className="whitespace-nowrap px-3">
                    <button
                      type="button"
                      onClick={status === "failed" ? flushAll : undefined}
                      title={autosave.lastError[learner.id] ?? undefined}
                      className={`text-[12px] ${STATUS_STYLE[status]} ${
                        status === "failed" ? "cursor-pointer" : "cursor-default"
                      }`}
                    >
                      {STATUS_LABEL[status]}
                    </button>
                    {Object.keys(errors).length > 0 && (
                      <span className="ml-2 text-[12px] text-red-600">
                        {Object.values(errors)[0]}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[12px] text-neutral-500">
        <strong>{roundName}</strong> · Tab moves across, Enter moves down the same
        column, Shift+Enter moves up. Rows save on their own; unsaved work is kept
        on this device and re-sent automatically if the connection drops.
      </p>
    </div>
  );
}
