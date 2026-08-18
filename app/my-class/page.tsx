import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "../logout-button";

export const metadata = { title: "My Class — I-LEADS" };

export default async function MyClassPage() {
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
          <h1 className="text-xl font-bold">My Class</h1>
          <p className="text-sm text-gray-500">
            {profile?.full_name} · {profile?.role}
          </p>
        </div>
        <LogoutButton />
      </header>
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
          CRLA Grade 1 entry →
        </Link>
        <Link
          href="/crla/class-record"
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          CRLA class record →
        </Link>
      </nav>
    </main>
  );
}
