// Single source of truth for the app's learner status vocabulary. Both the
// public landing page (app/page.tsx, outside the auth group) and the
// authenticated dashboards import from here so the legend can never drift
// from what the dashboards actually compute.
//
// Level label strings from lib/scoring/instruments.ts are byte-exact
// contracts with the district .xlsx COUNTIFS — this module maps *over* them,
// never renames them.

export type Tier = "on-track" | "needs-monitoring" | "needs-intervention" | "critical";

/** Worst -> best. Drives list sort order and legend order. */
export const TIER_ORDER: Tier[] = [
  "critical",
  "needs-intervention",
  "needs-monitoring",
  "on-track",
];

export const TIER_META: Record<
  Tier,
  {
    label: string;
    description: string;
    pill: string;
    hex: string;
  }
> = {
  "on-track": {
    label: "On Track",
    description: "Regular Progress",
    pill: "bg-emerald-50 text-emerald-700",
    // Restates STATUS.good from app/(authenticated)/dashboard-colors.ts —
    // lib/ must not depend on app/, so the value is duplicated deliberately.
    hex: "#0ca30c",
  },
  "needs-monitoring": {
    label: "Needs Monitoring",
    description: "Requires Additional Support",
    pill: "bg-amber-50 text-amber-700",
    hex: "#fab219",
  },
  "needs-intervention": {
    label: "Needs Intervention",
    description: "Targeted Learning Support",
    pill: "bg-orange-50 text-orange-700",
    hex: "#e8702a",
  },
  critical: {
    label: "Critical",
    description: "Immediate Intervention Required",
    pill: "bg-red-50 text-red-700",
    // Restates STATUS.critical from dashboard-colors.ts, same reason as above.
    hex: "#d03b3b",
  },
};

export type TierInstrument = "CRLA" | "RMA" | "Phil-IRI";

const LEVEL_TO_TIER: Record<TierInstrument, Record<string, Tier>> = {
  CRLA: {
    "Full Refresher": "critical",
    "Moderate Refresher": "needs-intervention",
    "Light Refresher": "needs-monitoring",
    "Grade Ready": "on-track",
  },
  RMA: {
    "Emerging (Not Proficient)": "critical",
    "Emerging (Low Proficient)": "needs-intervention",
    "Developing (Nearly Proficient)": "needs-monitoring",
    "Transitioning (Proficient)": "on-track",
    "At Grade Level (Highly Proficient)": "on-track",
  },
  "Phil-IRI": {
    // "Needs Intervention" has no Phil-IRI level mapped to it — only 3
    // levels are ever computed (Non-Reader was dropped, see
    // supabase/migrations/20260819130000_philiri_module.sql). Frustration ->
    // Critical preserves today's at-risk flagging exactly.
    Frustration: "critical",
    Instructional: "needs-monitoring",
    Independent: "on-track",
  },
};

/** null when the level is unrecognised or not yet computed. */
export function tierForLevel(instrument: TierInstrument, level: string | null): Tier | null {
  if (level === null) return null;
  return LEVEL_TO_TIER[instrument][level] ?? null;
}
