import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { getGradeTeacherNames } from "@/lib/teachers";
import { EXAM_GRADES, gradeLabel } from "@/lib/grades";
import { SCHOOL, schoolDetailsIncomplete } from "@/lib/school";
import { summariseExamSubject, type ExamEntry, type Sex } from "@/lib/scoring/exam-summary.ts";
import { PrintButton } from "../../print-button.tsx";

export const metadata = { title: "Exam Class Record — I-LEADS" };

const SEX_ROWS = [
  { key: "male", label: "Male" },
  { key: "female", label: "Female" },
  { key: "total", label: "Total" },
] as const;

export default async function ExamClassRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; round?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const viewer = await getViewer();

  const available = EXAM_GRADES.filter(
    (g) => viewer.isHead || viewer.allowedGrades.includes(g)
  );

  if (available.length === 0) {
    return (
      <Shell>
        <p className="text-neutral-600">
          You are not assigned to any grade, so there is no exam record to show
          here.
        </p>
      </Shell>
    );
  }

  const grade = available.includes(Number(params.grade))
    ? Number(params.grade)
    : available[0];

  const { data: rounds } = await supabase
    .from("assessment_rounds")
    .select("id, name, sequence")
    .eq("tool", "exam")
    .order("sequence");

  if (!rounds || rounds.length === 0) {
    return (
      <Shell>
        <p className="text-neutral-500">No exam quarters have been set up yet.</p>
      </Shell>
    );
  }

  const round = rounds.find((r) => String(r.id) === params.round) ?? rounds[0];

  const { data: subjectRows } = await supabase
    .from("learning_areas")
    .select("id, name, sequence, hps_per_quarter")
    .eq("grade_level", grade)
    .order("sequence");

  const subjects = (subjectRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    hps: ((s.hps_per_quarter ?? {}) as Record<string, number | null>)[round.name] ?? null,
  }));

  if (subjects.length === 0) {
    return (
      <Shell>
        <p className="text-neutral-500">
          No learning areas have been set up for Grade {grade} yet.
        </p>
      </Shell>
    );
  }

  const subjectIds = subjects.map((s) => s.id);

  const { data: learners } = await supabase
    .from("learners")
    .select("id, lrn, last_name, first_name, middle_name, sex")
    .eq("grade_level", grade)
    .eq("status", "enrolled")
    .order("last_name")
    .order("first_name");

  const { data: results } = await supabase
    .from("exam_results")
    .select("learner_id, learning_area_id, score")
    .eq("round_id", round.id)
    .in("learning_area_id", subjectIds);

  const { data: notes } = await supabase
    .from("exam_notes")
    .select("learning_area_id, least_mastered_skills")
    .eq("round_id", round.id)
    .in("learning_area_id", subjectIds);

  const scoreByLearnerSubject = new Map<string, number | null>();
  for (const r of results ?? []) {
    scoreByLearnerSubject.set(`${r.learner_id}:${r.learning_area_id}`, r.score);
  }
  const notesBySubject = new Map(
    (notes ?? []).map((n) => [n.learning_area_id, n.least_mastered_skills])
  );

  const rows = (learners ?? []).map((learner, i) => ({
    n: i + 1,
    learner,
    scores: Object.fromEntries(
      subjects.map((s) => [
        s.id,
        scoreByLearnerSubject.get(`${learner.id}:${s.id}`) ?? null,
      ])
    ),
  }));

  const teacherNames = await getGradeTeacherNames(supabase, grade);
  const teachers =
    teacherNames.length > 0 ? teacherNames.join(", ") : viewer.fullName || "—";

  const printedOn = new Date().toLocaleDateString("en-PH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const enrolledBySex = { male: 0, female: 0, total: rows.length };
  for (const r of rows) {
    if ((r.learner.sex as Sex) === "M") enrolledBySex.male += 1;
    else enrolledBySex.female += 1;
  }

  return (
    <Shell>
      <div className="no-print mb-5 flex flex-wrap gap-6 text-[13px]">
        <PickerGroup label="Grade">
          {available.map((g) => (
            <PickerLink
              key={g}
              href={`/exam/class-record?grade=${g}&round=${round.id}`}
              active={g === grade}
            >
              {gradeLabel(g)}
            </PickerLink>
          ))}
        </PickerGroup>

        <PickerGroup label="Quarter">
          {rounds.map((r) => (
            <PickerLink
              key={r.id}
              href={`/exam/class-record?grade=${grade}&round=${r.id}`}
              active={r.id === round.id}
            >
              {r.name}
            </PickerLink>
          ))}
        </PickerGroup>

        <div className="ml-auto flex items-center gap-3">
          <Link href="/exam" className="text-emerald-700 hover:underline">
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

      <header className="mb-4 break-inside-avoid border-b border-neutral-300 pb-3">
        <p className="text-center text-[11px] uppercase tracking-widest text-neutral-500">
          Republic of the Philippines · Department of Education
        </p>
        <h1 className="mt-1 text-center text-base font-bold">
          Grade {grade} Exam Class Record — Mean Percentage Score
        </h1>
        <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-[12px] sm:grid-cols-3">
          <Field label="School" value={SCHOOL.name} />
          <Field label="School ID" value={SCHOOL.id} />
          <Field label="District" value={SCHOOL.district} />
          <Field label="Division" value={SCHOOL.division} />
          <Field label="Region" value={SCHOOL.region} />
          <Field label="School Year" value={SCHOOL.schoolYear} />
          <Field label="Grade" value={`Grade ${grade}`} />
          <Field label="Quarter" value={round.name} />
          <Field label="Teacher" value={teachers} />
          <Field
            label="Total Enrolment"
            value={`${enrolledBySex.total} (M ${enrolledBySex.male} · F ${enrolledBySex.female})`}
          />
          <Field label="Date Printed" value={printedOn} />
        </dl>
      </header>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-y border-neutral-300 bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-600">
              <th className="px-2 py-1.5 text-right font-medium">S/N</th>
              <th className="px-2 py-1.5 text-left font-medium">LRN</th>
              <th className="px-2 py-1.5 text-left font-medium">Name of Learner</th>
              <th className="px-2 py-1.5 text-center font-medium">Sex</th>
              {subjects.map((s) => (
                <th key={s.id} className="whitespace-nowrap px-2 py-1.5 text-right font-medium">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ n, learner, scores }) => (
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
                {subjects.map((s) => (
                  <td key={s.id} className="px-2 py-1 text-right tabular-nums">
                    {scores[s.id] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={subjects.length + 4} className="px-2 py-8 text-center text-neutral-400">
                  No enrolled learners in this grade.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="mt-6 break-inside-avoid">
        <h2 className="mb-3 text-[13px] font-bold">
          Mean Percentage Score, per subject
        </h2>
        <div className="grid gap-4">
          {subjects.map((s) => {
            const entries: ExamEntry[] = rows.map((r) => ({
              sex: r.learner.sex as Sex,
              score: r.scores[s.id],
            }));
            const stat = summariseExamSubject(entries, s.hps);
            const skills = notesBySubject.get(s.id) ?? "";

            return (
              <div key={s.id} className="break-inside-avoid">
                <h3 className="mb-1 text-[12px] font-semibold">
                  {s.name}
                  {s.hps === null ? (
                    <span className="ml-2 font-normal text-amber-700">
                      (HPS not set for {round.name} — MPS not computed)
                    </span>
                  ) : (
                    <span className="ml-2 font-normal text-neutral-500">
                      HPS {s.hps}
                    </span>
                  )}
                </h3>
                <table className="w-full max-w-md border-collapse text-[11px]">
                  <thead>
                    <tr className="border-y border-neutral-300 bg-neutral-50 text-[10px] uppercase text-neutral-600">
                      <th className="px-2 py-1 text-left font-medium">Sex</th>
                      <th className="px-2 py-1 text-right font-medium">Assessed</th>
                      <th className="px-2 py-1 text-right font-medium">Mean</th>
                      <th className="px-2 py-1 text-right font-medium">SD</th>
                      <th className="px-2 py-1 text-right font-medium">MPS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SEX_ROWS.map(({ key, label }) => (
                      <tr
                        key={key}
                        className={
                          "border-b border-neutral-200" +
                          (key === "total" ? " font-medium" : "")
                        }
                      >
                        <td className="px-2 py-1">{label}</td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {stat.assessedBySex[key]}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {stat.meanBySex[key] === null ? "" : stat.meanBySex[key]!.toFixed(2)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {stat.sdBySex[key] === null ? "" : stat.sdBySex[key]!.toFixed(2)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {stat.mpsBySex[key] === null ? "" : `${stat.mpsBySex[key]!.toFixed(2)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-[11px] text-neutral-600">
                  <span className="font-medium text-neutral-500">
                    Least Mastered Skills:
                  </span>{" "}
                  {skills || <span className="text-neutral-400">(none recorded)</span>}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="mt-8 grid grid-cols-2 gap-12 break-inside-avoid text-[11px]">
        <SignatureLine label="Teacher" />
        <SignatureLine label="School Head" />
      </footer>
    </Shell>
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
    <main className="mx-auto max-w-[1200px] p-6 print:max-w-none print:p-0">
      {children}
    </main>
  );
}
