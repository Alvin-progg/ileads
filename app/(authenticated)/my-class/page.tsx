import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { CRLA_GRADES, PHILIRI_GRADES, RMA_GRADES } from "@/lib/grades";
import { LANGUAGE_NAMES } from "@/lib/languages";
import { buildDashboard, type CurrentRound, type GradeCardData } from "@/lib/dashboard/build-dashboard.ts";
import { GradeCard } from "../dashboard/grade-card.tsx";
import { AtRiskTable } from "../dashboard/at-risk-table.tsx";
import { EncodingProgressChart, StatusLegend } from "../encoding-progress-chart.tsx";
import { GroupedLevelChart } from "../admin/grouped-level-chart.tsx";
import { ExamMpsChart } from "../exam-mps-chart.tsx";

export const metadata = { title: "My Class — I-LEADS" };

function quickLink(
  href: string,
  label: string,
  round: CurrentRound | null,
  enrolled: number
) {
  if (!round) return null;
  return (
    <Link
      key={href}
      href={href}
      className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
    >
      <span className="font-medium text-emerald-700">{label}</span>
      <span className="tabular-nums text-neutral-500">
        {round.encoded}/{enrolled} encoded
      </span>
    </Link>
  );
}

function QuickLinks({ card }: { card: GradeCardData }) {
  const links = [
    CRLA_GRADES.includes(card.grade) &&
      quickLink(
        `/crla?grade=${card.grade}&round=${card.crlaCurrentRound?.id}`,
        "Continue CRLA encoding",
        card.crlaCurrentRound,
        card.enrolled
      ),
    RMA_GRADES.includes(card.grade) &&
      quickLink(
        `/rma?grade=${card.grade}&round=${card.rmaCurrentRound?.id}`,
        "Continue RMA encoding",
        card.rmaCurrentRound,
        card.enrolled
      ),
    PHILIRI_GRADES.includes(card.grade) &&
      quickLink(
        `/philiri?grade=${card.grade}&round=${card.philiriCurrentRound?.id}`,
        "Continue Phil-IRI encoding",
        card.philiriCurrentRound,
        card.enrolled
      ),
    quickLink(
      `/exam?grade=${card.grade}&round=${card.examCurrentRound?.id}`,
      "Continue exam encoding",
      card.examCurrentRound,
      card.enrolled
    ),
  ].filter(Boolean);

  if (links.length === 0) return null;

  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {links}
    </div>
  );
}

export default async function MyClassPage() {
  const supabase = await createClient();
  const viewer = await getViewer();
  const data = await buildDashboard(supabase, viewer.allowedGrades);

  if (viewer.allowedGrades.length === 0) {
    return (
      <main className="mx-auto max-w-[1400px] p-6">
        <h1 className="mb-2 text-2xl font-bold">My Class</h1>
        <p className="text-[13px] text-neutral-500">
          You aren&apos;t assigned to any grade yet — ask the school head to set
          up your grade assignment.
        </p>
      </main>
    );
  }

  const crlaChartGrades = data.crlaCharts.length > 0;
  const philiriChartGrades = data.philiriCharts.length > 0;

  return (
    <main className="mx-auto max-w-[1400px] p-6">
      <h1 className="mb-1 text-2xl font-bold">My Class</h1>
      <p className="mb-6 text-[13px] text-neutral-500">
        {viewer.fullName ? `${viewer.fullName} · ` : ""}
        Grade{viewer.allowedGrades.length > 1 ? "s" : ""} {viewer.allowedGrades.join(", ")}
      </p>

      <section className="mb-8">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-neutral-500">
          Your Grade{viewer.allowedGrades.length > 1 ? "s" : ""}
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.gradeCards.map((card) => (
            <div key={card.grade}>
              <GradeCard card={card} />
              <QuickLinks card={card} />
            </div>
          ))}
        </div>
      </section>

      {(crlaChartGrades || data.rmaGroups.length > 0 || philiriChartGrades) && (
        <section className="mb-8">
          <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-neutral-500">
            Score Distributions
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {data.crlaCharts.map((c) => (
              <GroupedLevelChart
                key={`crla-${c.language}`}
                title="CRLA Level Distribution"
                subtitle={LANGUAGE_NAMES[c.language] ?? c.language}
                levels={c.levels}
                groups={c.groups}
              />
            ))}
            {data.rmaGroups.length > 0 && (
              <GroupedLevelChart
                title="RMA Proficiency Distribution"
                levels={data.rmaLevels}
                groups={data.rmaGroups}
              />
            )}
            {data.philiriCharts.map((c) => (
              <GroupedLevelChart
                key={`philiri-${c.language}-${c.roundName}`}
                title="Phil-IRI Overall Level Distribution"
                subtitle={`${LANGUAGE_NAMES[c.language] ?? c.language} · ${c.roundName}`}
                levels={c.levels}
                groups={c.groups}
              />
            ))}
          </div>
          {data.examCharts.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {data.examCharts.map((c) => (
                <ExamMpsChart key={`exam-${c.grade}`} grade={c.grade} subjects={c.subjects} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-neutral-500">
          At-Risk Learners
        </h2>
        <AtRiskTable rows={data.atRisk} />
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-neutral-500">
          Your Encoding Progress
        </h2>
        <p className="mb-1 text-[12px] text-neutral-500">
          Learners with a record for that round, out of learners enrolled in that grade.
        </p>
        <StatusLegend />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <EncodingProgressChart data={data.crlaTracker} />
          <EncodingProgressChart data={data.rmaTracker} />
          <EncodingProgressChart data={data.philiriTracker} />
          <EncodingProgressChart data={data.examTracker} />
        </div>
      </section>
    </main>
  );
}
