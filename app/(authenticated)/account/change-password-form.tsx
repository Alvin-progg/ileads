"use client";

import { useState } from "react";
import { toast } from "sonner";
import { changeOwnPassword } from "./actions";

const inputClasses =
  "w-full rounded-[10px] border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 " +
  "text-[15px] outline-none transition-colors " +
  "focus:border-emerald-600 focus:bg-white focus:ring-[3px] focus:ring-emerald-600/10";

const labelClasses = "flex flex-col gap-1.5";
const spanClasses = "text-[13px] font-medium";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setConfirmError(null);
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setConfirmError("Passwords don't match.");
      return;
    }
    setConfirmError(null);
    setSubmitting(true);

    const { error } = await changeOwnPassword(currentPassword, newPassword);

    setSubmitting(false);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Password changed.");
    reset();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md rounded-xl border border-neutral-200 bg-white p-5"
    >
      <label className={labelClasses}>
        <span className={spanClasses}>Current password</span>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
          className={inputClasses}
        />
      </label>

      <label className={`${labelClasses} mt-4`}>
        <span className={spanClasses}>New password</span>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            setConfirmError(null);
          }}
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClasses}
        />
      </label>

      <label className={`${labelClasses} mt-4`}>
        <span className={spanClasses}>Confirm new password</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setConfirmError(null);
          }}
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClasses}
        />
      </label>
      {confirmError && (
        <p role="alert" className="mt-2 text-[13px] text-red-600">
          {confirmError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 rounded-[10px] bg-emerald-600 px-5 py-2.5 text-[14px] font-medium text-white hover:bg-emerald-700 disabled:opacity-55"
      >
        {submitting ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
