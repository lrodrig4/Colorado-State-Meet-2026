"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Mail, Send } from "lucide-react";
import { buildCoachInterestMailto } from "@/lib/utils/coachInterest";
import type { Classification } from "@/types/domain";

const classifications: Array<Classification | ""> = ["", "3A", "4A", "5A"];

export function CoachInterestForm({ recipient }: { recipient: string }) {
  const [coachName, setCoachName] = useState("");
  const [school, setSchool] = useState("");
  const [email, setEmail] = useState("");
  const [classification, setClassification] = useState<Classification | "">("");
  const [interest, setInterest] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const canSubmit =
    coachName.trim().length > 1 &&
    school.trim().length > 1 &&
    email.trim().length > 3;
  const mailto = useMemo(
    () =>
      buildCoachInterestMailto({
        recipient,
        coachName: coachName.trim(),
        school: school.trim(),
        email: email.trim(),
        classification,
        interest: interest.trim(),
      }),
    [classification, coachName, email, interest, recipient, school],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitted(true);
    window.location.href = mailto;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-[#d8e2ea] bg-white p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#08233f] text-white">
          <Mail size={18} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Request founder access
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Opens an email with your details filled in. Send the draft to join
            the founder-access list.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
          Coach name
          <input
            value={coachName}
            onChange={(event) => setCoachName(event.target.value)}
            className="app-input"
            placeholder="Jane Coach"
            required
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
          School
          <input
            value={school}
            onChange={(event) => setSchool(event.target.value)}
            className="app-input"
            placeholder="Colorado High School"
            required
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="app-input"
            placeholder="coach@school.org"
            required
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
          Division
          <select
            value={classification}
            onChange={(event) =>
              setClassification(event.target.value as Classification | "")
            }
            className="app-select"
          >
            {classifications.map((option) => (
              <option key={option || "unknown"} value={option}>
                {option || "Not sure yet"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 grid gap-1.5 text-sm font-semibold text-slate-800">
        What would make this worth paying for?
        <textarea
          value={interest}
          onChange={(event) => setInterest(event.target.value)}
          className="min-h-28 w-full rounded-md border border-[#d8e2ea] bg-white px-3 py-2 text-base text-slate-950 outline-none transition focus:border-[#0f8a5f] focus:ring-2 focus:ring-[#0f8a5f]/15"
          placeholder="Scouting reports, weekly rankings, saved team dashboard..."
        />
      </label>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-600">
          {submitted
            ? "Email draft opened. Send it to join the founder list."
            : `Sends to ${recipient}.`}
        </p>
        <button
          type="submit"
          disabled={!canSubmit}
          className="coach-action app-button-primary inline-flex h-11 items-center justify-center gap-2 px-4 text-sm disabled:cursor-not-allowed"
        >
          <Send size={16} />
          Request access
        </button>
      </div>
    </form>
  );
}
