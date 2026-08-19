import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Reports & Exports — I-LEADS" };

export default async function ReportsPage() {
  const viewer = await getViewer();
  if (!viewer.isHead) redirect("/my-class");

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Reports & Exports</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Reports & Exports lands here in a later ticket.
      </p>
    </main>
  );
}
