"use client";

import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
    >
      Sign out
    </button>
  );
}
