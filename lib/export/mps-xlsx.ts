import type { SupabaseClient } from "@supabase/supabase-js";
import { EXAM_GRADES } from "@/lib/grades";
import {
  summariseExamSubject,
  type ExamEntry,
  type Sex,
} from "@/lib/scoring/exam-summary.ts";
import { forceRecalcOnOpen, loadTemplate, toBlob } from "./xlsx-template";

const TEMPLATE_FILE = "MPS_blank.xlsx";

/** learning_areas.name -> the workbook's sheet name for that subject. Each
 * subject lives on its own sheet — there is no combined "School Summary". */
const SUBJECT_SHEETS: Record<string, string> = {
  GMRC: "GMRC",
  "English Reading & Literacy": "ENGLISH READING & LITERACY",
  "Filipino Language": "FILIPINO LANGUAGE",
  Mathematics: "MATH",
  Science: "SCIENCE",
  Makabansa: "Makabansa",
  EPP: "EPP",
  "Music & Arts": "MUSIC & ARTS",
  "PE & Health": "P.E & HEALTH",
};

/** Row of the "<QUARTER> SY ..." header for each quarter, 12 rows apart. */
const QUARTER_HEADER_ROW: Record<string, number> = { Q1: 5, Q2: 17, Q3: 29, Q4: 41 };

/** Within a quarter block, Grade N's data row is header+3+N (grades 1-6 sit
 * at header+4 .. header+9). */
function dataRow(headerRow: number, grade: number): number {
  return headerRow + 3 + grade;
}

type Learner = { id: string; sex: string };

/**
 * Builds the MPS workbook for one exam quarter: Mean, SD and MPS (Male/
 * Female/Total) plus the Least Mastered Skills note, written into every
 * subject's own sheet at that subject+grade's fixed row. All of these cells
 * are literal values in the real template (no formulas back them), so we
 * write our own computed numbers directly rather than feeding a raw-score
 * sheet.
 *
 * The template has one combined Mean/SD column, not split by sex — so Mean
 * and SD use the "Total" figure; only MPS is split Male/Female/Total, which
 * is what the template itself supports.
 */
export async function buildMpsWorkbook(
  supabase: SupabaseClient,
  roundId: number,
  roundName: string
): Promise<Blob> {
  const headerRow = QUARTER_HEADER_ROW[roundName];
  if (!headerRow) {
    throw new Error(`MPS template has no quarter block for round "${roundName}"`);
  }

  const workbook = await loadTemplate(TEMPLATE_FILE);

  const { data: learningAreas } = await supabase
    .from("learning_areas")
    .select("id, name, grade_level, hps_per_quarter");

  const areasBySubject = new Map<string, Map<number, { id: number; hps: number | null }>>();
  for (const area of learningAreas ?? []) {
    const hps = ((area.hps_per_quarter ?? {}) as Record<string, number | null>)[roundName] ?? null;
    if (!areasBySubject.has(area.name)) areasBySubject.set(area.name, new Map());
    areasBySubject.get(area.name)!.set(area.grade_level, { id: area.id, hps });
  }

  for (const [subjectName, sheetName] of Object.entries(SUBJECT_SHEETS)) {
    const bySubject = areasBySubject.get(subjectName);
    if (!bySubject) continue;

    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) throw new Error(`Template is missing the "${sheetName}" sheet`);

    for (const grade of EXAM_GRADES) {
      const area = bySubject.get(grade);
      if (!area) continue;

      const { data: learners } = await supabase
        .from("learners")
        .select("id, sex")
        .eq("grade_level", grade)
        .eq("status", "enrolled");

      const { data: results } = await supabase
        .from("exam_results")
        .select("learner_id, score")
        .eq("round_id", roundId)
        .eq("learning_area_id", area.id);

      const scoreByLearner = new Map((results ?? []).map((r) => [r.learner_id, r.score]));

      const entries: ExamEntry[] = ((learners ?? []) as Learner[]).map((l) => ({
        sex: l.sex as Sex,
        score: scoreByLearner.get(l.id) ?? null,
      }));

      const stat = summariseExamSubject(entries, area.hps);

      const { data: note } = await supabase
        .from("exam_notes")
        .select("least_mastered_skills")
        .eq("round_id", roundId)
        .eq("learning_area_id", area.id)
        .maybeSingle();

      const row = sheet.getRow(dataRow(headerRow, grade));
      row.getCell("A").value = grade;
      row.getCell("B").value = stat.enrolledBySex.total;
      if (stat.meanBySex.total !== null) row.getCell("C").value = stat.meanBySex.total;
      if (stat.sdBySex.total !== null) row.getCell("D").value = stat.sdBySex.total;
      if (stat.mpsBySex.male !== null) row.getCell("E").value = stat.mpsBySex.male;
      if (stat.mpsBySex.female !== null) row.getCell("F").value = stat.mpsBySex.female;
      if (stat.mpsBySex.total !== null) row.getCell("G").value = stat.mpsBySex.total;
      row.getCell("H").value = note?.least_mastered_skills ?? "";
    }
  }

  forceRecalcOnOpen(workbook);
  return toBlob(workbook);
}
