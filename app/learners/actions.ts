"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    return "This LRN is already registered to another learner.";
  }
  if (error.code === "23514") {
    return "LRN must be exactly 12 digits.";
  }
  if (error.code === "42501") {
    return "You can only manage learners in your assigned grade levels.";
  }
  return error.message;
}

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

  if (error) return { error: friendlyError(error) };
  revalidatePath("/learners");
  return { error: null };
}

export async function updateLearner(id: string, input: LearnerInput) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("learners")
    .update(toRow(input))
    .eq("id", id);

  if (error) return { error: friendlyError(error) };
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

  if (error) return { error: friendlyError(error) };
  revalidatePath("/learners");
  return { error: null };
}

export async function restoreLearner(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("learners")
    .update({ status: "enrolled" })
    .eq("id", id);

  if (error) return { error: friendlyError(error) };
  revalidatePath("/learners");
  return { error: null };
}
