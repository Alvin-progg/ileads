import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "../logout-button";

export const metadata = { title: "Admin — I-LEADS" };

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user!.id)
    .single();

  return (
    <main className="p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">School Head Dashboard</h1>
          <p className="text-sm text-gray-500">
            {profile?.full_name} · {profile?.role}
          </p>
        </div>
        <LogoutButton />
      </header>
      <nav className="mt-6 flex flex-col gap-2">
        <Link
          href="/admin/teachers"
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          Manage teacher assignments →
        </Link>
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
