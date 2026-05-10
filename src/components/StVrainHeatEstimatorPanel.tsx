"use client";

import { useState } from "react";
import {
  ChevronDown,
  Eye,
  Flame,
  ListTree,
  RadioTower,
  Target,
  TrendingUp,
} from "lucide-react";
import type { StVrainHeatEstimate } from "@/lib/services/stVrainHeatEstimator";

type EstimatedHeat = StVrainHeatEstimate["estimatedHeats"][number];

function planTone(plan: StVrainHeatEstimate["racePlans"][number]) {
  if (plan.isFocusTeam) return "border-[#2f6f5e] bg-[#f0faf6]";
  if (plan.stateSignalLabel !== "No app state signal") {
    return "border-rose-200 bg-rose-50";
  }
  if (plan.isFastSection) return "border-slate-200 bg-slate-50";
  return "border-slate-100 bg-white";
}

function heatTone(heat: EstimatedHeat) {
  return heat.isFastSection
    ? "border-[#2f6f5e] bg-[#f0faf6]"
    : "border-slate-200 bg-white";
}

function watchTone(watch: StVrainHeatEstimate["teamHeatWatches"][number]) {
  if (watch.heatOddsTone === "green") {
    return "border-emerald-200 bg-emerald-50";
  }
  if (watch.heatOddsTone === "amber") {
    return "border-amber-200 bg-amber-50";
  }
  if (watch.heatOddsTone === "rose") {
    return "border-rose-200 bg-rose-50";
  }
  return "border-slate-200 bg-white";
}

function chanceToneClass(
  tone: NonNullable<
    StVrainHeatEstimate["stateMarkOpportunities"][number]
  >["chanceTone"],
) {
  if (tone === "green") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-900";
  if (tone === "rose") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function storylineToneClass(
  tone: StVrainHeatEstimate["storylines"][number]["tone"],
) {
  if (tone === "green") return "border-emerald-200 bg-emerald-50";
  if (tone === "amber") return "border-amber-200 bg-amber-50";
  if (tone === "rose") return "border-rose-200 bg-rose-50";
  if (tone === "sky") return "border-sky-200 bg-sky-50";
  return "border-slate-200 bg-slate-50";
}

function TargetList({
  title,
  targets,
}: {
  title: string;
  targets: StVrainHeatEstimate["teamHeatWatches"][number]["sameHeatAhead"];
}) {
  if (!targets.length) return null;

  return (
    <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
      <div className="text-[11px] font-semibold uppercase text-slate-500">
        {title}
      </div>
      <div className="mt-1 space-y-1">
        {targets.map((target) => (
          <div
            key={target.id}
            className="flex items-start justify-between gap-2 text-xs"
          >
            <div className="min-w-0">
              <div className="font-semibold text-slate-950">
                #{target.seedRank} {target.athleteOrRelay}
              </div>
              <div className="text-slate-500">{target.school}</div>
            </div>
            <div className="shrink-0 font-semibold tabular-nums text-slate-950">
              {target.seedMarkRaw}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StVrainHeatEstimatorPanel({
  estimates,
  focusTeam,
}: {
  estimates: StVrainHeatEstimate[];
  focusTeam: string;
}) {
  const eventCount = estimates.length;
  const entryCount = estimates.reduce(
    (sum, estimate) => sum + estimate.entryCount,
    0,
  );
  const racePlanCount = estimates.reduce(
    (sum, estimate) => sum + estimate.racePlans.length,
    0,
  );
  const estimatedHeatCount = estimates.reduce(
    (sum, estimate) => sum + estimate.estimatedHeats.length,
    0,
  );
  const [openEstimateId, setOpenEstimateId] = useState<string | null>(null);

  if (!estimates.length) {
    return (
      <section className="coach-surface rounded-2xl p-5">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
          <RadioTower size={18} className="text-[#16324f]" />
          St. Vrain entries and analysis
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Live HOKA entries could not be loaded from the public AthleticLIVE
          feed yet. The field forecast below still uses the registered team
          list and state-bubble model.
        </p>
      </section>
    );
  }

  return (
    <section className="coach-surface rounded-2xl">
      <div className="border-b border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
              <RadioTower size={18} className="text-[#16324f]" />
              St. Vrain entries and analysis
            </div>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
              Uses the live HOKA entry feed plus the published 2026 heat-count
              schedule. Fast-section cuts are estimates, but seed ranks and
              marks come from the public live entries. Every event below shows
              estimated heats or flights, state-mark odds, and the biggest
              coach-planning storylines.
            </p>
          </div>
          <span className="rounded-full bg-[#f0faf6] px-3 py-1 text-xs font-semibold text-[#2f6f5e] ring-1 ring-[#b8ead9]">
            {focusTeam} highlighted
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3 sm:p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Live events
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950 sm:text-2xl">
              {eventCount}
            </div>
          </div>
          <div className="rounded-xl bg-sky-50 p-3 sm:p-3">
            <div className="text-xs font-semibold uppercase text-sky-700">
              Live entries
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950 sm:text-2xl">
              {entryCount}
            </div>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 sm:p-3">
            <div className="text-xs font-semibold uppercase text-emerald-700">
              Estimated sections
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950 sm:text-2xl">
              {estimatedHeatCount}
            </div>
          </div>
          <div className="rounded-xl bg-rose-50 p-3 sm:p-3">
            <div className="text-xs font-semibold uppercase text-rose-700">
              Race targets
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950 sm:text-2xl">
              {racePlanCount}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-3 sm:p-4 xl:grid-cols-2">
        {estimates.map((estimate) => {
          const isOpen = openEstimateId === estimate.id;

          return (
          <article
            key={estimate.id}
            className="rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() =>
                setOpenEstimateId((current) =>
                  current === estimate.id ? null : estimate.id,
                )
              }
              className="tap-row flex w-full cursor-pointer items-start justify-between gap-3 p-3 text-left sm:p-4"
              aria-expanded={isOpen}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-950">
                    {estimate.eventLabel}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {estimate.startLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {estimate.heatPatternLabel}; estimated sizes{" "}
                  {estimate.heatSizeLabel}.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                    all {estimate.sectionNounPlural} included
                  </span>
                  <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                    tap to open {estimate.sectionNoun} sheet
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-[#2f6f5e]">
                  {estimate.heatConfidenceLabel}
                </p>
              </div>
              <div className="shrink-0 rounded-xl bg-slate-50 px-2.5 py-1 text-right">
                <div className="text-lg font-semibold tabular-nums text-slate-950">
                  {estimate.entryCount}
                </div>
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  entries
                </div>
                <ChevronDown
                  size={16}
                  className={`ml-auto mt-1 text-slate-500 transition ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </button>

            {isOpen ? (
            <div className="border-t border-slate-100 px-3 pb-3 sm:px-4 sm:pb-4">
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                    <Flame size={14} />
                    Fast cut
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">
                    {estimate.fastCutoffLabel}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {estimate.fastSectionLabel}
                    {estimate.fastCutoffName
                      ? `; cutoff entry is ${estimate.fastCutoffName}.`
                      : "."}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                    <Target size={14} />
                    Race shape
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">
                    {estimate.fastestSeedLabel ?? "No top seed yet"}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {estimate.forecastSummary ??
                      "Use fast-section placement first; then compare each athlete to the Top 18 board."}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
                <span className="font-semibold text-slate-950">
                  Five-year {estimate.sectionNoun} history:
                </span>{" "}
                {estimate.historicalBasisLabel}
              </div>

              {estimate.storylines.length ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="text-sm font-semibold text-slate-950">
                    Biggest storylines
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {estimate.storylines.slice(0, 2).map((storyline) => (
                      <article
                        key={storyline.id}
                        className={`rounded-lg border p-3 ${storylineToneClass(
                          storyline.tone,
                        )}`}
                      >
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {storyline.title}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-700">
                          {storyline.body}
                        </p>
                      </article>
                    ))}
                  </div>
                  {estimate.storylines.length > 2 ? (
                    <div className="mt-2 text-xs font-semibold text-slate-500">
                      {estimate.storylines.length - 2} more storylines folded
                      into the event summary for mobile speed.
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
                      <Eye size={15} />
                      {focusTeam} heat alerts
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      These are the entries to watch because heat placement
                      changes how believable the state-chase result will be.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {estimate.teamHeatWatches.length} team entries
                  </span>
                </div>

                {estimate.teamHeatWatches.length ? (
                  <div className="mt-3 grid gap-2">
                    {estimate.teamHeatWatches.slice(0, 2).map((watch) => (
                      <div
                        key={watch.id}
                        className={`rounded-lg border p-3 ${watchTone(watch)}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-950">
                              #{watch.seedRank} · {watch.athleteOrRelay}
                            </div>
                            <div className="text-xs text-slate-600">
                              {watch.projectedHeatLabel} ·{" "}
                              {watch.heatRankRangeLabel}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold tabular-nums text-slate-950">
                              {watch.seedMarkRaw}
                            </div>
                            <div className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                              <TrendingUp size={12} />
                              {watch.heatOddsLabel}
                            </div>
                          </div>
                        </div>
                        {watch.stateMarkOpportunity ? (
                          <div className="mt-3 rounded-lg border border-white/70 bg-white p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  State-mark chance in this{" "}
                                  {watch.stateMarkOpportunity.sectionNoun}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-slate-950">
                                  Target {watch.stateMarkOpportunity.targetMarkRaw} ·{" "}
                                  {watch.stateMarkOpportunity.neededImprovementLabel}
                                </div>
                              </div>
                              <span
                                className={`rounded-full border px-2.5 py-1 text-sm font-semibold tabular-nums ${chanceToneClass(
                                  watch.stateMarkOpportunity.chanceTone,
                                )}`}
                              >
                                {watch.stateMarkOpportunity.heatAdjustedChanceLabel}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              <span>{watch.stateMarkOpportunity.baseChanceLabel}</span>
                              <span>{watch.stateMarkOpportunity.heatAdjustmentLabel}</span>
                              <span>{watch.stateMarkOpportunity.profileLabel}</span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-slate-700">
                              {watch.stateMarkOpportunity.reason}
                            </p>
                          </div>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                            {watch.stateSignalLabel}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                            {watch.fastCutoffContext}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-700">
                          {watch.summary}
                        </p>
                        <div className="mt-3 grid gap-2 lg:grid-cols-3">
                          <TargetList
                            title="Same heat ahead"
                            targets={watch.sameHeatAhead.slice(0, 2)}
                          />
                          <TargetList
                            title="Same heat chasers"
                            targets={watch.sameHeatChasers.slice(0, 2)}
                          />
                          <TargetList
                            title="Faster heat targets"
                            targets={watch.fasterHeatTargets.slice(0, 2)}
                          />
                        </div>
                      </div>
                    ))}
                    {estimate.teamHeatWatches.length > 2 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 p-3 text-xs font-semibold text-slate-500">
                        {estimate.teamHeatWatches.length - 2} more {focusTeam}{" "}
                        entries are loaded for this event but hidden here to
                        keep the phone view fast.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-slate-200 p-4 text-sm leading-6 text-slate-600">
                    No {focusTeam} entries are currently loaded in this HOKA
                    event.
                  </div>
                )}
              </div>

              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">
                      Estimated {estimate.sectionNoun} sheet
                    </div>
                    <p className="text-xs leading-5 text-slate-600">
                      Slow-to-fast projection from the live seed list. For phone
                      speed this shows every {estimate.sectionNoun} summary;
                      selected-team and state-target athletes appear in the
                      alerts above.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {estimate.heatCount} {estimate.sectionNounPlural}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {estimate.estimatedHeats.map((heat) => (
                    <div
                      key={heat.id}
                      className={`rounded-lg border p-3 ${heatTone(heat)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-slate-950">
                              {heat.label}
                            </div>
                            {heat.isFastSection ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                                state-race {estimate.sectionNoun}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-slate-600">
                            {heat.rankRangeLabel} · {heat.seedRangeLabel}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-base font-semibold tabular-nums text-slate-950">
                            {heat.entryCount}
                          </div>
                          <div className="text-[11px] font-semibold uppercase text-slate-500">
                            entries
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {estimate.racePlans.slice(0, 4).map((plan) => (
                  <div
                    key={plan.id}
                    className={`rounded-lg border p-3 ${planTone(plan)}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-950">
                          #{plan.seedRank} · {plan.athleteOrRelay}
                        </div>
                        <div className="text-sm text-slate-600">
                          {plan.school}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums text-slate-950">
                          {plan.seedMarkRaw}
                        </div>
                        <div className="text-xs text-slate-500">
                          {plan.projectedHeatLabel}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                        {plan.stateSignalLabel}
                      </span>
                      {plan.stateMarkOpportunity ? (
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${chanceToneClass(
                            plan.stateMarkOpportunity.chanceTone,
                          )}`}
                        >
                          {plan.stateMarkOpportunity.heatAdjustedChanceLabel} to hit{" "}
                          {plan.stateMarkOpportunity.targetMarkRaw}
                        </span>
                      ) : null}
                      {plan.isFastSection ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                          Fast race
                        </span>
                      ) : null}
                      {plan.isFocusTeam ? (
                        <span className="rounded-full bg-[#f0faf6] px-2.5 py-1 text-xs font-semibold text-[#2f6f5e] ring-1 ring-[#b8ead9]">
                          Team view
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      {plan.raceInstruction}
                    </p>
                  </div>
                ))}
                {estimate.racePlans.length > 4 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-3 text-xs font-semibold text-slate-500">
                    {estimate.racePlans.length - 4} additional race targets are
                    hidden in this preview.
                  </div>
                ) : null}

                {!estimate.racePlans.length ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm leading-6 text-slate-600">
                    Live entries loaded, but no selected-team or state-bubble
                    race targets were found for this event.
                  </div>
                ) : null}
              </div>

              <div className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500">
                <ListTree size={14} />
                {estimate.sectionNoun === "heat" ? "Heat" : "Flight"} sizes are
                estimated slow-to-fast from entry count and the HOKA schedule.
              </div>
            </div>
            ) : null}
          </article>
          );
        })}
      </div>
    </section>
  );
}
