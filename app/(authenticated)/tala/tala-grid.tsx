"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { computeTala, computeTalaMovement } from "@/lib/scoring/tala.ts";
import type { TalaRules } from "@/lib/scoring/types.ts";
import { useRowAutosave, type SaveStatus } from "@/lib/use-row-autosave.ts";
import { handleColumnKeyDown } from "@/lib/grid-keys.ts";
import { monthLabel, shiftMonth } from "@/lib/tala-month.ts";
import type { TalaLearner } from "@/lib/tala-class.ts";
import { Tab, TabGroup, useGuardedNav } from "../entry-nav.tsx";
import { saveTalaRow, type TalaRowValues } from "./actions.ts";

type ColumnKey = "wcpm" | "comprehension_correct" | "frequency" | "remarks";

const EMPTY: TalaRowValues = {
  wcpm: null,
  comprehension_correct: null,
  frequency: null,
  remarks: null,
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

const PROFILE_STYLE: Record<string, string> = {
  "S-C-": "bg-red-100 text-red-800",
  "S-C+": "bg-amber-100 text-amber-800",
  "S+C-": "bg-sky-100 text-sky-800",
  "S+C+": "bg-emerald-100 text-emerald-800",
};

export function TalaGrid({
  learners,
  rules,
  month,
  grades,
  grade,
  initialValues,
  prevProfiles,
}: {
  learners: TalaLearner[];
  rules: TalaRules;
  month: string;
  grades: number[];
  grade: number;
  initialValues: Record<string, TalaRowValues>;
  prevProfiles: Record<string, string | null>;
}) {
  const { items, plusAt } = rules.comprehension;

  const [rows, setRows] = useState<Record<string, TalaRowValues>>(() =>
    Object.fromEntries(learners.map((l) => [l.id, initialValues[l.id] ?? EMPTY]))
  );

  const autosave = useRowAutosave<TalaRowValues>({
    storagePrefix: `ileads:tala:${month}`,
    save: (learnerId, values) => saveTalaRow(learnerId, month, values),
  });
  const { readDrafts, queueSave, flushNow, flushAll, flushAllAndWait, pendingCount } =
    autosave;
  const { leaving, go } = useGuardedNav(flushAllAndWait);

  // Restore drafts left by a crash or reload; localStorage can only be read
  // after mount without breaking hydration.
  useEffect(() => {
    const drafts = readDrafts();
    const ids = Object.keys(drafts);
    if (ids.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows((prev) => {
      const next = { ...prev };
      for (const [id, v] of Object.entries(drafts)) if (next[id]) next[id] = v;
      return next;
    });
    for (const [id, v] of Object.entries(drafts)) queueSave(id, v);
    toast.info(
      `Recovered ${ids.length} unsaved row${ids.length === 1 ? "" : "s"} from your last session.`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wholeIn = (v: number | null, max: number) =>
    v === null || (Number.isInteger(v) && v >= 0 && v <= max);

  function errorsFor(v: TalaRowValues): Partial<Record<ColumnKey, string>> {
    const e: Partial<Record<ColumnKey, string>> = {};
    if (!wholeIn(v.wcpm, 400)) e.wcpm = "WCPM must be a whole number from 0 to 400.";
    if (!wholeIn(v.comprehension_correct, items))
      e.comprehension_correct = `Comprehension must be a whole number from 0 to ${items}.`;
    if (!wholeIn(v.frequency, 31)) e.frequency = "Frequency must be a whole number from 0 to 31.";
    return e;
  }

  function update(learnerId: string, patch: Partial<TalaRowValues>) {
    setRows((prev) => {
      const next = { ...prev[learnerId], ...patch };
      // An invalid row stays on screen but is never sent.
      if (Object.keys(errorsFor(next)).length === 0) queueSave(learnerId, next);
      return { ...prev, [learnerId]: next };
    });
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

  const hrefFor = (next: { grade?: number; month?: string }) =>
    `/tala?grade=${next.grade ?? grade}&month=${next.month ?? month}`;

  function numCell(
    learner: TalaLearner,
    rowIndex: number,
    col: Exclude<ColumnKey, "remarks">,
    label: string,
    errors: Partial<Record<ColumnKey, string>>
  ) {
    return (
      <td className="w-24 px-1">
        <input
          type="number"
          inputMode="numeric"
          data-row={rowIndex}
          data-col={col}
          value={rows[learner.id][col] ?? ""}
          onChange={(e) => update(learner.id, { [col]: numeric(e.target.value) })}
          onBlur={() => flushNow(learner.id)}
          onKeyDown={(e) => handleColumnKeyDown(e, rowIndex, col, learners.length)}
          title={errors[col]}
          aria-invalid={errors[col] ? true : undefined}
          aria-label={`${label} for ${learner.last_name}, ${learner.first_name}`}
          className={`${cellInput} ${errors[col] ? invalidInput : ""}`}
        />
      </td>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
        {grades.length > 1 && (
          <TabGroup label="Grade">
            {grades.map((g) => (
              <Tab key={g} active={g === grade} disabled={leaving} onClick={() => go(hrefFor({ grade: g }))}>
                {g}
              </Tab>
            ))}
          </TabGroup>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={leaving}
            onClick={() => go(hrefFor({ month: shiftMonth(month, -1) }))}
            aria-label="Previous month"
            className="rounded border border-neutral-300 px-2 py-0.5 disabled:opacity-50"
          >
            ←
          </button>
          <input
            type="month"
            value={month}
            disabled={leaving}
            onChange={(e) => e.target.value && go(hrefFor({ month: e.target.value }))}
            aria-label="Month"
            className="rounded border border-neutral-300 px-2 py-0.5"
          />
          <button
            type="button"
            disabled={leaving}
            onClick={() => go(hrefFor({ month: shiftMonth(month, 1) }))}
            aria-label="Next month"
            className="rounded border border-neutral-300 px-2 py-0.5 disabled:opacity-50"
          >
            →
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {leaving && (
            <span className="text-[12px] text-amber-600">
              saving {pendingCount} row{pendingCount === 1 ? "" : "s"}...
            </span>
          )}
          <button
            type="button"
            disabled={leaving}
            onClick={() => go(`/tala/class-record?grade=${grade}&month=${month}`)}
            className="font-medium text-emerald-700 hover:underline disabled:opacity-50"
          >
            Tracker &amp; Dashboard →
          </button>
        </div>
      </div>

      {authExpiredRows > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          <span>
            Your session expired, so {authExpiredRows} row{authExpiredRows === 1 ? "" : "s"}{" "}
            couldn&apos;t be saved. Your unsaved work is kept on this device and will
            send automatically once you&apos;re back.
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
            automatically — your work is kept and will be sent when the connection returns.
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
              <th className="px-2 py-2 font-medium">No.</th>
              <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 text-left font-medium">
                Learner
              </th>
              <th className="px-2 py-2 font-medium">
                WCPM
                <span className="block normal-case tracking-normal">S+ ≥ {rules.wcpmBenchmark}</span>
              </th>
              <th className="px-2 py-2 font-medium">
                Comp. Score
                <span className="block normal-case tracking-normal">
                  of {items} · C+ ≥ {plusAt}
                </span>
              </th>
              <th className="bg-emerald-50/60 px-2 py-2 font-medium">Reading Profile</th>
              <th className="bg-emerald-50/60 px-2 py-2 font-medium">Intervention Program</th>
              <th className="px-2 py-2 font-medium">
                Frequency
                <span className="block normal-case tracking-normal">
                  TALA 10 ≥ {rules.readingsPerMonth}
                </span>
              </th>
              <th className="bg-emerald-50/60 px-2 py-2 font-medium">Monthly Status</th>
              <th className="px-2 py-2 font-medium">Remarks</th>
              <th className="px-3 py-2 text-left font-medium" data-tour="save-status">Status</th>
            </tr>
          </thead>
          <tbody>
            {learners.map((learner, rowIndex) => {
              const v = rows[learner.id];
              const errors = errorsFor(v);
              const computed = computeTala(
                { wcpm: v.wcpm, comprehensionCorrect: v.comprehension_correct },
                rules
              );
              const prev = prevProfiles[learner.id] ?? null;
              const movement = computeTalaMovement(prev, computed.profile, rules);
              const status = autosave.statuses[learner.id] ?? "clean";

              return (
                <tr key={learner.id} className="group border-t border-neutral-100 transition-colors hover:bg-neutral-50">
                  <td className="px-2 text-center text-neutral-500">{rowIndex + 1}</td>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1 text-left font-normal transition-colors group-hover:bg-neutral-50"
                  >
                    {learner.last_name}, {learner.first_name}
                  </th>

                  {numCell(learner, rowIndex, "wcpm", "WCPM", errors)}
                  {numCell(learner, rowIndex, "comprehension_correct", "Comprehension Score", errors)}

                  <td className="whitespace-nowrap bg-emerald-50/40 px-2 text-center">
                    {computed.profile ? (
                      <span
                        title={computed.description ?? undefined}
                        className={`rounded px-1.5 py-0.5 text-[12px] font-medium ${PROFILE_STYLE[computed.profile] ?? ""}`}
                      >
                        {computed.profile}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap bg-emerald-50/40 px-2 text-center">
                    {computed.program ?? "—"}
                  </td>

                  {numCell(learner, rowIndex, "frequency", "Frequency", errors)}

                  <td
                    className="whitespace-nowrap bg-emerald-50/40 px-2 text-center"
                    title={movement ? `Last month: ${prev ?? "no record"}` : undefined}
                  >
                    {movement ?? "—"}
                  </td>

                  <td className="w-40 px-1">
                    <input
                      type="text"
                      data-row={rowIndex}
                      data-col="remarks"
                      value={v.remarks ?? ""}
                      onChange={(e) => update(learner.id, { remarks: e.target.value || null })}
                      onBlur={() => flushNow(learner.id)}
                      onKeyDown={(e) => handleColumnKeyDown(e, rowIndex, "remarks", learners.length)}
                      aria-label={`Remarks for ${learner.last_name}, ${learner.first_name}`}
                      className={cellInput}
                    />
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
        <strong>{monthLabel(month)}</strong> · Tab moves across, Enter moves down the
        same column, Shift+Enter moves up. Rows save on their own; unsaved work is
        kept on this device and re-sent automatically if the connection drops.
      </p>
    </div>
  );
}
