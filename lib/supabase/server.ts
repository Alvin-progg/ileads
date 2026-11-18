import { createServerClient } from "@supabase/ssr";
import { cache } from "react";
import { cookies } from "next/headers";

// cache(): one client per request, shared by layout, page and helpers.
export const createClient = cache(async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookie writes are not allowed
            // there. Safe to ignore when middleware refreshes sessions.
          }
        },
      },
    }
  );
});
