import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { gradeLabel } from "@/lib/grades";
import {
  getCrlaRules,
  getPhiliriRules,
  getRmaRules,
  tryGetRules,
} from "@/lib/scoring/load.ts";
import { orderLanguages } from "@/lib/languages";
import { toClassRecordRow } from "@/lib/scoring/class-record.ts";
import { computeRma } from "@/lib/scoring/rma.ts";
import { computePhiliri } from "@/lib/scoring/philiri.ts";
import {
  summariseExamSubject,
  type ExamEntry,
} from "@/lib/scoring/exam-summary.ts";
import { PrintButton } from "../../../print-button.tsx";

export const metadata = { title: "Learner Profile — I-LEADS" };

const CRLA_GRADES = [1, 2, 3];
const RMA_GRADES = [1, 2, 3];
const PHILIRI_GRADES = [4, 5, 6];
const EXAM_GRADES = [1, 2, 3, 4, 5, 6];

type Round = { id: number; name: string; sequence: number };

export default async function LearnerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const viewer = await getViewer();

  const { data: learner } = await supabase
    .from("learners")
    .select(
      "id, lrn, last_name, first_name, middle_name, ext_name, sex, birthdate, grade_level, status"
    )
    .eq("id", id)
    .single();

  if (!learner) notFound();
  if (!viewer.isHead && !viewer.allowedGrades.includes(learner.grade_level)) {
    notFound();
  }

  const grade = learner.grade_level;
  const fullName = [
    `${learner.last_name}, ${learner.first_name}`,
    learner.middle_name || null,
    learner.ext_name || null,
  ]
    .filter(Boolean)
    .join(" ");

  const showCrla = CRLA_GRADES.includes(grade);
  const showRma = RMA_GRADES.includes(grade);
  const showPhiliri = PHILIRI_GRADES.includes(grade);
  const showExam = EXAM_GRADES.includes(grade);

  const [crla, rma, philiri, exam] = await Promise.all([
    showCrla ? loadCrla(supabase, learner.id, grade) : null,
    showRma ? loadRma(supabase, learner.id, grade) : null,
    showPhiliri ? loadPhiliri(supabase, learner.id, grade) : null,
    showExam ? loadExam(supabase, learner.id, grade) : null,
  ]);

  return (
    <main className="mx-auto max-w-[900px] p-6 print:max-w-none print:p-0">
      <div className="no-print mb-5 flex items-center gap-4 text-[13px]">
        <Link href="/learners" className="text-emerald-700 hover:underline">
          ← Learners
        </Link>
        <div className="ml-auto">
          <PrintButton />
        </div>
      </div>

      <header className="mb-6 break-inside-avoid border-b border-neutral-300 pb-3">
        <p className="text-center text-[11px] uppercase tracking-widest text-neutral-500">
          Learner Progress Profile
        </p>
        <h1 className="mt-1 text-center text-lg font-bold">{fullName}</h1>
        <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-[12px] sm:grid-cols-3">
          <Field label="LRN" value={learner.lrn} />
          <Field label="Sex" value={learner.sex} />
          <Field
            label="Birthdate"
            value={learner.birthdate ?? "—"}
          />
          <Field label="Grade" value={gradeLabel(grade)} />
          <Field label="Status" value={learner.status} />
        </dl>
      </header>

      {!showCrla && !showRma && !showPhiliri && !showExam && (
        <p className="text-neutral-500">
          No assessment modules are configured for Grade {gradeLabel(grade)}{" "}
          yet.
        </p>
      )}

      {crla && <CrlaSection data={crla} />}
      {rma && <RmaSection data={rma} />}
      {philiri && <PhiliriSection data={philiri} />}
      {exam && <ExamSection data={exam} />}
    </main>
  );
}

// ---------------------------------------------------------------------------
// CRLA
// ---------------------------------------------------------------------------

async function loadCrla(
  supabase: Awaited<ReturnType<typeof createClient>>,
  learnerId: string,
  grade: number
) {
  const rules = await getCrlaRules(supabase, grade);
  const languages = orderLanguages(Object.keys(rules.languages));

  const { data: rounds } = await supabase
    .from("assessment_rounds")
    .select("id, name, sequence")
    .eq("tool", "crla")
    .order("sequence");

  const { data: results } = await supabase
    .from("crla_results")
    .select(
      "round_id, language, task1, task2l, task2h, story_no, miscues, reading_secs, comprehension_correct, remarks"
    )
    .eq("learner_id", learnerId);

  const byKey = new Map((results ?? []).map((r) => [`${r.round_id}:${r.language}`, r]));

  return {
    rounds: (rounds ?? []) as Round[],
    languages,
    rows: languages.map((language) => ({
      language,
      perRound: (rounds ?? []).map((round) => {
        const raw = byKey.get(`${round.id}:${language}`);
        if (!raw) return { round, encoded: false as const };
        const record = toClassRecordRow(
          {
            task1: raw.task1,
            task2Low: raw.task2l,
            task2High: raw.task2h,
            storyNo: raw.story_no,
            miscues: raw.miscues,
            readingSeconds: raw.reading_secs,
            comprehensionCorrect: raw.comprehension_correct,
          },
          rules,
          language
        );
        return { round, encoded: true as const, record, remarks: raw.remarks };
      }),
    })),
  };
}

function CrlaSection({ data }: { data: Awaited<ReturnType<typeof loadCrla>> }) {
  return (
    <Section title="CRLA — Reading">
      {data.rows.map(({ language, perRound }) => (
        <div key={language} className="mb-4">
          <h3 className="mb-1 text-[12px] font-semibold text-neutral-600">
            {language}
          </h3>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-y border-neutral-300 bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-600">
                <th className="px-2 py-1 text-left font-medium">Round</th>
                <th className="px-2 py-1 text-left font-medium">Reading Level</th>
                <th className="px-2 py-1 text-left font-medium">Reading Profile</th>
                <th className="px-2 py-1 text-right font-medium">WPM</th>
                <th className="px-2 py-1 text-left font-medium">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {perRound.map(({ round, ...cell }) => (
                <tr key={round.id} className="border-b border-neutral-200">
                  <td className="px-2 py-1 font-medium">{round.name}</td>
                  {!cell.encoded ? (
                    <td colSpan={4} className="px-2 py-1 text-neutral-400 italic">
                      Not yet encoded
                    </td>
                  ) : (
                    <>
                      <td className="px-2 py-1">{cell.record.readingLevel ?? "—"}</td>
                      <td className="px-2 py-1">{cell.record.readingProfile ?? "—"}</td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {cell.record.wpm !== null ? cell.record.wpm.toFixed(0) : "—"}
                      </td>
                      <td className="px-2 py-1">{cell.remarks ?? ""}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// RMA
// ---------------------------------------------------------------------------

async function loadRma(
  supabase: Awaited<ReturnType<typeof createClient>>,
  learnerId: string,
  grade: number
) {
  const rules = await tryGetRules(() => getRmaRules(supabase, grade));

  const { data: rounds } = await supabase
    .from("assessment_rounds")
    .select("id, name, sequence")
    .eq("tool", "rma")
    .order("sequence");

  const { data: results } = await supabase
    .from("rma_results")
    .select("round_id, task_scores, remarks")
    .eq("learner_id", learnerId);

  const byRound = new Map((results ?? []).map((r) => [r.round_id, r]));
  const levelsConfigured = (rules?.levels.length ?? 0) > 0;

  return {
    rules,
    levelsConfigured,
    perRound: (rounds ?? []).map((round) => {
      const raw = byRound.get(round.id);
      const encodedRaw =
        !!raw &&
        Object.values((raw.task_scores ?? {}) as Record<string, number | null>).some(
          (v) => typeof v === "number"
        );
      if (!raw || !encodedRaw) return { round, encoded: false as const };
      if (!rules) return { round, encoded: true as const, notConfigured: true as const };
      const computed = computeRma({ taskScores: raw.task_scores ?? {} }, rules);
      return {
        round,
        encoded: true as const,
        notConfigured: false as const,
        computed,
        remarks: raw.remarks,
      };
    }),
  };
}

function RmaSection({ data }: { data: Awaited<ReturnType<typeof loadRma>> }) {
  return (
    <Section title="RMA — Mathematics">
      {!data.rules && (
        <p className="mb-2 text-[12px] text-amber-700">
          RMA scoring rules for this grade have not been loaded.
        </p>
      )}
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-neutral-300 bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-600">
            <th className="px-2 py-1 text-left font-medium">Round</th>
            <th className="px-2 py-1 text-right font-medium">Total</th>
            <th className="px-2 py-1 text-right font-medium">%</th>
            <th className="px-2 py-1 text-left font-medium">Proficiency Level</th>
            <th className="px-2 py-1 text-left font-medium">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {data.perRound.map((row) => (
            <tr key={row.round.id} className="border-b border-neutral-200">
              <td className="px-2 py-1 font-medium">{row.round.name}</td>
              {!row.encoded ? (
                <td colSpan={4} className="px-2 py-1 text-neutral-400 italic">
                  Not yet encoded
                </td>
              ) : row.notConfigured || !row.computed ? (
                <td colSpan={4} className="px-2 py-1 text-neutral-400 italic">
                  Level not available
                </td>
              ) : (
                <>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {row.computed.total ?? "—"}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {row.computed.percent !== null
                      ? `${(row.computed.percent * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                  <td className="px-2 py-1">
                    {data.levelsConfigured
                      ? (row.computed.proficiencyLevel ?? "level not available")
                      : "level not available"}
                  </td>
                  <td className="px-2 py-1">{row.remarks ?? ""}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Phil-IRI
// ---------------------------------------------------------------------------

async function loadPhiliri(
  supabase: Awaited<ReturnType<typeof createClient>>,
  learnerId: string,
  grade: number
) {
  const rules = await tryGetRules(() => getPhiliriRules(supabase, grade));

  const { data: rounds } = await supabase
    .from("assessment_rounds")
    .select("id, name, sequence")
    .eq("tool", "philiri")
    .order("sequence");

  const { data: results } = await supabase
    .from("philiri_results")
    .select(
      "round_id, language, word_count, miscues, comprehension_items, comprehension_correct, remarks"
    )
    .eq("learner_id", learnerId);

  const byKey = new Map((results ?? []).map((r) => [`${r.round_id}:${r.language}`, r]));
  const languages = rules ? orderLanguages(Object.keys(rules.languages)) : [];

  return {
    rules,
    languages,
    rows: languages.map((language) => ({
      language,
      perRound: (rounds ?? []).map((round) => {
        const raw = byKey.get(`${round.id}:${language}`);
        if (!raw) return { round, encoded: false as const };
        const langRules = rules!.languages[language];
        const computed = computePhiliri(
          {
            wordCount: raw.word_count,
            miscues: raw.miscues,
            comprehensionItems: raw.comprehension_items,
            comprehensionCorrect: raw.comprehension_correct,
          },
          langRules
        );
        return { round, encoded: true as const, computed, remarks: raw.remarks };
      }),
    })),
  };
}

function PhiliriSection({
  data,
}: {
  data: Awaited<ReturnType<typeof loadPhiliri>>;
}) {
  return (
    <Section title="Phil-IRI — Oral Reading">
      {!data.rules ? (
        <p className="text-[12px] text-amber-700">
          Phil-IRI scoring rules for this grade have not been loaded.
        </p>
      ) : (
        data.rows.map(({ language, perRound }) => (
          <div key={language} className="mb-4">
            <h3 className="mb-1 text-[12px] font-semibold text-neutral-600">
              {language}
            </h3>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-y border-neutral-300 bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-600">
                  <th className="px-2 py-1 text-left font-medium">Round</th>
                  <th className="px-2 py-1 text-left font-medium">Word Reading Level</th>
                  <th className="px-2 py-1 text-left font-medium">Comprehension Level</th>
                  <th className="px-2 py-1 text-left font-medium">Overall Level</th>
                  <th className="px-2 py-1 text-left font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {perRound.map(({ round, ...cell }) => (
                  <tr key={round.id} className="border-b border-neutral-200">
                    <td className="px-2 py-1 font-medium">{round.name}</td>
                    {!cell.encoded ? (
                      <td colSpan={4} className="px-2 py-1 text-neutral-400 italic">
                        Not yet encoded
                      </td>
                    ) : (
                      <>
                        <td className="px-2 py-1">
                          {cell.computed.wordReadingLevel ?? "—"}
                        </td>
                        <td className="px-2 py-1">
                          {cell.computed.comprehensionLevel ?? "—"}
                        </td>
                        <td className="px-2 py-1 font-medium">
                          {cell.computed.overallLevel ?? "—"}
                        </td>
                        <td className="px-2 py-1">{cell.remarks ?? ""}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Exam
// ---------------------------------------------------------------------------

async function loadExam(
  supabase: Awaited<ReturnType<typeof createClient>>,
  learnerId: string,
  grade: number
) {
  const { data: rounds } = await supabase
    .from("assessment_rounds")
    .select("id, name, sequence")
    .eq("tool", "exam")
    .order("sequence");

  const { data: subjectRows } = await supabase
    .from("learning_areas")
    .select("id, name, sequence, hps_per_quarter")
    .eq("grade_level", grade)
    .order("sequence");

  const subjects = subjectRows ?? [];
  const subjectIds = subjects.map((s) => s.id);

  const { data: classmates } = await supabase
    .from("learners")
    .select("id, sex")
    .eq("grade_level", grade)
    .eq("status", "enrolled");

  const perRound = await Promise.all(
    (rounds ?? []).map(async (round) => {
      if (subjectIds.length === 0) {
        return { round, subjects: [] as never[] };
      }

      const { data: results } = await supabase
        .from("exam_results")
        .select("learner_id, learning_area_id, score")
        .eq("round_id", round.id)
        .in("learning_area_id", subjectIds);

      const scoreByLearnerSubject = new Map<string, number | null>();
      for (const r of results ?? []) {
        scoreByLearnerSubject.set(`${r.learner_id}:${r.learning_area_id}`, r.score);
      }

      const subjectRowsForRound = subjects.map((s) => {
        const hps =
          ((s.hps_per_quarter ?? {}) as Record<string, number | null>)[round.name] ?? null;
        const entries: ExamEntry[] = (classmates ?? []).map((c) => ({
          sex: c.sex,
          score: scoreByLearnerSubject.get(`${c.id}:${s.id}`) ?? null,
        }));
        const summary = summariseExamSubject(entries, hps);
        const learnerScore = scoreByLearnerSubject.get(`${learnerId}:${s.id}`) ?? null;

        return {
          subject: s,
          hps,
          learnerScore,
          classMps: summary.mpsBySex.total,
        };
      });

      return { round, subjects: subjectRowsForRound };
    })
  );

  return { perRound, hasSubjects: subjects.length > 0 };
}

function ExamSection({ data }: { data: Awaited<ReturnType<typeof loadExam>> }) {
  if (!data.hasSubjects) {
    return (
      <Section title="Exams">
        <p className="text-[12px] text-neutral-500">
          No learning areas have been set up for this grade yet.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Exams">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-neutral-300 bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-600">
            <th className="px-2 py-1 text-left font-medium">Subject</th>
            {data.perRound.map(({ round }) => (
              <th key={round.id} className="px-2 py-1 text-left font-medium">
                {round.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.perRound[0]?.subjects.map((_, subjectIndex) => {
            const subjectName = data.perRound[0].subjects[subjectIndex].subject.name;
            return (
              <tr key={subjectName} className="border-b border-neutral-200">
                <td className="px-2 py-1 font-medium">{subjectName}</td>
                {data.perRound.map(({ round, subjects }) => {
                  const cell = subjects[subjectIndex];
                  return (
                    <td key={round.id} className="px-2 py-1">
                      {cell.learnerScore === null ? (
                        <span className="text-neutral-400 italic">not yet encoded</span>
                      ) : cell.hps === null ? (
                        <>
                          {cell.learnerScore} —{" "}
                          <span className="text-neutral-400">MPS not available</span>
                        </>
                      ) : (
                        <>
                          {cell.learnerScore}/{cell.hps} — class MPS{" "}
                          {cell.classMps !== null ? `${cell.classMps.toFixed(0)}%` : "—"}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="mb-2 text-[13px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-neutral-500">{label}:</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
