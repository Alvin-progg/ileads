import type { SupabaseClient } from "@supabase/supabase-js";
import { CRLA_GRADES } from "@/lib/grades";
import { getGradeTeacherNames } from "@/lib/teachers";
import { orderLanguages } from "@/lib/languages";
import { SCHOOL } from "@/lib/school";
import { getCrlaRules } from "@/lib/scoring/load.ts";
import { toClassRecordRow } from "@/lib/scoring/class-record.ts";
import { forceRecalcOnOpen, loadTemplate, toBlob } from "./xlsx-template";

const TEMPLATE_FILE = "CRLA2_TagalogSchoolSummary_blank.xlsx";
const SHEET_NAME = "Class Results";
/** First learner row; rows 1-7 are the header block. Confirmed against the
 * real template's SUMIFS ranges ($A$8:$A$355) — every row 8-355 is a valid,
 * unordered data row, not a per-grade block. */
const FIRST_DATA_ROW = 8;

const LANGUAGE_LABELS: Record<string, string> = {
  MT: "Tagalog",
  FIL: "Filipino",
  ENG: "English",
};

const SEX_LABELS: Record<string, string> = { M: "Male", F: "Female" };

/** Column letters for the Reading Level one-hot flags, in the instrument's
 * own label order (see lib/scoring/instruments.ts). */
const LEVEL_COLUMNS: Record<string, string> = {
  "Full Refresher": "H",
  "Moderate Refresher": "I",
  "Light Refresher": "J",
  "Grade Ready": "K",
};

/** Column letters for the Reading Profile one-hot flags. */
const PROFILE_COLUMNS: Record<string, string> = {
  "Low Emerging Reader": "O",
  "High Emerging Reader": "P",
  "Developing Reader": "Q",
  "Transitioning Reader": "R",
  "Reading At Grade Level": "S",
};

type Learner = {
  id: string;
  sex: string;
};

/**
 * Builds the CRLA School Summary workbook for one round: one row per
 * enrolled learner per language they're assessed in, written into the
 * template's `Class Results` sheet. The `School Summary` sheet is 100%
 * SUMIFS/AVERAGEIFS formulas reading off `Class Results` — we never touch it,
 * and Excel recomputes it correctly the moment the file opens.
 */
export async function buildCrlaSchoolSummary(
  supabase: SupabaseClient,
  roundId: number
): Promise<Blob> {
  const workbook = await loadTemplate(TEMPLATE_FILE);
  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) throw new Error(`Template is missing the "${SHEET_NAME}" sheet`);

  sheet.getCell("B5").value = SCHOOL.name;

  let row = FIRST_DATA_ROW;

  for (const grade of CRLA_GRADES) {
    const rules = await getCrlaRules(supabase, grade);
    const languages = orderLanguages(Object.keys(rules.languages));
    const teacherNames = await getGradeTeacherNames(supabase, grade);
    const teacher = teacherNames.length > 0 ? teacherNames.join(", ") : "";

    const { data: learners } = await supabase
      .from("learners")
      .select("id, sex")
      .eq("grade_level", grade)
      .eq("status", "enrolled")
      .order("last_name")
      .order("first_name");

    for (const language of languages) {
      const { data: results } = await supabase
        .from("crla_results")
        .select(
          "learner_id, task1, task2l, task2h, story_no, miscues, reading_secs, comprehension_correct"
        )
        .eq("round_id", roundId)
        .eq("language", language);

      const byLearner = new Map((results ?? []).map((r) => [r.learner_id, r]));

      for (const learner of (learners ?? []) as Learner[]) {
        const raw = byLearner.get(learner.id);
        const record = toClassRecordRow(
          {
            task1: raw?.task1 ?? null,
            task2Low: raw?.task2l ?? null,
            task2High: raw?.task2h ?? null,
            storyNo: raw?.story_no ?? null,
            miscues: raw?.miscues ?? null,
            readingSeconds: raw?.reading_secs ?? null,
            comprehensionCorrect: raw?.comprehension_correct ?? null,
          },
          rules,
          language
        );

        const r = sheet.getRow(row);
        r.getCell("A").value = `Grade ${grade}`;
        r.getCell("C").value = teacher;
        r.getCell("D").value = LANGUAGE_LABELS[language] ?? language;
        r.getCell("E").value = SEX_LABELS[learner.sex] ?? learner.sex;
        r.getCell("F").value = 1; // enrolled
        r.getCell("G").value = record.readingLevel !== null ? 1 : 0; // assessed

        if (record.readingLevel !== null) {
          const col = LEVEL_COLUMNS[record.readingLevel];
          if (col) r.getCell(col).value = 1;
        }
        if (record.fluency !== null) r.getCell("L").value = record.fluency;
        if (record.comprehensionPercent !== null) {
          r.getCell("M").value = record.comprehensionPercent;
        }
        if (record.wpm !== null) r.getCell("N").value = record.wpm;
        if (record.readingProfile !== null) {
          const col = PROFILE_COLUMNS[record.readingProfile];
          if (col) r.getCell(col).value = 1;
        }

        row += 1;
      }
    }
  }

  forceRecalcOnOpen(workbook);
  return toBlob(workbook);
}
