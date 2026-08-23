import { PrintButton } from "../print-button.tsx";
import { SCHOOL } from "@/lib/school";

function TeacherReference() {
  return (
    <>
      <h2 className="mb-3 text-lg font-bold">Teacher quick reference</h2>

      <ol className="mb-4 list-decimal space-y-2 pl-5 text-[13px]">
        <li>
          <strong>Log in</strong> with the account the school head set up for you.
          You&apos;ll land on <strong>My Class</strong> — your grade(s), what&apos;s
          left to encode, and your class&apos;s score distributions.
        </li>
        <li>
          <strong>Learners</strong> in the sidebar lists your class. Use{" "}
          <strong>Profile</strong> next to a learner to see everything encoded for
          them in one place, or <strong>Edit</strong> to change their details.
        </li>
        <li>
          <strong>CRLA / RMA / Phil-IRI / Exams</strong> in the sidebar are your
          encoding grids — only the ones that apply to your grade level(s) appear.
          Pick a round at the top, then type raw scores. Levels and profiles are
          computed for you; never type a level directly.
        </li>
        <li>
          <strong>Tab</strong> moves across a row, <strong>Enter</strong> moves down
          the same column, <strong>Shift+Enter</strong> moves up — no mouse needed
          once you&apos;re in the grid.
        </li>
        <li>
          Rows save on their own a moment after you stop typing. Watch the{" "}
          <strong>Status</strong> column at the right of the grid.
        </li>
        <li>
          Use the <strong>Print</strong> button on a learner&apos;s profile or a
          class record to print or save it as a PDF.
        </li>
      </ol>

      <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-neutral-500">
        What the Status column means
      </h3>
      <table className="mb-4 w-full max-w-md border-collapse text-[13px]">
        <tbody>
          <tr className="border-b border-neutral-200">
            <td className="py-1.5 pr-4 font-medium text-amber-600">saving…</td>
            <td className="py-1.5 text-neutral-600">Sending your entry now.</td>
          </tr>
          <tr className="border-b border-neutral-200">
            <td className="py-1.5 pr-4 font-medium text-emerald-600">saved ✓</td>
            <td className="py-1.5 text-neutral-600">Safely stored.</td>
          </tr>
          <tr className="border-b border-neutral-200">
            <td className="py-1.5 pr-4 font-medium text-red-600 underline">
              failed ↻
            </td>
            <td className="py-1.5 text-neutral-600">
              Couldn&apos;t send — it keeps retrying on its own. Your entry is kept
              on this device either way, so it is never lost. You can also click
              the status to retry immediately.
            </td>
          </tr>
          <tr>
            <td className="py-1.5 pr-4 font-medium text-amber-700 underline">
              session expired
            </td>
            <td className="py-1.5 text-neutral-600">
              Log in again — your unsaved work is kept and sends automatically once
              you&apos;re back in.
            </td>
          </tr>
        </tbody>
      </table>

      <p className="text-[13px] text-neutral-600">
        No signal? Keep typing — nothing is lost. Entries you make while offline
        are kept on this device and sent automatically the next time you&apos;re
        connected.
      </p>

      <p className="mt-4 text-[13px] font-medium">
        Questions or something looks wrong? Ask the school head.
      </p>
    </>
  );
}

function HeadReference() {
  return (
    <>
      <h2 className="mb-3 text-lg font-bold">School head quick reference</h2>

      <ol className="mb-4 list-decimal space-y-2 pl-5 text-[13px]">
        <li>
          <strong>School Head Dashboard</strong> — enrollment, learners needing
          support, and incomplete encoding rounds at a glance, plus per-grade score
          distributions and a Learner Monitoring Status list (On Track / Needs
          Monitoring / Needs Intervention / Critical).
        </li>
        <li>
          <strong>Teacher Assignments</strong> — assign each teacher to the grade
          level(s) they handle. This drives what that teacher sees in their own
          sidebar and dashboard.
        </li>
        <li>
          <strong>Reports &amp; Exports</strong> — download the official district
          workbooks (CRLA, RMA, MPS, Phil-IRI), filled in from the same numbers on
          the dashboard, per round.
        </li>
        <li>
          <strong>Learners</strong> and each teacher&apos;s encoding grids are also
          visible to you, across every grade, for spot-checking.
        </li>
      </ol>

      <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-neutral-500">
        Handover checklist
      </h3>
      <ul className="list-disc space-y-1 pl-5 text-[13px] text-neutral-600">
        <li>
          Confirm the school&apos;s School ID, District, Division, and Region are
          filled in (a class record shows an amber warning banner if any are
          still placeholders) — these must be correct before printing anything
          for the district.
        </li>
        <li>
          Run the prototype data cleanup script so no demo learners or scores are
          mistaken for real records.
        </li>
        <li>Confirm all four teachers and the school head can log in.</li>
        <li>Confirm each teacher is assigned the correct grade level(s).</li>
      </ul>
    </>
  );
}

export function Reference({ isHead }: { isHead: boolean }) {
  return (
    <section className="ref-sheet mt-8 border-t border-neutral-200 pt-6">
      <div className="no-print mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Printable reference</h1>
        <PrintButton />
      </div>
      <p className="mb-4 hidden text-[12px] text-neutral-500 print:block">
        {SCHOOL.name} · I-LEADS
      </p>
      {isHead ? <HeadReference /> : <TeacherReference />}
    </section>
  );
}
