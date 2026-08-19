import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { getGradeTeacherNames } from "@/lib/teachers";
import {
  CRLA_GRADES,
  EXAM_GRADES,
  GRADE_LEVELS,
  PHILIRI_GRADES,
  RMA_GRADES,
} from "@/lib/grades";
import {
  getCrlaRules,
  getPhiliriRules,
  getRmaRules,
  tryGetRules,
} from "@/lib/scoring/load.ts";
import { LANGUAGE_NAMES, orderLanguages } from "@/lib/languages";
import { summarise } from "@/lib/scoring/class-summary.ts";
import { summariseRma } from "@/lib/scoring/rma-summary.ts";
import { summarisePhiliri, LEVELS as PHILIRI_LEVELS } from "@/lib/scoring/philiri-summary.ts";
import { summariseExamSubject, type ExamEntry } from "@/lib/scoring/exam-summary.ts";
import type { CrlaRules, PhiliriRules, RmaRules } from "@/lib/scoring/types.ts";
import {
  currentCrlaEntries,
  currentPhiliriEntries,
  currentRmaEntries,
  encodedLearnerIdsByKey,
  hasAnyRmaScore,
  philiriEntriesForRound,
  type CrlaRow,
  type PhiliriRow,
  type RmaRow,
} from "@/lib/dashboard/current-status.ts";
import {
  EncodingProgressChart,
  StatusLegend,
  type TrackerTableData,
} from "../encoding-progress-chart.tsx";
import { GroupedLevelChart, type LevelGroup } from "./grouped-level-chart.tsx";
import { ExamMpsChart } from "../exam-mps-chart.tsx";
import { EXAM_MASTERY_THRESHOLD } from "../dashboard-colors.ts";

export const metadata = { title: "School Head Dashboard — I-LEADS" };

type Round = { id: number; name: string; sequence: number };
type Learner = {
  id: string;
  lrn: string;
  last_name: string;
  first_name: string;
  sex: "M" | "F";
  grade_level: number;
};

type AtRiskRow = {
  learnerId: string;
  name: string;
  grade: number;
  instrument: string;
  language: string | null;
  level: string;
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const viewer = await getViewer();
  if (!viewer.isHead) redirect("/my-class");

  const { data: learnersData } = await supabase
    .from("learners")
    .select("id, lrn, last_name, first_name, sex, grade_level")
    .eq("status", "enrolled")
    .order("last_name")
    .order("first_name");
  const learners = (learnersData ?? []) as Learner[];

  const learnerById = new Map(learners.map((l) => [l.id, l]));
  const learnersByGrade = new Map<number, Learner[]>();
  for (const l of learners) {
    const list = learnersByGrade.get(l.grade_level) ?? [];
    list.push(l);
    learnersByGrade.set(l.grade_level, list);
  }
  const gradeOf = (learnerId: string) => learnerById.get(learnerId)?.grade_level;

  async function roundsFor(tool: string): Promise<Round[]> {
    const { data } = await supabase
      .from("assessment_rounds")
      .select("id, name, sequence")
      .eq("tool", tool)
      .order("sequence");
    return (data ?? []) as Round[];
  }

  const [crlaRounds, rmaRounds, philiriRounds, examRounds] = await Promise.all([
    roundsFor("crla"),
    roundsFor("rma"),
    roundsFor("philiri"),
    roundsFor("exam"),
  ]);

  const { data: crlaRowsData } = await supabase
    .from("crla_results")
    .select(
      "learner_id, round_id, language, task1, task2l, task2h, story_no, miscues, reading_secs, comprehension_correct"
    );
  const { data: rmaRowsData } = await supabase
    .from("rma_results")
    .select("learner_id, round_id, task_scores");
  const { data: philiriRowsData } = await supabase
    .from("philiri_results")
    .select(
      "learner_id, round_id, language, word_count, miscues, comprehension_items, comprehension_correct"
    );
  const { data: examRowsData } = await supabase
    .from("exam_results")
    .select("learner_id, round_id, learning_area_id, score");

  const crlaRows = (crlaRowsData ?? []) as CrlaRow[];
  const rmaRows = (rmaRowsData ?? []) as RmaRow[];
  const philiriRows = (philiriRowsData ?? []) as PhiliriRow[];
  const examRows = (examRowsData ?? []) as {
    learner_id: string;
    round_id: number;
    learning_area_id: number;
    score: number | null;
  }[];

  function byGrade<T extends { learner_id: string }>(rows: T[]): Map<number, T[]> {
    const map = new Map<number, T[]>();
    for (const row of rows) {
      const grade = gradeOf(row.learner_id);
      if (grade === undefined) continue;
      const list = map.get(grade) ?? [];
      list.push(row);
      map.set(grade, list);
    }
    return map;
  }

  const crlaRowsByGrade = byGrade(crlaRows);
  const rmaRowsByGrade = byGrade(rmaRows);
  const philiriRowsByGrade = byGrade(philiriRows);
  const examRowsByGrade = byGrade(examRows);

  const { data: learningAreasData } = await supabase
    .from("learning_areas")
    .select("id, name, grade_level, sequence, hps_per_quarter")
    .in("grade_level", GRADE_LEVELS)
    .order("sequence");
  const learningAreas = learningAreasData ?? [];

  const crlaRulesByGrade = new Map<number, CrlaRules | null>();
  const rmaRulesByGrade = new Map<number, RmaRules | null>();
  const philiriRulesByGrade = new Map<number, PhiliriRules | null>();
  const teacherNamesByGrade = new Map<number, string[]>();

  await Promise.all([
    ...CRLA_GRADES.map(async (g) => {
      crlaRulesByGrade.set(g, await tryGetRules(() => getCrlaRules(supabase, g)));
    }),
    ...RMA_GRADES.map(async (g) => {
      rmaRulesByGrade.set(g, await tryGetRules(() => getRmaRules(supabase, g)));
    }),
    ...PHILIRI_GRADES.map(async (g) => {
      philiriRulesByGrade.set(g, await tryGetRules(() => getPhiliriRules(supabase, g)));
    }),
    ...GRADE_LEVELS.map(async (g) => {
      teacherNamesByGrade.set(g, await getGradeTeacherNames(supabase, g));
    }),
  ]);

  const atRisk: AtRiskRow[] = [];
  const trackerCellCounts = { complete: 0, incomplete: 0 };

  function addTrackerCell(enrolled: number, encoded: number) {
    if (enrolled === 0) return; // nothing to encode — not a completeness signal
    if (encoded >= enrolled) trackerCellCounts.complete += 1;
    else trackerCellCounts.incomplete += 1;
  }

  // ---------------------------------------------------------------------
  // Per-grade cards + at-risk collection
  // ---------------------------------------------------------------------

  const gradeCards = GRADE_LEVELS.map((grade) => {
    const gradeLearners = learnersByGrade.get(grade) ?? [];
    const enrolled = gradeLearners.length;

    // --- CRLA ---
    let crlaCard: {
      language: string;
      summary: ReturnType<typeof summarise>;
      worstLabel: string;
    }[] | null = null;

    if (CRLA_GRADES.includes(grade)) {
      const rules = crlaRulesByGrade.get(grade);
      if (rules) {
        const languages = orderLanguages(Object.keys(rules.languages));
        crlaCard = languages.map((language) => {
          const entries = currentCrlaEntries(
            gradeLearners,
            crlaRowsByGrade.get(grade) ?? [],
            crlaRounds,
            rules,
            language
          );
          const worstLabel = rules.languages[language].part1.levels[0]?.label ?? "";
          for (const e of entries) {
            if (e.readingLevel !== null && e.readingLevel === worstLabel) {
              const learner = learnerById.get(e.learnerId)!;
              atRisk.push({
                learnerId: e.learnerId,
                name: `${learner.last_name}, ${learner.first_name}`,
                grade,
                instrument: "CRLA",
                language,
                level: worstLabel,
              });
            }
          }
          return { language, summary: summarise(entries, rules, language), worstLabel };
        });
      }
    }

    // --- RMA ---
    let rmaCard: {
      summary: ReturnType<typeof summariseRma>;
      configured: boolean;
      worstLabel: string | null;
    } | null = null;

    if (RMA_GRADES.includes(grade)) {
      const rules = rmaRulesByGrade.get(grade);
      if (rules) {
        const entries = currentRmaEntries(
          gradeLearners,
          rmaRowsByGrade.get(grade) ?? [],
          rmaRounds,
          rules
        );
        const configured = rules.levels.length > 0;
        const worstLabel = configured ? rules.levels[0].label : null;
        if (configured && worstLabel) {
          for (const e of entries) {
            if (e.proficiencyLevel !== null && e.proficiencyLevel === worstLabel) {
              const learner = learnerById.get(e.learnerId)!;
              atRisk.push({
                learnerId: e.learnerId,
                name: `${learner.last_name}, ${learner.first_name}`,
                grade,
                instrument: "RMA",
                language: null,
                level: worstLabel,
              });
            }
          }
        }
        rmaCard = { summary: summariseRma(entries, rules), configured, worstLabel };
      }
    }

    // --- Phil-IRI ---
    let philiriCard: {
      language: string;
      summary: ReturnType<typeof summarisePhiliri>;
    }[] | null = null;

    if (PHILIRI_GRADES.includes(grade)) {
      const rules = philiriRulesByGrade.get(grade);
      if (rules) {
        const languages = orderLanguages(Object.keys(rules.languages));
        philiriCard = languages.map((language) => {
          const entries = currentPhiliriEntries(
            gradeLearners,
            philiriRowsByGrade.get(grade) ?? [],
            philiriRounds,
            rules.languages[language],
            language
          );
          for (const e of entries) {
            if (e.overallLevel === "Frustration") {
              const learner = learnerById.get(e.learnerId)!;
              atRisk.push({
                learnerId: e.learnerId,
                name: `${learner.last_name}, ${learner.first_name}`,
                grade,
                instrument: "Phil-IRI",
                language,
                level: "Frustration",
              });
            }
          }
          return { language, summary: summarisePhiliri(entries) };
        });
      }
    }

    // --- Exam ---
    let examCard:
      | { subject: string; roundName: string | null; mps: number | null }[]
      | null = null;

    if (EXAM_GRADES.includes(grade)) {
      const gradeSubjects = learningAreas.filter((a) => a.grade_level === grade);
      const gradeExamRows = examRowsByGrade.get(grade) ?? [];
      const roundsDesc = [...examRounds].sort((a, b) => b.sequence - a.sequence);

      examCard = gradeSubjects.map((subject) => {
        const round = roundsDesc.find((r) =>
          gradeExamRows.some(
            (row) => row.learning_area_id === subject.id && row.round_id === r.id
          )
        );
        if (!round) return { subject: subject.name, roundName: null, mps: null };

        const hps =
          ((subject.hps_per_quarter ?? {}) as Record<string, number | null>)[round.name] ??
          null;
        const entries: ExamEntry[] = gradeLearners.map((l) => ({
          sex: l.sex,
          score:
            gradeExamRows.find(
              (row) =>
                row.learner_id === l.id &&
                row.round_id === round.id &&
                row.learning_area_id === subject.id
            )?.score ?? null,
        }));
        const summary = summariseExamSubject(entries, hps);
        return { subject: subject.name, roundName: round.name, mps: summary.mpsBySex.total };
      });
    }

    return { grade, enrolled, teachers: teacherNamesByGrade.get(grade) ?? [], crlaCard, rmaCard, philiriCard, examCard };
  });

  // ---------------------------------------------------------------------
  // Score distribution charts — a rendering layer on gradeCards, no new
  // Supabase queries. "not-applicable" = the language/round doesn't apply
  // to this grade; "not-configured" = the grade has no level bands yet
  // (e.g. RMA G1/G2); "not-enough-data" = configured, but nobody assessed.
  // ---------------------------------------------------------------------

  const crlaLanguages = orderLanguages(
    Array.from(
      new Set(CRLA_GRADES.flatMap((g) => Object.keys(crlaRulesByGrade.get(g)?.languages ?? {})))
    )
  );
  const crlaCharts = crlaLanguages.map((language) => {
    const levels =
      CRLA_GRADES.map((g) => crlaRulesByGrade.get(g)).find((rules) => rules?.languages[language])
        ?.languages[language].part1.levels.map((l) => l.label) ?? [];
    const groups: LevelGroup[] = CRLA_GRADES.map((grade) => {
      const entry = gradeCards.find((c) => c.grade === grade)?.crlaCard?.find((x) => x.language === language);
      if (!entry) return { key: `g${grade}`, label: `Grade ${grade}`, status: "not-applicable", assessed: 0, bars: null };
      if (entry.summary.assessed === 0) return { key: `g${grade}`, label: `Grade ${grade}`, status: "not-enough-data", assessed: 0, bars: null };
      return {
        key: `g${grade}`,
        label: `Grade ${grade}`,
        status: "ok",
        assessed: entry.summary.assessed,
        bars: entry.summary.levels.map((r) => ({ level: r.label, value: r.total })),
      };
    });
    return { language, levels, groups };
  });

  const rmaLevels = rmaRulesByGrade.get(3)?.levels.map((l) => l.label) ?? [];
  const rmaGroups: LevelGroup[] = RMA_GRADES.map((grade) => {
    const card = gradeCards.find((c) => c.grade === grade)?.rmaCard;
    if (!card) return { key: `g${grade}`, label: `Grade ${grade}`, status: "not-applicable", assessed: 0, bars: null };
    if (!card.configured) return { key: `g${grade}`, label: `Grade ${grade}`, status: "not-configured", assessed: card.summary.assessed, bars: null };
    if (card.summary.assessed === 0) return { key: `g${grade}`, label: `Grade ${grade}`, status: "not-enough-data", assessed: 0, bars: null };
    return {
      key: `g${grade}`,
      label: `Grade ${grade}`,
      status: "ok",
      assessed: card.summary.assessed,
      bars: card.summary.levels.map((r) => ({ level: r.label, value: r.total })),
    };
  });

  const philiriLanguages = orderLanguages(
    Array.from(
      new Set(PHILIRI_GRADES.flatMap((g) => Object.keys(philiriRulesByGrade.get(g)?.languages ?? {})))
    )
  );
  const philiriCharts = philiriLanguages.flatMap((language) =>
    philiriRounds.map((round) => {
      const groups: LevelGroup[] = PHILIRI_GRADES.map((grade) => {
        const rules = philiriRulesByGrade.get(grade);
        const langRules = rules?.languages[language];
        if (!langRules) return { key: `g${grade}`, label: `Grade ${grade}`, status: "not-applicable", assessed: 0, bars: null };
        const entries = philiriEntriesForRound(
          learnersByGrade.get(grade) ?? [],
          philiriRowsByGrade.get(grade) ?? [],
          round.id,
          langRules,
          language
        );
        const summary = summarisePhiliri(entries);
        if (summary.assessed === 0) return { key: `g${grade}`, label: `Grade ${grade}`, status: "not-enough-data", assessed: 0, bars: null };
        return {
          key: `g${grade}`,
          label: `Grade ${grade}`,
          status: "ok",
          assessed: summary.assessed,
          bars: summary.overallLevels.map((r) => ({ level: r.label, value: r.total })),
        };
      });
      return { language, roundName: round.name, levels: PHILIRI_LEVELS, groups };
    })
  );

  const examCharts = EXAM_GRADES.map((grade) => ({
    grade,
    subjects: (gradeCards.find((c) => c.grade === grade)?.examCard ?? []).map((s) => ({
      subject: s.subject,
      mps: s.mps,
    })),
  }));

  // ---------------------------------------------------------------------
  // Encoding progress trackers
  // ---------------------------------------------------------------------

  const crlaTracker: TrackerTableData = {
    title: "CRLA",
    columns: crlaRounds.map((r) => r.name),
    rows: CRLA_GRADES.flatMap((grade) => {
      const rules = crlaRulesByGrade.get(grade);
      if (!rules) return [];
      const enrolled = (learnersByGrade.get(grade) ?? []).length;
      const encodedByKey = encodedLearnerIdsByKey(
        crlaRowsByGrade.get(grade) ?? [],
        (r) => `${r.round_id}:${r.language}`,
        (r) => r.learner_id
      );
      return orderLanguages(Object.keys(rules.languages)).map((language) => ({
        label: `Grade ${grade} · ${language}`,
        cells: crlaRounds.map((round) => {
          const encoded = encodedByKey.get(`${round.id}:${language}`)?.size ?? 0;
          addTrackerCell(enrolled, encoded);
          return { label: round.name, encoded, enrolled };
        }),
      }));
    }),
  };

  const rmaTracker: TrackerTableData = {
    title: "RMA",
    columns: rmaRounds.map((r) => r.name),
    rows: RMA_GRADES.map((grade) => {
      const enrolled = (learnersByGrade.get(grade) ?? []).length;
      const encodedByKey = encodedLearnerIdsByKey(
        (rmaRowsByGrade.get(grade) ?? []).filter(hasAnyRmaScore),
        (r) => `${r.round_id}`,
        (r) => r.learner_id
      );
      return {
        label: `Grade ${grade}`,
        cells: rmaRounds.map((round) => {
          const encoded = encodedByKey.get(`${round.id}`)?.size ?? 0;
          addTrackerCell(enrolled, encoded);
          return { label: round.name, encoded, enrolled };
        }),
      };
    }),
  };

  const philiriTracker: TrackerTableData = {
    title: "Phil-IRI",
    columns: philiriRounds.map((r) => r.name),
    rows: PHILIRI_GRADES.flatMap((grade) => {
      const rules = philiriRulesByGrade.get(grade);
      if (!rules) return [];
      const enrolled = (learnersByGrade.get(grade) ?? []).length;
      const encodedByKey = encodedLearnerIdsByKey(
        philiriRowsByGrade.get(grade) ?? [],
        (r) => `${r.round_id}:${r.language}`,
        (r) => r.learner_id
      );
      return orderLanguages(Object.keys(rules.languages)).map((language) => ({
        label: `Grade ${grade} · ${language}`,
        cells: philiriRounds.map((round) => {
          const encoded = encodedByKey.get(`${round.id}:${language}`)?.size ?? 0;
          addTrackerCell(enrolled, encoded);
          return { label: round.name, encoded, enrolled };
        }),
      }));
    }),
  };

  const examTracker: TrackerTableData = {
    title: "Exam",
    columns: examRounds.map((r) => r.name),
    rows: EXAM_GRADES.map((grade) => {
      const enrolled = (learnersByGrade.get(grade) ?? []).length;
      const encodedByKey = encodedLearnerIdsByKey(
        examRowsByGrade.get(grade) ?? [],
        (r) => `${r.round_id}`,
        (r) => r.learner_id
      );
      return {
        label: `Grade ${grade}`,
        cells: examRounds.map((round) => {
          const encoded = encodedByKey.get(`${round.id}`)?.size ?? 0;
          addTrackerCell(enrolled, encoded);
          return { label: round.name, encoded, enrolled };
        }),
      };
    }),
  };

  atRisk.sort((a, b) => a.grade - b.grade || a.instrument.localeCompare(b.instrument));

  return (
    <main className="mx-auto max-w-[1400px] p-6">
      <h1 className="mb-6 text-2xl font-bold">School Head Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Total Enrolled" value={learners.length} tone="neutral" />
        <StatTile
          label="At-Risk Flags"
          value={atRisk.length}
          tone={atRisk.length > 0 ? "warn" : "good"}
        />
        <StatTile
          label="Incomplete Encoding Rounds"
          value={trackerCellCounts.incomplete}
          tone={trackerCellCounts.incomplete > 0 ? "warn" : "good"}
        />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-neutral-500">
          Per-Grade Breakdown
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {gradeCards.map((card) => (
            <GradeCard key={card.grade} card={card} />
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-neutral-500">
          Score Distributions
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {crlaCharts.map((c) => (
            <GroupedLevelChart
              key={`crla-${c.language}`}
              title="CRLA Level Distribution"
              subtitle={LANGUAGE_NAMES[c.language] ?? c.language}
              levels={c.levels}
              groups={c.groups}
            />
          ))}
          <GroupedLevelChart title="RMA Proficiency Distribution" levels={rmaLevels} groups={rmaGroups} />
          {philiriCharts.map((c) => (
            <GroupedLevelChart
              key={`philiri-${c.language}-${c.roundName}`}
              title="Phil-IRI Overall Level Distribution"
              subtitle={`${LANGUAGE_NAMES[c.language] ?? c.language} · ${c.roundName}`}
              levels={c.levels}
              groups={c.groups}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {examCharts.map((c) => (
            <ExamMpsChart key={`exam-${c.grade}`} grade={c.grade} subjects={c.subjects} />
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-neutral-500">
          At-Risk Learners
        </h2>
        {atRisk.length === 0 ? (
          <p className="text-[13px] text-neutral-500">
            No learners currently at the lowest level on any instrument.
          </p>
        ) : (
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
                {atRisk.map((row, i) => (
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
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-neutral-500">
          Encoding Progress
        </h2>
        <p className="mb-1 text-[12px] text-neutral-500">
          Learners with a record for that round, out of learners enrolled in that grade.
        </p>
        <StatusLegend />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <EncodingProgressChart data={crlaTracker} />
          <EncodingProgressChart data={rmaTracker} />
          <EncodingProgressChart data={philiriTracker} />
          <EncodingProgressChart data={examTracker} />
        </div>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "warn" | "neutral";
}) {
  const style = {
    good: { text: "text-emerald-700", accent: "border-l-emerald-500", wash: "bg-emerald-50/40" },
    warn: { text: "text-amber-700", accent: "border-l-amber-500", wash: "bg-amber-50/40" },
    neutral: { text: "text-neutral-900", accent: "border-l-neutral-300", wash: "bg-white" },
  }[tone];

  return (
    <div
      className={`rounded-xl border border-l-4 border-neutral-200 p-4 ${style.accent} ${style.wash}`}
    >
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${style.text}`}>{value}</p>
    </div>
  );
}

/**
 * `dangerLabel` highlights the instrument's lowest band in red when it has
 * learners in it — the same visual language as the At-Risk table below —
 * so the flag is visible here without having to cross-reference that table.
 */
function LevelTags({
  rows,
  dangerLabel,
}: {
  rows: { label: string; total: number }[];
  dangerLabel?: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {rows.map((r) => {
        const isDanger = dangerLabel !== null && dangerLabel !== undefined && r.label === dangerLabel && r.total > 0;
        return (
          <span
            key={r.label}
            className={
              "rounded-full px-2 py-0.5 text-[11px] font-medium " +
              (isDanger ? "bg-red-50 text-red-700" : "bg-neutral-100 text-neutral-700")
            }
          >
            {r.label}: <span className="tabular-nums">{r.total}</span>
          </span>
        );
      })}
    </div>
  );
}

function GradeCard({
  card,
}: {
  card: {
    grade: number;
    enrolled: number;
    teachers: string[];
    crlaCard: { language: string; summary: ReturnType<typeof summarise>; worstLabel: string }[] | null;
    rmaCard: { summary: ReturnType<typeof summariseRma>; configured: boolean; worstLabel: string | null } | null;
    philiriCard: { language: string; summary: ReturnType<typeof summarisePhiliri> }[] | null;
    examCard: { subject: string; roundName: string | null; mps: number | null }[] | null;
  };
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[15px] font-bold">Grade {card.grade}</h3>
        <p className="text-[12px] text-neutral-500">
          {card.enrolled} enrolled{card.teachers.length > 0 ? ` · ${card.teachers.join(", ")}` : ""}
        </p>
      </div>

      <div className="space-y-3">
        {card.crlaCard && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              CRLA
            </p>
            {card.crlaCard.map(({ language, summary, worstLabel }) => (
              <div key={language} className="mt-1">
                <p className="text-[12px] font-medium text-neutral-600">{language}</p>
                <LevelTags rows={summary.levels} dangerLabel={worstLabel} />
              </div>
            ))}
          </div>
        )}

        {card.rmaCard && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              RMA
            </p>
            {card.rmaCard.configured ? (
              <LevelTags rows={card.rmaCard.summary.levels} dangerLabel={card.rmaCard.worstLabel} />
            ) : (
              <p className="text-[12px] text-amber-700">
                Levels not configured for this grade ({card.rmaCard.summary.assessed} scored).
              </p>
            )}
          </div>
        )}

        {card.philiriCard && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Phil-IRI
            </p>
            {card.philiriCard.map(({ language, summary }) => (
              <div key={language} className="mt-1">
                <p className="text-[12px] font-medium text-neutral-600">{language}</p>
                <LevelTags rows={summary.overallLevels} dangerLabel="Frustration" />
              </div>
            ))}
          </div>
        )}

        {card.examCard && card.examCard.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Exam — class MPS
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {card.examCard.map((s) => {
                const tone =
                  s.mps === null
                    ? "bg-neutral-100 text-neutral-700"
                    : s.mps >= EXAM_MASTERY_THRESHOLD
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700";
                return (
                  <span
                    key={s.subject}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}
                    title={s.roundName ?? undefined}
                  >
                    {s.subject}: {s.mps !== null ? <span className="tabular-nums">{s.mps.toFixed(0)}%</span> : "not yet encoded"}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {!card.crlaCard && !card.rmaCard && !card.philiriCard && (!card.examCard || card.examCard.length === 0) && (
          <p className="text-[12px] text-neutral-400">No assessment modules configured.</p>
        )}
      </div>
    </div>
  );
}

