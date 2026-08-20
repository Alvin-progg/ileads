// Scoped dashboard data builder, shared by the school head's dashboard
// (app/(authenticated)/admin/page.tsx, scope = every grade) and a teacher's
// personal dashboard (app/(authenticated)/my-class/page.tsx, scope =
// viewer.allowedGrades). Everything here was originally inline in the admin
// page; the only real change from that version is that every "which grades"
// loop now filters against `scope` instead of assuming GRADE_LEVELS.
//
// RLS already scopes learners/crla_results/rma_results/philiri_results/
// exam_results to a teacher's own grades (see teacher_grades() in
// supabase/migrations/20260818093050_rls_policies.sql) — those queries stay
// unfiltered by grade here, same as they were in the admin page. RLS does
// NOT scope learning_areas/assessment_rounds/scoring_rules the same way
// (any signed-in user can read every grade's rows there), so those are
// explicitly filtered/looped against `scope`.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGradeTeacherNames } from "@/lib/teachers";
import { CRLA_GRADES, EXAM_GRADES, PHILIRI_GRADES, RMA_GRADES } from "@/lib/grades";
import {
  getCrlaRules,
  getPhiliriRules,
  getRmaRules,
  tryGetRules,
} from "@/lib/scoring/load.ts";
import { orderLanguages } from "@/lib/languages";
import { summarise, type ClassSummary } from "@/lib/scoring/class-summary.ts";
import { summariseRma, type RmaSummary } from "@/lib/scoring/rma-summary.ts";
import {
  summarisePhiliri,
  LEVELS as PHILIRI_LEVELS,
  type PhiliriSummary,
} from "@/lib/scoring/philiri-summary.ts";
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
} from "./current-status.ts";
import type { TrackerTableData } from "@/app/(authenticated)/encoding-progress-chart.tsx";
import type { LevelGroup } from "@/app/(authenticated)/admin/grouped-level-chart.tsx";

type Round = { id: number; name: string; sequence: number };
type Learner = {
  id: string;
  lrn: string;
  last_name: string;
  first_name: string;
  sex: "M" | "F";
  grade_level: number;
};

export type AtRiskRow = {
  learnerId: string;
  name: string;
  grade: number;
  instrument: string;
  language: string | null;
  level: string;
};

export type StatusCounts = { enrolled: number; transferred: number; dropped: number };

/** For a quick-encode link: which round to send the teacher to, and how far
 * along it is (distinct learners with a record there, out of the grade's
 * enrollment) — enough to render "Continue CRLA encoding: 12/15 encoded". */
export type CurrentRound = { id: number; encoded: number };

export type GradeCardData = {
  grade: number;
  enrolled: number;
  teachers: string[];
  statusCounts: StatusCounts;
  crlaCard: { language: string; summary: ClassSummary; worstLabel: string }[] | null;
  crlaCurrentRound: CurrentRound | null;
  rmaCard: { summary: RmaSummary; configured: boolean; worstLabel: string | null } | null;
  rmaCurrentRound: CurrentRound | null;
  philiriCard: { language: string; summary: PhiliriSummary }[] | null;
  philiriCurrentRound: CurrentRound | null;
  examCard: { subject: string; roundName: string | null; mps: number | null }[] | null;
  examCurrentRound: CurrentRound | null;
};

export type DashboardData = {
  totalEnrolled: number;
  gradeCards: GradeCardData[];
  atRisk: AtRiskRow[];
  trackerCellCounts: { complete: number; incomplete: number };
  crlaCharts: { language: string; levels: string[]; groups: LevelGroup[] }[];
  rmaLevels: string[];
  rmaGroups: LevelGroup[];
  philiriCharts: { language: string; roundName: string; levels: string[]; groups: LevelGroup[] }[];
  examCharts: { grade: number; subjects: { subject: string; mps: number | null }[] }[];
  crlaTracker: TrackerTableData;
  rmaTracker: TrackerTableData;
  philiriTracker: TrackerTableData;
  examTracker: TrackerTableData;
};

/** Highest-sequence round with any encoded row for this grade (across
 * languages, if any); falls back to the earliest round if nothing has been
 * touched yet. A heuristic, not a real "current term" — there's no such flag
 * in the schema — but a reasonable "continue where you left off" default for
 * a quick-encode link. Also returns how many distinct learners already have
 * a record there, for a "12/15 encoded" style label. */
function pickCurrentRound<T extends { round_id: number; learner_id: string }>(
  rows: T[],
  rounds: Round[]
): CurrentRound | null {
  if (rounds.length === 0) return null;
  const byRound = encodedLearnerIdsByKey(
    rows,
    (r) => String(r.round_id),
    (r) => r.learner_id
  );
  const withData = [...rounds]
    .sort((a, b) => b.sequence - a.sequence)
    .find((r) => (byRound.get(String(r.id))?.size ?? 0) > 0);
  const round = withData ?? [...rounds].sort((a, b) => a.sequence - b.sequence)[0];
  if (!round) return null;
  return { id: round.id, encoded: byRound.get(String(round.id))?.size ?? 0 };
}

export async function buildDashboard(
  supabase: SupabaseClient,
  scope: number[]
): Promise<DashboardData> {
  const crlaGrades = CRLA_GRADES.filter((g) => scope.includes(g));
  const rmaGrades = RMA_GRADES.filter((g) => scope.includes(g));
  const philiriGrades = PHILIRI_GRADES.filter((g) => scope.includes(g));
  const examGrades = EXAM_GRADES.filter((g) => scope.includes(g));

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

  // Every status, not just "enrolled" — for the learner-count-by-status stat.
  const { data: statusData } = await supabase.from("learners").select("grade_level, status");
  const statusCountsByGrade = new Map<number, StatusCounts>();
  for (const row of (statusData ?? []) as { grade_level: number; status: string }[]) {
    if (!scope.includes(row.grade_level)) continue;
    const counts =
      statusCountsByGrade.get(row.grade_level) ??
      ({ enrolled: 0, transferred: 0, dropped: 0 } satisfies StatusCounts);
    if (row.status === "enrolled") counts.enrolled += 1;
    else if (row.status === "transferred") counts.transferred += 1;
    else if (row.status === "dropped") counts.dropped += 1;
    statusCountsByGrade.set(row.grade_level, counts);
  }

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
    .in("grade_level", scope)
    .order("sequence");
  const learningAreas = learningAreasData ?? [];

  const crlaRulesByGrade = new Map<number, CrlaRules | null>();
  const rmaRulesByGrade = new Map<number, RmaRules | null>();
  const philiriRulesByGrade = new Map<number, PhiliriRules | null>();
  const teacherNamesByGrade = new Map<number, string[]>();

  await Promise.all([
    ...crlaGrades.map(async (g) => {
      crlaRulesByGrade.set(g, await tryGetRules(() => getCrlaRules(supabase, g)));
    }),
    ...rmaGrades.map(async (g) => {
      rmaRulesByGrade.set(g, await tryGetRules(() => getRmaRules(supabase, g)));
    }),
    ...philiriGrades.map(async (g) => {
      philiriRulesByGrade.set(g, await tryGetRules(() => getPhiliriRules(supabase, g)));
    }),
    ...scope.map(async (g) => {
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

  const gradeCards: GradeCardData[] = scope.map((grade) => {
    const gradeLearners = learnersByGrade.get(grade) ?? [];
    const enrolled = gradeLearners.length;

    // --- CRLA ---
    let crlaCard: { language: string; summary: ClassSummary; worstLabel: string }[] | null = null;
    let crlaCurrentRound: CurrentRound | null = null;

    if (crlaGrades.includes(grade)) {
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
        crlaCurrentRound = pickCurrentRound(crlaRowsByGrade.get(grade) ?? [], crlaRounds);
      }
    }

    // --- RMA ---
    let rmaCard: { summary: RmaSummary; configured: boolean; worstLabel: string | null } | null =
      null;
    let rmaCurrentRound: CurrentRound | null = null;

    if (rmaGrades.includes(grade)) {
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
        rmaCurrentRound = pickCurrentRound(
          (rmaRowsByGrade.get(grade) ?? []).filter(hasAnyRmaScore),
          rmaRounds
        );
      }
    }

    // --- Phil-IRI ---
    let philiriCard: { language: string; summary: PhiliriSummary }[] | null = null;
    let philiriCurrentRound: CurrentRound | null = null;

    if (philiriGrades.includes(grade)) {
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
        philiriCurrentRound = pickCurrentRound(
          philiriRowsByGrade.get(grade) ?? [],
          philiriRounds
        );
      }
    }

    // --- Exam ---
    let examCard: { subject: string; roundName: string | null; mps: number | null }[] | null =
      null;
    let examCurrentRound: CurrentRound | null = null;

    if (examGrades.includes(grade)) {
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
      examCurrentRound = pickCurrentRound(gradeExamRows, examRounds);
    }

    return {
      grade,
      enrolled,
      teachers: teacherNamesByGrade.get(grade) ?? [],
      statusCounts:
        statusCountsByGrade.get(grade) ?? { enrolled: 0, transferred: 0, dropped: 0 },
      crlaCard,
      crlaCurrentRound,
      rmaCard,
      rmaCurrentRound,
      philiriCard,
      philiriCurrentRound,
      examCard,
      examCurrentRound,
    };
  });

  // ---------------------------------------------------------------------
  // Score distribution charts — a rendering layer on gradeCards, no new
  // Supabase queries. "not-applicable" = the language/round doesn't apply
  // to this grade; "not-configured" = the grade has no level bands yet
  // (e.g. RMA G1/G2); "not-enough-data" = configured, but nobody assessed.
  // ---------------------------------------------------------------------

  const crlaLanguages = orderLanguages(
    Array.from(
      new Set(crlaGrades.flatMap((g) => Object.keys(crlaRulesByGrade.get(g)?.languages ?? {})))
    )
  );
  const crlaCharts = crlaLanguages.map((language) => {
    const levels =
      crlaGrades.map((g) => crlaRulesByGrade.get(g)).find((rules) => rules?.languages[language])
        ?.languages[language].part1.levels.map((l) => l.label) ?? [];
    const groups: LevelGroup[] = crlaGrades.map((grade) => {
      const entry = gradeCards
        .find((c) => c.grade === grade)
        ?.crlaCard?.find((x) => x.language === language);
      if (!entry) {
        return { key: `g${grade}`, label: `Grade ${grade}`, status: "not-applicable", assessed: 0, bars: null };
      }
      if (entry.summary.assessed === 0) {
        return { key: `g${grade}`, label: `Grade ${grade}`, status: "not-enough-data", assessed: 0, bars: null };
      }
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
  const rmaGroups: LevelGroup[] = rmaGrades.map((grade) => {
    const card = gradeCards.find((c) => c.grade === grade)?.rmaCard;
    if (!card) return { key: `g${grade}`, label: `Grade ${grade}`, status: "not-applicable", assessed: 0, bars: null };
    if (!card.configured) {
      return { key: `g${grade}`, label: `Grade ${grade}`, status: "not-configured", assessed: card.summary.assessed, bars: null };
    }
    if (card.summary.assessed === 0) {
      return { key: `g${grade}`, label: `Grade ${grade}`, status: "not-enough-data", assessed: 0, bars: null };
    }
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
      new Set(
        philiriGrades.flatMap((g) => Object.keys(philiriRulesByGrade.get(g)?.languages ?? {}))
      )
    )
  );
  const philiriCharts = philiriLanguages.flatMap((language) =>
    philiriRounds.map((round) => {
      const groups: LevelGroup[] = philiriGrades.map((grade) => {
        const rules = philiriRulesByGrade.get(grade);
        const langRules = rules?.languages[language];
        if (!langRules) {
          return { key: `g${grade}`, label: `Grade ${grade}`, status: "not-applicable", assessed: 0, bars: null };
        }
        const entries = philiriEntriesForRound(
          learnersByGrade.get(grade) ?? [],
          philiriRowsByGrade.get(grade) ?? [],
          round.id,
          langRules,
          language
        );
        const summary = summarisePhiliri(entries);
        if (summary.assessed === 0) {
          return { key: `g${grade}`, label: `Grade ${grade}`, status: "not-enough-data", assessed: 0, bars: null };
        }
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

  const examCharts = examGrades.map((grade) => ({
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
    rows: crlaGrades.flatMap((grade) => {
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
    rows: rmaGrades.map((grade) => {
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
    rows: philiriGrades.flatMap((grade) => {
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
    rows: examGrades.map((grade) => {
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

  return {
    totalEnrolled: learners.length,
    gradeCards,
    atRisk,
    trackerCellCounts,
    crlaCharts,
    rmaLevels,
    rmaGroups,
    philiriCharts,
    examCharts,
    crlaTracker,
    rmaTracker,
    philiriTracker,
    examTracker,
  };
}
