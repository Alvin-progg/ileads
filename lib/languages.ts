/**
 * The order the DepEd sheets list languages in. The rules arrive as jsonb, so
 * key order is whatever Postgres returns; the pickers need it fixed.
 */
export const LANGUAGE_ORDER = ["MT", "FIL", "ENG"];

/** Full names, for teachers who never see the sheet codes. */
export const LANGUAGE_NAMES: Record<string, string> = {
  MT: "Mother tongue",
  FIL: "Filipino",
  ENG: "English",
};

export function orderLanguages(languages: string[]): string[] {
  return [...languages].sort((a, b) => {
    const ai = LANGUAGE_ORDER.indexOf(a);
    const bi = LANGUAGE_ORDER.indexOf(b);
    // Anything the order does not know about sorts last, alphabetically.
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
