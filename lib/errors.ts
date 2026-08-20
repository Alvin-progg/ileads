// Translates Supabase/Postgres errors into plain language a teacher can act
// on. This is the single point every action file must go through — an
// unrecognized error falls back to a generic message, never the raw
// Postgres/PostgREST driver text.

const GENERIC_FALLBACK = "Something went wrong. Please try again.";

/** Matches the ways a dead session shows up in an error message, both from
 * PostgREST itself (a stale-but-sent JWT) and from Supabase's client-side
 * auth errors. */
const AUTH_EXPIRED_PATTERN = /jwt expired|invalid jwt|session.*expired/i;

export function friendlyError(
  error: { code?: string; message?: string } | null | undefined,
  opts: { permissionMessage?: string } = {}
): string {
  if (!error) return GENERIC_FALLBACK;

  if (error.code === "42501") {
    return opts.permissionMessage ?? "You don't have permission to do that.";
  }
  if (error.code === "23505") {
    return "This LRN is already registered to another learner.";
  }
  if (error.code === "23514") {
    return "LRN must be exactly 12 digits.";
  }
  if (error.message && AUTH_EXPIRED_PATTERN.test(error.message)) {
    return "Your session expired. Log in again to continue.";
  }

  return GENERIC_FALLBACK;
}
