"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const inputClasses =
  "w-full rounded-[10px] border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 " +
  "text-[15px] outline-none transition-colors " +
  "focus:border-emerald-600 focus:bg-white focus:ring-[3px] focus:ring-emerald-600/10";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Wrong email or password."
          : error.message
      );
      setSubmitting(false);
      return;
    }

    // full navigation so the proxy sees the fresh auth cookies
    window.location.assign("/");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          autoComplete="email"
          placeholder="m.reyes@deped.gov.ph"
          className={inputClasses}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className={inputClasses}
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="mt-1.5 rounded-[10px] bg-emerald-600 py-3 text-[15px] font-medium text-white hover:bg-emerald-700 disabled:opacity-55"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
