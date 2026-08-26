/**
 * Kindergarten is grade_level 0 — a ROSTER-ONLY grade. Kinder learners are
 * enrolled, listed, edited and counted like anyone else, but sit no
 * instrument: no CRLA, RMA, Phil-IRI or exam, and they appear in no export.
 *
 * That exclusion is structural, not gated: none of the *_GRADES lists below
 * contains 0, and every grid page, sidebar nav item, dashboard chart,
 * encoding tracker and lib/export/* loop derives its grade set from one of
 * them. Instrument code may therefore assume grade >= 1 — e.g.
 * mps-xlsx.dataRow() maps grade straight onto a template row offset, and
 * philiri-xlsx.blockFirstRow() uses PHILIRI_GRADES.indexOf(). Keep 0 out of
 * these lists and those stay correct.
 *
 * The database backs this up: learning_areas and scoring_rules still check
 * grade_level between 1 and 6 (supabase/migrations/20260825090000_restore_kindergarten.sql).
 */
export const KINDER = 0;

/**
 * Every grade the school enrols, Kinder first. This is roster/scope coverage
 * — NOT instrument coverage. Consumers: the head's default allowedGrades
 * (lib/viewer.ts), the head dashboard scope (admin/page.tsx) and the
 * grade-assignment pills (admin/teachers).
 */
export const GRADE_LEVELS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Grades with a CRLA instrument. */
export const CRLA_GRADES: number[] = [1, 2, 3];
/** Grades with an RMA instrument. */
export const RMA_GRADES: number[] = [1, 2, 3, 4, 5, 6];
/** Grades with a Phil-IRI Oral Reading instrument. */
export const PHILIRI_GRADES: number[] = [4, 5, 6];
/** Grades with an exam module. */
export const EXAM_GRADES: number[] = [1, 2, 3, 4, 5, 6];

/**
 * Bare token for a table cell, pill or narrow option: "K", "3". Kept to one
 * character so it still fits the 32px grade pills in admin/teachers.
 */
export function gradeLabel(grade: number): string {
  return grade === KINDER ? "K" : String(grade);
}

/**
 * Full display form for a heading or a sentence: "Kindergarten", "Grade 3".
 * Use this instead of writing `Grade ${g}` by hand.
 */
export function gradeHeading(grade: number): string {
  return grade === KINDER ? "Kindergarten" : `Grade ${grade}`;
}

/**
 * One viewer's grade scope as a phrase: "Kindergarten", "Grade 3",
 * "Grades 1, 2", "Kindergarten · Grade 1". Absorbs the pluralisation the
 * learners and my-class headers were hand-rolling.
 */
export function gradeScopeLabel(grades: number[]): string {
  if (grades.length === 0) return "none";

  const numbered = grades.filter((g) => g !== KINDER).sort((a, b) => a - b);
  const parts: string[] = [];

  if (grades.includes(KINDER)) parts.push("Kindergarten");
  if (numbered.length > 0) {
    parts.push(`Grade${numbered.length > 1 ? "s" : ""} ${numbered.join(", ")}`);
  }

  return parts.join(" · ");
}
