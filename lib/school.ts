// School identity printed on the header of every official form.
//
// name/DepEd numeric ID/address come from the `schools` table (each account
// belongs to exactly one, via profiles.school_id -- see lib/viewer.ts).
// district/division/region/schoolYear are shared across all schools in this
// deployment, so they stay app-level constants rather than DB columns.
//
// TODO(researcher): fill in the real shared values before submitting
// anything to the district. The placeholders below are deliberately
// obvious so an unfilled printout is caught at review rather than at
// submission.
const SHARED = {
  district: "TODO — District",
  division: "TODO — Division",
  region: "TODO — Region",
  schoolYear: "2026–2027",
};

export type SchoolRow = {
  id: number;
  name: string;
  school_id: number;
  address: string;
};

export type SchoolDetails = {
  name: string;
  id: string;
  address: string;
  district: string;
  division: string;
  region: string;
  schoolYear: string;
};

/** Resolves a viewer's school row (lib/viewer.ts) into export-ready details. */
export function resolveSchool(school: SchoolRow | null): SchoolDetails {
  return {
    name: school?.name ?? "TODO — School Name",
    id: school ? String(school.school_id) : "TODO — School ID",
    address: school?.address ?? "TODO — address",
    ...SHARED,
  };
}

/** True while any field is still a placeholder, so the UI can warn. */
export function schoolDetailsIncomplete(school: SchoolRow | null): boolean {
  return Object.values(resolveSchool(school)).some((v) => v.startsWith("TODO"));
}
