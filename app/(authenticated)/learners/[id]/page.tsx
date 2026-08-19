import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { LearnerForm } from "../learner-form";

export const metadata = { title: "Edit Learner — I-LEADS" };

export default async function EditLearnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const viewer = await getViewer();

  const { data: learner } = await supabase
    .from("learners")
    .select(
      "id, lrn, last_name, first_name, middle_name, ext_name, sex, birthdate, grade_level, status"
    )
    .eq("id", id)
    .single();

  if (!learner) notFound();

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-6 text-2xl font-bold">
        Edit {learner.first_name} {learner.last_name}
      </h1>
      <LearnerForm
        mode="edit"
        learnerId={learner.id}
        allowedGrades={
          viewer.allowedGrades.includes(learner.grade_level)
            ? viewer.allowedGrades
            : [...viewer.allowedGrades, learner.grade_level].sort((a, b) => a - b)
        }
        initial={{
          lrn: learner.lrn,
          last_name: learner.last_name,
          first_name: learner.first_name,
          middle_name: learner.middle_name ?? "",
          ext_name: learner.ext_name ?? "",
          sex: learner.sex,
          birthdate: learner.birthdate ?? "",
          grade_level: learner.grade_level,
          status: learner.status,
        }}
      />
    </main>
  );
}
