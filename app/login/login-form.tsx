"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/** Auth-JS error messages that are already plain language on their own;
 * anything else falls back to a generic message rather than showing raw
 * driver/network text. */
const KNOWN_AUTH_MESSAGES: Record<string, string> = {
  "Invalid login credentials": "Wrong email or password.",
  "Email not confirmed": "This account hasn't been confirmed yet. Contact the school head.",
};

/**
 * Where to send the teacher after signing in, if they were redirected here
 * mid-session (e.g. an expired refresh token while a grid had unsaved rows).
 * Only ever an internal path — rejects protocol-relative ("//host/...") and
 * anything pointing back at /login, so a crafted `next` can't leave the app
 * or loop.
 */
function safeNextPath(): string | null {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) {
    return null;
  }
  return next;
}

const inputClasses =
  "w-full rounded-[10px] border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 " +
  "text-[15px] outline-none transition-colors " +
  "focus:border-emerald-600 focus:bg-white focus:ring-[3px] focus:ring-emerald-600/10";

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.16 3.19M6.6 6.6C3.9 8.36 2 11.5 2 11.5s3.5 7 10 7a10.9 10.9 0 0 0 5.4-1.43" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M2 2l20 20" />
    </svg>
  );
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      toast.error(KNOWN_AUTH_MESSAGES[error.message] ?? "Couldn't sign in. Please try again.");
      setSubmitting(false);
      return;
    }

    // full navigation so the proxy sees the fresh auth cookies
    window.location.assign(safeNextPath() ?? "/");
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
          placeholder="johndoe@deped.gov.ph"
          className={inputClasses}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Password</span>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={`${inputClasses} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 grid w-10 place-items-center text-neutral-400 hover:text-neutral-600"
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
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
