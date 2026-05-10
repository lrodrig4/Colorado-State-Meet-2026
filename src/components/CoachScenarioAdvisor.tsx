"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  MessageSquareText,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import type {
  WeekendAthletePlan,
  WeekendRelayPlan,
  WeekendStrategy,
} from "@/lib/services/weekendStrategy";

type Answer = {
  title: string;
  bullets: string[];
};

function toneClass(tone: WeekendAthletePlan["coachCallTone"]) {
  const classes: Record<WeekendAthletePlan["coachCallTone"], string> = {
    emerald: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
    sky: "bg-sky-50 text-sky-800 ring-1 ring-sky-200",
    amber: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
    orange: "bg-orange-50 text-orange-900 ring-1 ring-orange-200",
    rose: "bg-rose-50 text-rose-800 ring-1 ring-rose-200",
    violet: "bg-violet-50 text-violet-800 ring-1 ring-violet-200",
    slate: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  };

  return classes[tone];
}

function relayToneClass(tone: WeekendRelayPlan["tone"]) {
  if (tone === "green") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
  if (tone === "amber") return "bg-amber-50 text-amber-900 ring-1 ring-amber-200";
  if (tone === "rose") return "bg-rose-50 text-rose-800 ring-1 ring-rose-200";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function wordsForName(name: string) {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 3);
}

function planMatchesQuery(plan: WeekendAthletePlan, query: string) {
  return wordsForName(plan.athleteName).some((word) => query.includes(word));
}

function relayMatchesQuery(plan: WeekendRelayPlan, query: string) {
  const label = plan.relayLabel.toLowerCase();
  if (query.includes("4x8") || query.includes("4 by 8")) {
    return label.includes("4x800");
  }
  if (query.includes("4x4") || query.includes("4 by 4")) {
    return label.includes("4x400");
  }
  if (query.includes("4x2") || query.includes("4 by 2")) {
    return label.includes("4x200");
  }
  if (query.includes("4x1") || query.includes("4 by 1")) {
    return label.includes("4x100");
  }
  return label.includes(query);
}

function athleteAnswer(plan: WeekendAthletePlan): Answer {
  return {
    title: `${plan.athleteName}: ${plan.coachCallLabel}`,
    bullets: [
      `${plan.eventLabel}, ${plan.rankLabel}, ${plan.markRaw}. State odds ${plan.stateProbabilityLabel}; hold ${plan.holdProbabilityLabel}; improve ${plan.improveProbabilityLabel}.`,
      plan.instruction,
      plan.reason,
      plan.eventChoiceNote ?? "",
      plan.repeatWarning ?? "",
      plan.restAdvice ?? "",
      plan.primarySlotLabel
        ? `Best first window: ${plan.primarySlotLabel}.${plan.backupSlotLabel ? ` Backup: ${plan.backupSlotLabel}.` : ""}`
        : "No last-chance schedule slot is loaded for this event yet.",
      plan.weekendEntryLabels.length
        ? `Loaded weekend entries: ${plan.weekendEntryLabels.join("; ")}.${plan.weekendStateMarkChanceLabel ? ` Weekend state-mark chance: ${plan.weekendStateMarkChanceLabel}.` : ""}`
        : "No Windjammer, Friday Night Lights, or Teddy entry is loaded for this event.",
    ].filter(Boolean),
  };
}

function relayAnswer(plan: WeekendRelayPlan): Answer {
  const impact = plan.athleteImpacts
    .filter(
      (item) =>
        item.opportunityLabel === "High individual cost" ||
        item.opportunityLabel === "Real trade-off",
    )
    .slice(0, 2);

  return {
    title: `${plan.relayLabel}: ${plan.call}`,
    bullets: [
      `${plan.currentRankLabel}${plan.currentMarkRaw ? `, ${plan.currentMarkRaw}` : ""}. Relay odds ${plan.relayStateOddsLabel}; projected lineup ${plan.projectedLineupRaw ?? "needs marks"}.`,
      plan.recommendation,
      impact.length
        ? `Key trade-off: ${impact
            .map(
              (item) =>
                `${item.athleteName} (${item.individualEventLabel ?? "individual path"} ${item.individualStateOddsLabel ?? ""})`,
            )
            .join("; ")}.`
        : "No major individual conflict in the projected top-four relay pool.",
      plan.primarySlotLabel
        ? `Relay windows: ${plan.primarySlotLabel}${plan.backupSlotLabel ? `; ${plan.backupSlotLabel}` : ""}.`
        : "No relay schedule slot is loaded yet.",
    ],
  };
}

function scheduleAnswer(strategy: WeekendStrategy): Answer {
  return {
    title: "Friday/Saturday plan",
    bullets: [
      ...strategy.scheduleNotes,
      strategy.athletePlans[0]
        ? `First athlete priority: ${strategy.athletePlans[0].athleteName} in ${strategy.athletePlans[0].eventLabel}. ${strategy.athletePlans[0].instruction}`
        : "No athlete priority rows are loaded for this team view.",
      strategy.relayPlans[0]
        ? `First relay trade-off: ${strategy.relayPlans[0].relayLabel}. ${strategy.relayPlans[0].recommendation}`
        : "No relay trade-off rows are loaded for this team view.",
    ],
  };
}

function seniorAnswer(strategy: WeekendStrategy): Answer {
  const seniors = strategy.athletePlans
    .filter((plan) => plan.gradeLabel === "Senior")
    .slice(0, 4);

  return {
    title: "Senior protection list",
    bullets: seniors.length
      ? seniors.map(
          (plan) =>
            `${plan.athleteName}, ${plan.eventLabel}: ${plan.instruction}`,
        )
      : [
          "No senior-specific priority is showing in this team view. Use the top race priority rows instead.",
        ],
  };
}

function answerScenario(strategy: WeekendStrategy, rawQuery: string): Answer {
  const query = rawQuery.trim().toLowerCase();

  if (!query) {
    return {
      title: strategy.defaultAnswerTitle,
      bullets: strategy.defaultAnswerBullets,
    };
  }

  const relayQuery =
    query.includes("relay") ||
    query.includes("4x") ||
    query.includes("4 by");
  if (relayQuery) {
    const relay = strategy.relayPlans.find((plan) =>
      relayMatchesQuery(plan, query),
    );
    if (relay) return relayAnswer(relay);
  }

  const athlete = strategy.athletePlans.find((plan) =>
    planMatchesQuery(plan, query),
  );
  if (athlete) return athleteAnswer(athlete);

  const relay = strategy.relayPlans.find((plan) =>
    relayMatchesQuery(plan, query),
  );
  if (relay) return relayAnswer(relay);

  if (
    query.includes("friday") ||
    query.includes("saturday") ||
    query.includes("windjammer") ||
    query.includes("friday night lights") ||
    query.includes("st vrain") ||
    query.includes("st. vrain") ||
    query.includes("teddy")
  ) {
    return scheduleAnswer(strategy);
  }

  if (query.includes("senior") || query.includes("protect")) {
    return seniorAnswer(strategy);
  }

  return {
    title: strategy.defaultAnswerTitle,
    bullets: strategy.defaultAnswerBullets,
  };
}

export function CoachScenarioAdvisor({
  strategy,
}: {
  strategy: WeekendStrategy;
}) {
  const initialAnswer = useMemo(
    () => answerScenario(strategy, ""),
    [strategy],
  );
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<Answer>(initialAnswer);
  const topPlans = strategy.athletePlans.slice(0, 3);
  const topRelay = strategy.relayPlans[0];

  function submit(nextQuery = query) {
    setAnswer(answerScenario(strategy, nextQuery));
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="grid gap-0 xl:grid-cols-[1fr_0.95fr]">
        <div className="border-b border-slate-200 p-5 xl:border-b-0 xl:border-r">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
                <MessageSquareText size={18} className="text-[#16324f]" />
                Weekend scenario advisor
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {strategy.basisLabel}. Ask about relays, seniors, Friday vs
                Saturday, or a specific athlete.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Team-specific
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {strategy.quickQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => {
                  setQuery(question);
                  submit(question);
                }}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[#2f6f5e] hover:bg-white"
              >
                {question}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
              placeholder="Example: Should we chase boys 4x800 or protect Noah?"
              className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#2f6f5e] focus:ring-2 focus:ring-[#2f6f5e]/15"
            />
            <button
              type="button"
              onClick={() => submit()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#16324f] px-4 text-sm font-semibold text-white transition hover:bg-[#0f263d]"
            >
              <Send size={15} />
              Ask
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-[#d8e2ea] bg-[#f8fbfd] p-4">
            <h3 className="text-base font-semibold text-slate-950">
              {answer.title}
            </h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {answer.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2">
                  <ShieldCheck
                    size={16}
                    className="mt-1 shrink-0 text-[#2f6f5e]"
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="p-5">
          <div className="grid gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <CalendarDays size={18} className="text-[#2f6f5e]" />
              Race windows
            </div>
            {topPlans.map((plan) => (
              <div
                key={plan.id}
                className="rounded-md border border-slate-200 bg-white p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-950">
                      {plan.athleteName}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-600">
                      {plan.eventLabel} · {plan.rankLabel} ·{" "}
                      {plan.stateProbabilityLabel} state
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass(
                      plan.coachCallTone,
                    )}`}
                  >
                    {plan.coachCallLabel}
                  </span>
                </div>
                <div className="mt-2 text-xs leading-5 text-slate-500">
                  {plan.primarySlotLabel ?? "No loaded meet slot"}
                  {plan.backupSlotLabel ? ` · Backup: ${plan.backupSlotLabel}` : ""}
                  {plan.weekendEntryLabels.length
                    ? ` · Entries: ${plan.weekendEntryLabels.join("; ")}`
                    : ""}
                </div>
              </div>
            ))}

            {topRelay ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <Users size={17} className="text-[#16324f]" />
                  First relay trade-off
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-950">
                      {topRelay.relayLabel}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-600">
                      {topRelay.currentRankLabel} · odds{" "}
                      {topRelay.relayStateOddsLabel} · {topRelay.repeatabilityLabel}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${relayToneClass(
                      topRelay.tone,
                    )}`}
                  >
                    {topRelay.call}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {topRelay.recommendation} {topRelay.repeatabilitySummary}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
