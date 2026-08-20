import type { SupabaseClient } from "@supabase/supabase-js";
import { PHILIRI_GRADES } from "@/lib/grades";
import { orderLanguages } from "@/lib/languages";
import { getPhiliriRules } from "@/lib/scoring/load.ts";
import { computePhiliri } from "@/lib/scoring/philiri.ts";
import {
  summarisePhiliri,
  type PhiliriSummaryEntry,
  type Sex,
} from "@/lib/scoring/philiri-summary.ts";
import { forceRecalcOnOpen, loadTemplate, toBlob } from "./xlsx-template";

const TEMPLATE_FILE = "PhilIRI_blank.xlsx";
const SHEET_NAME = "Summary";

/** Each grade occupies a 2-row block, one row per language (FIL then ENG,
 * matching orderLanguages), starting at row 4. */
function blockFirstRow(grade: number): number {
  return 4 + (PHILIRI_GRADES.indexOf(grade) * 2);
}

/** Overall Level -> [Male column, Female column], for the Pre-test block
 * (columns G-N). The Post-test block (O-V) mirrors it 8 columns over. There
 * is no "Non-Reader" bucket in the app's computed levels (see LEVELS in
 * lib/scoring/philiri-summary.ts) — those two columns are left at the
 * template's default rather than guessed. */
const LEVEL_COLUMNS_PRE: Record<string, [string, string]> = {
  Independent: ["G", "H"],
  Instructional: ["I", "J"],
  Frustration: ["K", "L"],
};
const LEVEL_COLUMNS_POST: Record<string, [string, string]> = {
  Independent: ["O", "P"],
  Instructional: ["Q", "R"],
  Frustration: ["S", "T"],
};

type Learner = { id: string; sex: string };

/**
 * Builds the Phil-IRI School Summary workbook for one Pre/Post round: counts
 * per Overall Level, split Male/Female, written into the `Summary` sheet.
 *
 * This template's mapping to the app's data model is looser than CRLA/RMA's:
 * it has no per-learner formula-feeding sheet (Mean/SD-style literal cells,
 * like MPS), no explicit language column (inferred from row order within
 * each grade's 2-row block), and a "Non-Reader" bucket the app doesn't
 * compute. Treat this export as best-effort — flagged as such on the Reports
 * page — rather than as verified cell-for-cell as CRLA/RMA are.
 */
export async function buildPhiliriSchoolSummary(
  supabase: SupabaseClient,
  roundId: number,
  roundName: string
): Promise<Blob> {
  const levelColumns = roundName === "Post" ? LEVEL_COLUMNS_POST : LEVEL_COLUMNS_PRE;

  const workbook = await loadTemplate(TEMPLATE_FILE);
  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) throw new Error(`Template is missing the "${SHEET_NAME}" sheet`);

  for (const grade of PHILIRI_GRADES) {
    const rules = await getPhiliriRules(supabase, grade);
    const languages = orderLanguages(Object.keys(rules.languages));
    const firstRow = blockFirstRow(grade);

    const { data: learners } = await supabase
      .from("learners")
      .select("id, sex")
      .eq("grade_level", grade)
      .eq("status", "enrolled")
      .order("last_name")
      .order("first_name");

    sheet.getCell(`B${firstRow}`).value = (learners ?? []).length;

    // Template only reserves 2 rows per grade — one per language.
    for (let i = 0; i < languages.length && i < 2; i++) {
      const language = languages[i];
      const targetRow = firstRow + i;
      const langRules = rules.languages[language];

      const { data: results } = await supabase
        .from("philiri_results")
        .select("learner_id, word_count, miscues, comprehension_items, comprehension_correct")
        .eq("round_id", roundId)
        .eq("language", language);

      const byLearner = new Map((results ?? []).map((r) => [r.learner_id, r]));

      const entries: PhiliriSummaryEntry[] = ((learners ?? []) as Learner[]).map((learner) => {
        const raw = byLearner.get(learner.id);
        const computed = computePhiliri(
          {
            wordCount: raw?.word_count ?? null,
            miscues: raw?.miscues ?? null,
            comprehensionItems: raw?.comprehension_items ?? null,
            comprehensionCorrect: raw?.comprehension_correct ?? null,
          },
          langRules
        );
        return {
          sex: learner.sex as Sex,
          wordReadingLevel: computed.wordReadingLevel,
          comprehensionLevel: computed.comprehensionLevel,
          overallLevel: computed.overallLevel,
        };
      });

      const summary = summarisePhiliri(entries);
      const row = sheet.getRow(targetRow);

      for (const level of summary.overallLevels) {
        const cols = levelColumns[level.label];
        if (!cols) continue;
        row.getCell(cols[0]).value = level.male;
        row.getCell(cols[1]).value = level.female;
      }
    }
  }

  forceRecalcOnOpen(workbook);
  return toBlob(workbook);
}
