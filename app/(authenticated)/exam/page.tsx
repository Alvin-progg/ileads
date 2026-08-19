import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { EXAM_GRADES } from "@/lib/grades";
import { ExamGrid, type Learner, type Subject } from "./exam-grid.tsx";

export const metadata = { title: "Exam Scores — I-LEADS" };

export default async function ExamPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; round?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const viewer = await getViewer();

  const available = EXAM_GRADES.filter(
    (g) => viewer.isHead || viewer.allowedGrades.includes(g)
  );

  if (available.length === 0) {
    return (
      <Shell grade={null}>
        <p className="text-neutral-600">
          You are not assigned to any grade, so there are no exam scores for
          you to encode here.
        </p>
      </Shell>
    );
  }

  const grade = available.includes(Number(params.grade))
    ? Number(params.grade)
    : available[0];

  const { data: rounds } = await supabase
    .from("assessment_rounds")
    .select("id, name, sequence")
    .eq("tool", "exam")
    .order("sequence");

  if (!rounds || rounds.length === 0) {
    return (
      <Shell grade={grade}>
        <p className="text-neutral-500">No exam quarters have been set up yet.</p>
      </Shell>
    );
  }

  const activeRound =
    rounds.find((r) => String(r.id) === params.round) ?? rounds[0];

  const { data: subjectRows } = await supabase
    .from("learning_areas")
    .select("id, name, sequence, hps_per_quarter")
    .eq("grade_level", grade)
    .order("sequence");

  const subjects: Subject[] = (subjectRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    sequence: s.sequence,
    hpsByQuarter: (s.hps_per_quarter ?? {}) as Record<string, number | null>,
  }));

  if (subjects.length === 0) {
    return (
      <Shell grade={grade}>
        <p className="text-neutral-500">
          No learning areas have been set up for Grade {grade} yet.
        </p>
      </Shell>
    );
  }

  const subjectIds = subjects.map((s) => s.id);

  const { data: learners } = await supabase
    .from("learners")
    .select("id, lrn, last_name, first_name, sex")
    .eq("grade_level", grade)
    .eq("status", "enrolled")
    .order("last_name")
    .order("first_name");

  const { data: results } = await supabase
    .from("exam_results")
    .select("learner_id, learning_area_id, score")
    .eq("round_id", activeRound.id)
    .in("learning_area_id", subjectIds);

  const { data: notes } = await supabase
    .from("exam_notes")
    .select("learning_area_id, least_mastered_skills")
    .eq("round_id", activeRound.id)
    .in("learning_area_id", subjectIds);

  const initialScores: Record<string, Record<number, number | null>> = {};
  for (const r of results ?? []) {
    initialScores[r.learner_id] ??= {};
    initialScores[r.learner_id][r.learning_area_id] = r.score;
  }

  const initialNotes: Record<number, string | null> = Object.fromEntries(
    (notes ?? []).map((n) => [n.learning_area_id, n.least_mastered_skills])
  );

  return (
    <Shell grade={grade}>
      {!learners || learners.length === 0 ? (
        <p className="text-neutral-500">
          No enrolled Grade {grade} learners yet.{" "}
          <Link href="/learners" className="text-emerald-700 hover:underline">
            Add learners
          </Link>{" "}
          to start encoding.
        </p>
      ) : (
        // Keyed on the selection: the grid seeds its rows once per mount, so a
        // switch has to remount it — which is also what keeps one grade's
        // subject columns, or one quarter's scores, from surviving into the
        // next selection.
        <ExamGrid
          key={`${grade}:${activeRound.id}`}
          learners={learners as Learner[]}
          subjects={subjects}
          roundId={activeRound.id}
          roundName={activeRound.name}
          initialScores={initialScores}
          initialNotes={initialNotes}
          nav={{
            grades: available,
            quarters: rounds.map((r) => ({ id: r.id, name: r.name, sequence: r.sequence })),
            grade,
          }}
        />
      )}
    </Shell>
  );
}

function Shell({
  grade,
  children,
}: {
  grade: number | null;
  children: React.ReactNode;
}) {
  return (
    <main className="p-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold">
          Exam Scores{grade === null ? "" : ` · Grade ${grade}`}
        </h1>
        <p className="text-sm text-neutral-500">
          Encode each subject&apos;s raw score for the quarter; Mean, SD and MPS
          are computed as you go.
        </p>
      </header>
      {children}
    </main>
  );
}
