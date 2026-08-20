"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { computeRma } from "@/lib/scoring/rma.ts";
import type { RmaRules } from "@/lib/scoring/types.ts";
import { useRowAutosave, type SaveStatus } from "@/lib/use-row-autosave.ts";
import { handleColumnKeyDown } from "@/lib/grid-keys.ts";
import { Tab, TabGroup, useGuardedNav } from "../entry-nav.tsx";
import { saveRmaRow, type RmaRowValues } from "./actions.ts";

export type Learner = {
  id: string;
  lrn: string;
  last_name: string;
  first_name: string;
};

/** What the teacher types: one cell per task, plus free-text remarks. */
type RowValues = {
  scores: Record<string, number | null>;
  remarks: string | null;
};

export type GridNav = {
  /** Grades with an RMA instrument that this viewer may encode. */
  grades: number[];
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
  "auth-expired": "session expired",
};

const STATUS_STYLE: Record<SaveStatus, string> = {
  clean: "text-neutral-300",
  dirty: "text-neutral-400",
  saving: "text-amber-600",
  saved: "text-emerald-600",
  failed: "text-red-600 underline",
  "auth-expired": "text-amber-700 underline",
};

export function RmaGrid({
  learners,
  rules,
  roundId,
  roundName,
  initialValues,
  nav,
}: {
  learners: Learner[];
  rules: RmaRules;
  roundId: number;
  roundName: string;
  initialValues: Record<string, RmaRowValues>;
  nav: GridNav;
}) {
  // Every column comes from the rules, so a grade with a different task list
  // renders correctly without touching this component.
  const tasks = rules.tasks;
  // No band formula transcribed for this grade: raw scores are still encodable,
  // but a level would be a guess, so none is shown.
  const levelsConfigured = rules.levels.length > 0;

  const [rows, setRows] = useState<Record<string, RowValues>>(() =>
    Object.fromEntries(
      learners.map((l) => {
        const saved = initialValues[l.id];
        return [
          l.id,
          {
            scores: { ...(saved?.task_scores ?? {}) },
            remarks: saved?.remarks ?? null,
          },
        ];
      })
    )
  );

  const autosave = useRowAutosave<RmaRowValues>({
    storagePrefix: `ileads:rma:${roundId}`,
    save: (learnerId, values) => saveRmaRow(learnerId, roundId, values),
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
        next[id] = { scores: { ...v.task_scores }, remarks: v.remarks };
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
   * Field-level problems, every bound read from the rules.
   *
   * A task with no stated maximum can only be checked against the instrument
   * total — the row-level check below is the only ceiling those grades have.
   */
  function errorsFor(v: RowValues): Record<string, string> {
    const e: Record<string, string> = {};

    for (const task of tasks) {
      const value = v.scores[task.key];
      if (value === null || value === undefined) continue;
      const max = task.max ?? rules.max;
      if (value < 0 || value > max) {
        e[task.key] = `${task.label} must be 0–${max}.`;
      }
    }

    const total = totalOf(v);
    if (total !== null && total > rules.max) {
      e.total = `The task scores add up to ${total}, above the ${rules.max}-point maximum.`;
    }

    return e;
  }

  /** Null while nothing has been encoded, so a blank row stays blank. */
  function totalOf(v: RowValues): number | null {
    const encoded = tasks.filter((t) => typeof v.scores[t.key] === "number");
    if (encoded.length === 0) return null;
    return encoded.reduce((sum, t) => sum + (v.scores[t.key] as number), 0);
  }

  function toRowValues(v: RowValues): RmaRowValues {
    return {
      task_scores: Object.fromEntries(
        tasks.map((t) => [t.key, v.scores[t.key] ?? null])
      ),
      remarks: v.remarks,
    };
  }

  function update(learnerId: string, patch: Partial<RowValues>) {
    setRows((prev) => {
      const next = { ...prev[learnerId], ...patch };
      const updated = { ...prev, [learnerId]: next };

      // A row with an invalid field is never sent — the value stays on screen
      // so nothing the teacher typed is discarded, but the save waits.
      if (Object.keys(errorsFor(next)).length === 0) {
        queueSave(learnerId, toRowValues(next));
      }
      return updated;
    });
  }

  function setScore(learnerId: string, key: string, value: number | null) {
    const current = rows[learnerId];
    update(learnerId, { scores: { ...current.scores, [key]: value } });
  }

  const numeric = (raw: string): number | null =>
    raw.trim() === "" ? null : Number(raw);

  const failedRows = useMemo(
    () => Object.values(autosave.statuses).filter((s) => s === "failed").length,
    [autosave.statuses]
  );
  const authExpiredRows = useMemo(
    () => Object.values(autosave.statuses).filter((s) => s === "auth-expired").length,
    [autosave.statuses]
  );

  function hrefFor(next: { grade?: number; round?: number }): string {
    const params = new URLSearchParams({
      grade: String(next.grade ?? nav.grade),
      round: String(next.round ?? roundId),
    });
    return `/rma?${params}`;
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
              go(`/rma/class-record?grade=${nav.grade}&round=${roundId}`)
            }
            className="font-medium text-emerald-700 hover:underline disabled:opacity-50"
          >
            Class Record →
          </button>
        </div>
      </div>

      {!levelsConfigured && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          Grade {nav.grade}&apos;s proficiency cut-offs have not been issued to
          this school yet, and its per-task maximums are not in any supplied
          scoresheet. Raw scores save normally; the level is left blank rather
          than computed from another grade&apos;s bands.
        </div>
      )}

      {authExpiredRows > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          <span>
            Your session expired, so {authExpiredRows} row
            {authExpiredRows === 1 ? "" : "s"} couldn&apos;t be saved. Your unsaved
            work is kept on this device and will send automatically once you&apos;re
            back.
          </span>
          <a
            href={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}
            className="ml-auto rounded border border-amber-300 px-2 py-0.5 font-medium hover:bg-amber-100"
          >
            Log in again
          </a>
        </div>
      )}

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
              {tasks.map((task) => (
                <th key={task.key} className="px-2 py-2 font-medium">
                  {task.label}
                  {task.max === null ? "" : ` (${task.max})`}
                </th>
              ))}
              <th className="px-2 py-2 font-medium">Remarks</th>
              <th className="bg-emerald-50/60 px-2 py-2 font-medium">
                Total ({rules.max})
              </th>
              <th className="bg-emerald-50/60 px-2 py-2 font-medium">%</th>
              <th className="bg-emerald-50/60 px-2 py-2 font-medium">
                Proficiency Level
              </th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {learners.map((learner, rowIndex) => {
              const v = rows[learner.id];
              const errors = errorsFor(v);
              const encoded = totalOf(v) !== null;
              const computed = computeRma(
                {
                  taskScores: Object.fromEntries(
                    tasks.map((t) => [t.key, v.scores[t.key] ?? null])
                  ),
                },
                rules
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

                  {tasks.map((task) => (
                    <td key={task.key} className="w-16 px-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        data-row={rowIndex}
                        data-col={task.key}
                        value={v.scores[task.key] ?? ""}
                        onChange={(e) =>
                          setScore(learner.id, task.key, numeric(e.target.value))
                        }
                        onBlur={() => flushNow(learner.id)}
                        onKeyDown={(e) =>
                          handleColumnKeyDown(e, rowIndex, task.key, learners.length)
                        }
                        title={errors[task.key] ?? undefined}
                        aria-invalid={errors[task.key] ? true : undefined}
                        aria-label={`${task.label} for ${learner.last_name}, ${learner.first_name}`}
                        className={`${cellInput} ${errors[task.key] ? invalidInput : ""}`}
                      />
                    </td>
                  ))}

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
                      onKeyDown={(e) =>
                        handleColumnKeyDown(e, rowIndex, "remarks", learners.length)
                      }
                      aria-label={`Remarks for ${learner.last_name}, ${learner.first_name}`}
                      className={cellInput}
                    />
                  </td>

                  <td className="bg-emerald-50/40 px-2 text-center font-medium tabular-nums">
                    {encoded ? computed.total : "—"}
                  </td>
                  <td className="bg-emerald-50/40 px-2 text-center tabular-nums">
                    {encoded && computed.percent !== null
                      ? `${(computed.percent * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap bg-emerald-50/40 px-2 text-center">
                    {!levelsConfigured ? (
                      <span className="text-[12px] text-amber-700">
                        not yet configured
                      </span>
                    ) : (
                      (encoded ? computed.proficiencyLevel : null) ?? "—"
                    )}
                  </td>

                  <td className="whitespace-nowrap px-3">
                    <button
                      type="button"
                      onClick={status === "failed" ? flushAll : undefined}
                      title={
                        status === "auth-expired"
                          ? "Your session expired. Log in again — your unsaved work is safe."
                          : (autosave.lastError[learner.id] ?? undefined)
                      }
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
