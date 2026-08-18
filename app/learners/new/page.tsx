import { getViewer } from "@/lib/viewer";
import { LearnerForm } from "../learner-form";

export const metadata = { title: "Add Learner — I-LEADS" };

export default async function NewLearnerPage() {
  const viewer = await getViewer();

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-6 text-xl font-bold">Add learner</h1>
      <LearnerForm mode="create" allowedGrades={viewer.allowedGrades} />
    </main>
  );
}
