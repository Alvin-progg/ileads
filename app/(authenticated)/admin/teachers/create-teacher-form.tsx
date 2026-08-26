"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createTeacher } from "./actions";

const inputClasses =
  "w-full rounded-[10px] border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 " +
  "text-[15px] outline-none transition-colors " +
  "focus:border-emerald-600 focus:bg-white focus:ring-[3px] focus:ring-emerald-600/10";

const labelClasses = "flex flex-col gap-1.5";
const spanClasses = "text-[13px] font-medium";

export function CreateTeacherForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSpecial, setIsSpecial] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setIsSpecial(false);
    setConfirmError(null);
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    if (password !== confirmPassword) {
      setConfirmError("Passwords don't match.");
      return;
    }
    setConfirmError(null);
    setSubmitting(true);

    const { error } = await createTeacher({
      firstName,
      lastName,
      email,
      password,
      isSpecial,
    });

    setSubmitting(false);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`${firstName} ${lastName} added. Assign their grades below.`);
    reset();
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-6 rounded-[10px] bg-emerald-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-emerald-700"
      >
        + Add teacher
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 rounded-xl border border-neutral-200 bg-white p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-bold">Add teacher</h2>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-[13px] text-neutral-500 hover:underline"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className={labelClasses}>
          <span className={spanClasses}>First name</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            autoFocus
            className={inputClasses}
          />
        </label>
        <label className={labelClasses}>
          <span className={spanClasses}>Last name</span>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className={inputClasses}
          />
        </label>
      </div>

      <label className={`${labelClasses} mt-4`}>
        <span className={spanClasses}>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="johndoe@deped.gov.ph"
          className={inputClasses}
        />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <label className={labelClasses}>
          <span className={spanClasses}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setConfirmError(null);
            }}
            required
            minLength={8}
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

      <label className="mt-4 flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={isSpecial}
          onChange={(e) => setIsSpecial(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-emerald-600"
        />
        <span className="text-[13px] font-medium">
          Special teacher
          {/* Spelled out because the checkbox grants nothing: Kinder access
              comes from the grade assignment, not from this label. */}
          <span className="block font-normal text-[12px] text-neutral-500">
            Handles Kindergarten. This is a label only — assign Kindergarten
            below to give access.
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 rounded-[10px] bg-emerald-600 px-5 py-2.5 text-[14px] font-medium text-white hover:bg-emerald-700 disabled:opacity-55"
      >
        {submitting ? "Adding…" : "Add teacher"}
      </button>
    </form>
  );
}
