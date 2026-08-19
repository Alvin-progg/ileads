import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { RMA_GRADES, gradeLabel } from "@/lib/grades";
import { getRmaRules, tryGetRules } from "@/lib/scoring/load.ts";
import { RmaGrid, type Learner } from "./rma-grid.tsx";
import type { RmaRowValues } from "./actions.ts";

export const metadata = { title: "RMA — I-LEADS" };

export default async function RmaPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; round?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const viewer = await getViewer();

  const available = RMA_GRADES.filter(
    (g) => viewer.isHead || viewer.allowedGrades.includes(g)
  );

  if (available.length === 0) {
    return (
      <Shell grade={null}>
        <p className="text-neutral-600">
          RMA has only been set up for Grades 1–3 so far, and you are not
          assigned to any of them.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Your grade levels:{" "}
          {viewer.allowedGrades.map((g) => gradeLabel(g)).join(", ") || "none"}.
          Ask the school head if this looks wrong.
        </p>
      </Shell>
    );
  }

  const grade = available.includes(Number(params.grade))
    ? Number(params.grade)
    : available[0];

  const rules = await tryGetRules(() => getRmaRules(supabase, grade));

  if (!rules) {
    return (
      <Shell grade={grade}>
        <p className="text-neutral-600">
          RMA scoring rules for Grade {grade} have not been loaded into this
          database yet, so there is nothing to encode against.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          They live in <code className="font-mono">scoring_rules</code>; run the
          pending migration in{" "}
          <code className="font-mono">supabase/migrations</code> to seed them.
        </p>
      </Shell>
    );
  }

  const { data: rounds } = await supabase
    .from("assessment_rounds")
    .select("id, name, sequence")
    .eq("tool", "rma")
    .order("sequence");

  if (!rounds || rounds.length === 0) {
    return (
      <Shell grade={grade}>
        <p className="text-neutral-500">No RMA rounds have been set up yet.</p>
      </Shell>
    );
  }

  const activeRound =
    rounds.find((r) => String(r.id) === params.round) ?? rounds[0];

  const { data: learners } = await supabase
    .from("learners")
    .select("id, lrn, last_name, first_name")
    .eq("grade_level", grade)
    .eq("status", "enrolled")
    .order("last_name")
    .order("first_name");

  const { data: existing } = await supabase
    .from("rma_results")
    .select("learner_id, task_scores, remarks")
    .eq("round_id", activeRound.id);

  const initialValues: Record<string, RmaRowValues> = Object.fromEntries(
    (existing ?? []).map(({ learner_id, ...values }) => [learner_id, values])
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
        // switch has to remount it — which is also what keeps one grade's task
        // columns from surviving into another grade's grid.
        <RmaGrid
          key={`${grade}:${activeRound.id}`}
          learners={learners as Learner[]}
          rules={rules}
          roundId={activeRound.id}
          roundName={activeRound.name}
          initialValues={initialValues}
          nav={{
            grades: available,
            rounds: rounds.map((r) => ({ id: r.id, name: r.name })),
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
          RMA{grade === null ? "" : ` · Grade ${grade}`}
        </h1>
        <p className="text-sm text-neutral-500">
          Rapid Mathematics Assessment. Encode the raw score for each task; the
          total, percentage and proficiency level are computed.
        </p>
      </header>
      {children}
    </main>
  );
}
