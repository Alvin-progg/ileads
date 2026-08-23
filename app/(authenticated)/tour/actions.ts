"use server";

import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

export async function markTourSeen() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_tour_seen");

  return { error: error ? friendlyError(error) : null };
}
