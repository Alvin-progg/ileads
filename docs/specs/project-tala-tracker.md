# Spec: Project TALA — Class Reading Intervention Tracker

**Status:** Draft for review
**Source:** SDO Batangas Division Memorandum No. 373, s. 2026 — *Launching and Implementation of TALA (Texts for Advanced Literacy and Achievement) under BATANGAN 2.0: Project TALAS-DUNONG*, Enclosures 1 and 2
**Reference form:** a Grade 4 Class Reading Intervention Tracker filled in by hand (September)

---

## 1. Summary

Add Project TALA to I-LEADS. Each month, the teacher fills in the **Class Reading Intervention Tracker** for her class. I-LEADS saves the raw scores and computes the reading profile, the intervention program and the monthly status.

```
Teacher encodes (WCPM, comprehension score, frequency)
        → saved to tala_results (one row per learner per month)
        → computed: Reading Profile → Intervention Program → Monthly Status
        → results: printable class tracker + class literacy dashboard (+ school summary for the head)
```

This follows the project's main rule: **raw scores go in and levels are computed out.** The teacher never types a profile or a program code.

## 2. Why computed, not typed

The paper form already shows the problem. Two of its six rows contradict the memo's own rules:

| Row | WCPM | Comp. | Written on paper | Correct per DM 373 | Issue |
|---|---|---|---|---|---|
| 2 | 100 | 5/10 | S-C- / **TALA-UNAWA** | S-C- / **TALA-SULONG** | Program code doesn't match the profile (UNAWA is for S+C-) |
| 4 | 110 | 8/10 | **S+C+** / TALA-HUSAY | **S-C+** / TALA-BILIS | 110 is below Grade 4's 115 WCPM benchmark |

Computing these values removes both kinds of error. **Open question Q1** is whether row 4 is a teacher error or a different local benchmark.

## 3. Scope

**In scope**
- Monthly per-learner entry grid for Grades 1–6.
- Computed Reading Profile, Intervention Program, Monthly Status and TALA 10 completion.
- Class tracker view, printable, laid out like the Enclosure 2 form.
- Class Literacy Dashboard: profile distribution, intervention summary, movement, Phil-IRI equivalent.
- School Reading Profile Summary for the head, by grade.
- A sidebar nav item called "TALA".

**Out of scope (later tickets)**
- Reading Passport (per-reading log of 10 readings: date, title, word count, WCPM, comp, teacher validation). This spec records **one monthly summary row per learner**, which is what the tracker form asks for.
- Monthly Reading Reflection, Year-End Achievement Report and Reader Awards.
- The .xlsx district export. No official blank template has been supplied yet, and the project rule is to fill official templates cell by cell.
- Showing TALA on the dashboard, the learner profile page and in the guided tour.
- Grades 7–10. The deployment schools stop at G6, and `scoring_rules` CHECKs grade 1–6.

## 4. Domain rules (from DM 373, Enclosure 1)

### 4.1 Speed (S): WCPM vs Minimum S+ Benchmark

S+ when `wcpm >= benchmark`, otherwise S-.

| Grade | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Min S+ WCPM | 45 | 75 | 95 | 115 | 125 | 140 |

### 4.2 Comprehension (C): correct answers out of the grade's questions

C+ when `correct >= plusAt`, otherwise C-.

| Grades | Questions | C+ | C- |
|---|---|---|---|
| 1–2 | 5 | 4–5 | 0–3 |
| 3 | 8 | 6–8 | 0–5 |
| 4–6 | 10 | 8–10 | 0–7 |

### 4.3 Profile → Intervention Program

The rows are listed lowest to highest. This order drives Monthly Status (§4.4).

| Order | Profile | Description | Program |
|---|---|---|---|
| 0 | S-C- | Struggling Reader | TALA-SULONG |
| 1 | S-C+ | Careful Reader | TALA-BILIS |
| 2 | S+C- | Word Caller | TALA-UNAWA |
| 3 | S+C+ | Independent / Advanced Reader | TALA-HUSAY |

The order matches the memo's *Class Reading Movement Tracker*: S-C- → S-C+ → S+C- → S+C+.

### 4.4 Monthly Status

The form leaves this column undefined (**Q2**). Proposed: compare this month's profile with the same learner's profile from the previous calendar month.

| Condition | Status |
|---|---|
| No profile this month | *(blank)* |
| No profile last month | First record |
| Higher in §4.3 order | Moved up |
| Same | Maintained |
| Lower | Moved down |

### 4.5 Frequency and TALA 10

The policy is "Ten Readings. Every Month. Every Learner." with 10 monitored readings per month. **Q3:** the form's "Frequency" column most likely means readings or sessions done this month; the sample shows 10 for every learner.

Proposed: Frequency is an integer from 0 to 31. A learner **completed TALA 10** when `frequency >= 10`.

### 4.6 Phil-IRI Equivalent Report (Enclosure 2)

| Phil-IRI category | Formula |
|---|---|
| Independent | S+C+ |
| Instructional | S+C- + S-C+ |
| Frustration | S-C- |

### 4.7 Rule placement

All of the numbers in §4.1–4.6 go into `scoring_rules` under `tool = 'tala'` with version `TALA-DM373s2026`, one row per grade 1–6. They are not hardcoded. Proposed jsonb shape:

```json
{
  "wcpmBenchmark": 115,
  "comprehension": { "items": 10, "plusAt": 8 },
  "profiles": [
    { "label": "S-C-", "speed": "-", "comprehension": "-", "description": "Struggling Reader",  "program": "TALA-SULONG" },
    { "label": "S-C+", "speed": "-", "comprehension": "+", "description": "Careful Reader",     "program": "TALA-BILIS"  },
    { "label": "S+C-", "speed": "+", "comprehension": "-", "description": "Word Caller",        "program": "TALA-UNAWA"  },
    { "label": "S+C+", "speed": "+", "comprehension": "+", "description": "Independent Reader", "program": "TALA-HUSAY"  }
  ],
  "readingsPerMonth": 10,
  "philiriEquivalent": [
    { "category": "Independent",   "profiles": ["S+C+"] },
    { "category": "Instructional", "profiles": ["S+C-", "S-C+"] },
    { "category": "Frustration",   "profiles": ["S-C-"] }
  ]
}
```

The source of truth is `lib/scoring/instruments.ts` (`TALA_G1`–`TALA_G6`). The seed migration is generated from it with `scripts/gen-scoring-rules-sql.mjs`. That script needs an optional tool filter (`… gen-scoring-rules-sql.mjs tala`) so it emits only the new rows.

## 5. Data model

### 5.1 Migration `<ts>_tala_module.sql`

```sql
-- allow the new instrument
alter table scoring_rules drop constraint if exists scoring_rules_tool_check;
alter table scoring_rules add constraint scoring_rules_tool_check
  check (tool in ('crla', 'rma', 'philiri', 'exam', 'tala'));

create table tala_results (
  id bigint generated always as identity primary key,
  learner_id uuid not null references learners (id),
  month date not null check (extract(day from month) = 1),  -- first of month
  wcpm int check (wcpm between 0 and 400),
  comprehension_correct int check (comprehension_correct >= 0),
  frequency int check (frequency between 0 and 31),
  remarks text,
  updated_at timestamptz not null default now(),
  unique (learner_id, month)
);
create index on tala_results (month);
alter table tala_results enable row level security;
```

**Design notes**
- **Monthly key, not `assessment_rounds`.** TALA runs every month. BOSY/MOY/EOSY and the `assessment_rounds.name` CHECK don't fit it.
- **Raw columns are nullable.** Autosave writes partial rows, and null means "not encoded" (not zero), as in the other `*_results` tables.
- **No profile/program column is stored.** These values are always computed.
- **`comprehension_correct <= items` is not a CHECK.** The item count lives in rules jsonb (5/8/10), so the server action enforces it, the same way exam score ≤ HPS works.
- **Unique key:** `tala(learner, month)`. Add this to CLAUDE.md's unique-keys list.

### 5.2 RLS

These policies have the same school-scoped shape as `philiri_results` in `20260912100100_rls_school_scope.sql`, scoped via `learners`:
- `head full access`: `is_head()` and the learner belongs to `my_school()`.
- `teacher scoped access`: the learner's `grade_level = any(teacher_grades())` and it belongs to `my_school()`.

### 5.3 Seed migration `<ts>_seed_scoring_rules_tala.sql`

Generated as described in §4.7.

## 6. Engine (`lib/scoring/`)

| Function | Signature | Behaviour |
|---|---|---|
| `computeTala` | `(input: {wcpm, comprehensionCorrect}, rules) → {speed, comprehension, profile, description, program}` | Each sign is reported as soon as its own input exists. Profile and program stay `null` until **both** inputs exist. |
| `computeTalaMovement` | `(prevProfile, currProfile, rules) → TalaMovement \| null` | Implements §4.4. |
| `completedTala10` | `(frequency, rules) → boolean` | Returns `frequency >= readingsPerMonth`. |
| `summariseTala` | `(entries, rules) → TalaSummary` | Counts and percentages per profile and program, movement counts, TALA 10 count and the Phil-IRI equivalent. Percentages are of **assessed** learners (full profile), not enrolled. If nobody is assessed, the result is `null`, not 0%. |

Add `getTalaRules()` with `TALA_VERSION` to `lib/scoring/load.ts`. Add `TALA_GRADES = [1..6]` to `lib/grades.ts`; it excludes Kinder.

## 7. UI

### 7.1 Entry grid: `/tala?grade=&month=YYYY-MM`

The grid is cloned from the Phil-IRI grid pattern: `useRowAutosave`, `useGuardedNav`, `handleColumnKeyDown`, localStorage draft recovery, failed/expired banners and a per-row status.

- **Pickers:** grade tabs (viewer's grades ∩ `TALA_GRADES`) and a month picker (prev ← `<input type="month">` → next). The default is the current month in Asia/Manila.
- **Columns:** these mirror the paper form.

| No. | Learner Name | **WCPM** | **Comp. Score** | Reading Profile | Intervention Program | **Frequency** | Monthly Status | Remarks | Save status |
|---|---|---|---|---|---|---|---|---|---|
| auto | roster | input | input (of N) | computed | computed | input | computed | input | autosave |

  - Each header shows its benchmark, for example "S+ ≥ 115" and "of 10 · C+ ≥ 8", so the teacher can see why a profile came out as it did.
  - Each profile has its own colour badge, and hovering it shows the description.
  - Hovering Monthly Status shows last month's profile.
- **Validation:** inputs are whole numbers. WCPM is 0–400, Comp is 0–items for the grade, Frequency is 0–31. An invalid row stays on screen and is not sent.
- **Link:** "Tracker & Dashboard →" goes to the class record page.

### 7.2 Server action: `saveTalaRow(learnerId, month, values)`

1. Validate that `month` matches `YYYY-MM`.
2. Load the learner's **actual** `grade_level`, without trusting the client. If RLS hides the learner, return the permission message.
3. Load that grade's rules and validate the ranges, including `comprehension_correct <= items`.
4. Upsert on `(learner_id, month)` and set `updated_at`. The upsert is idempotent, so autosave retries are safe.
5. Pass errors through `friendlyError`.

### 7.3 Results: `/tala/class-record?grade=&month=`

This page is printable (`PrintButton`, `no-print` pickers). It uses the same header block as the Phil-IRI class record: school, grade, teacher(s), month and date printed.

1. **Class Reading Intervention Tracker.** The form's columns, read-only, followed by the *Intervention Codes* legend.
2. **Class Literacy Dashboard.** Profile × Number × % with a total row, plus a *Class Intervention Summary* (program × no. of learners).
3. **Class Reading Movement.** Moved up, Maintained, Moved down and First record against the previous month.
4. **TALA 10 compliance.** The number of learners who completed TALA 10, out of those enrolled.
5. **Phil-IRI Equivalent Report** (§4.6).

Head only: a **School Reading Profile Summary** for the selected month, one row per grade 1–6. It shows enrolment, S+C+, S+C-, S-C+, S-C-, TALA 10 completion and a total row. This matches the *School Reading Intervention Tracker* and *School TALA 10 Compliance Report* pages of Enclosure 2.

### 7.4 Navigation

- Add a sidebar item **"TALA"**, shown when `showsFor(TALA_GRADES)`.
- Add a new `tala` icon (a star; *tala* means star).

## 8. Acceptance criteria

- [ ] A teacher assigned to Grade 4 opens `/tala` and sees only Grade 4 learners from her own school. The other grades and schools are blocked by RLS, not just hidden by the UI.
- [ ] Typing 55 / 4 shows **S-C- / TALA-SULONG**. Typing 115 / 8 shows **S+C+ / TALA-HUSAY**. Typing 110 / 8 shows **S-C+ / TALA-BILIS**.
- [ ] No profile shows until both WCPM and Comp are entered.
- [ ] Typing 11 for Comp in Grade 4 is flagged in the grid and is never saved. A forged request is rejected by the server action.
- [ ] Reloading mid-entry with the network off loses nothing (draft recovery). Switching month waits for pending saves.
- [ ] If a learner was S-C- in August and is S-C+ in September, September's Monthly Status reads "Moved up". A learner with no August row reads "First record".
- [ ] The class record percentages use assessed learners as the denominator. An empty class shows blanks, not 0%.
- [ ] The head's school summary totals across grades and matches the sum of the class dashboards.
- [ ] If the `scoring_rules` row is missing, the page shows a "not configured" message instead of crashing (via `tryGetRules`).

## 9. Tests (`lib/scoring/tala.test.ts`, run with `npm test`)

- The paper-form fixture: the six Grade 4 rows from §2, identified by row number only with no learner names, including the two corrected rows.
- Boundaries for every grade: `benchmark` is S+ and `benchmark − 1` is S-; `plusAt` is C+ and `plusAt − 1` is C-.
- All four profile → program mappings.
- A half-encoded row gives a `null` profile.
- Every branch of Monthly Status.
- TALA 10 at 9, at 10 and at null.
- `summariseTala` on the paper fixture plus one unencoded learner, checking counts, the assessed denominator and the Phil-IRI equivalent. An empty class gives null percentages.

## 10. Open questions for the client

| # | Question | Default if unanswered |
|---|---|---|
| Q1 | Row 4 (110 WCPM, 8/10, Grade 4) is written as S+C+, but the memo's benchmark is 115. Is this a teacher error, or does the school use a different benchmark? | Follow the memo (115 → S-C+) |
| Q2 | What should **Monthly Status** contain? It is blank on the sample. | Movement vs previous month (§4.4) |
| Q3 | Does **Frequency** mean readings done this month (TALA 10) or ARAL intervention sessions attended? | Readings done; ≥10 = TALA 10 complete |
| Q4 | Learners have no **section** in I-LEADS, but the form header says "Grade & Section: 4-Hope". Should a section be added to learners, or should the grade alone be printed? | Print the grade only |
| Q5 | The memo prioritises KS2 (G4–6) for SY 2026–27. Should G1–3 be hidden for now? | Show G1–6, since benchmarks exist for all |
| Q6 | Will the Division send an official .xlsx template for the monthly school report? | No export until a template arrives |

## 11. Implementation plan (files)

| File | Change |
|---|---|
| `supabase/migrations/<ts>_tala_module.sql` | §5.1–5.2 |
| `supabase/migrations/<ts>_seed_scoring_rules_tala.sql` | generated, §4.7 |
| `scripts/gen-scoring-rules-sql.mjs` | optional tool filter |
| `lib/scoring/types.ts` | `TalaRules`, `TalaInput`, `TalaResult`, `TalaMovement` |
| `lib/scoring/instruments.ts` | `TALA_G1`–`G6`, appended to `SEED_RULES` |
| `lib/scoring/tala.ts`, `tala-summary.ts`, `tala.test.ts` | §6, §9 |
| `lib/scoring/load.ts` | `getTalaRules`, `TALA_VERSION` |
| `lib/grades.ts` | `TALA_GRADES` |
| `lib/tala-month.ts` | month param parse/shift/label (Asia/Manila default) |
| `lib/tala-class.ts` | load a grade × month with previous-month profiles |
| `app/(authenticated)/tala/{page,tala-grid,actions}.tsx` | §7.1–7.2 |
| `app/(authenticated)/tala/class-record/page.tsx` | §7.3 |
| `app/(authenticated)/layout.tsx`, `sidebar.tsx` | §7.4 |
| `CLAUDE.md` | add TALA to Assessment domain and unique keys |
