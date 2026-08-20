"use server";

import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

const PERMISSION_MESSAGE = "You can only encode learners in your assigned grades.";

export type PhiliriRowValues = {
  screening_score: number | null;
  passage_level: number | null;
  word_count: number | null;
  miscues: number | null;
  comprehension_items: number | null;
  comprehension_correct: number | null;
  set_used: string | null;
  remarks: string | null;
};

/**
 * Writes one learner's Phil-IRI row for a round and language.
 *
 * Upserts on the (learner, round, language) key so a retry after a failed or
 * ambiguous save is safe to repeat — the client retries automatically, and a
 * duplicate attempt must never create a second row or error out.
 */
export async function savePhiliriRow(
  learnerId: string,
  roundId: number,
  language: string,
  values: PhiliriRowValues
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.from("philiri_results").upsert(
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
