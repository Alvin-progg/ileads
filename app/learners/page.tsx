import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { LearnerTable } from "./learner-table";

export const metadata = { title: "Learners — I-LEADS" };

export default async function LearnersPage() {
  const supabase = await createClient();
  const viewer = await getViewer();

  const { data: learners } = await supabase
    .from("learners")
    .select("id, lrn, last_name, first_name, middle_name, sex, grade_level, status")
    .order("last_name");

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Learners</h1>
          <p className="text-sm text-neutral-500">
            {viewer.isHead
              ? "All grade levels"
              : `Grade${viewer.allowedGrades.length > 1 ? "s" : ""} ${viewer.allowedGrades
                  .map((g) => (g === 0 ? "K" : g))
                  .join(", ")}`}
          </p>
        </div>
        <Link
          href="/learners/new"
          className="rounded-[10px] bg-emerald-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-emerald-700"
        >
          Add learner
        </Link>
      </div>
      <LearnerTable learners={learners ?? []} allowedGrades={viewer.allowedGrades} />
    </main>
  );
}
