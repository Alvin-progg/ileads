"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { colorForLevel, MUTED_TEXT } from "../dashboard-colors.ts";

export type LevelGroupStatus = "ok" | "not-applicable" | "not-configured" | "not-enough-data";

export type LevelGroup = {
  key: string;
  label: string;
  status: LevelGroupStatus;
  assessed: number;
  /** One row per `levels` entry, in canonical order. Null unless status === "ok". */
  bars: { level: string; value: number }[] | null;
};

export type GroupedLevelChartProps = {
  title: string;
  subtitle?: string;
  /** Canonical DepEd progression order — drives bar and legend order, never sorted. */
  levels: string[];
  groups: LevelGroup[];
};

type ChartRow = { name: string } & Record<string, number | string>;

function statusChipText(group: LevelGroup): string {
  switch (group.status) {
    case "not-configured":
      return `${group.label}: levels not yet configured`;
    case "not-enough-data":
      return `${group.label}: not enough data yet`;
    default:
      return "";
  }
}

function Legend({ levels }: { levels: string[] }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-3 text-[12px] text-neutral-500">
      {levels.map((level, i) => (
        <span key={level} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: colorForLevel(i) }}
          />
          {level}
        </span>
      ))}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  levels,
}: {
  active?: boolean;
  payload?: readonly { payload?: ChartRow }[];
  levels: string[];
}) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] shadow-sm">
      <p className="font-medium text-neutral-900">{row.name}</p>
      {levels.map((level) => (
        <p key={level} className="text-neutral-500">
          {level}: {row[level]}
        </p>
      ))}
    </div>
  );
}

/**
 * Grouped bar chart for a DepEd level/proficiency distribution, shared by
 * CRLA, RMA and Phil-IRI. Groups without real data (not applicable to a
 * grade, not yet configured, or nothing encoded) are never plotted as
 * zero-height bars — that would be indistinguishable from a genuine zero —
 * they instead render as a status chip below the chart.
 */
export function GroupedLevelChart({ title, subtitle, levels, groups }: GroupedLevelChartProps) {
  const okGroups = groups.filter((g) => g.status === "ok" && g.bars);
  const chips = groups.filter((g) => g.status !== "ok" && g.status !== "not-applicable");

  const rows: ChartRow[] = okGroups.map((g) => {
    const row: ChartRow = { name: g.label };
    for (const b of g.bars!) row[b.level] = b.value;
    return row;
  });

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-2">
        <h3 className="text-[13px] font-bold">{title}</h3>
        {subtitle && <p className="text-[12px] text-neutral-500">{subtitle}</p>}
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-[12px] text-neutral-400">Not enough data yet.</p>
      ) : (
        <>
          <Legend levels={levels} />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rows} barGap={2} barCategoryGap="20%" margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#f0efe9" />
              <XAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#525252" }} axisLine={false} tickLine={false} />
              <YAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: MUTED_TEXT }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ChartTooltip levels={levels} />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
              {levels.map((level, i) => (
                <Bar key={level} dataKey={level} name={level} fill={colorForLevel(i)} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  <LabelList dataKey={level} position="top" style={{ fontSize: 10, fill: "#52514e" }} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </>
      )}

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {chips.map((g) => (
            <p
              key={g.key}
              className={`text-[12px] ${g.status === "not-configured" ? "text-amber-700" : "text-neutral-400"}`}
            >
              {statusChipText(g)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
