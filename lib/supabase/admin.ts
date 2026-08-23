import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely and is the only client that
 * can call the Auth Admin API (auth.admin.createUser, etc). Server-only:
 * SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix, so Next.js never
 * bundles it to the client — but this file must still never be imported
 * from a "use client" component, only from server actions/route handlers
 * that have already verified the caller is authorized.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
