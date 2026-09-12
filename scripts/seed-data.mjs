// Dummy prototype data: assessment rounds (global), MATATAG learning areas
// per grade per school, and ~10 learners per grade K-6 per school.
// Idempotent (upserts on each table's real unique constraint) — safe to
// re-run.
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

// Same three DepEd school_ids as scripts/seed-auth.mjs and the schools_table
// migration. schoolIndex (1-3) is a single digit folded into each school's
// learners' LRN so all three schools' fake LRNs stay globally unique without
// growing past the 12-digit format (see lrnFor below). Keep this array's
// order in sync with scripts/purge-demo-data.mjs's LRN regex.
const SCHOOL_DEPED_IDS = [107460, 107461, 999999];

// ---------------------------------------------------------------------
// assessment_rounds — global, DepEd instrument definitions, not per-school.
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
// figures — actual HPS belongs to a later ticket. One set per school.
// ---------------------------------------------------------------------
const CORE_G1_2 = [
  "GMRC",
  "English Reading & Literacy",
  "Filipino Language",
  "Mathematics",
  "Makabansa",
  "Music & Arts",
  "PE & Health",
];
const CORE_G3 = [...CORE_G1_2, "Science"];
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
  if (grade <= 2) return CORE_G1_2;
  if (grade === 3) return CORE_G3;
  return CORE_G4_6;
}

const HPS_PLACEHOLDER = { Q1: 50, Q2: 50, Q3: 50, Q4: 50 };

function learningAreasFor(schoolId) {
  const rows = [];
  for (let grade = 1; grade <= 6; grade++) {
    subjectsFor(grade).forEach((name, i) => {
      rows.push({
        school_id: schoolId,
        name,
        grade_level: grade,
        hps_per_quarter: HPS_PLACEHOLDER,
        sequence: i + 1,
      });
    });
  }
  return rows;
}

// ---------------------------------------------------------------------
// learners — 10 per grade K-6 per school, deterministic (no Math.random,
// so a second run produces identical rows). Fake 12-digit LRN scheme:
// school index (1-3) + grade digit (0-6, 0 = Kindergarten) + 2-digit
// sequence + 8 zero-pad digits.
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

function lrnFor(schoolIndex, grade, seq) {
  return `${schoolIndex}${grade}${String(seq).padStart(2, "0")}00000000`;
}

function birthdateFor(grade, seq) {
  // typical age-for-grade: G1~6 ... G6~11, +/- a year alternating by seq
  const baseAge = 5 + grade;
  const age = baseAge + (seq % 2 === 0 ? 0 : 1);
  const year = 2026 - age;
  const month = String(1 + (seq % 12)).padStart(2, "0");
  const day = String(1 + ((seq * 7) % 28)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function learnersFor(schoolId, schoolIndex) {
  const rows = [];
  // Starts at 0: Kindergarten is roster-only, so it gets learners but NOT
  // learning areas (learningAreasFor stays at 1-6, and the learning_areas
  // CHECK still rejects grade 0).
  for (let grade = 0; grade <= 6; grade++) {
    for (let seq = 0; seq < 10; seq++) {
      const isFemale = seq % 2 === 0;
      const surname = SURNAMES[(grade * 3 + seq) % SURNAMES.length];
      const firstName = (isFemale ? FEMALE_NAMES : MALE_NAMES)[
        (grade * 2 + seq) % (isFemale ? FEMALE_NAMES.length : MALE_NAMES.length)
      ];
      // 8 enrolled, 1 transferred, 1 dropped per grade
      const status = seq === 8 ? "transferred" : seq === 9 ? "dropped" : "enrolled";

      rows.push({
        school_id: schoolId,
        lrn: lrnFor(schoolIndex, grade, seq),
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
  return rows;
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

let totalLearningAreas = 0;
let totalLearners = 0;

for (let i = 0; i < SCHOOL_DEPED_IDS.length; i++) {
  const schoolDepedId = SCHOOL_DEPED_IDS[i];
  const schoolIndex = i + 1; // 1-3, folded into LRNs -- see lrnFor

  const { data: schoolRow, error: schoolErr } = await supabase
    .from("schools")
    .select("id, name")
    .eq("school_id", schoolDepedId)
    .single();

  if (schoolErr || !schoolRow) {
    console.error(
      `✗ no schools row for DepEd school_id ${schoolDepedId} -- run the schools_table migration first`
    );
    process.exitCode = 1;
    continue;
  }

  console.log(`\n== ${schoolRow.name} (school_id ${schoolRow.id}) ==`);

  const learningAreas = learningAreasFor(schoolRow.id);
  const learners = learnersFor(schoolRow.id, schoolIndex);

  await seed("learning_areas", "learning_areas", learningAreas, "school_id,name,grade_level");
  await seed("learners", "learners", learners, "lrn");

  totalLearningAreas += learningAreas.length;
  totalLearners += learners.length;
}

console.log(
  `\nDone: ${ROUNDS.length} rounds, ${totalLearningAreas} learning areas, ${totalLearners} learners across ${SCHOOL_DEPED_IDS.length} schools.`
);
