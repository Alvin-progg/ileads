// School identity printed on the header of every official form.
//
// TODO(researcher): fill in the real values before submitting anything to the
// district. The placeholders below are deliberately obvious so an unfilled
// printout is caught at review rather than at submission.
export const SCHOOL = {
  name: "Ligaya Primary School",
  id: "TODO — School ID",
  district: "TODO — District",
  division: "TODO — Division",
  region: "TODO — Region",
  schoolYear: "2026–2027",
};

/** True while any field is still a placeholder, so the UI can warn. */
export function schoolDetailsIncomplete(): boolean {
  return Object.values(SCHOOL).some((v) => v.startsWith("TODO"));
}
