"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { gradeLabel } from "@/lib/grades";
import { createLearner, updateLearner, type LearnerInput } from "./actions";

const inputClasses =
  "w-full rounded-[10px] border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 " +
  "text-[15px] outline-none transition-colors " +
  "focus:border-emerald-600 focus:bg-white focus:ring-[3px] focus:ring-emerald-600/10";

const labelClasses = "flex flex-col gap-1.5";
const spanClasses = "text-[13px] font-medium";

type Props = {
  mode: "create" | "edit";
  allowedGrades: number[];
  learnerId?: string;
  initial?: Partial<LearnerInput>;
};

const LRN_PATTERN = /^\d{12}$/;

export function LearnerForm({ mode, allowedGrades, learnerId, initial }: Props) {
  const router = useRouter();
  const [lrn, setLrn] = useState(initial?.lrn ?? "");
  const [lastName, setLastName] = useState(initial?.last_name ?? "");
  const [firstName, setFirstName] = useState(initial?.first_name ?? "");
  const [middleName, setMiddleName] = useState(initial?.middle_name ?? "");
  const [extName, setExtName] = useState(initial?.ext_name ?? "");
  const [sex, setSex] = useState<"M" | "F">(initial?.sex ?? "M");
  const [birthdate, setBirthdate] = useState(initial?.birthdate ?? "");
  const [gradeLevel, setGradeLevel] = useState(
    initial?.grade_level ?? allowedGrades[0] ?? 0
  );
  const [status, setStatus] = useState<LearnerInput["status"]>(
    initial?.status ?? "enrolled"
  );
  const [lrnError, setLrnError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!LRN_PATTERN.test(lrn)) {
      setLrnError("LRN must be exactly 12 digits.");
      return;
    }
    setLrnError(null);
    setSubmitting(true);

    const input: LearnerInput = {
      lrn,
      last_name: lastName,
      first_name: firstName,
      middle_name: middleName,
      ext_name: extName,
      sex,
      birthdate,
      grade_level: gradeLevel,
      status,
    };

    const { error } =
      mode === "create"
        ? await createLearner(input)
        : await updateLearner(learnerId!, input);

    setSubmitting(false);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success(mode === "create" ? "Learner added." : "Learner updated.");
    router.push("/learners");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className={labelClasses}>
        <span className={spanClasses}>LRN (12 digits)</span>
        <input
          value={lrn}
          onChange={(e) => {
            setLrn(e.target.value.replace(/\D/g, "").slice(0, 12));
            setLrnError(null);
          }}
          required
          autoFocus
          inputMode="numeric"
          maxLength={12}
          className={inputClasses}
        />
        {lrnError && (
          <span role="alert" className="text-[13px] text-red-600">
            {lrnError}
          </span>
        )}
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className={labelClasses}>
          <span className={spanClasses}>Last name</span>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className={inputClasses}
          />
        </label>
        <label className={labelClasses}>
          <span className={spanClasses}>First name</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className={inputClasses}
          />
        </label>
        <label className={labelClasses}>
          <span className={spanClasses}>Middle name</span>
          <input
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            className={inputClasses}
          />
        </label>
        <label className={labelClasses}>
          <span className={spanClasses}>Ext. (Jr., III…)</span>
          <input
            value={extName}
            onChange={(e) => setExtName(e.target.value)}
            className={inputClasses}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className={labelClasses}>
          <span className={spanClasses}>Sex</span>
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value as "M" | "F")}
            className={inputClasses}
          >
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </label>
        <label className={labelClasses}>
          <span className={spanClasses}>Birthdate</span>
          <input
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            className={inputClasses}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className={labelClasses}>
          <span className={spanClasses}>Grade level</span>
          <select
            value={gradeLevel}
            onChange={(e) => setGradeLevel(Number(e.target.value))}
            className={inputClasses}
          >
            {allowedGrades.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClasses}>
          <span className={spanClasses}>Status</span>
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as LearnerInput["status"])
            }
            className={inputClasses}
          >
            <option value="enrolled">Enrolled</option>
            <option value="transferred">Transferred</option>
            <option value="dropped">Dropped</option>
          </select>
        </label>
      </div>

      <div className="mt-2 flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-[10px] bg-emerald-600 px-5 py-2.5 text-[14px] font-medium text-white hover:bg-emerald-700 disabled:opacity-55"
        >
          {submitting ? "Saving…" : mode === "create" ? "Add learner" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/learners")}
          className="rounded-[10px] px-5 py-2.5 text-[14px] font-medium text-neutral-600 hover:bg-neutral-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
