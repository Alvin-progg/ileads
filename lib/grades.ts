export const GRADE_LEVELS = [1, 2, 3, 4, 5, 6] as const;

/** Grades with a CRLA instrument. */
export const CRLA_GRADES: number[] = [1, 2, 3];
/** Grades with an RMA instrument. Grades 4-6 use a different one. */
export const RMA_GRADES: number[] = [1, 2, 3];
/** Grades with a Phil-IRI Oral Reading instrument. */
export const PHILIRI_GRADES: number[] = [4, 5, 6];
/** Grades with an exam module. */
export const EXAM_GRADES: number[] = [1, 2, 3, 4, 5, 6];

export function gradeLabel(grade: number): string {
  return String(grade);
}
