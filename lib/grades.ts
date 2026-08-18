export const GRADE_LEVELS = [0, 1, 2, 3, 4, 5, 6] as const;

export function gradeLabel(grade: number): string {
  return grade === 0 ? "K" : String(grade);
}
