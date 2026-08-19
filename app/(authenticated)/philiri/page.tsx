import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { gradeLabel } from "@/lib/grades";
import { getPhiliriRules, tryGetRules } from "@/lib/scoring/load.ts";
import { LANGUAGE_NAMES, orderLanguages } from "@/lib/languages";
import { PhiliriGrid, type Learner } from "./philiri-grid.tsx";
import type { PhiliriRowValues } from "./actions.ts";

export const metadata = { title: "Phil-IRI — I-LEADS" };

/** Grades with a Phil-IRI Oral Reading instrument. */
const PHILIRI_GRADES = [4, 5, 6];

export default async function PhiliriPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; language?: string; round?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const viewer = await getViewer();

  const available = PHILIRI_GRADES.filter(
    (g) => viewer.isHead || viewer.allowedGrades.includes(g)
  );

  if (available.length === 0) {
    return (
      <Shell grade={null} language={null}>
        <p className="text-neutral-600">
          You are not assigned to any grade with a Phil-IRI assessment (Grades
          4–6), so there are no rows for you to encode here.
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

  const rules = await tryGetRules(() => getPhiliriRules(supabase, grade));

  if (!rules) {
    return (
      <Shell grade={grade} language={null}>
        <p className="text-neutral-600">
          Phil-IRI scoring rules for Grade {grade} have not been loaded into
          this database yet, so there is nothing to encode against.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          They live in <code className="font-mono">scoring_rules</code>; run
          the pending migration in{" "}
          <code className="font-mono">supabase/migrations</code> to seed them.
        </p>
      </Shell>
    );
  }

  const languages = orderLanguages(Object.keys(rules.languages));
  const language = languages.includes(params.language ?? "")
    ? params.language!
    : languages[0];

  const { data: rounds } = await supabase
    .from("assessment_rounds")
    .select("id, name, sequence")
    .eq("tool", "philiri")
    .order("sequence");

  if (!rounds || rounds.length === 0) {
    return (
      <Shell grade={grade} language={language}>
        <p className="text-neutral-500">No Phil-IRI rounds have been set up yet.</p>
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
    .from("philiri_results")
    .select(
      "learner_id, screening_score, passage_level, word_count, miscues, comprehension_items, comprehension_correct, set_used, remarks"
    )
    .eq("round_id", activeRound.id)
    .eq("language", language);

  const initialValues: Record<string, PhiliriRowValues> = Object.fromEntries(
    (existing ?? []).map(({ learner_id, ...values }) => [learner_id, values])
  );

  return (
    <Shell grade={grade} language={language}>
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
        // switch has to remount it or it would keep showing the previous
        // selection's typed values.
        <PhiliriGrid
          key={`${grade}:${language}:${activeRound.id}`}
          learners={learners as Learner[]}
          rules={rules}
          language={language}
          roundId={activeRound.id}
          roundName={activeRound.name}
          initialValues={initialValues}
          nav={{
            grades: available,
            languages,
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
  language,
  children,
}: {
  grade: number | null;
  language: string | null;
  children: React.ReactNode;
}) {
  return (
    <main className="p-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold">
          Phil-IRI
          {grade === null ? "" : ` · Grade ${grade}`}
          {language === null ? "" : ` · ${LANGUAGE_NAMES[language] ?? language}`}
        </h1>
        <p className="text-sm text-neutral-500">
          Oral Reading Profile. Encode the raw scores; Word Reading Score,
          Comprehension Score and their levels are computed.
        </p>
      </header>
      {children}
    </main>
  );
}
