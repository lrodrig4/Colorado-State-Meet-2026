"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight, GitBranch, UserRound, UsersRound } from "lucide-react";
import { weatherNoteForSlotLabel } from "@/lib/data/weekendWeather";
import type {
  WeekendAthletePlan,
  WeekendRelayPlan,
} from "@/lib/services/weekendStrategy";

type ScenarioMode = "best" | "friday" | "split" | "teddy" | "rest";
type PlannerView = "athletes" | "relays";

const scenarioOptions: Array<{ id: ScenarioMode; label: string }> = [
  { id: "best", label: "Best call" },
  { id: "friday", label: "St. Vrain" },
  { id: "split", label: "Fri + Sat" },
  { id: "teddy", label: "Teddy only" },
  { id: "rest", label: "Rest check" },
];

function pct(label: string) {
  return Number.parseInt(label, 10) || 0;
}

function nodeClass(active: boolean) {
  return active
    ? "border-[#16324f] bg-[#f3f8fb] shadow-sm"
    : "border-slate-200 bg-white";
}

function modeMeetPlan(plan: WeekendAthletePlan, mode: ScenarioMode) {
  const is3200 = plan.eventLabel.includes("3200m");
  const primaryWeather = weatherNoteForSlotLabel(plan.primarySlotLabel);
  const backupWeather = weatherNoteForSlotLabel(plan.backupSlotLabel);
  const entryContext = plan.weekendEntryLabels.length
    ? ` Loaded entries: ${plan.weekendEntryLabels.join("; ")}.`
    : " No Windjammer, Friday Night Lights, or Teddy entry is loaded for this event.";

  if (mode === "rest") {
    return plan.restAdvice
      ? `Rest/protect: ${plan.restAdvice}`
      : `Controlled tune-up only if it helps rhythm. ${plan.repeatWarning ?? ""}`;
  }

  if (mode === "friday") {
    if (!plan.primarySlotLabel) return `No St. Vrain slot loaded for this event.${entryContext}`;
    return is3200
      ? `${plan.primarySlotLabel} only. Do not repeat the 3200 Saturday. Weather: ${primaryWeather ?? "check forecast before entries."}${entryContext}`
      : `${plan.primarySlotLabel}. Use this as the fresh primary attempt. Weather: ${primaryWeather ?? "check forecast before entries."}${entryContext}`;
  }

  if (mode === "split") {
    if (is3200) {
      return `${plan.primarySlotLabel ?? "Friday"} only; Teddy 3200 only if there is no Friday start.${entryContext}`;
    }

    return `${plan.primarySlotLabel ?? "Friday first"}; ${plan.backupSlotLabel ?? "Saturday"} only if the first attempt misses or does not happen.${entryContext}`;
  }

  if (mode === "teddy") {
    if (!plan.backupSlotLabel) return `No Teddy slot loaded for this event.${entryContext}`;
    return is3200
      ? `${plan.backupSlotLabel} as the one 3200 attempt only if Friday is not used. Weather: ${backupWeather ?? "check forecast before entries."}${entryContext}`
      : `${plan.backupSlotLabel}. One-shot Saturday plan; account for fatigue from any Friday work. Weather: ${backupWeather ?? "check forecast before entries."}${entryContext}`;
  }

  return plan.instruction;
}

function finalCall(plan: WeekendAthletePlan, mode: ScenarioMode) {
  const state = pct(plan.stateProbabilityLabel);
  const improve = pct(plan.improveProbabilityLabel);
  const secondary = plan.eventChoiceNote?.startsWith("Secondary event");

  if (mode === "rest" || (plan.restAdvice && state >= 88 && mode === "best")) {
    return "Rest/protect unless the race has a clear state-weekend purpose.";
  }

  if (plan.eventLabel.includes("3200m")) {
    return "Pick one 3200 attempt. Friday is preferred when available; do not race it on back-to-back days.";
  }

  if (secondary) {
    return "Do this only after the athlete's higher-value event is protected or completed.";
  }

  if (plan.gradeLabel === "Senior" && improve >= 55) {
    return "Prioritize a fresh individual attempt before relay load.";
  }

  if (state >= 78) {
    return "Protect the seed first; race only if the mark or scoring position can meaningfully improve.";
  }

  return "Chase only if the athlete is fresh enough for a real PR attempt.";
}

function flowNodes(plan: WeekendAthletePlan, mode: ScenarioMode) {
  const state = pct(plan.stateProbabilityLabel);
  const secondary = plan.eventChoiceNote?.startsWith("Secondary event");
  const safe = Boolean(plan.restAdvice && state >= 88);
  const is3200 = plan.eventLabel.includes("3200m");
  const hasFriday = Boolean(plan.primarySlotLabel?.includes("Friday"));
  const hasSaturday = Boolean(plan.backupSlotLabel?.includes("Saturday"));

  return [
    {
      title: "1. Best event?",
      question: "Is this the best state path for this athlete?",
      active: !secondary,
      yes: "Keep this event in the plan.",
      no: plan.eventChoiceNote ?? "Check their stronger event first.",
    },
    {
      title: "2. Already safe?",
      question: "Does the current mark already hold strongly?",
      active: safe,
      yes: plan.restAdvice ?? "Protect the state seed.",
      no: "Continue to the last-chance decision.",
    },
    {
      title: "3. Distance risk?",
      question: "Is this a 3200 or another high-fatigue effort?",
      active: is3200,
      yes: is3200
        ? "One 3200 attempt only. No Friday/Saturday 3200 double."
        : (plan.repeatWarning ?? "Manage the repeat carefully."),
      no: plan.repeatWarning ?? "A repeat is possible if the athlete is fresh.",
    },
    {
      title: "4. Meet choice",
      question: "Which meet path fits this athlete?",
      active:
        mode === "best" ||
        (mode === "friday" && hasFriday) ||
        (mode === "teddy" && hasSaturday) ||
        mode === "split",
      yes: modeMeetPlan(plan, mode),
      no: "Choose a different meet path or rest.",
    },
  ];
}

function relayModePlan(plan: WeekendRelayPlan, mode: ScenarioMode) {
  const primaryWeather = weatherNoteForSlotLabel(plan.primarySlotLabel);
  const backupWeather = weatherNoteForSlotLabel(plan.backupSlotLabel);

  if (mode === "rest") {
    return plan.call === "Already qualified"
      ? "Protect the relay seed. Keep handoffs sharp without spending legs."
      : "Rest the relay unless it does not pull from higher-priority individual paths.";
  }

  if (mode === "friday") {
    return plan.primarySlotLabel
      ? `${plan.primarySlotLabel}. Use Friday only if the lineup is the real top four and the individual cost is acceptable. Weather: ${primaryWeather ?? "check forecast before entries."}`
      : "No St. Vrain relay slot loaded.";
  }

  if (mode === "split") {
    return `${plan.primarySlotLabel ?? "Friday"} first if the relay is worth chasing; ${plan.backupSlotLabel ?? "Saturday"} only if it does not compromise individual races.`;
  }

  if (mode === "teddy") {
    return plan.backupSlotLabel
      ? `${plan.backupSlotLabel}. Saturday-only relay chase has more fatigue risk. Weather: ${backupWeather ?? "check forecast before entries."}`
      : "No Teddy relay slot loaded.";
  }

  return plan.recommendation;
}

function relayFinalCall(plan: WeekendRelayPlan, mode: ScenarioMode) {
  if (mode === "rest" || plan.call === "Already qualified") {
    return "Protect the qualified relay unless the lineup needs a controlled handoff rep.";
  }

  if (plan.call === "Protect individuals") {
    return "Do not chase this relay before the high-value individual races are protected.";
  }

  if (plan.lineupCost >= 50) {
    return "Only run this relay with alternates or after the individual state path is settled.";
  }

  if (plan.call === "Chase relay") {
    return "This relay is a real chase candidate if the best four are available fresh.";
  }

  return "Conditional relay. Use it only if entries, freshness, and individual priorities line up.";
}

function relayFlowNodes(plan: WeekendRelayPlan, mode: ScenarioMode) {
  const seeded = plan.currentRankLabel.startsWith("#");
  const highCost = plan.lineupCost >= 50;
  const realOdds = pct(plan.projectedQualifyOddsLabel) >= 35;
  const hasLineup = Boolean(plan.projectedLineupRaw);

  return [
    {
      title: "1. Seed status",
      question: "Is this relay already in the state field?",
      active: seeded,
      yes: "Protect the lineup and avoid unnecessary fatigue.",
      no: `${plan.currentRankLabel}. Use the projected lineup and gap before entering it.`,
    },
    {
      title: "2. Lineup cost",
      question: "Does this relay cost a priority individual?",
      active: highCost,
      yes: plan.tradeoffSummary,
      no: "Projected relay pool does not show a major individual conflict.",
    },
    {
      title: "3. Relay upside",
      question: "Does the projected relay have enough state upside?",
      active: realOdds && hasLineup,
      yes: `${plan.projectedLineupRaw ?? "Needs marks"}; ${plan.projectedGapLabel ?? plan.projectedQualifyOddsLabel}.`,
      no: plan.alternateSummary ?? "Add missing marks or use alternates before chasing.",
    },
    {
      title: "4. Meet choice",
      question: "Where should this relay fit this weekend?",
      active: mode !== "rest",
      yes: relayModePlan(plan, mode),
      no: "Rest or protect individual races first.",
    },
  ];
}

function ViewButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
        active
          ? "border-[#16324f] bg-[#16324f] text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-[#2f6f5e]"
      }`}
    >
      {children}
    </button>
  );
}

export function IndividualDecisionFlowchart({
  athletePlans,
  relayPlans = [],
  focusTeam,
}: {
  athletePlans: WeekendAthletePlan[];
  relayPlans?: WeekendRelayPlan[];
  focusTeam: string;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, WeekendAthletePlan[]>();

    for (const plan of athletePlans) {
      map.set(plan.athleteName, [...(map.get(plan.athleteName) ?? []), plan]);
    }

    return [...map.entries()]
      .map(([name, plans]) => ({
        name,
        plans: plans.sort((a, b) => b.priorityScore - a.priorityScore),
      }))
      .sort(
        (a, b) => b.plans[0].priorityScore - a.plans[0].priorityScore,
      );
  }, [athletePlans]);

  const [view, setView] = useState<PlannerView>("athletes");
  const [athleteName, setAthleteName] = useState(grouped[0]?.name ?? "");
  const selectedGroup =
    grouped.find((group) => group.name === athleteName) ?? grouped[0];
  const [eventId, setEventId] = useState(selectedGroup?.plans[0]?.id ?? "");
  const selectedPlan =
    selectedGroup?.plans.find((plan) => plan.id === eventId) ??
    selectedGroup?.plans[0];
  const [relayId, setRelayId] = useState(relayPlans[0]?.id ?? "");
  const selectedRelay =
    relayPlans.find((plan) => plan.id === relayId) ?? relayPlans[0];
  const [mode, setMode] = useState<ScenarioMode>("best");
  const activeView: PlannerView =
    view === "relays" && relayPlans.length ? "relays" : "athletes";

  if (!selectedPlan && !selectedRelay) return null;

  const athleteNodes = selectedPlan ? flowNodes(selectedPlan, mode) : [];
  const relayNodes = selectedRelay ? relayFlowNodes(selectedRelay, mode) : [];
  const nodes = activeView === "relays" ? relayNodes : athleteNodes;

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
              <GitBranch size={18} className="text-[#16324f]" />
              Individual and relay weekend flowchart
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Pick an athlete or relay from {focusTeam}, then walk through St.
              Vrain, Teddy&apos;s, both meets, or a rest/protect call.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {grouped.length} athletes · {relayPlans.length} relays
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <ViewButton
            active={activeView === "athletes"}
            onClick={() => setView("athletes")}
          >
            Athletes
          </ViewButton>
          <ViewButton
            active={activeView === "relays"}
            onClick={() => setView("relays")}
          >
            Relays
          </ViewButton>
        </div>

        {activeView === "athletes" && selectedGroup && selectedPlan ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
            <label className="text-sm font-semibold text-slate-700">
              Athlete
              <select
                value={selectedGroup.name}
                onChange={(event) => {
                  const next = grouped.find(
                    (group) => group.name === event.target.value,
                  );
                  setAthleteName(event.target.value);
                  setEventId(next?.plans[0]?.id ?? "");
                }}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-[#2f6f5e]"
              >
                {grouped.map((group) => (
                  <option key={group.name} value={group.name}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Event path
              <select
                value={selectedPlan.id}
                onChange={(event) => setEventId(event.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-[#2f6f5e]"
              >
                {selectedGroup.plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.eventLabel} · {plan.rankLabel} · {plan.stateProbabilityLabel} state
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : selectedRelay ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
            <label className="text-sm font-semibold text-slate-700">
              Relay
              <select
                value={selectedRelay.id}
                onChange={(event) => setRelayId(event.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-[#2f6f5e]"
              >
                {relayPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.relayLabel} · {plan.currentRankLabel} · {plan.call}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              Shows every selected-team relay, including low-ROI, unqualified,
              and already-qualified relays.
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {scenarioOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                mode === option.id
                  ? "border-[#16324f] bg-[#16324f] text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-[#2f6f5e]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="border-b border-slate-200 p-5 xl:border-b-0 xl:border-r">
          {activeView === "relays" && selectedRelay ? (
            <RelaySummary plan={selectedRelay} mode={mode} />
          ) : selectedPlan ? (
            <AthleteSummary plan={selectedPlan} mode={mode} />
          ) : null}
        </div>

        <div className="p-5">
          <div className="grid gap-3 md:grid-cols-2">
            {nodes.map((node, index) => (
              <div
                key={node.title}
                className={`relative rounded-lg border p-4 ${nodeClass(node.active)}`}
              >
                {index < nodes.length - 1 ? (
                  <ArrowRight
                    size={17}
                    className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-slate-300 md:block"
                  />
                ) : null}
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {node.title}
                </div>
                <div className="mt-1 text-sm font-semibold leading-5 text-slate-950">
                  {node.question}
                </div>
                <div className="mt-3 grid gap-2 text-xs leading-5">
                  <div className="rounded-md bg-emerald-50 p-2 text-emerald-800">
                    Yes: {node.yes}
                  </div>
                  <div className="rounded-md bg-slate-50 p-2 text-slate-600">
                    No: {node.no}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {activeView === "relays" && selectedRelay ? (
            <RelayWhy plan={selectedRelay} />
          ) : selectedPlan ? (
            <AthleteWhy plan={selectedPlan} />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AthleteSummary({
  plan,
  mode,
}: {
  plan: WeekendAthletePlan;
  mode: ScenarioMode;
}) {
  return (
    <>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0f2a47] text-white">
          <UserRound size={19} />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            {plan.athleteName}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {plan.gradeLabel} · {plan.eventLabel} · {plan.rankLabel} ·{" "}
            {plan.markRaw}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center">
        <Metric value={plan.stateProbabilityLabel} label="State" />
        <Metric value={plan.holdProbabilityLabel} label="Hold" muted />
        <Metric value={plan.improveProbabilityLabel} label="Improve" green />
      </div>
      {plan.weekendStateMarkChanceLabel || plan.weekendEntryLabels.length ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Weekend entries
          </div>
          <div className="mt-1 font-semibold text-slate-950">
            {plan.weekendStateMarkChanceLabel
              ? `${plan.weekendStateMarkChanceLabel} state-mark chance in loaded weekend fields`
              : "Entry loaded"}
          </div>
          <p className="mt-1 text-xs leading-5">
            {plan.weekendEntryLabels.length
              ? plan.weekendEntryLabels.join("; ")
              : "No loaded Windjammer / Friday Night Lights / Teddy entry for this event."}
          </p>
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-[#d8e2ea] bg-[#fbfcfd] p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Final call
        </div>
        <div className="mt-2 text-base font-semibold leading-6 text-slate-950">
          {finalCall(plan, mode)}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {modeMeetPlan(plan, mode)}
        </p>
      </div>
    </>
  );
}

function RelaySummary({
  plan,
  mode,
}: {
  plan: WeekendRelayPlan;
  mode: ScenarioMode;
}) {
  return (
    <>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0f2a47] text-white">
          <UsersRound size={19} />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            {plan.relayLabel}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {plan.currentRankLabel}
            {plan.currentMarkRaw ? ` · ${plan.currentMarkRaw}` : ""} ·{" "}
            {plan.call}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center">
        <Metric value={plan.relayStateOddsLabel} label="State" />
        <Metric value={plan.repeatabilityLabel} label="Repeat" muted />
        <Metric value={`${plan.lineupCost}`} label="Cost" green={plan.lineupCost < 36} />
      </div>
      <div className="mt-3 rounded-lg border border-[#d8e2ea] bg-white p-3 text-sm leading-6 text-slate-600">
        <span className="font-semibold text-slate-950">
          State lineup:
        </span>{" "}
        {plan.adjustedProjectedMarkRaw ?? plan.projectedLineupRaw ?? "needs marks"}
        {plan.alternateLossRaw
          ? ` · alternate loss ${plan.alternateLossRaw}`
          : ""}{" "}
        · {plan.projectedPointsSwingLabel}
      </div>

      <div className="mt-4 rounded-lg border border-[#d8e2ea] bg-[#fbfcfd] p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Final call
        </div>
        <div className="mt-2 text-base font-semibold leading-6 text-slate-950">
          {relayFinalCall(plan, mode)}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {relayModePlan(plan, mode)}
        </p>
      </div>
    </>
  );
}

function Metric({
  value,
  label,
  muted,
  green,
}: {
  value: string;
  label: string;
  muted?: boolean;
  green?: boolean;
}) {
  return (
    <div>
      <div
        className={`text-xl font-semibold tabular-nums ${
          green ? "text-[#2f6f5e]" : muted ? "text-slate-700" : "text-slate-950"
        }`}
      >
        {value}
      </div>
      <div className="text-[11px] font-semibold uppercase text-slate-500">
        {label}
      </div>
    </div>
  );
}

function AthleteWhy({ plan }: { plan: WeekendAthletePlan }) {
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
      <div className="font-semibold text-slate-950">Why this call</div>
      <p className="mt-1">{plan.reason}</p>
      {plan.eventChoiceNote ? <p className="mt-2">{plan.eventChoiceNote}</p> : null}
      {plan.repeatWarning ? <p className="mt-2">{plan.repeatWarning}</p> : null}
      {plan.weekendEntryReason ? (
        <p className="mt-2">
          <span className="font-semibold text-slate-950">Weekend field:</span>{" "}
          {plan.weekendEntryReason}
        </p>
      ) : null}
    </div>
  );
}

function RelayWhy({ plan }: { plan: WeekendRelayPlan }) {
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
      <div className="font-semibold text-slate-950">Why this relay call</div>
      <p className="mt-1">{plan.recommendation}</p>
      <p className="mt-2">
        <span className="font-semibold text-slate-950">
          {plan.repeatabilityLabel}:
        </span>{" "}
        {plan.repeatabilitySummary}
      </p>
      <p className="mt-2">{plan.tradeoffSummary}</p>
      {plan.alternateSummary ? <p className="mt-2">{plan.alternateSummary}</p> : null}
      {plan.athleteImpacts.length ? (
        <div className="mt-3 grid gap-2">
          {plan.athleteImpacts.slice(0, 4).map((impact) => (
            <div
              key={`${plan.id}-${impact.athleteName}`}
              className="rounded-md bg-white p-2 text-xs leading-5 text-slate-600"
            >
              <span className="font-semibold text-slate-950">
                {impact.athleteName}:
              </span>{" "}
              {impact.detail}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
