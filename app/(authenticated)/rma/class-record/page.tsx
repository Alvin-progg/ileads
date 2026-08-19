import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { getGradeTeacherNames } from "@/lib/teachers";
import { SCHOOL, schoolDetailsIncomplete } from "@/lib/school";
import { getRmaRules, tryGetRules } from "@/lib/scoring/load.ts";
import { computeRma } from "@/lib/scoring/rma.ts";
import {
  summariseRma,
  type PercentRow,
  type RmaSummary,
  type Sex,
  type TallyRow,
} from "@/lib/scoring/rma-summary.ts";
import { PrintButton } from "../../print-button.tsx";

export const metadata = { title: "RMA Class Record — I-LEADS" };

/** Grades with an RMA instrument. Grades 4–6 use a different one. */
const RMA_GRADES = [1, 2, 3];

/** The three rows every tally is split into, in the workbook's order. */
const SEX_ROWS = [
  { key: "male", label: "Male" },
  { key: "female", label: "Female" },
  { key: "total", label: "Total" },
] as const;

type SexKey = (typeof SEX_ROWS)[number]["key"];

export default async function RmaClassRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; round?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const viewer = await getViewer();

  const available = RMA_GRADES.filter(
    (g) => viewer.isHead || viewer.allowedGrades.includes(g)
  );

  if (available.length === 0) {
    return (
      <Shell>
        <p className="text-neutral-600">
          RMA has only been set up for Grades 1–3 so far, and you are not
          assigned to any of them.
        </p>
      </Shell>
    );
  }

  const grade = available.includes(Number(params.grade))
    ? Number(params.grade)
    : available[0];

  const rules = await tryGetRules(() => getRmaRules(supabase, grade));

  if (!rules) {
    return (
      <Shell>
        <p className="text-neutral-600">
          RMA scoring rules for Grade {grade} have not been loaded into this
          database yet, so there is nothing to encode against.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          They live in <code className="font-mono">scoring_rules</code>; run the
          pending migration in{" "}
          <code className="font-mono">supabase/migrations</code> to seed them.
        </p>
      </Shell>
    );
  }

  const { data: rounds } = await supabase
    .from("assessment_rounds")
    .select("id, name, sequence")
    .eq("tool", "rma")
    .order("sequence");

  if (!rounds || rounds.length === 0) {
    return (
      <Shell>
        <p className="text-neutral-500">No RMA rounds have been set up yet.</p>
      </Shell>
    );
  }

  const round = rounds.find((r) => String(r.id) === params.round) ?? rounds[0];

  const { data: learners } = await supabase
    .from("learners")
    .select("id, lrn, last_name, first_name, middle_name, sex")
    .eq("grade_level", grade)
    .eq("status", "enrolled")
    .order("last_name")
    .order("first_name");

  const { data: results } = await supabase
    .from("rma_results")
    .select("learner_id, task_scores, remarks")
    .eq("round_id", round.id);

  const byLearner = new Map((results ?? []).map((r) => [r.learner_id, r]));

  const rows = (learners ?? []).map((learner, i) => {
    const raw = byLearner.get(learner.id);
    const scores = (raw?.task_scores ?? {}) as Record<string, number | null>;
    // Nothing encoded is not the same as a row of zeros: the record must show a
    // blank learner as blank, not as a zero-scoring one.
    const encoded = rules.tasks.some(
      (t) => typeof scores[t.key] === "number"
    );
    const computed = computeRma({ taskScores: scores }, rules);

    return {
      n: i + 1,
      learner,
      encoded,
      computed,
      remarks: raw?.remarks ?? null,
    };
  });

  const summary = summariseRma(
    rows.map((r) => ({
      sex: r.learner.sex as Sex,
      total: r.encoded ? r.computed.total : null,
      percent: r.encoded ? r.computed.percent : null,
      proficiencyLevel: r.encoded ? r.computed.proficiencyLevel : null,
      taskMastery: r.encoded ? r.computed.taskMastery : {},
    })),
    rules
  );

  const teacherNames = await getGradeTeacherNames(supabase, grade);
  const teachers =
    teacherNames.length > 0 ? teacherNames.join(", ") : viewer.fullName || "—";

  // rma_results has no date-of-assessment column, so the header carries the
  // date the form was printed — and says so, to avoid being read as one.
  const printedOn = new Date().toLocaleDateString("en-PH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const levelsConfigured = rules.levels.length > 0;

  return (
    <Shell>
      {/* Pickers — screen only; the print carries the header block instead. */}
      <div className="no-print mb-5 flex flex-wrap gap-6 text-[13px]">
        <PickerGroup label="Grade">
          {available.map((g) => (
            <PickerLink
              key={g}
              href={`/rma/class-record?grade=${g}&round=${round.id}`}
              active={g === grade}
            >
              {g}
            </PickerLink>
          ))}
        </PickerGroup>

        <PickerGroup label="Round">
          {rounds.map((r) => (
            <PickerLink
              key={r.id}
              href={`/rma/class-record?grade=${grade}&round=${r.id}`}
              active={r.id === round.id}
            >
              {r.name}
            </PickerLink>
          ))}
        </PickerGroup>

        <div className="ml-auto flex items-center gap-3">
          <Link href="/rma" className="text-emerald-700 hover:underline">
            ← Entry grid
          </Link>
          <PrintButton />
        </div>
      </div>

      {schoolDetailsIncomplete() && (
        <p className="no-print mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          School details are still placeholders. Fill them in{" "}
          <code className="font-mono">lib/school.ts</code> before submitting this
          form to the district.
        </p>
      )}

      {/* Printed header block. */}
      <header className="mb-4 break-inside-avoid border-b border-neutral-300 pb-3">
        <p className="text-center text-[11px] uppercase tracking-widest text-neutral-500">
          Republic of the Philippines · Department of Education
        </p>
        <h1 className="mt-1 text-center text-base font-bold">
          Grade {grade} Rapid Mathematics Assessment — Class Record
        </h1>
        <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-[12px] sm:grid-cols-3">
          <Field label="School" value={SCHOOL.name} />
          <Field label="School ID" value={SCHOOL.id} />
          <Field label="District" value={SCHOOL.district} />
          <Field label="Division" value={SCHOOL.division} />
          <Field label="Region" value={SCHOOL.region} />
          <Field label="School Year" value={SCHOOL.schoolYear} />
          <Field label="Grade" value={`Grade ${grade}`} />
          <Field label="Round" value={round.name} />
          <Field label="Teacher" value={teachers} />
          <Field
            label="Total Enrolment"
            value={`${summary.enrolledBySex.total} (M ${summary.enrolledBySex.male} · F ${summary.enrolledBySex.female})`}
          />
          <Field label="Total Assessed" value={String(summary.assessed)} />
          <Field label="Date Printed" value={printedOn} />
        </dl>
      </header>

      {!levelsConfigured && (
        <p className="mb-4 break-inside-avoid rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          Grade {grade}&apos;s proficiency cut-offs have not been issued to this
          school. Totals and percentages are computed; the Levelling of Learners
          column is left blank rather than scored against another grade&apos;s
          bands.
        </p>
      )}

      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-neutral-300 bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-600">
            <th className="px-2 py-1.5 text-right font-medium">S/N</th>
            <th className="px-2 py-1.5 text-left font-medium">LRN</th>
            <th className="px-2 py-1.5 text-left font-medium">Name of Learner</th>
            <th className="px-2 py-1.5 text-center font-medium">Sex</th>
            <th className="px-2 py-1.5 text-right font-medium">
              Total Score ({rules.max})
            </th>
            <th className="px-2 py-1.5 text-right font-medium">
              % of Correct Answer
            </th>
            <th className="px-2 py-1.5 text-left font-medium">
              Levelling of Learners
            </th>
            <th className="px-2 py-1.5 text-left font-medium">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ n, learner, encoded, computed, remarks }) => (
            <tr key={learner.id} className="border-b border-neutral-200">
              <td className="px-2 py-1 text-right tabular-nums text-neutral-500">
                {n}
              </td>
              <td className="px-2 py-1 font-mono text-[11px] text-neutral-600">
                {learner.lrn}
              </td>
              <td className="whitespace-nowrap px-2 py-1">
                {learner.last_name}, {learner.first_name}
                {learner.middle_name ? ` ${learner.middle_name[0]}.` : ""}
              </td>
              <td className="px-2 py-1 text-center">{learner.sex}</td>
              <td className="px-2 py-1 text-right tabular-nums">
                {encoded ? computed.total : ""}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {encoded && computed.percent !== null
                  ? `${(computed.percent * 100).toFixed(0)}%`
                  : ""}
              </td>
              <td className="whitespace-nowrap px-2 py-1">
                {!levelsConfigured
                  ? ""
                  : encoded
                    ? (computed.proficiencyLevel ?? "")
                    : ""}
              </td>
              <td className="px-2 py-1">{remarks ?? ""}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-2 py-8 text-center text-neutral-400">
                No enrolled learners in this grade.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <section className="mt-6 break-inside-avoid">
        <h2 className="mb-2 text-[13px] font-bold">Class Summary</h2>
        <p className="mb-3 text-[11px] text-neutral-500">
          {summary.enrolled} enrolled · {summary.assessed} assessed ·{" "}
          {summary.unscored.total} not yet assessed
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <TallyTable
            title="By Proficiency Level"
            heading="Level"
            rows={[...summary.levels, summary.unlevelled, summary.unscored]}
          />
          {summary.taskMastery.length > 0 ? (
            <TallyTable
              title="Learners scoring 75% or more, per task"
              heading="Task"
              rows={summary.taskMastery}
            />
          ) : (
            <p className="text-[12px] text-neutral-500">
              Per-task mastery needs each task&apos;s maximum, which Grade {grade}
              &apos;s scoresheet does not state. Raw scores are still recorded.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 break-inside-avoid">
        <h2 className="mb-2 text-[13px] font-bold">
          Class Summary — district form layout
        </h2>
        <div className="overflow-x-auto print:overflow-visible">
          <SummaryMatrix summary={summary} maxScore={rules.max} />
        </div>
      </section>

      {levelsConfigured && (
        <section className="mt-6 break-inside-avoid">
          <h2 className="mb-2 text-[13px] font-bold">Percent (%) of Learners</h2>
          <p className="mb-2 text-[11px] text-neutral-500">
            Each level as a share of the learners assessed in that row.
          </p>
          <div className="overflow-x-auto print:overflow-visible">
            <PercentMatrix summary={summary} />
          </div>
        </section>
      )}

      <footer className="mt-8 grid grid-cols-2 gap-12 break-inside-avoid text-[11px]">
        <SignatureLine label="Teacher" />
        <SignatureLine label="School Head" />
      </footer>
    </Shell>
  );
}

const pct = (v: number | null) => (v === null ? "" : `${(v * 100).toFixed(0)}%`);
const num = (v: number | null, digits = 0) => (v === null ? "" : v.toFixed(digits));

/** One row per sex: assessed, the level counts, per-task mastery, average. */
function SummaryMatrix({
  summary,
  maxScore,
}: {
  summary: RmaSummary;
  maxScore: number;
}) {
  const tasks = summary.taskMastery;

  return (
    <table className="summary-matrix w-full min-w-[720px] border-collapse text-[11px] print:min-w-0">
      <thead>
        <tr className="border-y border-neutral-300 bg-neutral-50 text-[9px] uppercase tracking-wide text-neutral-600">
          <th rowSpan={2} className="px-2 py-1 text-left font-medium">
            Sex
          </th>
          <th rowSpan={2} className="px-2 py-1 text-right font-medium">
            Enrolled
          </th>
          <th rowSpan={2} className="px-2 py-1 text-right font-medium">
            Assessed
          </th>
          <th
            colSpan={summary.levels.length + 1}
            className="border-x border-neutral-300 px-2 py-1 text-center font-medium"
          >
            Levelling of Learners
          </th>
          {tasks.length > 0 && (
            <th
              colSpan={tasks.length}
              className="border-r border-neutral-300 px-2 py-1 text-center font-medium"
            >
              Learners with score ≥ 75% per task
            </th>
          )}
          <th rowSpan={2} className="px-2 py-1 text-right font-medium">
            Overall Score Average (of {maxScore})
          </th>
        </tr>
        <tr className="border-b border-neutral-300 bg-neutral-50 text-[9px] uppercase tracking-wide text-neutral-600">
          {summary.levels.map((l, i) => (
            <th
              key={l.label}
              className={
                "px-2 py-1 text-right font-medium" +
                (i === 0 ? " border-l border-neutral-300" : "")
              }
            >
              {l.label}
            </th>
          ))}
          <th
            className={
              "px-2 py-1 text-right font-medium border-r border-neutral-300" +
              (summary.levels.length === 0 ? " border-l border-neutral-300" : "")
            }
          >
            {summary.unlevelled.label}
          </th>
          {tasks.map((t) => (
            <th key={t.label} className="px-2 py-1 text-right font-medium">
              {t.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {SEX_ROWS.map(({ key, label }) => (
          <tr
            key={key}
            className={
              "border-b border-neutral-200" + (key === "total" ? " font-medium" : "")
            }
          >
            <td className="px-2 py-1">{label}</td>
            <td className="px-2 py-1 text-right tabular-nums">
              {summary.enrolledBySex[key]}
            </td>
            <td className="px-2 py-1 text-right tabular-nums">
              {summary.assessedBySex[key]}
            </td>
            {summary.levels.map((l, i) => (
              <td
                key={l.label}
                className={
                  "px-2 py-1 text-right tabular-nums" +
                  (i === 0 ? " border-l border-neutral-200" : "")
                }
              >
                {l[key]}
              </td>
            ))}
            <td
              className={
                "px-2 py-1 text-right tabular-nums border-r border-neutral-200" +
                (summary.levels.length === 0 ? " border-l border-neutral-200" : "")
              }
            >
              {summary.unlevelled[key]}
            </td>
            {tasks.map((t) => (
              <td key={t.label} className="px-2 py-1 text-right tabular-nums">
                {t[key]}
              </td>
            ))}
            <td className="px-2 py-1 text-right tabular-nums">
              {num(summary.averageTotal[key], 2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The level counts again, each divided by that row's assessed learners. */
function PercentMatrix({ summary }: { summary: RmaSummary }) {
  const cell = (row: PercentRow, key: SexKey) => pct(row[key]);

  return (
    <table className="summary-matrix w-full min-w-[560px] border-collapse text-[11px] print:min-w-0">
      <thead>
        <tr className="border-y border-neutral-300 bg-neutral-50 text-[9px] uppercase tracking-wide text-neutral-600">
          <th className="px-2 py-1 text-left font-medium">Sex</th>
          <th className="px-2 py-1 text-right font-medium">
            Percent of Learners Assessed
          </th>
          {summary.percents.levels.map((l, i) => (
            <th
              key={l.label}
              className={
                "px-2 py-1 text-right font-medium" +
                (i === 0 ? " border-l border-neutral-300" : "")
              }
            >
              {l.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {SEX_ROWS.map(({ key, label }) => {
          const enrolled = summary.enrolledBySex[key];
          const assessed = summary.assessedBySex[key];
          return (
            <tr
              key={key}
              className={
                "border-b border-neutral-200" +
                (key === "total" ? " font-medium" : "")
              }
            >
              <td className="px-2 py-1">{label}</td>
              <td className="px-2 py-1 text-right tabular-nums">
                {enrolled === 0 ? "" : pct(assessed / enrolled)}
              </td>
              {summary.percents.levels.map((l, i) => (
                <td
                  key={l.label}
                  className={
                    "px-2 py-1 text-right tabular-nums" +
                    (i === 0 ? " border-l border-neutral-200" : "")
                  }
                >
                  {cell(l, key)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TallyTable({
  title,
  heading,
  rows,
}: {
  title: string;
  heading: string;
  rows: TallyRow[];
}) {
  const totals = rows.reduce(
    (acc, r) => ({
      male: acc.male + r.male,
      female: acc.female + r.female,
      total: acc.total + r.total,
    }),
    { male: 0, female: 0, total: 0 }
  );

  return (
    <table className="w-full border-collapse text-[12px]">
      <caption className="mb-1 text-left text-[11px] font-medium text-neutral-600">
        {title}
      </caption>
      <thead>
        <tr className="border-y border-neutral-300 bg-neutral-50 text-[10px] uppercase text-neutral-600">
          <th className="px-2 py-1 text-left font-medium">{heading}</th>
          <th className="w-12 px-2 py-1 text-right font-medium">M</th>
          <th className="w-12 px-2 py-1 text-right font-medium">F</th>
          <th className="w-14 px-2 py-1 text-right font-medium">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-neutral-200">
            <td className="px-2 py-1">{r.label}</td>
            <td className="px-2 py-1 text-right tabular-nums">{r.male}</td>
            <td className="px-2 py-1 text-right tabular-nums">{r.female}</td>
            <td className="px-2 py-1 text-right tabular-nums">{r.total}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-neutral-300 font-medium">
          <td className="px-2 py-1">Total</td>
          <td className="px-2 py-1 text-right tabular-nums">{totals.male}</td>
          <td className="px-2 py-1 text-right tabular-nums">{totals.female}</td>
          <td className="px-2 py-1 text-right tabular-nums">{totals.total}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-neutral-500">{label}:</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div className="mt-6 border-b border-neutral-400" />
      <p className="mt-1 text-neutral-500">{label}</p>
    </div>
  );
}

function PickerGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-neutral-500">{label}</span>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}

function PickerLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "rounded-md px-2.5 py-1 font-medium transition-colors " +
        (active
          ? "bg-emerald-600 text-white"
          : "text-neutral-600 hover:bg-neutral-100")
      }
    >
      {children}
    </Link>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[1100px] p-6 print:max-w-none print:p-0">
      {children}
    </main>
  );
}
