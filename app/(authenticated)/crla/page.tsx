import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { CRLA_GRADES, gradeLabel } from "@/lib/grades";
import { getCrlaRules } from "@/lib/scoring/load.ts";
import { LANGUAGE_NAMES, orderLanguages } from "@/lib/languages";
import { CrlaGrid, type Learner } from "./crla-grid.tsx";
import type { CrlaRowValues } from "./actions.ts";

export const metadata = { title: "CRLA — I-LEADS" };

export default async function CrlaPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; language?: string; round?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const viewer = await getViewer();

  const available = CRLA_GRADES.filter(
    (g) => viewer.isHead || viewer.allowedGrades.includes(g)
  );

  if (available.length === 0) {
    return (
      <Shell grade={null} language={null}>
        <p className="text-neutral-600">
          You are not assigned to any grade with a CRLA assessment (Grades 1–3),
          so there are no rows for you to encode here.
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

  const rules = await getCrlaRules(supabase, grade);
  const languages = orderLanguages(Object.keys(rules.languages));
  const language = languages.includes(params.language ?? "")
    ? params.language!
    : languages[0];

  const { data: rounds } = await supabase
    .from("assessment_rounds")
    .select("id, name, sequence")
    .eq("tool", "crla")
    .order("sequence");

  if (!rounds || rounds.length === 0) {
    return (
      <Shell grade={grade} language={language}>
        <p className="text-neutral-500">No CRLA rounds have been set up yet.</p>
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
    .from("crla_results")
    .select(
      "learner_id, task1, task2l, task2h, story_no, miscues, words_read, reading_secs, comprehension_correct, experience_rating, observation_level, remarks"
    )
    .eq("round_id", activeRound.id)
    .eq("language", language);

  const initialValues: Record<string, CrlaRowValues> = Object.fromEntries(
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
        <CrlaGrid
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
          CRLA{grade === null ? "" : ` · Grade ${grade}`}
        </h1>
        <p className="text-sm text-neutral-500">
          {language === null
            ? "Reading assessment."
            : `${LANGUAGE_NAMES[language] ?? language} reading assessment.`}{" "}
          Levels are computed from the raw scores you enter.
        </p>
      </header>
      {children}
    </main>
  );
}
