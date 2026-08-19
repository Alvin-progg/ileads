// Dummy auth seed: 1 head + 4 teachers, with grade assignments.
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (dashboard: Settings → API).
// Run: node scripts/seed-auth.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "password123";

// grade_level: 1 … 6. Multigrade: 4 teachers cover Grades 1–6.
const users = [
  { email: "head@example.com", full_name: "Maria Santos", role: "head", grades: [] },
  { email: "teacher1@example.com", full_name: "Ana Reyes", role: "teacher", grades: [1] },
  { email: "teacher2@example.com", full_name: "Jose Cruz", role: "teacher", grades: [2, 3] },
  { email: "teacher3@example.com", full_name: "Liza Bautista", role: "teacher", grades: [4, 5] },
  { email: "teacher4@example.com", full_name: "Pedro Flores", role: "teacher", grades: [6] },
];

async function findUserId(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email === email)?.id;
}

for (const u of users) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: u.full_name, role: u.role },
  });

  let id = data?.user?.id;
  if (error) {
    if (/already/i.test(error.message)) {
      id = await findUserId(u.email);
      console.log(`= ${u.email} already exists (${id})`);
    } else {
      console.error(`✗ ${u.email}: ${error.message}`);
      continue;
    }
  } else {
    console.log(`+ ${u.email} created (${id})`);
  }

  // trigger created the profile from metadata; assignments seeded here
  if (u.grades.length) {
    const { error: aerr } = await supabase
      .from("teacher_assignments")
      .upsert(
        u.grades.map((g) => ({ teacher_id: id, grade_level: g })),
        { onConflict: "teacher_id,grade_level", ignoreDuplicates: true }
      );
    if (aerr) console.error(`  assignments failed: ${aerr.message}`);
    else console.log(`  grades: ${u.grades.join(", ")}`);
  }
}

console.log(`\nAll accounts use password: ${PASSWORD}`);
