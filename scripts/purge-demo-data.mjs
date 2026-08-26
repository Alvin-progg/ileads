// Removes the dummy prototype learners seeded by scripts/seed-data.mjs and
// scripts/seed-chart-demo.mjs (and their CRLA/RMA/Phil-IRI/exam results)
// before real encoding begins. Leaves scoring_rules, assessment_rounds,
// learning_areas, profiles, and auth users untouched.
//
// Demo learners are identified by the deterministic fake LRN scheme from
// scripts/seed-data.mjs: "9" + grade(0-6, 0 = Kindergarten) + 2-digit seq
// + 8 zeros.
// learner_id foreign keys have no ON DELETE CASCADE, so result rows are
// deleted first.
//
// Defaults to a dry run — prints what would be deleted and does nothing.
// Pass --confirm to actually delete.
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (dashboard: Settings → API).
// Run: node scripts/purge-demo-data.mjs [--confirm]
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const DEMO_LRN = /^9[0-6]\d{2}0{8}$/;

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

const confirm = process.argv.includes("--confirm");

const { data: candidates, error: fetchError } = await supabase
  .from("learners")
  .select("id, lrn, last_name, first_name, grade_level")
  .like("lrn", "9%00000000");

if (fetchError) {
  console.error("Failed to fetch learners:", fetchError.message);
  process.exit(1);
}

// Belt-and-suspenders: the LIKE pattern is broader than the real scheme, so
// re-verify each candidate against it exactly before anything is deleted.
const demoLearners = (candidates ?? []).filter((l) => DEMO_LRN.test(l.lrn));
const demoIds = demoLearners.map((l) => l.id);

if (demoIds.length === 0) {
  console.log("No demo learners found (matched by the seed-data.mjs fake LRN scheme). Nothing to do.");
  process.exit(0);
}

console.log(`Matched ${demoIds.length} demo learner(s):`);
for (const l of demoLearners) {
  const grade = l.grade_level === 0 ? "Kindergarten" : `Grade ${l.grade_level}`;
  console.log(`  ${grade} · ${l.lrn} · ${l.last_name}, ${l.first_name}`);
}

const RESULT_TABLES = ["crla_results", "rma_results", "philiri_results", "exam_results"];

for (const table of RESULT_TABLES) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .in("learner_id", demoIds);
  if (error) {
    console.error(`Failed to count ${table}:`, error.message);
    process.exit(1);
  }
  console.log(`  ${table}: ${count ?? 0} row(s) would be deleted`);
}

if (!confirm) {
  console.log("\nDry run only — nothing was deleted. Re-run with --confirm to delete these rows.");
  process.exit(0);
}

console.log("\n--confirm passed — deleting now.");

for (const table of RESULT_TABLES) {
  const { error } = await supabase.from(table).delete().in("learner_id", demoIds);
  if (error) {
    console.error(`Failed to delete from ${table}:`, error.message);
    process.exit(1);
  }
}

const { error: deleteLearnersError } = await supabase
  .from("learners")
  .delete()
  .in("id", demoIds);

if (deleteLearnersError) {
  console.error("Failed to delete learners:", deleteLearnersError.message);
  process.exit(1);
}

console.log(`Deleted ${demoIds.length} demo learner(s) and their results.`);
