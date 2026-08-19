"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  summariseExamSubject,
  type ExamEntry,
  type Sex,
} from "@/lib/scoring/exam-summary.ts";
import { useRowAutosave, type SaveStatus } from "@/lib/use-row-autosave.ts";
import { handleColumnKeyDown } from "@/lib/grid-keys.ts";
import { Tab, TabGroup, useGuardedNav } from "../entry-nav.tsx";
import { ExamMpsChart } from "../exam-mps-chart.tsx";
import { saveExamHps, saveExamNotes, saveExamScore } from "./actions.ts";

export type Learner = {
  id: string;
  lrn: string;
  last_name: string;
  first_name: string;
  sex: Sex;
};

export type Subject = {
  id: number;
  name: string;
  sequence: number;
  /** Every quarter's HPS this subject has ever had, keyed by round name. */
  hpsByQuarter: Record<string, number | null>;
};

export type GridNav = {
  /** Grades this viewer may encode exam scores for. */
  grades: number[];
  quarters: { id: number; name: string; sequence: number }[];
  grade: number;
};

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

/** The nearest earlier quarter (by sequence) that has an HPS for this subject. */
function priorHps(
  subject: Subject,
  quarters: GridNav["quarters"],
  activeSequence: number
): { value: number; quarterName: string } | null {
  const earlier = quarters
    .filter((q) => q.sequence < activeSequence)
    .sort((a, b) => b.sequence - a.sequence);
  for (const q of earlier) {
    const v = subject.hpsByQuarter[q.name];
    if (v !== null && v !== undefined) return { value: v, quarterName: q.name };
  }
  return null;
}

export function ExamGrid({
  learners,
  subjects,
  roundId,
  roundName,
  initialScores,
  initialNotes,
  nav,
}: {
  learners: Learner[];
  subjects: Subject[];
  roundId: number;
  roundName: string;
  /** learnerId -> learningAreaId -> score */
  initialScores: Record<string, Record<number, number | null>>;
  /** learningAreaId -> text */
  initialNotes: Record<number, string | null>;
  nav: GridNav;
}) {
  const activeQuarter = nav.quarters.find((q) => q.name === roundName);
  const activeSequence = activeQuarter?.sequence ?? 0;

  const [scores, setScores] = useState<Record<string, Record<number, number | null>>>(
    () =>
      Object.fromEntries(
        learners.map((l) => [
          l.id,
          Object.fromEntries(
            subjects.map((s) => [s.id, initialScores[l.id]?.[s.id] ?? null])
          ),
        ])
      )
  );

  // Effective HPS per subject: the subject's own value for this quarter, or a
  // value carried forward from the nearest earlier quarter that has one.
  const [hps, setHps] = useState<Record<number, number | null>>(() =>
    Object.fromEntries(
      subjects.map((s) => [s.id, s.hpsByQuarter[roundName] ?? null])
    )
  );
  const [carriedFrom, setCarriedFrom] = useState<Record<number, string | null>>({});

  const [notes, setNotes] = useState<Record<number, string | null>>(() =>
    Object.fromEntries(subjects.map((s) => [s.id, initialNotes[s.id] ?? null]))
  );

  const scoreAutosave = useRowAutosave<number | null>({
    storagePrefix: `ileads:exam:scores:${roundId}`,
    save: (key, score) => {
      const [learnerId, learningAreaId] = key.split(":");
      return saveExamScore(learnerId, roundId, Number(learningAreaId), score);
    },
  });

  const hpsAutosave = useRowAutosave<number>({
    storagePrefix: `ileads:exam:hps:${roundName}`,
    save: (learningAreaId, value) =>
      saveExamHps(Number(learningAreaId), roundName, value),
  });

  const notesAutosave = useRowAutosave<string | null>({
    storagePrefix: `ileads:exam:notes:${roundId}`,
    save: (learningAreaId, text) =>
      saveExamNotes(Number(learningAreaId), roundId, text),
  });

  async function flushAllAndWait(): Promise<boolean> {
    const results = await Promise.all([
      scoreAutosave.flushAllAndWait(),
      hpsAutosave.flushAllAndWait(),
      notesAutosave.flushAllAndWait(),
    ]);
    return results.every(Boolean);
  }

  const { leaving, go } = useGuardedNav(flushAllAndWait);

  // A subject with no HPS for this quarter carries one forward from the
  // nearest earlier quarter that has it, and saves it immediately — the
  // displayed ceiling and the enforced one must never diverge, so nothing is
  // shown that has not actually been written.
  useEffect(() => {
    for (const subject of subjects) {
      const own = subject.hpsByQuarter[roundName] ?? null;
      if (own !== null) continue;
      const source = priorHps(subject, nav.quarters, activeSequence);
      if (!source) continue;

      // Carrying a value forward has to happen after mount: it triggers a
      // write, and reading DB-derived defaults during the initial render
      // would make the client tree disagree with the server HTML.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHps((prev) => ({ ...prev, [subject.id]: source.value }));
      setCarriedFrom((prev) => ({ ...prev, [subject.id]: source.quarterName }));
      hpsAutosave.queueSave(String(subject.id), source.value);
    }
    // Runs once on mount: carry-forward is a load-time concern, the effective
    // value is tracked in state afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setHpsValue(subjectId: number, value: number | null) {
    setCarriedFrom((prev) => ({ ...prev, [subjectId]: null }));
    setHps((prev) => ({ ...prev, [subjectId]: value }));
    if (value !== null) hpsAutosave.queueSave(String(subjectId), value);
  }

  function setScore(learnerId: string, subjectId: number, value: number | null) {
    setScores((prev) => {
      const row = { ...prev[learnerId], [subjectId]: value };
      const next = { ...prev, [learnerId]: row };
      const effectiveHps = hps[subjectId];
      const invalid =
        value !== null &&
        (value < 0 || (effectiveHps !== null && value > effectiveHps));
      if (!invalid) {
        scoreAutosave.queueSave(`${learnerId}:${subjectId}`, value);
      }
      return next;
    });
  }

  function errorFor(subjectId: number, value: number | null): string | null {
    if (value === null) return null;
    const effectiveHps = hps[subjectId];
    if (value < 0) return "Score cannot be negative.";
    if (effectiveHps !== null && value > effectiveHps) {
      return `Score cannot exceed the HPS (${effectiveHps}).`;
    }
    return null;
  }

  // Drafts from a crash or reload while offline: restore and flush, so the
  // page recovers unsent work instead of silently showing stale saved data.
  useEffect(() => {
    const scoreDrafts = scoreAutosave.readDrafts();
    const noteDrafts = notesAutosave.readDrafts();
    const scoreIds = Object.keys(scoreDrafts);
    const noteIds = Object.keys(noteDrafts);
    if (scoreIds.length === 0 && noteIds.length === 0) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScores((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(scoreDrafts)) {
        const [learnerId, subjectId] = key.split(":");
        if (!next[learnerId]) continue;
        next[learnerId] = { ...next[learnerId], [Number(subjectId)]: value };
      }
      return next;
    });
    for (const [key, value] of Object.entries(scoreDrafts)) scoreAutosave.queueSave(key, value);

    if (noteIds.length > 0) {
      setNotes((prev) => {
        const next = { ...prev };
        for (const [id, text] of Object.entries(noteDrafts)) next[Number(id)] = text;
        return next;
      });
      for (const [id, text] of Object.entries(noteDrafts)) notesAutosave.queueSave(id, text);
    }

    const total = scoreIds.length + noteIds.length;
    toast.info(
      `Recovered ${total} unsaved field${total === 1 ? "" : "s"} from your last session.`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const numeric = (raw: string): number | null =>
    raw.trim() === "" ? null : Number(raw);

  const failedCount =
    Object.values(scoreAutosave.statuses).filter((s) => s === "failed").length +
    Object.values(hpsAutosave.statuses).filter((s) => s === "failed").length +
    Object.values(notesAutosave.statuses).filter((s) => s === "failed").length;

  function retryAll() {
    scoreAutosave.flushAll();
    hpsAutosave.flushAll();
    notesAutosave.flushAll();
  }

  const pendingCount =
    scoreAutosave.pendingCount + hpsAutosave.pendingCount + notesAutosave.pendingCount;

  function hrefFor(next: { grade?: number; round?: number }): string {
    const params = new URLSearchParams({
      grade: String(next.grade ?? nav.grade),
      round: String(next.round ?? roundId),
    });
    return `/exam?${params}`;
  }

  const subjectStats = useMemo(() => {
    return new Map(
      subjects.map((s) => {
        const entries: ExamEntry[] = learners.map((l) => ({
          sex: l.sex,
          score: scores[l.id]?.[s.id] ?? null,
        }));
        return [s.id, summariseExamSubject(entries, hps[s.id])];
      })
    );
  }, [subjects, learners, scores, hps]);

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

        <TabGroup label="Quarter">
          {nav.quarters.map((q) => (
            <Tab
              key={q.id}
              active={q.id === roundId}
              disabled={leaving}
              onClick={() => go(hrefFor({ round: q.id }))}
            >
              {q.name}
            </Tab>
          ))}
        </TabGroup>

        <div className="ml-auto flex items-center gap-3">
          {leaving && (
            <span className="text-[12px] text-amber-600">
              saving {pendingCount} field{pendingCount === 1 ? "" : "s"}...
            </span>
          )}
          <button
            type="button"
            disabled={leaving}
            onClick={() => go(`/exam/class-record?grade=${nav.grade}&round=${roundId}`)}
            className="font-medium text-emerald-700 hover:underline disabled:opacity-50"
          >
            Class Record →
          </button>
        </div>
      </div>

      {failedCount > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          <span>
            {failedCount} field{failedCount === 1 ? "" : "s"} could not be saved.
            Retrying automatically — your work is kept and will be sent when the
            connection returns.
          </span>
          <button
            type="button"
            onClick={retryAll}
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
              {subjects.map((s) => (
                <th key={s.id} className="min-w-[110px] px-2 py-1 font-medium">
                  <div className="whitespace-nowrap normal-case text-neutral-700">
                    {s.name}
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-1">
                    <span className="text-[10px] font-normal normal-case text-neutral-400">
                      HPS
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={hps[s.id] ?? ""}
                      onChange={(e) => setHpsValue(s.id, numeric(e.target.value))}
                      onBlur={() => hpsAutosave.flushNow(String(s.id))}
                      className="w-14 rounded border border-neutral-300 bg-white px-1 py-0.5 text-center text-[12px] font-normal normal-case text-neutral-700 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  {carriedFrom[s.id] && (
                    <div className="mt-0.5 text-[10px] font-normal normal-case text-amber-600">
                      carried over from {carriedFrom[s.id]}
                    </div>
                  )}
                  {hps[s.id] === null && (
                    <div className="mt-0.5 text-[10px] font-normal normal-case text-amber-600">
                      set HPS to enable this subject
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {learners.map((learner, rowIndex) => (
              <tr key={learner.id} className="group border-t border-neutral-100 transition-colors hover:bg-neutral-50">
                <th
                  scope="row"
                  className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1 text-left font-normal transition-colors group-hover:bg-neutral-50"
                >
                  {learner.last_name}, {learner.first_name}
                </th>
                {subjects.map((s) => {
                  const value = scores[learner.id]?.[s.id] ?? null;
                  const error = errorFor(s.id, value);
                  const disabled = hps[s.id] === null;
                  const status =
                    scoreAutosave.statuses[`${learner.id}:${s.id}`] ?? "clean";
                  return (
                    <td key={s.id} className="w-24 px-1">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          inputMode="numeric"
                          data-row={rowIndex}
                          data-col={String(s.id)}
                          disabled={disabled}
                          value={value ?? ""}
                          onChange={(e) => setScore(learner.id, s.id, numeric(e.target.value))}
                          onBlur={() => scoreAutosave.flushNow(`${learner.id}:${s.id}`)}
                          onKeyDown={(e) =>
                            handleColumnKeyDown(e, rowIndex, String(s.id), learners.length)
                          }
                          title={error ?? undefined}
                          aria-invalid={error ? true : undefined}
                          aria-label={`${s.name} score for ${learner.last_name}, ${learner.first_name}`}
                          className={`${cellInput} ${error ? invalidInput : ""}`}
                        />
                        <span
                          className={`text-[10px] ${STATUS_STYLE[status]}`}
                          title={scoreAutosave.lastError[`${learner.id}:${s.id}`] ?? undefined}
                        >
                          {STATUS_LABEL[status] === "saved ✓" ? "✓" : ""}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {learners.length === 0 && (
              <tr>
                <td colSpan={subjects.length + 1} className="px-2 py-8 text-center text-neutral-400">
                  No enrolled learners in this grade.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-[13px] font-bold">Class statistics</h2>
        <div className="mb-3">
          <ExamMpsChart
            grade={nav.grade}
            subjects={subjects.map((s) => ({
              subject: s.name,
              mps: subjectStats.get(s.id)!.mpsBySex.total,
            }))}
          />
        </div>
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full border-collapse text-[12px]">
            <thead className="bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Subject</th>
                <th className="px-2 py-1.5 text-left font-medium">Sex</th>
                <th className="px-2 py-1.5 text-right font-medium">Assessed</th>
                <th className="px-2 py-1.5 text-right font-medium">Mean</th>
                <th className="px-2 py-1.5 text-right font-medium">SD</th>
                <th className="px-2 py-1.5 text-right font-medium">MPS</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => {
                const stat = subjectStats.get(s.id)!;
                return (["male", "female", "total"] as const).map((key, i) => (
                  <tr
                    key={`${s.id}-${key}`}
                    className={
                      "border-t border-neutral-100" +
                      (key === "total" ? " font-medium" : "")
                    }
                  >
                    {i === 0 && (
                      <td rowSpan={3} className="whitespace-nowrap px-2 py-1 align-top">
                        {s.name}
                      </td>
                    )}
                    <td className="px-2 py-1 capitalize">{key}</td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {stat.assessedBySex[key]}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {stat.meanBySex[key] === null ? "—" : stat.meanBySex[key]!.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {stat.sdBySex[key] === null ? "—" : stat.sdBySex[key]!.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {stat.mpsBySex[key] === null ? "—" : `${stat.mpsBySex[key]!.toFixed(2)}%`}
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-[13px] font-bold">Least Mastered Skills</h2>
        <div className="grid gap-3">
          {subjects.map((s) => {
            const status = notesAutosave.statuses[String(s.id)] ?? "clean";
            return (
              <div key={s.id} className="flex items-start gap-3">
                <label className="w-40 shrink-0 pt-1.5 text-[12px] font-medium text-neutral-600">
                  {s.name}
                </label>
                <textarea
                  value={notes[s.id] ?? ""}
                  onChange={(e) => {
                    const text = e.target.value || null;
                    setNotes((prev) => ({ ...prev, [s.id]: text }));
                    notesAutosave.queueSave(String(s.id), text);
                  }}
                  onBlur={() => notesAutosave.flushNow(String(s.id))}
                  rows={2}
                  className="flex-1 rounded border border-neutral-300 px-2 py-1 text-[13px] outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                />
                <span className={`w-16 pt-1.5 text-[11px] ${STATUS_STYLE[status]}`}>
                  {STATUS_LABEL[status]}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <p className="mt-3 text-[12px] text-neutral-500">
        <strong>{roundName}</strong> · Tab moves across, Enter moves down the same
        subject, Shift+Enter moves up. Fields save on their own; unsaved work is
        kept on this device and re-sent automatically if the connection drops.
      </p>
    </div>
  );
}
