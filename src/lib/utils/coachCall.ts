import { getEventDefinition } from "@/lib/data/events";
import type { LastChanceRecommendation } from "@/lib/services/lastChance";

export type CoachCallTone =
  | "emerald"
  | "sky"
  | "amber"
  | "orange"
  | "rose"
  | "violet"
  | "slate";

export type CoachCall = {
  label: string;
  tone: CoachCallTone;
  urgent: boolean;
};

export function coachCall(row: LastChanceRecommendation): CoachCall {
  const definition = getEventDefinition(row.event);
  const isRelay = definition.relay;
  const seniorIndividual = row.grade === 12 && !isRelay;
  const state = row.stateProbability;
  const hold = row.holdProbability;
  const improve = row.improveProbability;

  if (row.scratchProbability >= 55) {
    return { label: "Coach call", tone: "rose", urgent: true };
  }

  if (row.rank <= 18) {
    if (isRelay) {
      if (state >= 88) {
        return { label: "Relay priority", tone: "emerald", urgent: false };
      }

      if (state >= 72) {
        return { label: "Relay watch", tone: "amber", urgent: true };
      }

      return { label: "Relay at risk", tone: "rose", urgent: true };
    }

    if (state >= 96) {
      return { label: "Lock", tone: "emerald", urgent: false };
    }

    if (state >= 88) {
      return { label: "Safe", tone: "emerald", urgent: false };
    }

    if (state >= 78) {
      return {
        label: "Watch",
        tone: "amber",
        urgent: true,
      };
    }

    if (state >= 68) {
      return { label: "At risk", tone: "amber", urgent: true };
    }

    return { label: "At risk", tone: "rose", urgent: true };
  }

  if (seniorIndividual && improve >= 68 && hold <= 18) {
    return { label: "Senior chase", tone: "violet", urgent: true };
  }

  if (state >= 52) {
    return { label: "Run it", tone: "amber", urgent: true };
  }

  if (state >= 40) {
    return { label: "Chase if fresh", tone: "amber", urgent: true };
  }

  if (state >= 30) {
    return { label: "PR + help", tone: "orange", urgent: true };
  }

  if (state >= 20) {
    return {
      label: seniorIndividual ? "Senior PR" : "Big PR",
      tone: "rose",
      urgent: true,
    };
  }

  if (improve >= 56) {
    return { label: "Upside", tone: "sky", urgent: true };
  }

  if (isRelay) {
    return { label: "Relay depth", tone: "slate", urgent: false };
  }

  if (row.status === "Monitor") {
    return { label: "Watch", tone: "sky", urgent: false };
  }

  return { label: "Low ROI", tone: "slate", urgent: false };
}

export function coachCallClass(call: CoachCall) {
  const toneClass: Record<CoachCallTone, string> = {
    emerald: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
    sky: "bg-sky-50 text-sky-800 ring-1 ring-sky-200",
    amber: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
    orange: "bg-orange-50 text-orange-900 ring-1 ring-orange-200",
    rose: "bg-rose-50 text-rose-800 ring-1 ring-rose-200",
    violet: "bg-violet-50 text-violet-800 ring-1 ring-violet-200",
    slate: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  };

  return toneClass[call.tone];
}
