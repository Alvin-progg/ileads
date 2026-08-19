"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EXAM_MASTERY_THRESHOLD, MUTED_TEXT, MUTED_TRACK, STATUS } from "./dashboard-colors.ts";

export type ExamSubjectBar = { subject: string; mps: number | null };

export type ExamMpsChartProps = {
  grade: number;
  subjects: ExamSubjectBar[];
  threshold?: number;
};

type ChartRow = { subject: string; mps: number; encoded: boolean };

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload?: ChartRow }[];
}) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] shadow-sm">
      <p className="font-medium text-neutral-900">{row.subject}</p>
      <p className="text-neutral-500">{row.encoded ? `MPS: ${row.mps.toFixed(0)}%` : "Not yet encoded"}</p>
    </div>
  );
}

/**
 * One bar per subject's class MPS, colored by whether it clears the mastery
 * threshold. Subjects with no score yet still appear on the axis (as a flat
 * muted bar) so their absence reads as "not yet encoded", not "doesn't exist".
 */
export function ExamMpsChart({ grade, subjects, threshold = EXAM_MASTERY_THRESHOLD }: ExamMpsChartProps) {
  const allUnencoded = subjects.every((s) => s.mps === null);
  const rows: ChartRow[] = subjects.map((s) => ({
    subject: s.subject,
    mps: s.mps ?? 0,
    encoded: s.mps !== null,
  }));

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="mb-2 text-[13px] font-bold">Grade {grade} — Exam MPS</h3>

      {subjects.length === 0 || allUnencoded ? (
        <p className="py-8 text-center text-[12px] text-neutral-400">Not enough data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={rows} margin={{ top: 16, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} stroke="#f0efe9" />
            <XAxis
              dataKey="subject"
              type="category"
              tick={{ fontSize: 10, fill: "#525252" }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={56}
              tickFormatter={(v: string) => (v.length > 13 ? `${v.slice(0, 12)}…` : v)}
            />
            <YAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: MUTED_TEXT }} axisLine={false} tickLine={false} width={28} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
            <ReferenceLine
              y={threshold}
              stroke={MUTED_TEXT}
              strokeDasharray="4 4"
              label={{ value: `${threshold}% mastery`, position: "insideTopRight", fontSize: 10, fill: MUTED_TEXT }}
            />
            <Bar dataKey="mps" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {rows.map((row) => (
                <Cell key={row.subject} fill={!row.encoded ? MUTED_TRACK : row.mps >= threshold ? STATUS.good : STATUS.critical} />
              ))}
              <LabelList
                dataKey="mps"
                position="top"
                content={(props: { x?: number | string; y?: number | string; width?: number | string; index?: number }) => {
                  const row = props.index !== undefined ? rows[props.index] : undefined;
                  if (!row || props.x === undefined || props.y === undefined || props.width === undefined) return null;
                  const x = Number(props.x);
                  const y = Number(props.y);
                  const width = Number(props.width);
                  const text = row.encoded ? `${row.mps.toFixed(0)}%` : "n/a";
                  return (
                    <text
                      x={x + width / 2}
                      y={y - 4}
                      textAnchor="middle"
                      fontSize={10}
                      fill="#52514e"
                    >
                      {text}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
