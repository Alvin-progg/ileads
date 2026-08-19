// Demo raw-score data for ticket #15.6 (dashboard charts) — fills in enough
// CRLA/RMA/Phil-IRI/Exam rows for the current round of each tool so the new
// Score Distribution charts have real bars to show instead of "not enough
// data yet". NOT idempotent-safe against re-seeding different levels (upserts
// on each table's unique constraint, so re-running just overwrites with the
// same values) — safe to re-run, but don't treat this as real data.
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
// Run: node scripts/seed-chart-demo.mjs
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

async function seed(label, table, rows, onConflict) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) {
    console.error(`✗ ${label}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`+ ${label}: ${rows.length} rows upserted`);
}

// ---------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------

async function roundId(tool, name) {
  const { data, error } = await supabase
    .from("assessment_rounds")
    .select("id")
    .eq("tool", tool)
    .eq("name", name)
    .single();
  if (error) throw new Error(`round ${tool}/${name}: ${error.message}`);
  return data.id;
}

async function enrolledLearners(grade) {
  const { data, error } = await supabase
    .from("learners")
    .select("id, lrn")
    .eq("grade_level", grade)
    .eq("status", "enrolled")
    .order("lrn");
  if (error) throw new Error(`learners grade ${grade}: ${error.message}`);
  return data;
}

const { data: learningAreasData, error: laError } = await supabase
  .from("learning_areas")
  .select("id, name, grade_level");
if (laError) throw new Error(`learning_areas: ${laError.message}`);

const crlaBosy = await roundId("crla", "BOSY");
const rmaBosy = await roundId("rma", "BOSY");
const philiriPre = await roundId("philiri", "Pre");
const examQ1 = await roundId("exam", "Q1");

// ---------------------------------------------------------------------
// CRLA — 8 learners per grade/language, 2 at each of the 4 levels.
// MT/FIL share the task1_branch model (branch at 7, +10 auto-credit);
// G3 ENG uses the sum model with its own bands.
// ---------------------------------------------------------------------

const MT_FIL_LEVEL_INPUTS = [
  { task1: 3, task2l: 3, task2h: null }, // Full Refresher (low, total 6)
  { task1: 6, task2l: 6, task2h: null }, // Moderate Refresher (low, total 12)
  { task1: 7, task2l: null, task2h: 0 }, // Light Refresher (high, total 17)
  { task1: 10, task2l: null, task2h: 10 }, // Grade Ready (high, total 30)
];

const ENG_LEVEL_INPUTS = [
  { task1: 0, task2l: 0, task2h: null }, // Full Refresher (zero override)
  { task1: 3, task2l: 3, task2h: null }, // Moderate Refresher (total 6)
  { task1: 6, task2l: 6, task2h: null }, // Light Refresher (total 12)
  { task1: 10, task2l: 10, task2h: null }, // Grade Ready (total 20)
];

function crlaRowsFor(learners, roundId, language, levelInputs) {
  return learners.map((learner, i) => {
    const level = levelInputs[Math.floor(i / 2) % levelInputs.length];
    return {
      learner_id: learner.id,
      round_id: roundId,
      language,
      task1: level.task1,
      task2l: level.task2l,
      task2h: level.task2h,
      story_no: 1,
      miscues: 2,
      reading_secs: 60,
      comprehension_correct: 3,
    };
  });
}

const CRLA_LANGUAGES = { 1: ["MT"], 2: ["MT", "FIL"], 3: ["MT", "FIL", "ENG"] };
let crlaRows = [];
for (const grade of [1, 2, 3]) {
  const learners = await enrolledLearners(grade);
  for (const language of CRLA_LANGUAGES[grade]) {
    const inputs = language === "ENG" ? ENG_LEVEL_INPUTS : MT_FIL_LEVEL_INPUTS;
    crlaRows = crlaRows.concat(crlaRowsFor(learners, crlaBosy, language, inputs));
  }
}
await seed("crla_results", "crla_results", crlaRows, "learner_id,round_id,language");

// ---------------------------------------------------------------------
// RMA — Grade 3 only (1/2 have no bands). 8 learners across the 5 bands.
// Tasks A-H max 2,1,2,3,3,2,3,4 (sum 20); fill greedily to hit a target total.
// ---------------------------------------------------------------------

const RMA_G3_TASK_MAX = { A: 2, B: 1, C: 2, D: 3, E: 3, F: 2, G: 3, H: 4 };
const RMA_LEVEL_TOTALS = [2, 3, 6, 8, 11, 13, 16, 19]; // one per learner, band order

function tasksSummingTo(total) {
  let remaining = total;
  const scores = {};
  for (const [key, max] of Object.entries(RMA_G3_TASK_MAX)) {
    const v = Math.min(max, remaining);
    scores[key] = v;
    remaining -= v;
  }
  return scores;
}

const g3Learners = await enrolledLearners(3);
const rmaRows = g3Learners.map((learner, i) => ({
  learner_id: learner.id,
  round_id: rmaBosy,
  task_scores: tasksSummingTo(RMA_LEVEL_TOTALS[i % RMA_LEVEL_TOTALS.length]),
}));
await seed("rma_results", "rma_results", rmaRows, "learner_id,round_id");

// ---------------------------------------------------------------------
// Phil-IRI — Grades 4-6, FIL+ENG, Pre round. 8 learners: 3 Independent,
// 3 Instructional, 2 Frustration, matched on both word reading and
// comprehension so the Overall Level lands cleanly on the intended band.
// ---------------------------------------------------------------------

const PHILIRI_BAND_INPUTS = [
  { wordCount: 100, miscues: 2, comprehensionItems: 10, comprehensionCorrect: 9 }, // Independent
  { wordCount: 100, miscues: 7, comprehensionItems: 10, comprehensionCorrect: 6 }, // Instructional
  { wordCount: 100, miscues: 15, comprehensionItems: 10, comprehensionCorrect: 4 }, // Frustration
];
const PHILIRI_BAND_COUNTS = [3, 3, 2]; // Independent, Instructional, Frustration

function philiriRowsFor(learners, roundId, language) {
  const bandForIndex = [];
  PHILIRI_BAND_COUNTS.forEach((count, bandIdx) => {
    for (let n = 0; n < count; n++) bandForIndex.push(bandIdx);
  });
  return learners.map((learner, i) => {
    const band = PHILIRI_BAND_INPUTS[bandForIndex[i % bandForIndex.length]];
    return {
      learner_id: learner.id,
      round_id: roundId,
      language,
      word_count: band.wordCount,
      miscues: band.miscues,
      comprehension_items: band.comprehensionItems,
      comprehension_correct: band.comprehensionCorrect,
    };
  });
}

let philiriRows = [];
for (const grade of [4, 5, 6]) {
  const learners = await enrolledLearners(grade);
  for (const language of ["FIL", "ENG"]) {
    philiriRows = philiriRows.concat(philiriRowsFor(learners, philiriPre, language));
  }
}
await seed("philiri_results", "philiri_results", philiriRows, "learner_id,round_id,language");

// ---------------------------------------------------------------------
// Exam — Q1, all grades/subjects. Alternate subjects between an above- and
// below-75%-mastery mean (HPS is the seeded placeholder of 50 per quarter),
// with small per-learner variation so the class isn't perfectly uniform.
// ---------------------------------------------------------------------

let examRows = [];
for (const grade of [1, 2, 3, 4, 5, 6]) {
  const learners = await enrolledLearners(grade);
  const subjects = learningAreasData.filter((a) => a.grade_level === grade);
  subjects.forEach((subject, subjectIdx) => {
    const hps = 50;
    const baseMean = subjectIdx % 2 === 0 ? hps * 0.9 : hps * 0.6; // above / below 75%
    learners.forEach((learner, i) => {
      const wobble = ((i % 3) - 1) * 2; // -2, 0, +2
      const score = Math.max(0, Math.min(hps, Math.round(baseMean + wobble)));
      examRows.push({
        learner_id: learner.id,
        round_id: examQ1,
        learning_area_id: subject.id,
        score,
      });
    });
  });
}
await seed("exam_results", "exam_results", examRows, "learner_id,round_id,learning_area_id");

console.log("\nDone.");
