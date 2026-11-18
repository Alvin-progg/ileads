"use server";

import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { getTalaRules } from "@/lib/scoring/load.ts";
import { isMonthParam, monthStart } from "@/lib/tala-month";

const PERMISSION_MESSAGE = "You can only encode learners in your assigned grades.";

export type TalaRowValues = {
  wcpm: number | null;
  comprehension_correct: number | null;
  frequency: number | null;
  remarks: string | null;
};

const isWhole = (v: number | null, max: number) =>
  v === null || (Number.isInteger(v) && v >= 0 && v <= max);

/**
 * Writes one learner's TALA row for a month. Idempotent upsert on
 * (learner, month), so autosave retries are safe. The grade, and so the
 * comprehension limit, comes from the database, never from the client.
 */
export async function saveTalaRow(
  learnerId: string,
  month: string,
  values: TalaRowValues
): Promise<{ error: string | null }> {
  if (!isMonthParam(month)) return { error: "Invalid month." };

  const supabase = await createClient();

  const { data: learner } = await supabase
    .from("learners")
    .select("grade_level")
    .eq("id", learnerId)
    .maybeSingle();
  if (!learner) return { error: PERMISSION_MESSAGE };

  let items: number;
  try {
    items = (await getTalaRules(supabase, learner.grade_level)).comprehension.items;
  } catch {
    return { error: "TALA rules for this grade are not configured." };
  }

  if (!isWhole(values.wcpm, 400)) return { error: "WCPM must be a whole number from 0 to 400." };
  if (!isWhole(values.comprehension_correct, items)) {
    return { error: `Comprehension score must be a whole number from 0 to ${items}.` };
  }
  if (!isWhole(values.frequency, 31)) return { error: "Frequency must be a whole number from 0 to 31." };

  const { error } = await supabase.from("tala_results").upsert(
    {
      learner_id: learnerId,
      month: monthStart(month),
      ...values,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "learner_id,month" }
  );

  return {
    error: error ? friendlyError(error, { permissionMessage: PERMISSION_MESSAGE }) : null,
  };
}
