"use server";

import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

const PERMISSION_MESSAGE = "You can only encode learners in your assigned grades.";

export type RmaRowValues = {
  /** Raw score per task key. Null means not encoded yet, not zero. */
  task_scores: Record<string, number | null>;
  remarks: string | null;
};

/**
 * Writes one learner's RMA row for a round.
 *
 * Upserts on the (learner, round) key so a retry after a failed or ambiguous
 * save is safe to repeat — the client retries automatically, and a duplicate
 * attempt must never create a second row or error out.
 */
export async function saveRmaRow(
  learnerId: string,
  roundId: number,
  values: RmaRowValues
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.from("rma_results").upsert(
    {
      learner_id: learnerId,
      round_id: roundId,
      ...values,
    },
    { onConflict: "learner_id,round_id" }
  );

  return {
    error: error ? friendlyError(error, { permissionMessage: PERMISSION_MESSAGE }) : null,
  };
}
