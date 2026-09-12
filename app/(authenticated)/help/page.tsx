import { getViewer } from "@/lib/viewer";
import { resolveSchool } from "@/lib/school";
import { TakeTourButton } from "../tour/take-tour-button.tsx";
import { Reference } from "./reference.tsx";

export const metadata = { title: "Help — I-LEADS" };

export default async function HelpPage() {
  const viewer = await getViewer();
  const school = resolveSchool(viewer.school);

  return (
    <main className="mx-auto max-w-[900px] p-6">
      <h1 className="text-2xl font-bold">Help / User Guide</h1>
      <p className="mt-2 text-[13px] text-neutral-500">
        New here? The guided tour walks you through the real screens — the same
        ones you&apos;ll use every day.
      </p>

      <div className="no-print mt-4">
        <TakeTourButton className="rounded-[10px] bg-emerald-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-emerald-700">
          Take the tour
        </TakeTourButton>
      </div>

      <p className="no-print mt-3 text-[12px] text-neutral-500">
        No stable connection right now, or want something on paper? Use the
        printable reference below.
      </p>

      <Reference isHead={viewer.isHead} schoolName={school.name} />
    </main>
  );
}
