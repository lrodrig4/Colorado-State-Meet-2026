"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Image as ImageIcon, Medal, Trophy } from "lucide-react";
import type { Classification, RankingResult } from "@/types/domain";
import { eventDefinitions, getEventDefinition } from "@/lib/data/events";
import { focusTeamHref, shortSchoolName } from "@/lib/utils/focusTeam";
import { withClassificationHref } from "@/lib/utils/classificationScope";
import { rankingPath } from "@/lib/utils/rankingRoutes";
import type { ScratchPrediction } from "@/lib/services/lastChance";

function scratchRead(row: ScratchPrediction) {
  if (row.netScratchCall === "Likely scratch" || row.scratchProbability >= 55) {
    return {
      label: "Likely drop",
      className: "border-rose-200 bg-rose-50 text-rose-800",
    };
  }

  if (row.netScratchCall === "Maybe scratch" || row.scratchProbability >= 35) {
    return {
      label: "May drop",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  return {
    label: "Check",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  };
}

export function RankingLinks({
  rankings,
  focusTeam,
  classification,
  scratchPredictions = [],
}: {
  rankings: RankingResult[];
  focusTeam?: string;
  classification?: Classification;
  scratchPredictions?: ScratchPrediction[];
}) {
  const hrefFor = (ranking: RankingResult) =>
    focusTeam
      ? focusTeamHref(
          rankingPath(ranking.gender, getEventDefinition(ranking.event).slug),
          focusTeam,
          classification,
      )
      : classification
        ? withClassificationHref(
            rankingPath(ranking.gender, getEventDefinition(ranking.event).slug),
            classification,
          )
        : rankingPath(ranking.gender, getEventDefinition(ranking.event).slug);
  const focusShortName = focusTeam ? shortSchoolName(focusTeam) : undefined;
  const rankingOptions = useMemo(
    () => {
      const rankingByGenderEvent = new Map(
        rankings.map((ranking) => [`${ranking.gender}|${ranking.event}`, ranking]),
      );

      return eventDefinitions.flatMap((event) =>
        event.genders.flatMap((gender) => {
          const ranking = rankingByGenderEvent.get(`${gender}|${event.event}`);
          if (!ranking) return [];

          return [
            {
              key: `${gender}|${event.event}`,
              label: `${gender} ${event.displayName}`,
              event,
              ranking,
            },
          ];
        }),
      );
    },
    [rankings],
  );
  const [selectedKey, setSelectedKey] = useState(rankingOptions[0]?.key ?? "");
  const selected =
    rankingOptions.find((option) => option.key === selectedKey) ??
    rankingOptions[0];
  const selectedTitle = selected
    ? `${selected.ranking.gender} ${selected.event.displayName}`
    : "No ranking board";
  const cutoff = selected?.ranking.top18.at(-1);
  const firstBubble = selected?.ranking.bubble[0];
  const topSeed = selected?.ranking.top18[0];
  const focusRows =
    focusTeam && selected
      ? [...selected.ranking.top18, ...selected.ranking.bubble].filter(
          (row) => row.school === focusTeam,
        )
      : [];
  const graphicHref =
    selected && classification && !selected.event.relay
      ? focusTeam
        ? focusTeamHref(
            `/event-squads?gender=${selected.ranking.gender.toLowerCase()}&event=${
              selected.event.slug
            }&scope=${classification.toLowerCase()}`,
            focusTeam,
            classification,
          )
        : withClassificationHref(
            `/event-squads?gender=${selected.ranking.gender.toLowerCase()}&event=${
              selected.event.slug
            }&scope=${classification.toLowerCase()}`,
            classification,
          )
      : undefined;
  const focusRankLabel = focusRows.length
    ? focusRows
        .slice(0, 2)
        .map((row) => (row.rank <= 18 ? `#${row.rank}` : `B${row.rank - 18}`))
        .join(" / ")
    : "Not in";
  const focusMarkLabel = focusRows.length
    ? focusRows.map((row) => row.markRaw).join(" / ")
    : "No mark listed";
  const selectedScratchPredictions = useMemo(
    () =>
      selected
        ? scratchPredictions
            .filter(
              (row) =>
                row.gender === selected.ranking.gender &&
                row.event === selected.ranking.event,
            )
            .slice(0, 8)
        : [],
    [scratchPredictions, selected],
  );

  return (
    <div className="app-panel">
      <div className="border-b border-[#cad7e1]">
        <div className="h-1 bg-[#08233f]" />
        <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-normal text-[#526276]">
              Pick an event
            </div>
            <h2 className="mt-1 truncate text-xl font-semibold leading-tight text-[#07111f]">
              {selectedTitle}
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="h-2 w-2 rounded-full bg-[#28705d]" />
            <span>{focusShortName ? `${focusShortName} saved` : "No saved team"}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
        <div className="border-b border-[#e0e8ee] p-3 sm:p-4 xl:border-b-0 xl:border-r">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
              Event
            </span>
            <select
              value={selected?.key ?? ""}
              onChange={(event) => setSelectedKey(event.target.value)}
            className="app-select mt-2 h-11"
            >
              {rankingOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {selected ? (
            <div className="mt-3 grid gap-2">
              <Link
                href={hrefFor(selected.ranking)}
                className="coach-action app-button-navy inline-flex items-center justify-center gap-2 px-4 text-sm"
              >
                <Medal size={16} />
                Open list
                <ArrowRight size={15} />
              </Link>
              {graphicHref ? (
                <Link
                  href={graphicHref}
                  className="coach-action app-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm"
                >
                  <ImageIcon size={16} />
                  Make picture
                  <ArrowRight size={15} />
                </Link>
              ) : (
                <Link
                  href={
                    classification
                      ? focusTeam
                        ? focusTeamHref(
                            "/virtual-state-meet",
                            focusTeam,
                            classification,
                          )
                        : withClassificationHref(
                            "/virtual-state-meet",
                            classification,
                          )
                      : "/virtual-state-meet"
                  }
                  className="coach-action app-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm"
                >
                  <Trophy size={16} />
                  Check relay score
                  <ArrowRight size={15} />
                </Link>
              )}
            </div>
          ) : null}
        </div>

        {selected ? (
          <div className="divide-y divide-[#e0e8ee]">
            <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:px-4">
              <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                Last spot in
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">
                  Last person in
                </div>
                <div className="truncate text-xs text-slate-500">
                  {cutoff ? `${cutoff.athleteName}, ${cutoff.school}` : "No last spot yet"}
                </div>
              </div>
              <div className="text-right text-lg font-semibold tabular-nums text-slate-950">
                {cutoff?.markRaw ?? "-"}
              </div>
            </div>
            <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-3 bg-amber-50/55 px-3 py-3 sm:px-4">
              <div className="text-[11px] font-semibold uppercase tracking-normal text-amber-800">
                First out
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">
                  First out
                </div>
                <div className="truncate text-xs text-amber-800">
                  {firstBubble
                    ? `${firstBubble.athleteName}, ${firstBubble.school}`
                    : "No one just outside"}
                </div>
              </div>
              <div className="text-right text-lg font-semibold tabular-nums text-slate-950">
                {firstBubble?.markRaw ?? "-"}
              </div>
            </div>
            <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:px-4">
              <div className="text-[11px] font-semibold uppercase tracking-normal text-emerald-800">
                Best mark
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">
                  Best mark
                </div>
                <div className="truncate text-xs text-slate-500">
                  {topSeed ? `${topSeed.athleteName}, ${topSeed.school}` : "No marks"}
                </div>
              </div>
              <div className="text-right text-lg font-semibold tabular-nums text-slate-950">
                {topSeed?.markRaw ?? "-"}
              </div>
            </div>
            <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-3 bg-[#f5faf8] px-3 py-3 sm:px-4">
              <div className="text-[11px] font-semibold uppercase tracking-normal text-[#28705d]">
                Your team
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">
                  {focusShortName ?? "Saved team"}
                </div>
                <div className="truncate text-xs text-[#28705d]">
                  {focusMarkLabel}
                </div>
              </div>
              <div className="text-right text-lg font-semibold tabular-nums text-slate-950">
                {focusRankLabel}
              </div>
            </div>
            <div className="bg-[#fbfcfd] px-3 py-3 sm:px-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                    May not race
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-950">
                    People who may drop this event
                  </div>
                </div>
                <div className="text-xs font-semibold text-slate-500">
                  {selectedScratchPredictions.length
                    ? `${selectedScratchPredictions.length} to check`
                    : "No one flagged"}
                </div>
              </div>
              <div className="mt-2 space-y-2">
                {selectedScratchPredictions.map((row) => {
                  const read = scratchRead(row);

                  return (
                    <div
                      key={row.id}
                      className="grid gap-2 rounded-md border border-slate-200 bg-white p-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${read.className}`}
                          >
                            {read.label}
                          </span>
                          <span className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                            {row.rankLabel}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-sm font-semibold text-slate-950">
                          {row.athleteName}
                        </div>
                        <div className="truncate text-xs text-slate-600">
                          {row.school}
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-sm font-semibold tabular-nums text-slate-950">
                          {row.markRaw}
                        </div>
                        <div className="text-[11px] text-slate-500">
                  {row.netScratchCall
                    .replace("Likely scratch", "Likely drop")
                    .replace("Maybe scratch", "May drop")}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!selectedScratchPredictions.length ? (
                  <div className="rounded-md border border-dashed border-slate-200 bg-white p-3 text-sm leading-5 text-slate-600">
                    No one is likely to drop this event right now.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No ranking boards are loaded for this classification.
          </div>
        )}
      </div>
    </div>
  );
}
