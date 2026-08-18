import { createClient } from "@/lib/supabase/server";
import { TeacherGradeRow } from "./teacher-grade-row";

export const metadata = { title: "Teacher Assignments — I-LEADS" };

export default async function TeachersPage() {
  const supabase = await createClient();

  const [{ data: teachers }, { data: assignments }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "teacher")
      .order("full_name"),
    supabase.from("teacher_assignments").select("teacher_id, grade_level"),
  ]);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">Teacher Assignments</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Toggle the grade levels each teacher handles, then Save.
      </p>
      <div>
        {teachers?.map((t) => (
          <TeacherGradeRow
            key={t.id}
            teacherId={t.id}
            fullName={t.full_name}
            initialGrades={
              assignments
                ?.filter((a) => a.teacher_id === t.id)
                .map((a) => a.grade_level) ?? []
            }
          />
        ))}
      </div>
    </main>
  );
}
