export type SchoolSummary = {
  schoolId: number;
  name: string;
};

export const SCHOOLS: SchoolSummary[] = [
  { schoolId: 107460, name: "Ligaya Primary School" },
  { schoolId: 107461, name: "San Jose ES" },
  { schoolId: 999999, name: "Panay ES" },
];

export function schoolByDepedId(schoolId: number | undefined): SchoolSummary | undefined {
  return SCHOOLS.find((s) => s.schoolId === schoolId);
}
