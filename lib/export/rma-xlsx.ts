import type { SupabaseClient } from "@supabase/supabase-js";
import { RMA_GRADES } from "@/lib/grades";
import { SCHOOL } from "@/lib/school";
import { getRmaRules } from "@/lib/scoring/load.ts";
import { computeRma } from "@/lib/scoring/rma.ts";
import { forceRecalcOnOpen, loadTemplate, toBlob } from "./xlsx-template";

const TEMPLATE_FILE = "RMA_KeyStage1_blank.xlsx";
const SHEET_NAME = "Class Results";
/** Header rows are 1-9; every row 10-362 is a valid, unordered data row (the
 * School Summary sheet's SUMIFS ranges scan $A$10:$A$362 in full). */
const FIRST_DATA_ROW = 10;

const SEX_LABELS: Record<string, string> = { M: "Male", F: "Female" };

/** Column letters for the Proficiency Level one-hot flags, in RMA_LEVELS'
 * own order (see lib/scoring/instruments.ts) — label text is byte-exact with
 * the template's own headers. */
const LEVEL_COLUMNS: Record<string, string> = {
  "Emerging (Not Proficient)": "G",
  "Emerging (Low Proficient)": "H",
  "Developing (Nearly Proficient)": "I",
  "Transitioning (Proficient)": "J",
  "At Grade Level (Highly Proficient)": "K",
};

/** Task columns L..V hold Task A..Task K's 75%-pass flag, in letter order. */
const TASK_COLUMNS = ["L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"];
function taskColumn(key: string): string | undefined {
  const index = key.charCodeAt(0) - "A".charCodeAt(0);
  return TASK_COLUMNS[index];
}

type Learner = {
  id: string;
  sex: string;
};

/**
 * Builds the RMA (Key Stage 1, Grades 1-3) School Summary workbook for one
 * round: one row per enrolled learner written into `Class Results`.
 * `School Summary` is formula-driven off it and is never touched directly.
 *
 * Grades 1-2 have proficiency levels (reusing Grade 3's percentage bands —
 * see lib/scoring/instruments.ts) but no per-task maximums, so their Task
 * A-K columns are left blank rather than 0: a real "not tracked" gap, not a
 * zero score. The Reports page notes this next to the download button.
 */
export async function buildRmaSchoolSummary(
  supabase: SupabaseClient,
  roundId: number
): Promise<Blob> {
  const workbook = await loadTemplate(TEMPLATE_FILE);
  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) throw new Error(`Template is missing the "${SHEET_NAME}" sheet`);

  sheet.getCell("B4").value = SCHOOL.id;
  sheet.getCell("B5").value = SCHOOL.name;

  let row = FIRST_DATA_ROW;

  for (const grade of RMA_GRADES) {
    const rules = await getRmaRules(supabase, grade);

    const { data: learners } = await supabase
      .from("learners")
      .select("id, sex")
      .eq("grade_level", grade)
      .eq("status", "enrolled")
      .order("last_name")
      .order("first_name");

    const { data: results } = await supabase
      .from("rma_results")
      .select("learner_id, task_scores")
      .eq("round_id", roundId);

    const byLearner = new Map((results ?? []).map((r) => [r.learner_id, r]));

    for (const learner of (learners ?? []) as Learner[]) {
      const raw = byLearner.get(learner.id);
      const scores = (raw?.task_scores ?? {}) as Record<string, number | null>;
      const encoded = rules.tasks.some((t) => typeof scores[t.key] === "number");
      const computed = computeRma({ taskScores: scores }, rules);

      const r = sheet.getRow(row);
      r.getCell("A").value = `Grade ${grade}`;
      r.getCell("C").value = SEX_LABELS[learner.sex] ?? learner.sex;
      r.getCell("D").value = 1; // language matched (LOI vs learner) — not tracked by the app
      r.getCell("E").value = encoded ? 1 : 0; // assessed
      r.getCell("F").value = 1; // enrolled

      if (encoded) {
        if (computed.proficiencyLevel !== null) {
          const col = LEVEL_COLUMNS[computed.proficiencyLevel];
          if (col) r.getCell(col).value = 1;
        }
        for (const task of rules.tasks) {
          const mastered = computed.taskMastery[task.key];
          if (mastered === undefined) continue; // no stated max — leave blank, not 0
          const col = taskColumn(task.key);
          if (col) r.getCell(col).value = mastered ? 1 : 0;
        }
        if (computed.total !== null) r.getCell("W").value = computed.total;
      }

      row += 1;
    }
  }

  forceRecalcOnOpen(workbook);
  return toBlob(workbook);
}
