// Dummy prototype data: assessment rounds, MATATAG learning areas per
// grade, and ~10 learners per grade K-6. Idempotent (upserts on each
// table's real unique constraint) — safe to re-run.
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (dashboard: Settings → API).
// Run: node scripts/seed-data.mjs
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

// ---------------------------------------------------------------------
// assessment_rounds
// ---------------------------------------------------------------------
const ROUNDS = [
  { tool: "crla", name: "BOSY", sequence: 1 },
  { tool: "crla", name: "MOY", sequence: 2 },
  { tool: "crla", name: "EOSY", sequence: 3 },
  { tool: "rma", name: "BOSY", sequence: 1 },
  { tool: "rma", name: "MOY", sequence: 2 },
  { tool: "rma", name: "EOSY", sequence: 3 },
  { tool: "philiri", name: "Pre", sequence: 1 },
  { tool: "philiri", name: "Post", sequence: 2 },
  { tool: "exam", name: "Q1", sequence: 1 },
  { tool: "exam", name: "Q2", sequence: 2 },
  { tool: "exam", name: "Q3", sequence: 3 },
  { tool: "exam", name: "Q4", sequence: 4 },
];

// ---------------------------------------------------------------------
// learning_areas — MATATAG-plausible split; Science starts Grade 3,
// EPP starts Grade 4. hps_per_quarter is a placeholder, not real DepEd
// figures — actual HPS belongs to a later ticket.
// ---------------------------------------------------------------------
const CORE_K2 = [
  "GMRC",
  "English Reading & Literacy",
  "Filipino Language",
  "Mathematics",
  "Makabansa",
  "Music & Arts",
  "PE & Health",
];
const CORE_G3 = [...CORE_K2, "Science"];
const CORE_G4_6 = [
  "GMRC",
  "English Reading & Literacy",
  "Filipino Language",
  "Mathematics",
  "Science",
  "Makabansa",
  "EPP",
  "Music & Arts",
  "PE & Health",
];

function subjectsFor(grade) {
  if (grade <= 2) return CORE_K2;
  if (grade === 3) return CORE_G3;
  return CORE_G4_6;
}

const HPS_PLACEHOLDER = { Q1: 50, Q2: 50, Q3: 50, Q4: 50 };

const LEARNING_AREAS = [];
for (let grade = 0; grade <= 6; grade++) {
  subjectsFor(grade).forEach((name, i) => {
    LEARNING_AREAS.push({
      name,
      grade_level: grade,
      hps_per_quarter: HPS_PLACEHOLDER,
      sequence: i + 1,
    });
  });
}

// ---------------------------------------------------------------------
// learners — 10 per grade K-6, deterministic (no Math.random, so a
// second run produces identical rows). Fake 12-digit LRN scheme:
// "9" + grade digit (0-6) + 2-digit sequence + 8 zero-pad digits.
// ---------------------------------------------------------------------
const SURNAMES = [
  "Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Mendoza", "Torres",
  "Flores", "Ramos", "Aquino", "Villanueva", "Fernandez", "Gonzales",
  "Rivera", "Salazar", "Castillo", "Domingo", "Pascual", "Navarro", "Del Rosario",
];
const MALE_NAMES = [
  "Juan", "Jose", "Miguel", "Antonio", "Carlos", "Rafael", "Diego",
  "Gabriel", "Andres", "Francisco",
];
const FEMALE_NAMES = [
  "Maria", "Ana", "Rosa", "Elena", "Carmen", "Isabel", "Teresa",
  "Josefa", "Luz", "Angelica",
];

function lrnFor(grade, seq) {
  return `9${grade}${String(seq).padStart(2, "0")}00000000`;
}

function birthdateFor(grade, seq) {
  // typical age-for-grade: K~5, G1~6 ... G6~11, +/- a year alternating by seq
  const baseAge = 5 + grade;
  const age = baseAge + (seq % 2 === 0 ? 0 : 1);
  const year = 2026 - age;
  const month = String(1 + (seq % 12)).padStart(2, "0");
  const day = String(1 + ((seq * 7) % 28)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const LEARNERS = [];
for (let grade = 0; grade <= 6; grade++) {
  for (let seq = 0; seq < 10; seq++) {
    const isFemale = seq % 2 === 0;
    const surname = SURNAMES[(grade * 3 + seq) % SURNAMES.length];
    const firstName = (isFemale ? FEMALE_NAMES : MALE_NAMES)[
      (grade * 2 + seq) % (isFemale ? FEMALE_NAMES.length : MALE_NAMES.length)
    ];
    // 8 enrolled, 1 transferred, 1 dropped per grade
    const status = seq === 8 ? "transferred" : seq === 9 ? "dropped" : "enrolled";

    LEARNERS.push({
      lrn: lrnFor(grade, seq),
      last_name: surname,
      first_name: firstName,
      middle_name: SURNAMES[(grade + seq + 5) % SURNAMES.length],
      ext_name: null,
      sex: isFemale ? "F" : "M",
      birthdate: birthdateFor(grade, seq),
      grade_level: grade,
      status,
    });
  }
}

// ---------------------------------------------------------------------
async function seed(label, table, rows, onConflict) {
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) {
    console.error(`✗ ${label}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`+ ${label}: ${rows.length} rows upserted`);
}

await seed("assessment_rounds", "assessment_rounds", ROUNDS, "tool,name");
await seed("learning_areas", "learning_areas", LEARNING_AREAS, "name,grade_level");
await seed("learners", "learners", LEARNERS, "lrn");

console.log(`\nDone: ${ROUNDS.length} rounds, ${LEARNING_AREAS.length} learning areas, ${LEARNERS.length} learners.`);
