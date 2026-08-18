import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrlaRules, RmaRules } from "./types.ts";

export const CRLA_VERSION = "CRLA2v1";
export const RMA_VERSION = "RMA2v2";

/**
 * Fetches the cut-off rules for one instrument from the database.
 *
 * The engine never falls back to compiled-in defaults: if a grade has no rules
 * row, that grade's instrument has not been transcribed yet, and scoring it
 * would invent official-looking levels DepEd never defined. Failing loudly is
 * the point.
 */
async function getRules<T>(
  supabase: SupabaseClient,
  tool: string,
  gradeLevel: number,
  version: string
): Promise<T> {
  const { data, error } = await supabase
    .from("scoring_rules")
    .select("rules")
    .eq("tool", tool)
    .eq("grade_level", gradeLevel)
    .eq("version", version)
    .maybeSingle();

  if (error) throw new Error(`Failed to load ${tool} rules: ${error.message}`);
  if (!data) {
    throw new Error(
      `No ${tool} scoring rules for grade ${gradeLevel} version ${version}. ` +
        `This instrument has not been configured.`
    );
  }

  return data.rules as T;
}

export function getCrlaRules(
  supabase: SupabaseClient,
  gradeLevel: number,
  version: string = CRLA_VERSION
): Promise<CrlaRules> {
  return getRules<CrlaRules>(supabase, "crla", gradeLevel, version);
}

export function getRmaRules(
  supabase: SupabaseClient,
  gradeLevel: number,
  version: string = RMA_VERSION
): Promise<RmaRules> {
  return getRules<RmaRules>(supabase, "rma", gradeLevel, version);
}

/**
 * Same as the getters above, but reports a missing instrument as null instead
 * of throwing — for pages that would rather show "not configured for this
 * grade" than a stack trace. A genuine query failure still throws: silently
 * treating a broken connection as an unconfigured instrument would hide it.
 */
export async function tryGetRules<T>(
  load: () => Promise<T>
): Promise<T | null> {
  try {
    return await load();
  } catch (e) {
    if (e instanceof Error && e.message.includes("has not been configured")) {
      return null;
    }
    throw e;
  }
}
