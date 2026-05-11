"use client";

import { useMemo, useState } from "react";
import { ArrowRight, GitBranch, Route, TimerReset } from "lucide-react";
import type {
  WeekendScenarioPlan,
  WeekendStrategy,
} from "@/lib/services/weekendStrategy";

function scenarioTone(id: WeekendScenarioPlan["id"]) {
  if (id === "st-vrain-first") return "border-emerald-300 bg-emerald-50";
  if (id === "split-weekend") return "border-sky-300 bg-sky-50";
  if (id === "teddy-only") return "border-amber-300 bg-amber-50";
  if (id === "relay-first") return "border-rose-300 bg-rose-50";
  return "border-violet-300 bg-violet-50";
}

function activeScenarioClass(active: boolean) {
  return active
    ? "border-[#16324f] bg-[#16324f] text-white shadow-sm"
    : "border-slate-200 bg-white text-slate-700 hover:border-[#2f6f5e]";
}

export function WeekendScenarioBracket({
  strategy,
}: {
  strategy: WeekendStrategy;
}) {
  const firstScenario = strategy.scenarioPlans[0]?.id ?? "st-vrain-first";
  const [selectedScenarioId, setSelectedScenarioId] =
    useState<WeekendScenarioPlan["id"]>(firstScenario);
  const selectedScenario =
    strategy.scenarioPlans.find((plan) => plan.id === selectedScenarioId) ??
    strategy.scenarioPlans[0];
  const selectedNode = useMemo(
    () =>
      strategy.decisionTree.find(
        (node) => node.scenarioId === selectedScenario?.id,
      ),
    [selectedScenario?.id, strategy.decisionTree],
  );

  if (!selectedScenario) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
              <GitBranch size={18} className="text-[#16324f]" />
              Weekend decision bracket
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Click a branch to see what I would do for {strategy.focusTeam}.
              Friday is modeled as the fresh St. Vrain attempt; Saturday is
              Teddy&apos;s backup or one-shot plan.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {strategy.focusTeam}
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {strategy.scenarioPlans.map((plan) => {
            const active = plan.id === selectedScenario.id;

            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedScenarioId(plan.id)}
                className={`rounded-lg border p-3 text-left transition ${activeScenarioClass(
                  active,
                )}`}
              >
                <div className="text-sm font-semibold">{plan.title}</div>
                <div
                  className={`mt-1 text-xs leading-5 ${
                    active ? "text-white/80" : "text-slate-500"
                  }`}
                >
                  {plan.expectedStateAddsLabel} · {plan.riskLabel}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="border-b border-slate-200 p-5 xl:border-b-0 xl:border-r">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Route size={18} className="text-[#2f6f5e]" />
            Branch logic
          </div>
          <div className="mt-4 space-y-3">
            {strategy.decisionTree.map((node, index) => {
              const active = node.scenarioId === selectedScenario.id;

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedScenarioId(node.scenarioId)}
                  className={`relative w-full rounded-lg border p-3 text-left transition ${
                    active
                      ? "border-[#2f6f5e] bg-[#f0faf6]"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  {index < strategy.decisionTree.length - 1 ? (
                    <span className="absolute -bottom-4 left-6 h-4 w-px bg-slate-200" />
                  ) : null}
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Step {index + 1}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">
                    {node.question}
                  </div>
                  <div className="mt-2 grid gap-2 text-xs leading-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <div className="rounded-md bg-emerald-50 p-2 text-emerald-800">
                      Yes: {node.yes}
                    </div>
                    <div className="rounded-md bg-slate-50 p-2 text-slate-600">
                      No: {node.no}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5">
          <div className={`rounded-lg border p-4 ${scenarioTone(selectedScenario.id)}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {selectedScenario.title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  {selectedScenario.subtitle}
                </p>
              </div>
              <div className="rounded-md bg-white/80 px-3 py-2 text-right shadow-sm">
                <div className="text-xs font-semibold uppercase text-slate-500">
                  Objective
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-950">
                  {selectedScenario.expectedStateAddsLabel}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-md bg-white/70 p-3 text-sm leading-6 text-slate-700">
              <TimerReset size={17} className="mt-1 shrink-0 text-[#16324f]" />
              {selectedScenario.objective}
            </div>
            {selectedNode ? (
              <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Active question: {selectedNode.question}
              </div>
            ) : null}
          </div>

          <div className="mt-4 overflow-hidden">
            <table className="app-data-table table-fixed">
              <colgroup>
                <col className="w-[13%]" />
                <col className="w-[20%]" />
                <col className="w-[16%]" />
                <col className="w-[18%]" />
                <col className="w-[11%]" />
                <col className="w-[22%]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="px-3 py-3 font-semibold">Call</th>
                  <th className="px-3 py-3 font-semibold">Athlete / relay</th>
                  <th className="px-3 py-3 font-semibold">Event</th>
                  <th className="px-3 py-3 font-semibold">Meet plan</th>
                  <th className="px-3 py-3 font-semibold">Odds</th>
                  <th className="px-3 py-3 font-semibold">Why</th>
                </tr>
              </thead>
              <tbody>
                {selectedScenario.entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100">
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                        {entry.label}
                      </span>
                    </td>
                    <td className="break-words px-3 py-3 font-semibold text-slate-950">
                      {entry.athleteOrRelay}
                    </td>
                    <td className="break-words px-3 py-3 text-slate-700">
                      {entry.eventLabel}
                    </td>
                    <td className="break-words px-3 py-3 text-slate-700">
                      {entry.meetPlan}
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-950">
                      {entry.oddsLabel}
                    </td>
                    <td className="break-words px-3 py-3 text-xs leading-5 text-slate-600">
                      {entry.reason}
                    </td>
                  </tr>
                ))}
                {!selectedScenario.entries.length ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="border-t border-slate-100 px-3 py-5 text-sm text-slate-600"
                    >
                      No scenario entries loaded for this team branch.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() => {
              const currentIndex = strategy.scenarioPlans.findIndex(
                (plan) => plan.id === selectedScenario.id,
              );
              const next =
                strategy.scenarioPlans[
                  (currentIndex + 1) % strategy.scenarioPlans.length
                ];
              if (next) setSelectedScenarioId(next.id);
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#2f6f5e]"
          >
            Try next branch
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}
