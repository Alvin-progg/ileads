import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { TALA_GRADES, gradeScopeLabel } from "@/lib/grades";
import { getTalaRules, tryGetRules } from "@/lib/scoring/load.ts";
import { currentMonth, isMonthParam, monthLabel } from "@/lib/tala-month";
import { loadTalaClass } from "@/lib/tala-class";
import { TalaGrid } from "./tala-grid.tsx";

export const metadata = { title: "TALA — I-LEADS" };

export default async function TalaPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; month?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const viewer = await getViewer();

  const available = TALA_GRADES.filter(
    (g) => viewer.isHead || viewer.allowedGrades.includes(g)
  );

  if (available.length === 0) {
    return (
      <Shell title="TALA">
        <p className="text-neutral-600">
          You are not assigned to any grade with a TALA tracker (Grades 1–6).
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Your grade levels: {gradeScopeLabel(viewer.allowedGrades)}. Ask the
          school head if this looks wrong.
        </p>
      </Shell>
    );
  }

  const grade = available.includes(Number(params.grade))
    ? Number(params.grade)
    : available[0];
  const month = isMonthParam(params.month) ? params.month : currentMonth();

  const rules = await tryGetRules(() => getTalaRules(supabase, grade));
  if (!rules) {
    return (
      <Shell title={`TALA · Grade ${grade}`}>
        <p className="text-neutral-600">
          TALA scoring rules for Grade {grade} are not configured in this
          database yet.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Run the pending migrations in{" "}
          <code className="font-mono">supabase/migrations</code> to seed them.
        </p>
      </Shell>
    );
  }

  const { learners, values, prevProfiles } = await loadTalaClass(
    supabase,
    grade,
    month,
    rules
  );

  return (
    <Shell title={`TALA · Grade ${grade} · ${monthLabel(month)}`}>
      {learners.length === 0 ? (
        <p className="text-neutral-500">
          No enrolled Grade {grade} learners yet.{" "}
          <Link href="/learners" className="text-emerald-700 hover:underline">
            Add learners
          </Link>{" "}
          to start encoding.
        </p>
      ) : (
        // Keyed on the selection: the grid seeds its rows once per mount.
        <TalaGrid
          key={`${grade}:${month}`}
          learners={learners}
          rules={rules}
          month={month}
          grades={available}
          grade={grade}
          initialValues={values}
          prevProfiles={prevProfiles}
        />
      )}
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-neutral-500">
          Class Reading Intervention Tracker. Encode WCPM, Comprehension Score
          and Frequency; the Reading Profile, Program and Status are computed.
        </p>
      </header>
      {children}
    </main>
  );
}
