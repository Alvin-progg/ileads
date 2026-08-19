"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type TrackerCell = { label: string; encoded: number; enrolled: number };
export type TrackerRow = { label: string; cells: TrackerCell[] };
export type TrackerTableData = { title: string; columns: string[]; rows: TrackerRow[] };

// Fixed status palette — never themed, never reused for series identity.
// See the dataviz skill's references/palette.md.
const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  critical: "#d03b3b",
};

const TRACK_COLOR = "#e1e0d9"; // hairline gridline gray — the meter's unfilled track

function statusFor(pct: number): keyof typeof STATUS {
  if (pct >= 100) return "good";
  if (pct >= 50) return "warning";
  return "critical";
}

type MeterPoint = { key: string; label: string; encoded: number; enrolled: number; pct: number };

/**
 * Every (grade[/language], round) pair flattened into one row, in grade-major
 * order — so a grade's rounds stay adjacent and read as a group — rather than
 * splitting rounds into side-by-side panels, which starves each panel's bars
 * of width once a tool has more than two rounds.
 */
function flattenRows(data: TrackerTableData): MeterPoint[] {
  const out: MeterPoint[] = [];
  for (const row of data.rows) {
    row.cells.forEach((cell, i) => {
      const pct = cell.enrolled === 0 ? 0 : (cell.encoded / cell.enrolled) * 100;
      out.push({
        key: `${row.label}__${data.columns[i]}`,
        label: `${row.label} · ${data.columns[i]}`,
        encoded: cell.encoded,
        enrolled: cell.enrolled,
        pct,
      });
    });
  }
  return out;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload?: MeterPoint }[];
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] shadow-sm">
      <p className="font-medium text-neutral-900">{point.label}</p>
      <p className="text-neutral-500">
        {point.encoded}/{point.enrolled} encoded ({point.pct.toFixed(0)}%)
      </p>
    </div>
  );
}

function StatusLegend() {
  const items: { label: string; color: string }[] = [
    { label: "Complete", color: STATUS.good },
    { label: "Partial", color: STATUS.warning },
    { label: "Behind", color: STATUS.critical },
  ];
  return (
    <div className="mb-3 flex items-center gap-4 text-[12px] text-neutral-500">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/**
 * One meter per (grade[/language], round): a horizontal bar on a fixed
 * 0-100 track, filled to the encoded percentage and colored by completeness
 * status only — never by round or grade identity, which the row's own text
 * label already carries.
 */
export function EncodingProgressChart({ data }: { data: TrackerTableData }) {
  if (data.rows.length === 0) return null;

  const rows = flattenRows(data);
  const rowHeight = 24;
  const height = rows.length * rowHeight + 20;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="mb-2 text-[13px] font-bold">{data.title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 2, right: 34, bottom: 2, left: 0 }}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="label"
            width={185}
            tick={{ fontSize: 11, fill: "#525252" }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
          <Bar
            dataKey="pct"
            radius={[4, 4, 4, 4]}
            barSize={12}
            background={{ fill: TRACK_COLOR, radius: 4 } as object}
            isAnimationActive={false}
          >
            {rows.map((row) => (
              <Cell key={row.key} fill={STATUS[statusFor(row.pct)]} />
            ))}
            <LabelList
              dataKey="pct"
              position="right"
              formatter={(v) => `${Number(v).toFixed(0)}%`}
              style={{ fontSize: 11, fill: "#52514e" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export { StatusLegend };
