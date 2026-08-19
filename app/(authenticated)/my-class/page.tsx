import Link from "next/link";

export const metadata = { title: "My Class — I-LEADS" };

export default function MyClassPage() {
  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">My Class</h1>
      <nav className="mt-6 flex flex-col gap-2">
        <Link
          href="/learners"
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          Learners →
        </Link>
        <Link
          href="/crla"
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          CRLA entry →
        </Link>
        <Link
          href="/crla/class-record"
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          CRLA class record →
        </Link>
        <Link
          href="/rma"
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          RMA entry →
        </Link>
        <Link
          href="/rma/class-record"
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          RMA class record →
        </Link>
        <Link
          href="/exam"
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          Exam entry →
        </Link>
        <Link
          href="/exam/class-record"
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          Exam class record →
        </Link>
        <Link
          href="/philiri"
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          Phil-IRI entry →
        </Link>
        <Link
          href="/philiri/class-record"
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          Phil-IRI class record →
        </Link>
      </nav>
    </main>
  );
}
