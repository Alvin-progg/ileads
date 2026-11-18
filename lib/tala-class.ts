import type { SupabaseClient } from "@supabase/supabase-js";
import { computeTala } from "@/lib/scoring/tala.ts";
import type { TalaRules } from "@/lib/scoring/types.ts";
import { monthStart, shiftMonth } from "@/lib/tala-month";

export type TalaValues = {
  wcpm: number | null;
  comprehension_correct: number | null;
  frequency: number | null;
  remarks: string | null;
};

export type TalaLearner = {
  id: string;
  lrn: string;
  last_name: string;
  first_name: string;
  middle_name: string | null;
};

const COLUMNS = "learner_id, wcpm, comprehension_correct, frequency, remarks";

/** Enrolled learners of a grade, this month's rows, and last month's profiles. */
export async function loadTalaClass(
  supabase: SupabaseClient,
  grade: number,
  month: string,
  rules: TalaRules
) {
  const { data: learners } = await supabase
    .from("learners")
    .select("id, lrn, last_name, first_name, middle_name")
    .eq("grade_level", grade)
    .eq("status", "enrolled")
    .order("last_name")
    .order("first_name");

  const ids = (learners ?? []).map((l) => l.id);
  const rowsFor = async (m: string) => {
    if (ids.length === 0) return [];
    const { data } = await supabase
      .from("tala_results")
      .select(COLUMNS)
      .eq("month", monthStart(m))
      .in("learner_id", ids);
    return data ?? [];
  };

  const [current, previous] = await Promise.all([
    rowsFor(month),
    rowsFor(shiftMonth(month, -1)),
  ]);

  const values: Record<string, TalaValues> = Object.fromEntries(
    current.map(({ learner_id, ...v }) => [learner_id, v])
  );
  const prevProfiles: Record<string, string | null> = Object.fromEntries(
    previous.map((r) => [
      r.learner_id,
      computeTala(
        { wcpm: r.wcpm, comprehensionCorrect: r.comprehension_correct },
        rules
      ).profile,
    ])
  );

  return { learners: (learners ?? []) as TalaLearner[], values, prevProfiles };
}
