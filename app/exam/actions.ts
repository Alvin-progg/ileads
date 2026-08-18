"use server";

import { createClient } from "@/lib/supabase/server";

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === "42501") {
    return "You can only encode learners in your assigned grades.";
  }
  return error.message;
}

/**
 * Writes one learner's score for one subject in one quarter.
 *
 * Upserts on the (learner, round, learning_area) key so a retry after a
 * failed or ambiguous save is safe to repeat.
 */
export async function saveExamScore(
  learnerId: string,
  roundId: number,
  learningAreaId: number,
  score: number | null
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.from("exam_results").upsert(
    { learner_id: learnerId, round_id: roundId, learning_area_id: learningAreaId, score },
    { onConflict: "learner_id,round_id,learning_area_id" }
  );

  return { error: error ? friendlyError(error) : null };
}

/**
 * Sets a subject's HPS for one quarter via the set_learning_area_hps RPC,
 * which merges the value into hps_per_quarter atomically and checks grade
 * authorization server-side — a second enforcement point beside RLS.
 */
export async function saveExamHps(
  learningAreaId: number,
  quarterName: string,
  hps: number
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_learning_area_hps", {
    p_learning_area_id: learningAreaId,
    p_quarter: quarterName,
    p_hps: hps,
  });

  return { error: error ? friendlyError(error) : null };
}

/** Writes the Least Mastered Skills note for one subject in one quarter. */
export async function saveExamNotes(
  learningAreaId: number,
  roundId: number,
  leastMasteredSkills: string | null
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.from("exam_notes").upsert(
    {
      learning_area_id: learningAreaId,
      round_id: roundId,
      least_mastered_skills: leastMasteredSkills,
    },
    { onConflict: "learning_area_id,round_id" }
  );

  return { error: error ? friendlyError(error) : null };
}
