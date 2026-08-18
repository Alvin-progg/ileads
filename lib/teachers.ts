import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Names of the teachers assigned to a grade, for the header of a printed form.
 *
 * RLS decides how much of this a caller sees: the head reads every assignment
 * and profile, while a teacher reads only their own row. A teacher printing
 * their own class therefore gets their own name, and the caller should fall
 * back to the viewer's name if this comes back empty.
 *
 * A grade can have more than one teacher in a multigrade school, so this
 * returns a list rather than a single name.
 */
export async function getGradeTeacherNames(
  supabase: SupabaseClient,
  gradeLevel: number
): Promise<string[]> {
  const { data } = await supabase
    .from("teacher_assignments")
    .select("profiles (full_name, active)")
    .eq("grade_level", gradeLevel);

  return (data ?? [])
    .flatMap((row) => {
      // PostgREST types the embed as an object or array depending on the
      // relationship it infers; tolerate both.
      const profile = row.profiles as
        | { full_name: string; active: boolean }
        | { full_name: string; active: boolean }[]
        | null;
      if (!profile) return [];
      return Array.isArray(profile) ? profile : [profile];
    })
    .filter((p) => p.active)
    .map((p) => p.full_name)
    .sort((a, b) => a.localeCompare(b));
}
