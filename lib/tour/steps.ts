import { CRLA_GRADES, EXAM_GRADES, PHILIRI_GRADES, RMA_GRADES } from "@/lib/grades";

export type TourStep = {
  id: string;
  route: string;
  target: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
  /** Drops the overlay so the underlying interface stays fully usable. */
  live?: boolean;
};

export type EncodingEntry = { href: string; label: string };

const INSTRUMENTS: { grades: number[]; href: string; label: string }[] = [
  { grades: CRLA_GRADES, href: "/crla", label: "CRLA" },
  { grades: RMA_GRADES, href: "/rma", label: "RMA" },
  { grades: PHILIRI_GRADES, href: "/philiri", label: "Phil-IRI" },
  { grades: EXAM_GRADES, href: "/exam", label: "Exams" },
];

/**
 * Same instrument-priority logic as the sidebar's `showsFor`
 * (app/(authenticated)/layout.tsx) — kept in sync by construction so the
 * tour never targets a nav item this teacher can't see. A teacher only ever
 * has one instrument set worth walking through.
 */
export function firstEncodingEntry(allowedGrades: number[]): EncodingEntry | null {
  const match = INSTRUMENTS.find((i) => i.grades.some((g) => allowedGrades.includes(g)));
  return match ? { href: match.href, label: match.label } : null;
}

/**
 * Every instrument the viewer has grades for — a head has all four, since
 * their allowedGrades covers every grade level.
 */
export function allEncodingEntries(allowedGrades: number[]): EncodingEntry[] {
  return INSTRUMENTS.filter((i) => i.grades.some((g) => allowedGrades.includes(g))).map(
    (i) => ({ href: i.href, label: i.label })
  );
}

function gridStepPair(entry: EncodingEntry, gridBody: string): TourStep[] {
  return [
    {
      id: `grid-${entry.href}`,
      route: entry.href,
      target: '[data-row="0"]',
      title: `${entry.label}: pick a round, then type scores`,
      body: gridBody,
      placement: "bottom",
      live: true,
    },
    {
      id: `save-status-${entry.href}`,
      route: entry.href,
      target: '[data-tour="save-status"]',
      title: "Your work is saved",
      body: "This shows your work is saved — don't worry if you lose signal, it retries.",
      placement: "left",
      live: true,
    },
  ];
}

function learnerProfileSteps(sampleLearnerId: string | null): TourStep[] {
  if (!sampleLearnerId) return [];
  const profileRoute = `/learners/${sampleLearnerId}/profile`;
  return [
    {
      id: "profile",
      route: profileRoute,
      target: '[data-tour="profile-body"]',
      title: "One learner, everything together",
      body: "This is where everything about one learner comes together.",
      placement: "left",
    },
    {
      id: "print",
      route: profileRoute,
      target: '[data-tour="print"]',
      title: "Print or export",
      body: "Print or download reports from here.",
      placement: "left",
    },
  ];
}

export function teacherTour(
  entry: EncodingEntry | null,
  sampleLearnerId: string | null
): TourStep[] {
  return [
    {
      id: "nav",
      route: "/my-class",
      target: '[data-tour="nav"]',
      title: "Your sidebar",
      body: "This is where you'll find your class and your assessments.",
      placement: "right",
    },
    {
      id: "dashboard",
      route: "/my-class",
      target: '[data-tour="quick-links"]',
      title: "Your class overview",
      body: "Here's your class overview and what's left to encode.",
      placement: "bottom",
    },
    {
      id: "learners",
      route: "/learners",
      target: '[data-tour="learner-table"]',
      title: "Your class list",
      body: "Here's your class list.",
      placement: "bottom",
    },
    ...(entry
      ? gridStepPair(
          entry,
          "Pick a round, then type scores here — the level computes automatically. Try it: type into the row below."
        )
      : []),
    ...learnerProfileSteps(sampleLearnerId),
  ];
}

export function headTour(
  allowedGrades: number[],
  sampleLearnerId: string | null
): TourStep[] {
  const entries = allEncodingEntries(allowedGrades);

  return [
    {
      id: "nav",
      route: "/admin",
      target: '[data-tour="nav"]',
      title: "Your sidebar",
      body: "This is where you'll find dashboards, learners, assignments, and exports.",
      placement: "right",
    },
    {
      id: "kpis",
      route: "/admin",
      target: '[data-tour="head-kpis"]',
      title: "School-wide snapshot",
      body: "Enrollment, at-risk flags, and incomplete encoding rounds — at a glance.",
      placement: "bottom",
    },
    {
      id: "per-grade",
      route: "/admin",
      target: '[data-tour="per-grade"]',
      title: "Per-grade breakdown",
      body: "Every grade's numbers, side by side.",
      placement: "top",
    },
    {
      id: "charts",
      route: "/admin",
      target: '[data-tour="head-charts"]',
      title: "Score distributions",
      body: "Distributions per grade and subject, computed from the raw scores teachers encode.",
      placement: "top",
    },
    {
      id: "at-risk",
      route: "/admin",
      target: '[data-tour="at-risk"]',
      title: "At-risk learners",
      body: "Learners flagged across any instrument, school-wide.",
      placement: "top",
    },
    {
      id: "encoding-progress",
      route: "/admin",
      target: '[data-tour="encoding-progress"]',
      title: "Who still needs to encode",
      body: "How far along each grade and instrument is, so you know who to follow up with.",
      placement: "top",
    },
    {
      id: "learners",
      route: "/learners",
      target: '[data-tour="learner-table"]',
      title: "Every learner, every grade",
      body: "Unlike a teacher, you see every enrolled learner across the whole school here.",
      placement: "bottom",
    },
    ...entries.flatMap((entry) =>
      gridStepPair(
        entry,
        `This is the ${entry.label} encoding grid — the same one a teacher assigned to that grade uses. Pick a round, type scores, and the level computes automatically. Try it: type into the row below.`
      )
    ),
    ...learnerProfileSteps(sampleLearnerId),
    {
      id: "assignments",
      route: "/admin/teachers",
      target: '[data-tour="assignments"]',
      title: "Assign teachers to grades",
      body: "Assign each teacher to the grade levels they teach — this drives what they see.",
      placement: "bottom",
    },
    {
      id: "exports",
      route: "/reports",
      target: '[data-tour="exports"]',
      title: "District exports",
      body: "Download the official district workbooks, filled from the encoded data.",
      placement: "bottom",
    },
  ];
}
