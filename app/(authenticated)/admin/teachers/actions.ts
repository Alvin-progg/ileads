"use server";

import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

export async function saveTeacherGrades(teacherId: string, grades: number[]) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_teacher_grades", {
    p_teacher: teacherId,
    p_grades: grades,
  });

  return { error: error ? friendlyError(error) : null };
}
