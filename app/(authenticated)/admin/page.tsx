import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { GRADE_LEVELS } from "@/lib/grades";
import { LANGUAGE_NAMES } from "@/lib/languages";
import { buildDashboard } from "@/lib/dashboard/build-dashboard.ts";
import { GradeCard, StatTile } from "../dashboard/grade-card.tsx";
import { AtRiskTable } from "../dashboard/at-risk-table.tsx";
import { EncodingProgressChart, StatusLegend } from "../encoding-progress-chart.tsx";
import { GroupedLevelChart } from "./grouped-level-chart.tsx";
import { ExamMpsChart } from "../exam-mps-chart.tsx";

export const metadata = { title: "School Head Dashboard — I-LEADS" };

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const viewer = await getViewer();
  if (!viewer.isHead) redirect("/my-class");

  const data = await buildDashboard(supabase, [...GRADE_LEVELS]);

  return (
    <main className="mx-auto max-w-[1400px] p-6">
      <h1 className="mb-6 text-2xl font-bold">School Head Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Total Enrolled" value={data.totalEnrolled} tone="neutral" />
        <StatTile
          label="At-Risk Flags"
          value={data.atRisk.length}
          tone={data.atRisk.length > 0 ? "warn" : "good"}
        />
        <StatTile
          label="Incomplete Encoding Rounds"
          value={data.trackerCellCounts.incomplete}
          tone={data.trackerCellCounts.incomplete > 0 ? "warn" : "good"}
        />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-neutral-500">
          Per-Grade Breakdown
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.gradeCards.map((card) => (
            <GradeCard key={card.grade} card={card} />
          ))}
        </div>
      </section>

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
          <GroupedLevelChart
            title="RMA Proficiency Distribution"
            levels={data.rmaLevels}
            groups={data.rmaGroups}
          />
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
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.examCharts.map((c) => (
            <ExamMpsChart key={`exam-${c.grade}`} grade={c.grade} subjects={c.subjects} />
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-neutral-500">
          At-Risk Learners
        </h2>
        <AtRiskTable rows={data.atRisk} />
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-neutral-500">
          Encoding Progress
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
