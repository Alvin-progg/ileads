"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { computePhiliri } from "@/lib/scoring/philiri.ts";
import type { PhiliriRules } from "@/lib/scoring/types.ts";
import { useRowAutosave, type SaveStatus } from "@/lib/use-row-autosave.ts";
import { handleColumnKeyDown } from "@/lib/grid-keys.ts";
import { Tab, TabGroup, useGuardedNav } from "../entry-nav.tsx";
import { savePhiliriRow, type PhiliriRowValues } from "./actions.ts";

export type Learner = {
  id: string;
  lrn: string;
  last_name: string;
  first_name: string;
};

/** What the teacher types. Same shape as the DB row — nothing to decompose. */
type RowValues = PhiliriRowValues;

const EMPTY: RowValues = {
  screening_score: null,
  passage_level: null,
  word_count: null,
  miscues: null,
  comprehension_items: null,
  comprehension_correct: null,
  set_used: null,
  remarks: null,
};

type ColumnKey =
  | "screening_score"
  | "passage_level"
  | "word_count"
  | "miscues"
  | "comprehension_items"
  | "comprehension_correct"
  | "set_used"
  | "remarks";

const SETS = ["A", "B", "C", "D"];

export type GridNav = {
  /** Grades with a Phil-IRI instrument that this viewer may encode. */
  grades: number[];
  /** Languages the current grade is assessed in. */
  languages: string[];
  rounds: { id: number; name: string }[];
  grade: number;
};

const cellInput =
  "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[13px] " +
  "outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/15";

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

export function PhiliriGrid({
  learners,
  rules,
  language,
  roundId,
  roundName,
  initialValues,
  nav,
}: {
  learners: Learner[];
  rules: PhiliriRules;
  language: string;
  roundId: number;
  roundName: string;
  initialValues: Record<string, PhiliriRowValues>;
  nav: GridNav;
}) {
  const langRules = rules.languages[language];

  const [rows, setRows] = useState<Record<string, RowValues>>(() =>
    Object.fromEntries(
      learners.map((l) => [l.id, initialValues[l.id] ?? EMPTY])
    )
  );

  const storagePrefix = `ileads:philiri:${roundId}:${language}`;

  const autosave = useRowAutosave<PhiliriRowValues>({
    storagePrefix,
    save: (learnerId, values) =>
      savePhiliriRow(learnerId, roundId, language, values),
  });

  const { readDrafts, queueSave, flushNow, flushAll, flushAllAndWait, pendingCount } =
    autosave;
  const { leaving, go } = useGuardedNav(flushAllAndWait);

  // Drafts from a crash or reload while offline: restore them over the server
  // values and immediately try to flush, so reopening the page recovers work
  // rather than silently showing stale saved data.
  useEffect(() => {
    const drafts = readDrafts();
    const ids = Object.keys(drafts);
    if (ids.length === 0) return;

    // Recovery has to happen after mount: reading localStorage during the
    // initial render would make the client tree disagree with the server HTML.
    // One extra render at load is the price of not losing a teacher's drafts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows((prev) => {
      const next = { ...prev };
      for (const [id, v] of Object.entries(drafts)) {
        if (!next[id]) continue;
        next[id] = v;
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

  /**
   * Field-level problems. Bounds below zero are structural (a count cannot be
   * negative); the miscues-vs-words and correct-vs-items relations mirror the
   * database's own check constraints, so a row that would fail to save is
   * caught here first, with the value kept on screen.
   */
  function errorsFor(v: RowValues): Partial<Record<ColumnKey, string>> {
    const e: Partial<Record<ColumnKey, string>> = {};
    const nonNegative = (key: ColumnKey, value: number | null, label: string) => {
      if (value !== null && value < 0) e[key] = `${label} cannot be negative.`;
    };

    nonNegative("screening_score", v.screening_score, "Screening Score");
    nonNegative("passage_level", v.passage_level, "Passage Grade Level");
    nonNegative("word_count", v.word_count, "No. of Words");
    nonNegative("miscues", v.miscues, "No. of Miscues");
    nonNegative("comprehension_items", v.comprehension_items, "Items");
    nonNegative("comprehension_correct", v.comprehension_correct, "Correct Answer");

    if (v.miscues !== null && v.word_count !== null && v.miscues > v.word_count) {
      e.miscues = `Miscues cannot exceed the word count (${v.word_count}).`;
    }
    if (
      v.comprehension_correct !== null &&
      v.comprehension_items !== null &&
      v.comprehension_correct > v.comprehension_items
    ) {
      e.comprehension_correct = `Correct answers cannot exceed the items (${v.comprehension_items}).`;
    }

    return e;
  }

  function update(learnerId: string, patch: Partial<RowValues>) {
    setRows((prev) => {
      const next = { ...prev[learnerId], ...patch };
      const updated = { ...prev, [learnerId]: next };

      // A row with an invalid field is never sent — the value stays on screen
      // so nothing the teacher typed is discarded, but the save waits.
      if (Object.keys(errorsFor(next)).length === 0) {
        queueSave(learnerId, next);
      }
      return updated;
    });
  }

  function handleKeyDown(e: React.KeyboardEvent, rowIndex: number, col: ColumnKey) {
    handleColumnKeyDown(e, rowIndex, col, learners.length);
  }

  const numeric = (raw: string): number | null =>
    raw.trim() === "" ? null : Number(raw);

  const failedRows = useMemo(
    () => Object.values(autosave.statuses).filter((s) => s === "failed").length,
    [autosave.statuses]
  );

  function hrefFor(next: {
    grade?: number;
    language?: string;
    round?: number;
  }): string {
    const params = new URLSearchParams({
      grade: String(next.grade ?? nav.grade),
      language: next.language ?? language,
      round: String(next.round ?? roundId),
    });
    return `/philiri?${params}`;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
        {nav.grades.length > 1 && (
          <TabGroup label="Grade">
            {nav.grades.map((g) => (
              <Tab
                key={g}
                active={g === nav.grade}
                disabled={leaving}
                onClick={() => go(hrefFor({ grade: g }))}
              >
                {g}
              </Tab>
            ))}
          </TabGroup>
        )}

        {nav.languages.length > 1 && (
          <TabGroup label="Language">
            {nav.languages.map((l) => (
              <Tab
                key={l}
                active={l === language}
                disabled={leaving}
                onClick={() => go(hrefFor({ language: l }))}
              >
                {l}
              </Tab>
            ))}
          </TabGroup>
        )}

        <TabGroup label="Round">
          {nav.rounds.map((r) => (
            <Tab
              key={r.id}
              active={r.id === roundId}
              disabled={leaving}
              onClick={() => go(hrefFor({ round: r.id }))}
            >
              {r.name}
            </Tab>
          ))}
        </TabGroup>

        <div className="ml-auto flex items-center gap-3">
          {leaving && (
            <span className="text-[12px] text-amber-600">
              saving {pendingCount} row{pendingCount === 1 ? "" : "s"}...
            </span>
          )}
          <button
            type="button"
            disabled={leaving}
            onClick={() =>
              go(
                `/philiri/class-record?grade=${nav.grade}&language=${language}&round=${roundId}`
              )
            }
            className="font-medium text-emerald-700 hover:underline disabled:opacity-50"
          >
            Class Record →
          </button>
        </div>
      </div>

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
              <th className="px-2 py-2 font-medium">Screening Score</th>
              <th className="px-2 py-2 font-medium">Passage Grade Level</th>
              <th className="px-2 py-2 font-medium">No. of Words</th>
              <th className="px-2 py-2 font-medium">No. of Miscues</th>
              <th className="bg-emerald-50/60 px-2 py-2 font-medium">
                Word Reading Score %
              </th>
              <th className="bg-emerald-50/60 px-2 py-2 font-medium">
                Word Reading Level
              </th>
              <th className="px-2 py-2 font-medium">Items</th>
              <th className="px-2 py-2 font-medium">Correct Answer</th>
              <th className="bg-emerald-50/60 px-2 py-2 font-medium">
                Comprehension Score %
              </th>
              <th className="bg-emerald-50/60 px-2 py-2 font-medium">
                Comprehension Level
              </th>
              <th className="bg-emerald-50/60 px-2 py-2 font-medium">
                Overall Level
              </th>
              <th className="px-2 py-2 font-medium">Set</th>
              <th className="px-2 py-2 font-medium">Remarks</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {learners.map((learner, rowIndex) => {
              const v = rows[learner.id];
              const errors = errorsFor(v);
              const computed = computePhiliri(
                {
                  wordCount: v.word_count,
                  miscues: v.miscues,
                  comprehensionItems: v.comprehension_items,
                  comprehensionCorrect: v.comprehension_correct,
                },
                langRules
              );
              const status = autosave.statuses[learner.id] ?? "clean";

              return (
                <tr key={learner.id} className="group border-t border-neutral-100 transition-colors hover:bg-neutral-50">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1 text-left font-normal transition-colors group-hover:bg-neutral-50"
                  >
                    {learner.last_name}, {learner.first_name}
                  </th>

                  <td className="w-20 px-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      data-row={rowIndex}
                      data-col="screening_score"
                      value={v.screening_score ?? ""}
                      onChange={(e) =>
                        update(learner.id, { screening_score: numeric(e.target.value) })
                      }
                      onBlur={() => flushNow(learner.id)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "screening_score")}
                      title={errors.screening_score ?? undefined}
                      aria-invalid={errors.screening_score ? true : undefined}
                      aria-label={`Screening Score for ${learner.last_name}, ${learner.first_name}`}
                      className={`${cellInput} ${errors.screening_score ? invalidInput : ""}`}
                    />
                  </td>

                  <td className="w-20 px-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      data-row={rowIndex}
                      data-col="passage_level"
                      value={v.passage_level ?? ""}
                      onChange={(e) =>
                        update(learner.id, { passage_level: numeric(e.target.value) })
                      }
                      onBlur={() => flushNow(learner.id)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "passage_level")}
                      title={errors.passage_level ?? undefined}
                      aria-invalid={errors.passage_level ? true : undefined}
                      aria-label={`Passage Grade Level for ${learner.last_name}, ${learner.first_name}`}
                      className={`${cellInput} ${errors.passage_level ? invalidInput : ""}`}
                    />
                  </td>

                  <td className="w-20 px-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      data-row={rowIndex}
                      data-col="word_count"
                      value={v.word_count ?? ""}
                      onChange={(e) =>
                        update(learner.id, { word_count: numeric(e.target.value) })
                      }
                      onBlur={() => flushNow(learner.id)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "word_count")}
                      title={errors.word_count ?? undefined}
                      aria-invalid={errors.word_count ? true : undefined}
                      aria-label={`No. of Words for ${learner.last_name}, ${learner.first_name}`}
                      className={`${cellInput} ${errors.word_count ? invalidInput : ""}`}
                    />
                  </td>

                  <td className="w-20 px-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      data-row={rowIndex}
                      data-col="miscues"
                      value={v.miscues ?? ""}
                      onChange={(e) =>
                        update(learner.id, { miscues: numeric(e.target.value) })
                      }
                      onBlur={() => flushNow(learner.id)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "miscues")}
                      title={errors.miscues ?? undefined}
                      aria-invalid={errors.miscues ? true : undefined}
                      aria-label={`No. of Miscues for ${learner.last_name}, ${learner.first_name}`}
                      className={`${cellInput} ${errors.miscues ? invalidInput : ""}`}
                    />
                  </td>

                  <td className="bg-emerald-50/40 px-2 text-center tabular-nums">
                    {computed.wordReadingScore !== null
                      ? `${(computed.wordReadingScore * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap bg-emerald-50/40 px-2 text-center">
                    {computed.wordReadingLevel ?? "—"}
                  </td>

                  <td className="w-16 px-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      data-row={rowIndex}
                      data-col="comprehension_items"
                      value={v.comprehension_items ?? ""}
                      onChange={(e) =>
                        update(learner.id, {
                          comprehension_items: numeric(e.target.value),
                        })
                      }
                      onBlur={() => flushNow(learner.id)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "comprehension_items")}
                      title={errors.comprehension_items ?? undefined}
                      aria-invalid={errors.comprehension_items ? true : undefined}
                      aria-label={`Items for ${learner.last_name}, ${learner.first_name}`}
                      className={`${cellInput} ${errors.comprehension_items ? invalidInput : ""}`}
                    />
                  </td>

                  <td className="w-16 px-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      data-row={rowIndex}
                      data-col="comprehension_correct"
                      value={v.comprehension_correct ?? ""}
                      onChange={(e) =>
                        update(learner.id, {
                          comprehension_correct: numeric(e.target.value),
                        })
                      }
                      onBlur={() => flushNow(learner.id)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "comprehension_correct")}
                      title={errors.comprehension_correct ?? undefined}
                      aria-invalid={errors.comprehension_correct ? true : undefined}
                      aria-label={`Correct Answer for ${learner.last_name}, ${learner.first_name}`}
                      className={`${cellInput} ${errors.comprehension_correct ? invalidInput : ""}`}
                    />
                  </td>

                  <td className="bg-emerald-50/40 px-2 text-center tabular-nums">
                    {computed.comprehensionScore !== null
                      ? `${(computed.comprehensionScore * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap bg-emerald-50/40 px-2 text-center">
                    {computed.comprehensionLevel ?? "—"}
                  </td>
                  <td className="whitespace-nowrap bg-emerald-50/40 px-2 text-center font-medium">
                    {computed.overallLevel ?? "—"}
                  </td>

                  <td className="w-16 px-1">
                    <select
                      data-row={rowIndex}
                      data-col="set_used"
                      value={v.set_used ?? ""}
                      onChange={(e) =>
                        update(learner.id, { set_used: e.target.value || null })
                      }
                      onBlur={() => flushNow(learner.id)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "set_used")}
                      aria-label={`Set used for ${learner.last_name}, ${learner.first_name}`}
                      className={cellInput}
                    >
                      <option value="">—</option>
                      {SETS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="w-40 px-1">
                    <input
                      type="text"
                      data-row={rowIndex}
                      data-col="remarks"
                      value={v.remarks ?? ""}
                      onChange={(e) =>
                        update(learner.id, { remarks: e.target.value || null })
                      }
                      onBlur={() => flushNow(learner.id)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, "remarks")}
                      aria-label={`Remarks for ${learner.last_name}, ${learner.first_name}`}
                      className={cellInput}
                    />
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
