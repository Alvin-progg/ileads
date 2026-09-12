"use client";

import { useState } from "react";
import { toast } from "sonner";
import { resetTeacherPassword } from "./actions";

const inputClasses =
  "w-full rounded-[10px] border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 " +
  "text-[15px] outline-none transition-colors " +
  "focus:border-emerald-600 focus:bg-white focus:ring-[3px] focus:ring-emerald-600/10";

const labelClasses = "flex flex-col gap-1.5";
const spanClasses = "text-[13px] font-medium";

/** Expanded inline form for setting a teacher's password directly — rendered
 * full-width below the row when open. The trigger button lives in the row's
 * own button group; open/close state is owned by the parent row. */
export function ResetTeacherPasswordForm({
  teacherId,
  fullName,
  onClose,
}: {
  teacherId: string;
  fullName: string;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setConfirmError("Passwords don't match.");
      return;
    }
    setConfirmError(null);
    setSubmitting(true);

    const { error } = await resetTeacherPassword(teacherId, newPassword);

    setSubmitting(false);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`New password set for ${fullName}. Share it with them directly.`);
    onClose();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 w-full rounded-lg border border-neutral-200 bg-neutral-50 p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClasses}>
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
            autoFocus
            autoComplete="new-password"
            className={inputClasses}
          />
        </label>
        <label className={labelClasses}>
          <span className={spanClasses}>Confirm password</span>
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
      </div>
      {confirmError && (
        <p role="alert" className="mt-2 text-[13px] text-red-600">
          {confirmError}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-neutral-900 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-neutral-800 disabled:opacity-55"
        >
          {submitting ? "Setting…" : "Set password"}
        </button>
        <button type="button" onClick={onClose} className="text-[13px] text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
