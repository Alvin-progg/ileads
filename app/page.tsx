import Image from "next/image";
import Link from "next/link";
import { TIER_ORDER, TIER_META } from "@/lib/status-tiers";
import { SCHOOL } from "@/lib/school";

export const metadata = {
  title: "I-LEADS",
  description: "Integrated Learner Evaluation and Data Management System",
};

function IconWrap({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-emerald-600"
    >
      {children}
    </svg>
  );
}

function SchoolIcon() {
  return (
    <IconWrap>
      <path d="M12 3 3 8v1h18V8z" />
      <path d="M5 9v10h14V9" />
      <path d="M10 19v-5h4v5" />
    </IconWrap>
  );
}

function LearnerDataIcon() {
  return (
    <IconWrap>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M15 4h4M15 8h4M15 12h3" />
    </IconWrap>
  );
}

function AssessmentIcon() {
  return (
    <IconWrap>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1z" />
      <path d="m8.5 13 2 2 4-4.2" />
    </IconWrap>
  );
}

function ProgressIcon() {
  return (
    <IconWrap>
      <path d="M4 19h16" />
      <path d="M6 15l4-5 3 3 5-7" />
    </IconWrap>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 rotate-90 text-neutral-300 md:rotate-0"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

const WORKFLOW_STEPS = [
  { key: "school", label: "School", icon: <SchoolIcon /> },
  { key: "learner-data", label: "Learner Data", icon: <LearnerDataIcon /> },
  { key: "assessment", label: "Assessment Results", icon: <AssessmentIcon /> },
  { key: "monitoring", label: "Progress Monitoring", icon: <ProgressIcon /> },
];

function Nav() {
  return (
    <nav className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <Image
            src="/images/Logo.png"
            alt="I-LEADS logo"
            width={32}
            height={32}
            className="shrink-0"
          />
          <span className="text-[15px] font-bold">I-LEADS</span>
        </div>
        <Link
          href="/login"
          className="rounded-[10px] bg-emerald-600 px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Log in
        </Link>
      </div>
    </nav>
  );
}

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main
        className="flex-1"
        style={{
          background:
            "radial-gradient(900px 500px at 20% 0%, rgba(5,150,105,0.08), transparent 60%)," +
            "radial-gradient(700px 400px at 90% 100%, rgba(5,150,105,0.06), transparent 60%)," +
            "#f6faf8",
        }}
      >
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
          {/* Hero */}
          <section className="fade-up text-center">
            <Image
              src="/images/Logo.png"
              alt="I-LEADS — Paaralang Primarya ng Ligaya"
              width={80}
              height={80}
              className="mx-auto mb-5"
              priority
            />
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">I-LEADS</h1>
            <p className="mt-3 text-[15px] font-medium text-emerald-700">
              Integrated Learner Evaluation and Data Management System
            </p>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-neutral-600">
              A centralized learner information and monitoring platform designed for
              multigrade schools to organize, consolidate, retrieve, and monitor learner
              data, including literacy, numeracy, and term examination results.
            </p>
          </section>

          {/* Learner Monitoring Status legend */}
          <section className="mt-20">
            <h2 className="text-center text-[13px] font-bold uppercase tracking-wide text-neutral-500">
              Learner Monitoring Status
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TIER_ORDER.map((tier) => {
                const meta = TIER_META[tier];
                return (
                  <div
                    key={tier}
                    className="rounded-xl border border-neutral-200 bg-white p-4"
                  >
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[12px] font-medium ${meta.pill}`}
                    >
                      {meta.label}
                    </span>
                    <p className="mt-2 text-[13px] text-neutral-600">{meta.description}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Data workflow diagram */}
          <section className="mt-20">
            <h2 className="text-center text-[13px] font-bold uppercase tracking-wide text-neutral-500">
              How Data Flows
            </h2>
            <ol className="mt-6 flex flex-col items-center gap-2 md:flex-row md:justify-center md:gap-2">
              {WORKFLOW_STEPS.map((step, i) => (
                <li key={step.key} className="flex flex-col items-center md:flex-row md:gap-2">
                  <div className="flex w-40 flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-4 text-center">
                    {step.icon}
                    <span className="text-[13px] font-medium">{step.label}</span>
                  </div>
                  {i < WORKFLOW_STEPS.length - 1 && <ArrowIcon />}
                </li>
              ))}
            </ol>
          </section>

          {/* Closing description + CTA */}
          <section className="mt-20 border-t border-neutral-200 pt-14 text-center">
            <p className="mx-auto max-w-2xl text-[15px] leading-relaxed text-neutral-600">
              I-LEADS helps teachers and school administrators keep every learner&apos;s
              reading, numeracy, and examination records in one place — replacing
              scattered spreadsheets with a single source that computes levels
              automatically, flags learners who need support, and prepares official
              DepEd reports in a few clicks.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-block rounded-[10px] bg-emerald-600 px-6 py-3 text-[15px] font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Log in to I-LEADS
            </Link>
            <p className="mt-4 text-[12px] text-neutral-400">{SCHOOL.name}</p>
          </section>
        </div>
      </main>
    </>
  );
}
