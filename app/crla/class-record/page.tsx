import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { gradeLabel } from "@/lib/grades";
import { SCHOOL, schoolDetailsIncomplete } from "@/lib/school";
import { getCrlaRules } from "@/lib/scoring/load.ts";
import { toClassRecordRow } from "@/lib/scoring/class-record.ts";
import { summarise, type Sex, type TallyRow } from "@/lib/scoring/class-summary.ts";

export const metadata = { title: "CRLA Class Record — I-LEADS" };

/** Grades with a CRLA instrument. */
const CRLA_GRADES = [1, 2, 3];

export default async function ClassRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; language?: string; round?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const viewer = await getViewer();

  const available = CRLA_GRADES.filter(
    (g) => viewer.isHead || viewer.allowedGrades.includes(g)
  );

  if (available.length === 0) {
    return (
      <Shell>
        <p className="text-neutral-600">
          You are not assigned to any grade with a CRLA assessment (Grades 1–3).
        </p>
      </Shell>
    );
  }

  const grade = available.includes(Number(params.grade))
    ? Number(params.grade)
    : available[0];

  const rules = await getCrlaRules(supabase, grade);
  const languages = Object.keys(rules.languages);
  const language = languages.includes(params.language ?? "")
    ? params.language!
    : languages[0];

  const { data: rounds } = await supabase
    .from("assessment_rounds")
    .select("id, name, sequence")
    .eq("tool", "crla")
    .order("sequence");

  if (!rounds || rounds.length === 0) {
    return (
      <Shell>
        <p className="text-neutral-500">No CRLA rounds have been set up yet.</p>
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
    .from("crla_results")
    .select(
      "learner_id, task1, task2l, task2h, story_no, miscues, reading_secs, comprehension_correct, remarks"
    )
    .eq("round_id", round.id)
    .eq("language", language);

  const byLearner = new Map((results ?? []).map((r) => [r.learner_id, r]));

  const rows = (learners ?? []).map((learner, i) => {
    const raw = byLearner.get(learner.id);
    const record = toClassRecordRow(
      {
        task1: raw?.task1 ?? null,
        task2Low: raw?.task2l ?? null,
        task2High: raw?.task2h ?? null,
        storyNo: raw?.story_no ?? null,
        miscues: raw?.miscues ?? null,
        readingSeconds: raw?.reading_secs ?? null,
        comprehensionCorrect: raw?.comprehension_correct ?? null,
      },
      rules,
      language
    );
    return { n: i + 1, learner, record, remarks: raw?.remarks ?? null };
  });

  const summary = summarise(
    rows.map((r) => ({
      sex: r.learner.sex as Sex,
      readingLevel: r.record.readingLevel,
      readingProfile: r.record.readingProfile,
    })),
    rules,
    language
  );

  const pct = (v: number | null) => (v === null ? "" : `${(v * 100).toFixed(0)}%`);
  const num = (v: number | null, digits = 0) =>
    v === null ? "" : v.toFixed(digits);

  return (
    <Shell>
      {/* Pickers — screen only; the print carries the header block instead. */}
      <div className="no-print mb-5 flex flex-wrap gap-6 text-[13px]">
        <PickerGroup label="Grade">
          {available.map((g) => (
            <PickerLink
              key={g}
              href={`/crla/class-record?grade=${g}&round=${round.id}`}
              active={g === grade}
            >
              {gradeLabel(g)}
            </PickerLink>
          ))}
        </PickerGroup>

        <PickerGroup label="Language">
          {languages.map((l) => (
            <PickerLink
              key={l}
              href={`/crla/class-record?grade=${grade}&language=${l}&round=${round.id}`}
              active={l === language}
            >
              {l}
            </PickerLink>
          ))}
        </PickerGroup>

        <PickerGroup label="Round">
          {rounds.map((r) => (
            <PickerLink
              key={r.id}
              href={`/crla/class-record?grade=${grade}&language=${language}&round=${r.id}`}
              active={r.id === round.id}
            >
              {r.name}
            </PickerLink>
          ))}
        </PickerGroup>

        <div className="ml-auto flex items-center gap-3">
          <Link href="/crla" className="text-emerald-700 hover:underline">
            ← Entry grid
          </Link>
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
      <header className="mb-4 border-b border-neutral-300 pb-3">
        <p className="text-center text-[11px] uppercase tracking-widest text-neutral-500">
          Republic of the Philippines · Department of Education
        </p>
        <h1 className="mt-1 text-center text-base font-bold">
          CRLA Class Record
        </h1>
        <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-[12px] sm:grid-cols-3">
          <Field label="School" value={SCHOOL.name} />
          <Field label="School ID" value={SCHOOL.id} />
          <Field label="District" value={SCHOOL.district} />
          <Field label="Division" value={SCHOOL.division} />
          <Field label="Region" value={SCHOOL.region} />
          <Field label="School Year" value={SCHOOL.schoolYear} />
          <Field label="Grade" value={gradeLabel(grade)} />
          <Field label="Language" value={language} />
          <Field label="Round" value={round.name} />
        </dl>
      </header>

      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-neutral-300 bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-600">
            <th className="px-2 py-1.5 text-right font-medium">S/N</th>
            <th className="px-2 py-1.5 text-left font-medium">LRN</th>
            <th className="px-2 py-1.5 text-left font-medium">Name of Learner</th>
            <th className="px-2 py-1.5 text-center font-medium">Sex</th>
            <th className="px-2 py-1.5 text-left font-medium">Part 1 Reading Level</th>
            <th className="px-2 py-1.5 text-right font-medium">% Score</th>
            <th className="px-2 py-1.5 text-right font-medium">Fluency</th>
            <th className="px-2 py-1.5 text-right font-medium">Compr.</th>
            <th className="px-2 py-1.5 text-right font-medium">WPM</th>
            <th className="px-2 py-1.5 text-left font-medium">Reading Profile</th>
            <th className="px-2 py-1.5 text-left font-medium">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ n, learner, record, remarks }) => (
            <tr key={learner.id} className="border-b border-neutral-200">
              <td className="px-2 py-1 text-right tabular-nums text-neutral-500">{n}</td>
              <td className="px-2 py-1 font-mono text-[11px] text-neutral-600">
                {learner.lrn}
              </td>
              <td className="whitespace-nowrap px-2 py-1">
                {learner.last_name}, {learner.first_name}
                {learner.middle_name ? ` ${learner.middle_name[0]}.` : ""}
              </td>
              <td className="px-2 py-1 text-center">{learner.sex}</td>
              <td className="whitespace-nowrap px-2 py-1">
                {record.readingLevel ?? ""}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {pct(record.percentScore)}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {pct(record.fluency)}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {pct(record.comprehensionPercent)}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {num(record.wpm, 1)}
              </td>
              <td className="whitespace-nowrap px-2 py-1">
                {record.readingProfile ?? ""}
              </td>
              <td className="px-2 py-1">{remarks ?? ""}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={11} className="px-2 py-8 text-center text-neutral-400">
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
          <TallyTable title="By Reading Level" rows={summary.levels} extra={summary.unscored} />
          <TallyTable title="By Reading Profile" rows={summary.profiles} />
        </div>
      </section>

      <footer className="mt-8 grid grid-cols-2 gap-12 text-[11px]">
        <SignatureLine label="Teacher" />
        <SignatureLine label="School Head" />
      </footer>
    </Shell>
  );
}

function TallyTable({
  title,
  rows,
  extra,
}: {
  title: string;
  rows: TallyRow[];
  extra?: TallyRow;
}) {
  const all = extra ? [...rows, extra] : rows;
  const totals = all.reduce(
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
          <th className="px-2 py-1 text-left font-medium">Level</th>
          <th className="w-12 px-2 py-1 text-right font-medium">M</th>
          <th className="w-12 px-2 py-1 text-right font-medium">F</th>
          <th className="w-14 px-2 py-1 text-right font-medium">Total</th>
        </tr>
      </thead>
      <tbody>
        {all.map((r) => (
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
  return <main className="mx-auto max-w-[1100px] p-6 print:max-w-none print:p-0">{children}</main>;
}
