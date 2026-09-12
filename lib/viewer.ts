import { createClient } from "@/lib/supabase/server";
import { GRADE_LEVELS } from "@/lib/grades";

export async function getViewer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, has_seen_tour, school_id, schools(id, name, school_id, address)")
    .eq("id", user!.id)
    .single();

  const isHead = profile?.role === "head";
  const school = Array.isArray(profile?.schools) ? profile.schools[0] : profile?.schools;
  let allowedGrades: number[] = [...GRADE_LEVELS];

  if (!isHead) {
    const { data: assignments } = await supabase
      .from("teacher_assignments")
      .select("grade_level")
      .eq("teacher_id", user!.id);
    allowedGrades = (assignments ?? []).map((a) => a.grade_level).sort((a, b) => a - b);
  }

  return {
    id: user!.id,
    fullName: profile?.full_name ?? "",
    role: profile?.role ?? "teacher",
    isHead,
    allowedGrades,
    hasSeenTour: profile?.has_seen_tour ?? false,
    schoolId: profile?.school_id ?? null,
    school: school ?? null,
  };
}
