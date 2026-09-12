"use server";

import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

/**
 * supabase.auth.updateUser() alone doesn't verify the caller's current
 * password — it only needs a valid session. Re-authenticate on this same
 * cookie-bound client first, so a stolen/left-open session can't be used to
 * lock the real owner out.
 */
export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "Your session expired. Log in again to continue." };
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError) {
    return { error: "Current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: error ? friendlyError(error) : null };
}
