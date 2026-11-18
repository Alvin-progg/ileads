import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { getGradeTeacherNames } from "@/lib/teachers";
import { TALA_GRADES } from "@/lib/grades";
import { resolveSchool, schoolDetailsIncomplete } from "@/lib/school";
import { getTalaRules, tryGetRules } from "@/lib/scoring/load.ts";
import { computeTala, computeTalaMovement } from "@/lib/scoring/tala.ts";
import { summariseTala, type TalaCount } from "@/lib/scoring/tala-summary.ts";
import type { TalaRules } from "@/lib/scoring/types.ts";
import { currentMonth, isMonthParam, monthLabel, shiftMonth } from "@/lib/tala-month";
import { loadTalaClass } from "@/lib/tala-class";
import { PrintButton } from "../../print-button.tsx";

export const metadata = { title: "TALA Class Record — I-LEADS" };

const pct = (v: number | null) => (v === null ? "" : `${(v * 100).toFixed(0)}%`);

async function loadGrade(
  supabase: Awaited<ReturnType<typeof createClient>>,
  grade: number,
  month: string,
  rules: TalaRules
) {
  const { learners, values, prevProfiles } = await loadTalaClass(supabase, grade, month, rules);
  const rows = learners.map((learner, i) => {
    const v = values[learner.id];
    const computed = computeTala(
      { wcpm: v?.wcpm ?? null, comprehensionCorrect: v?.comprehension_correct ?? null },
      rules
    );
    return {
      n: i + 1,
      learner,
      v,
      computed,
      movement: computeTalaMovement(prevProfiles[learner.id] ?? null, computed.profile, rules),
      frequency: v?.frequency ?? null,
    };
  });
  const summary = summariseTala(
    rows.map((r) => ({ profile: r.computed.profile, movement: r.movement, frequency: r.frequency })),
    rules
  );
  return { rows, summary };
}

export default async function TalaClassRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; month?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const viewer = await getViewer();
  const school = resolveSchool(viewer.school);

  const available = TALA_GRADES.filter(
    (g) => viewer.isHead || viewer.allowedGrades.includes(g)
  );
  if (available.length === 0) {
    return (
      <Shell>
        <p className="text-neutral-600">
          You are not assigned to any grade with a TALA tracker (Grades 1–6).
        </p>
      </Shell>
    );
  }

  const grade = available.includes(Number(params.grade)) ? Number(params.grade) : available[0];
  const month = isMonthParam(params.month) ? params.month : currentMonth();

  const rules = await tryGetRules(() => getTalaRules(supabase, grade));
  if (!rules) {
    return (
      <Shell>
        <p className="text-neutral-600">
          TALA scoring rules for Grade {grade} are not configured in this
          database yet.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Run the pending migrations in{" "}
          <code className="font-mono">supabase/migrations</code> to seed them.
        </p>
      </Shell>
    );
  }

  const { rows, summary } = await loadGrade(supabase, grade, month, rules);

  // Head only: one row per grade for the selected month.
  const schoolRows = viewer.isHead
    ? await Promise.all(
        TALA_GRADES.map(async (g) => {
          const r = await tryGetRules(() => getTalaRules(supabase, g));
          return { grade: g, summary: r ? (await loadGrade(supabase, g, month, r)).summary : null };
        })
      )
    : [];

  const teacherNames = await getGradeTeacherNames(supabase, grade);
  const teachers = teacherNames.length > 0 ? teacherNames.join(", ") : viewer.fullName || "—";
  const printedOn = new Date().toLocaleDateString("en-PH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const href = (g: number, m: string) => `/tala/class-record?grade=${g}&month=${m}`;
  const countOf = (list: TalaCount[], label: string) => list.find((c) => c.label === label);

  return (
    <Shell>
      <div className="no-print mb-5 flex flex-wrap items-center gap-6 text-[13px]">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Grade</span>
          <div className="flex gap-1">
            {available.map((g) => (
              <PickerLink key={g} href={href(g, month)} active={g === grade}>
                {g}
              </PickerLink>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={href(grade, shiftMonth(month, -1))} aria-label="Previous month" className="rounded border border-neutral-300 px-2 py-0.5">
            ←
          </Link>
          <span className="font-medium">{monthLabel(month)}</span>
          <Link href={href(grade, shiftMonth(month, 1))} aria-label="Next month" className="rounded border border-neutral-300 px-2 py-0.5">
            →
          </Link>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link href={`/tala?grade=${grade}&month=${month}`} className="text-emerald-700 hover:underline">
            ← Entry grid
          </Link>
          <PrintButton />
        </div>
      </div>

      {schoolDetailsIncomplete(viewer.school) && (
        <p className="no-print mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          School details are still placeholders. Fill them in{" "}
          <code className="font-mono">lib/school.ts</code> before submitting this form to the district.
        </p>
      )}

      <header className="mb-4 break-inside-avoid border-b border-neutral-300 pb-3">
        <p className="text-center text-[11px] uppercase tracking-widest text-neutral-500">
          Republic of the Philippines · Department of Education
        </p>
        <h1 className="mt-1 text-center text-base font-bold">
          Grade {grade} Project TALA — Class Reading Intervention Tracker
        </h1>
        <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-[12px] sm:grid-cols-3">
          <Field label="School" value={school.name} />
          <Field label="School ID" value={school.id} />
          <Field label="District" value={school.district} />
          <Field label="Division" value={school.division} />
          <Field label="Region" value={school.region} />
          <Field label="School Year" value={school.schoolYear} />
          <Field label="Grade" value={`Grade ${grade}`} />
          <Field label="Month" value={monthLabel(month)} />
          <Field label="Teacher" value={teachers} />
          <Field label="Total Enrolment" value={String(summary.enrolled)} />
          <Field label="Total Assessed" value={String(summary.assessed)} />
          <Field label="Date Printed" value={printedOn} />
        </dl>
      </header>

      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-neutral-300 bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-600">
            {["No.", "Name of Learner", "WCPM", "Comp. Score", "Reading Profile", "Intervention Program", "Frequency", "Monthly Status", "Remarks"].map(
              (h) => (
                <th key={h} className="px-2 py-1.5 text-left font-medium">
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ n, learner, v, computed, movement }) => (
            <tr key={learner.id} className="border-b border-neutral-200">
              <td className="px-2 py-1 tabular-nums text-neutral-500">{n}</td>
              <td className="whitespace-nowrap px-2 py-1">
                {learner.last_name}, {learner.first_name}
                {learner.middle_name ? ` ${learner.middle_name.charAt(0)}.` : ""}
              </td>
              <td className="px-2 py-1 tabular-nums">{v?.wcpm ?? ""}</td>
              <td className="px-2 py-1 tabular-nums">
                {v?.comprehension_correct ?? ""}
                {v?.comprehension_correct != null ? `/${rules.comprehension.items}` : ""}
              </td>
              <td className="px-2 py-1">{computed.profile ?? ""}</td>
              <td className="px-2 py-1">{computed.program ?? ""}</td>
              <td className="px-2 py-1 tabular-nums">{v?.frequency ?? ""}</td>
              <td className="px-2 py-1">{movement ?? ""}</td>
              <td className="px-2 py-1">{v?.remarks ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-3 break-inside-avoid text-[11px] text-neutral-600">
        <h2 className="font-semibold">Intervention Codes</h2>
        <ul className="mt-1 grid grid-cols-2 gap-x-6">
          {rules.profiles.map((p) => (
            <li key={p.label}>
              <strong>{p.program}</strong> — {p.label} {p.description}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 print:grid-cols-2">
        <Block title="Class Literacy Dashboard">
          <CountTable head={["Reading Profile", "Number", "%"]} rows={summary.profiles} total={summary.assessed} />
        </Block>
        <Block title="Class Intervention Summary">
          <CountTable head={["Program", "No. of Learners", "%"]} rows={summary.programs} total={summary.assessed} />
        </Block>
        <Block title="Class Reading Movement (vs previous month)">
          <table className="w-full text-[12px]">
            <tbody>
              {summary.movements.map((m) => (
                <tr key={m.label} className="border-b border-neutral-200">
                  <td className="px-2 py-1">{m.label}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
        <Block title="TALA 10 Compliance">
          <p className="px-2 text-[12px]">
            <strong>{summary.tala10}</strong> of {summary.enrolled} enrolled learners completed TALA 10
            ({rules.readingsPerMonth} readings).
          </p>
        </Block>
        <Block title="Phil-IRI Equivalent Report">
          <CountTable head={["Category", "Number", "%"]} rows={summary.philiriEquivalent} total={summary.assessed} />
        </Block>
      </div>

      {viewer.isHead && (
        <Block title={`School Reading Profile Summary — ${monthLabel(month)}`} className="mt-8">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-y border-neutral-300 bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-600">
                {["Grade", "Enrolment", "Assessed", "S+C+", "S+C-", "S-C+", "S-C-", "TALA 10"].map((h) => (
                  <th key={h} className="px-2 py-1.5 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schoolRows.map(({ grade: g, summary: s }) => (
                <tr key={g} className="border-b border-neutral-200">
                  <td className="px-2 py-1">Grade {g}</td>
                  {s ? (
                    <>
                      <td className="px-2 py-1 tabular-nums">{s.enrolled}</td>
                      <td className="px-2 py-1 tabular-nums">{s.assessed}</td>
                      {["S+C+", "S+C-", "S-C+", "S-C-"].map((p) => (
                        <td key={p} className="px-2 py-1 tabular-nums">{countOf(s.profiles, p)?.count}</td>
                      ))}
                      <td className="px-2 py-1 tabular-nums">{s.tala10}</td>
                    </>
                  ) : (
                    <td colSpan={7} className="px-2 py-1 text-neutral-400">not configured</td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-400 font-semibold">
                <td className="px-2 py-1">Total</td>
                {(() => {
                  const sums = schoolRows.flatMap((r) => (r.summary ? [r.summary] : []));
                  const add = (f: (s: (typeof sums)[number]) => number) =>
                    sums.reduce((t, s) => t + f(s), 0);
                  return (
                    <>
                      <td className="px-2 py-1 tabular-nums">{add((s) => s.enrolled)}</td>
                      <td className="px-2 py-1 tabular-nums">{add((s) => s.assessed)}</td>
                      {["S+C+", "S+C-", "S-C+", "S-C-"].map((p) => (
                        <td key={p} className="px-2 py-1 tabular-nums">
                          {add((s) => countOf(s.profiles, p)?.count ?? 0)}
                        </td>
                      ))}
                      <td className="px-2 py-1 tabular-nums">{add((s) => s.tala10)}</td>
                    </>
                  );
                })()}
              </tr>
            </tfoot>
          </table>
        </Block>
      )}

      <div className="mt-10 grid grid-cols-2 gap-10 text-[12px]">
        <SignatureLine label="Class Adviser / Teacher" />
        <SignatureLine label="School Head" />
      </div>
    </Shell>
  );
}

function CountTable({
  head,
  rows,
  total,
}: {
  head: string[];
  rows: TalaCount[];
  total: number;
}) {
  return (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr className="border-y border-neutral-300 bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-600">
          {head.map((h) => (
            <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-neutral-200">
            <td className="px-2 py-1">{r.label}</td>
            <td className="px-2 py-1 tabular-nums">{r.count}</td>
            <td className="px-2 py-1 tabular-nums">{pct(r.percent)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-neutral-400 font-semibold">
          <td className="px-2 py-1">Total assessed</td>
          <td className="px-2 py-1 tabular-nums">{total}</td>
          <td className="px-2 py-1">{total === 0 ? "" : "100%"}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function Block({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`break-inside-avoid ${className}`}>
      <h2 className="mb-1 text-[13px] font-semibold">{title}</h2>
      {children}
    </section>
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
        (active ? "bg-emerald-600 text-white" : "text-neutral-600 hover:bg-neutral-100")
      }
    >
      {children}
    </Link>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[1100px] p-6 print:max-w-none print:p-0">{children}</main>
  );
}
