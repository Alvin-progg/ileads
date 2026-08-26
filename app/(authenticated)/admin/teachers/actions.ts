"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/viewer";
import { friendlyError } from "@/lib/errors";

export async function saveTeacherGrades(teacherId: string, grades: number[]) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_teacher_grades", {
    p_teacher: teacherId,
    p_grades: grades,
  });

  return { error: error ? friendlyError(error) : null };
}

export type CreateTeacherInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  isSpecial: boolean;
};

/**
 * Creates the auth user directly via the Admin API — the same operation
 * scripts/seed-auth.mjs performs, just from the UI instead of a one-off
 * script. profiles.full_name/role come from the on_auth_user_created
 * trigger (supabase/migrations/20260818084952_auth_profiles.sql) reading
 * user_metadata, so there's no separate profiles insert here.
 *
 * Gated in code, not RLS: creating an auth user isn't a table write a
 * Postgres policy can guard, so the head check has to happen here, first,
 * before the service-role client (which bypasses RLS entirely) is ever
 * touched.
 */
export async function createTeacher(input: CreateTeacherInput) {
  const viewer = await getViewer();
  if (!viewer.isHead) {
    return { error: "You don't have permission to do that." };
  }

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim();

  if (!firstName || !lastName) {
    return { error: "First and last name are required." };
  }
  if (!email) {
    return { error: "Email is required." };
  }
  if (input.password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: `${firstName} ${lastName}`, role: "teacher" },
  });

  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      return { error: "An account with that email already exists." };
    }
    return { error: friendlyError(error) };
  }

  // profiles.is_special is set here rather than through raw_user_meta_data +
  // handle_new_user(): that trigger is on the critical path for every auth
  // user in the system, and this is a display label with a column default —
  // not worth the blast radius. The trigger has already committed the
  // profiles row by the time createUser() returns, and the head's own client
  // can update it ("head full access" on profiles), so no service-role write
  // and no RPC — same two-step shape as setTeacherActive() below.
  if (input.isSpecial && data?.user?.id) {
    const supabase = await createClient();
    const { error: flagError } = await supabase
      .from("profiles")
      .update({ is_special: true })
      .eq("id", data.user.id);

    // Says "added" on purpose: the account exists, so a retry would only hit
    // "already exists". The head fixes the label with the row toggle.
    if (flagError) {
      return {
        error: `Teacher added, but the special-teacher label didn't save: ${friendlyError(flagError)}`,
      };
    }
  }

  return { error: null };
}

/**
 * "Special teacher" = the Kindergarten teacher. Label only — it grants no
 * access; Kinder access comes from a teacher_assignments row at grade_level
 * 0. Editable after creation because the only other repair for a mistyped
 * checkbox is deleting the auth user, which the app cannot do.
 */
export async function setTeacherSpecial(teacherId: string, isSpecial: boolean) {
  const viewer = await getViewer();
  if (!viewer.isHead) {
    return { error: "You don't have permission to do that." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_special: isSpecial })
    .eq("id", teacherId);

  return { error: error ? friendlyError(error) : null };
}

/**
 * Deactivating a teacher does two things, in this order:
 *
 * 1. Bans the auth user (ban_duration below ~100 years, "none" to lift it)
 *    — this is what actually blocks sign-in and invalidates any session
 *    already open, enforced by Supabase itself. Done first: if this fails,
 *    nothing else changes, so the account is never left half-deactivated.
 * 2. Flips profiles.active, which lib/teachers.ts already reads to drop a
 *    deactivated teacher's name from a grade's printed-form header — that
 *    existing behavior is reused here, not duplicated.
 */
export async function setTeacherActive(teacherId: string, active: boolean) {
  const viewer = await getViewer();
  if (!viewer.isHead) {
    return { error: "You don't have permission to do that." };
  }

  const admin = createAdminClient();
  const { error: banError } = await admin.auth.admin.updateUserById(teacherId, {
    ban_duration: active ? "none" : "876000h",
  });
  if (banError) {
    return { error: friendlyError(banError) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ active }).eq("id", teacherId);

  return { error: error ? friendlyError(error) : null };
}
