import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

/**
 * Shared setup for every export download route: only the school head may
 * download a School Summary, and every route needs the same round lookup.
 * Returns a Response to bail out with, or the round to export.
 */
export async function loadExportRound(
  tool: string,
  roundId: string
): Promise<
  | { ok: true; supabase: SupabaseClient; round: { id: number; name: string } }
  | { ok: false; response: Response }
> {
  const viewer = await getViewer();
  if (!viewer.isHead) {
    return { ok: false, response: new Response("Forbidden", { status: 403 }) };
  }

  const supabase = await createClient();
  const { data: round } = await supabase
    .from("assessment_rounds")
    .select("id, name")
    .eq("tool", tool)
    .eq("id", roundId)
    .maybeSingle();

  if (!round) {
    return { ok: false, response: new Response("Round not found", { status: 404 }) };
  }

  return { ok: true, supabase, round };
}
