import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Reports & Exports — I-LEADS" };

type Round = { id: number; name: string };

const TOOLS = [
  {
    tool: "crla",
    label: "CRLA School Summary",
    description:
      "Reading Level and Reading Profile counts by grade, language and sex.",
    route: "crla",
  },
  {
    tool: "rma",
    label: "RMA School Summary",
    description:
      "Proficiency Level counts by grade and sex, Grades 1–3. Per-task mastery is not tracked for Grades 1–2 (no stated task maximums) — those columns show 0 in the file, not a real zero score.",
    route: "rma",
  },
  {
    tool: "exam",
    label: "MPS Workbook",
    description:
      "Mean, SD and MPS per subject per grade per quarter, plus the Least Mastered Skills teachers recorded.",
    route: "mps",
  },
  {
    tool: "philiri",
    label: "Phil-IRI School Summary",
    description:
      "Overall Level counts by grade and sex, Grades 4–6, split Pre/Post. Best-effort: the district template has no explicit language column and a Non-Reader bucket the app doesn't compute — treat this export as a starting point, not a verified match.",
    route: "philiri",
  },
] as const;

export default async function ReportsPage() {
  const viewer = await getViewer();
  if (!viewer.isHead) redirect("/my-class");

  const supabase = await createClient();

  const roundsByTool = new Map<string, Round[]>();
  for (const t of TOOLS) {
    const { data } = await supabase
      .from("assessment_rounds")
      .select("id, name, sequence")
      .eq("tool", t.tool)
      .order("sequence");
    roundsByTool.set(t.tool, data ?? []);
  }

  return (
    <main className="mx-auto max-w-[800px] p-6">
      <h1 className="text-xl font-bold">Reports & Exports</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Download the district submission workbook for one round, filled in
        from the same numbers on the dashboard.
      </p>

      <div className="mt-6 grid gap-4">
        {TOOLS.map((t) => {
          const rounds = roundsByTool.get(t.tool) ?? [];
          return (
            <section
              key={t.tool}
              className="rounded-xl border border-neutral-200 p-4"
            >
              <h2 className="text-[15px] font-semibold">{t.label}</h2>
              <p className="mt-1 text-[13px] text-neutral-500">{t.description}</p>

              {rounds.length === 0 ? (
                <p className="mt-3 text-[13px] text-neutral-400">
                  No rounds have been set up for this tool yet.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {rounds.map((r) => (
                    <a
                      key={r.id}
                      href={`/reports/${t.route}/${r.id}`}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-emerald-700"
                    >
                      Download {r.name}
                    </a>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
