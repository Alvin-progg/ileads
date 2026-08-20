"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

const PERMISSION_MESSAGE = "You can only manage learners in your assigned grade levels.";

export type LearnerInput = {
  lrn: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  ext_name: string;
  sex: "M" | "F";
  birthdate: string;
  grade_level: number;
  status: "enrolled" | "transferred" | "dropped";
};

function toRow(input: LearnerInput) {
  return {
    lrn: input.lrn,
    last_name: input.last_name,
    first_name: input.first_name,
    middle_name: input.middle_name || null,
    ext_name: input.ext_name || null,
    sex: input.sex,
    birthdate: input.birthdate || null,
    grade_level: input.grade_level,
    status: input.status,
  };
}

export async function createLearner(input: LearnerInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("learners").insert(toRow(input));

  if (error) return { error: friendlyError(error, { permissionMessage: PERMISSION_MESSAGE }) };
  revalidatePath("/learners");
  return { error: null };
}

export async function updateLearner(id: string, input: LearnerInput) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("learners")
    .update(toRow(input))
    .eq("id", id);

  if (error) return { error: friendlyError(error, { permissionMessage: PERMISSION_MESSAGE }) };
  revalidatePath("/learners");
  return { error: null };
}

export async function archiveLearner(
  id: string,
  status: "transferred" | "dropped"
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("learners")
    .update({ status })
    .eq("id", id);

  if (error) return { error: friendlyError(error, { permissionMessage: PERMISSION_MESSAGE }) };
  revalidatePath("/learners");
  return { error: null };
}

export async function restoreLearner(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("learners")
    .update({ status: "enrolled" })
    .eq("id", id);

  if (error) return { error: friendlyError(error, { permissionMessage: PERMISSION_MESSAGE }) };
  revalidatePath("/learners");
  return { error: null };
}
