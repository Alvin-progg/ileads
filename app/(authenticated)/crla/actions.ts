"use server";

import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

const PERMISSION_MESSAGE = "You can only encode learners in your assigned grades.";

export type CrlaRowValues = {
  task1: number | null;
  task2l: number | null;
  task2h: number | null;
  story_no: number | null;
  miscues: number | null;
  words_read: number | null;
  reading_secs: number | null;
  comprehension_correct: number | null;
  experience_rating: number | null;
  observation_level: string | null;
  remarks: string | null;
};

/**
 * Writes one learner's row for a round.
 *
 * Upserts on the (learner, round, language) key so a retry after a failed or
 * ambiguous save is safe to repeat — the client retries automatically, and a
 * duplicate attempt must never create a second row or error out.
 */
export async function saveCrlaRow(
  learnerId: string,
  roundId: number,
  language: string,
  values: CrlaRowValues
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.from("crla_results").upsert(
    {
      learner_id: learnerId,
      round_id: roundId,
      language,
      ...values,
    },
    { onConflict: "learner_id,round_id,language" }
  );

  return {
    error: error ? friendlyError(error, { permissionMessage: PERMISSION_MESSAGE }) : null,
  };
}
