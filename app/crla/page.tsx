import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { getCrlaRules } from "@/lib/scoring/load.ts";
import { CrlaGrid, type Learner } from "./crla-grid.tsx";
import type { CrlaRowValues } from "./actions.ts";

export const metadata = { title: "CRLA Grade 1 — I-LEADS" };

// Grade 1 is assessed in the mother tongue only.
const GRADE = 1;
const LANGUAGE = "MT";

export default async function CrlaPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string }>;
}) {
  const { round } = await searchParams;
  const supabase = await createClient();
  const viewer = await getViewer();

  const { data: rounds } = await supabase
    .from("assessment_rounds")
    .select("id, name, sequence")
    .eq("tool", "crla")
    .order("sequence");

  if (!rounds || rounds.length === 0) {
    return (
      <Shell>
        <p className="text-neutral-500">
          No CRLA rounds have been set up yet.
        </p>
      </Shell>
    );
  }

  const activeRound =
    rounds.find((r) => String(r.id) === round) ?? rounds[0];

  if (!viewer.isHead && !viewer.allowedGrades.includes(GRADE)) {
    return (
      <Shell>
        <p className="text-neutral-600">
          You are not assigned to Grade 1, so there are no CRLA rows for you to
          encode here.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Your grade levels:{" "}
          {viewer.allowedGrades.map((g) => (g === 0 ? "K" : g)).join(", ") ||
            "none"}
          . Ask the school head if this looks wrong.
        </p>
      </Shell>
    );
  }

  const { data: learners } = await supabase
    .from("learners")
    .select("id, lrn, last_name, first_name")
    .eq("grade_level", GRADE)
    .eq("status", "enrolled")
    .order("last_name")
    .order("first_name");

  const { data: existing } = await supabase
    .from("crla_results")
    .select(
      "learner_id, task1, task2l, task2h, story_no, miscues, words_read, reading_secs, comprehension_correct, experience_rating, observation_level, remarks"
    )
    .eq("round_id", activeRound.id)
    .eq("language", LANGUAGE);

  const initialValues: Record<string, CrlaRowValues> = Object.fromEntries(
    (existing ?? []).map(({ learner_id, ...values }) => [learner_id, values])
  );

  const rules = await getCrlaRules(supabase, GRADE);

  return (
    <Shell>
      <nav className="mb-5 flex gap-1" aria-label="Assessment round">
        {rounds.map((r) => {
          const active = r.id === activeRound.id;
          return (
            <Link
              key={r.id}
              href={`/crla?round=${r.id}`}
              aria-current={active ? "page" : undefined}
              className={
                "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors " +
                (active
                  ? "bg-emerald-600 text-white"
                  : "text-neutral-600 hover:bg-neutral-100")
              }
            >
              {r.name}
            </Link>
          );
        })}
      </nav>

      {!learners || learners.length === 0 ? (
        <p className="text-neutral-500">
          No enrolled Grade 1 learners yet.{" "}
          <Link href="/learners" className="text-emerald-700 hover:underline">
            Add learners
          </Link>{" "}
          to start encoding.
        </p>
      ) : (
        <CrlaGrid
          learners={learners as Learner[]}
          rules={rules}
          language={LANGUAGE}
          roundId={activeRound.id}
          roundName={activeRound.name}
          initialValues={initialValues}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="p-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold">CRLA · Grade 1</h1>
        <p className="text-sm text-neutral-500">
          Mother tongue reading assessment. Levels are computed from the raw
          scores you enter.
        </p>
      </header>
      {children}
    </main>
  );
}
