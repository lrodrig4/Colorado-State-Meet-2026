"use client";

import { type ReactNode, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  ChevronDown,
  Clipboard,
  History,
  ListChecks,
  MapPin,
  School,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { getEventDefinition } from "@/lib/data/events";
import { stateMeetScheduleSlots } from "@/lib/data/stateSchedule";
import { shortSchoolName } from "@/lib/utils/focusTeam";
import { coachCall, coachCallClass } from "@/lib/utils/coachCall";
import { normalizeEvent } from "@/lib/utils/time";
import {
  buildAthleteEventOutlook,
  type AthleteEventOutlook,
} from "@/lib/services/athleteOutlook";
import {
  buildEventEntryForecast,
  forecastEventEntryRow,
  type EventEntryForecastRow,
} from "@/lib/services/eventEntryForecast";
import type { Classification } from "@/types/domain";
import type {
  CutoffPrediction,
  LastChanceRecommendation,
  PuebloMeetMarkRow,
  ScratchPrediction,
} from "@/lib/services/lastChance";
import type {
  StVrainStateMarkOpportunity,
} from "@/lib/services/stVrainHeatEstimator";
import { StatusBadge } from "@/components/StatusBadge";

type Mode = "palmer" | "event" | "all";

const scheduleContextByEvent: Partial<Record<LastChanceRecommendation["event"], LastChanceRecommendation["event"][]>> = {
  "400m": ["4x200m Relay", "4x400m Relay"],
  "800m": ["4x800m Relay", "3200m", "4x400m Relay", "1600m"],
  "1600m": ["4x800m Relay", "3200m", "800m", "4x400m Relay"],
  "3200m": ["4x800m Relay", "800m", "4x400m Relay", "1600m"],
  "300m Hurdles": ["4x400m Relay"],
  "4x400m Relay": ["400m", "800m"],
  "4x800m Relay": ["3200m", "800m", "1600m"],
};

function scheduleMinutes(day: "Thursday" | "Friday" | "Saturday", time: string) {
  const offset = { Thursday: 0, Friday: 24 * 60, Saturday: 48 * 60 }[day];
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return offset;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toLowerCase();

  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  return offset + hour * 60 + minute;
}

function scheduleReadFor(
  rows: LastChanceRecommendation[],
  classification: Classification,
) {
  const sample = rows[0];
  if (!sample) return undefined;

  const slotsFor = (event: LastChanceRecommendation["event"]) =>
    stateMeetScheduleSlots
      .filter(
        (slot) =>
          slot.classification === classification &&
          slot.gender === sample.gender &&
          normalizeEvent(slot.event) === event,
      )
      .sort((a, b) => scheduleMinutes(a.day, a.startTime) - scheduleMinutes(b.day, b.startTime));

  const formatSlot = (event: LastChanceRecommendation["event"]) =>
    slotsFor(event)
      .map((slot) => `${slot.day} ${slot.startTime} ${slot.round.toLowerCase()}`)
      .join(" / ");

  const primary = formatSlot(sample.event);
  const related = (scheduleContextByEvent[sample.event] ?? [])
    .map((event) => ({ event, text: formatSlot(event) }))
    .filter((item) => item.text)
    .slice(0, 4);

  return { primary, related };
}

function modeButtonClass(active: boolean) {
  return `coach-action inline-flex items-center justify-center gap-2 border px-3 text-sm transition ${
    active
      ? "border-[#16324f] bg-[#16324f] text-white"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  }`;
}

function scratchRiskClass(probability: number) {
  if (probability >= 65) {
    return "bg-rose-100 text-rose-800";
  }

  if (probability >= 45) {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-slate-100 text-slate-700";
}

function chanceText(probability: number) {
  if (probability >= 90) {
    return {
      detail: "Current mark should hold",
      bar: "bg-emerald-500",
      text: "text-emerald-800",
      bg: "bg-emerald-50",
    };
  }

  if (probability >= 68) {
    return {
      detail: "Strong, but watch",
      bar: "bg-lime-500",
      text: "text-lime-800",
      bg: "bg-lime-50",
    };
  }

  if (probability >= 54) {
    return {
      detail: "Could go either way",
      bar: "bg-amber-500",
      text: "text-amber-800",
      bg: "bg-amber-50",
    };
  }

  if (probability >= 40) {
    return {
      detail: "Needs a PR",
      bar: "bg-orange-500",
      text: "text-orange-800",
      bg: "bg-orange-50",
    };
  }

  if (probability >= 24) {
    return {
      detail: "Needs big PR",
      bar: "bg-rose-500",
      text: "text-rose-800",
      bg: "bg-rose-50",
    };
  }

  return {
    detail: "Low odds",
    bar: "bg-slate-400",
    text: "text-slate-700",
    bg: "bg-slate-50",
  };
}

function entryWindowLabel(rank: number) {
  return rank <= 18 ? "Top 18" : "Bubble";
}

function entryWindowClass(rank: number) {
  if (rank <= 18) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (rank <= 24) {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function stVrainNormalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\(co\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stVrainOpportunityKey(athleteOrRelay: string, school: string) {
  return `${stVrainNormalize(athleteOrRelay.replace(/\s+Relay$/i, ""))}|${stVrainNormalize(
    school,
  )}`;
}

function InsightDisclosure({
  icon,
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  icon: ReactNode;
  title: string;
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 marker:hidden">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#edf5f1] text-[#16324f]">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-950">
            {title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-600 sm:whitespace-normal">
            {summary}
          </span>
        </span>
        <ChevronDown
          size={18}
          className="shrink-0 text-slate-500 transition group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-slate-100 px-3 pb-3 pt-2 text-sm leading-6 text-slate-700">
        {children}
      </div>
    </details>
  );
}

function seededEventSort(a: LastChanceRecommendation, b: LastChanceRecommendation) {
  return (
    a.rank - b.rank ||
    Math.abs(a.gapValue) - Math.abs(b.gapValue) ||
    a.athleteName.localeCompare(b.athleteName)
  );
}

function projectedEdgePick(
  rows: LastChanceRecommendation[],
  prediction?: CutoffPrediction,
) {
  if (!prediction) return undefined;

  const candidates = rows.filter(
    (row) => row.rank <= 42 && row.scratchProbability < 70,
  );

  if (!candidates.length) return undefined;

  const maxGap = Math.max(
    ...candidates.map((row) => Math.abs(row.gapValue)),
    1,
  );
  const scored = candidates
    .map((row) => {
      const score =
        (Math.abs(row.gapValue) / maxGap) * 60 +
        Math.abs(row.rank - 18) * 2.2 +
        Math.abs(row.makeProbability - 58) * 0.45 +
        row.scratchProbability * 0.3 -
        row.expectedScratchOpenings * 4;

      return { row, score };
    })
    .sort((a, b) => a.score - b.score || a.row.rank - b.row.rank);
  const best = scored[0];

  if (!best) return undefined;

  const confidence =
    best.score <= 12 ? "High" : best.score <= 24 ? "Medium" : "Low";
  const nextNames = scored
    .slice(1, 4)
    .map(({ row }) => `${row.athleteName} (${row.rankLabel}, ${row.markRaw})`);

  return {
    row: best.row,
    confidence,
    nextNames,
    reason: `${best.row.markRaw} is closest to the projected cut ${prediction.predictedCutoffRaw}; state odds ${best.row.stateProbabilityLabel}, hold odds ${best.row.holdProbabilityLabel}, scratch prediction ${best.row.scratchRiskLabel.toLowerCase()} ${best.row.scratchProbabilityLabel}.`,
  };
}

function buildCoachSummary(rows: LastChanceRecommendation[], focusTeam: string) {
  const urgent = rows
    .filter(
      (row) =>
        row.isFocusTeam &&
        (row.status === "Must race" ||
          row.status === "At risk" ||
          row.status === "Monitor" ||
          row.scratchProbability >= 35),
    )
    .slice(0, 18);

  if (!urgent.length) {
    return `${focusTeam}: no urgent last-chance priorities in the current Top 18/bubble window.`;
  }

  return [
    `${focusTeam} last-chance priorities`,
    ...urgent.map(
      (row) => {
        const call = coachCall(row);

        return `${call.label}: ${row.eventLabel} - ${row.athleteName}, ${row.rankLabel}, ${row.markRaw}, ${row.gapRaw}, state odds ${row.stateProbabilityLabel} (range ${row.stateConfidenceIntervalLabel}), hold odds ${row.holdProbabilityLabel} (range ${row.holdConfidenceIntervalLabel}), improve odds ${row.improveProbabilityLabel} (range ${row.improveConfidenceIntervalLabel}), scratch prediction ${row.scratchRiskLabel} ${row.scratchProbabilityLabel} (range ${row.scratchConfidenceIntervalLabel}). ${row.recommendation}`;
      },
    ),
  ].join("\n");
}

export function LastChancePanel({
  focusTeam,
  classification,
  eventTitle,
  prediction,
  eventRecommendations,
  focusRows,
  allRows,
  athleteContextRows,
  coachSummaryRows,
  puebloMarks,
  scratchPredictions,
  stVrainStateMarkOpportunities = [],
}: {
  focusTeam: string;
  classification: Classification;
  eventTitle: string;
  prediction?: CutoffPrediction;
  eventRecommendations: LastChanceRecommendation[];
  focusRows: LastChanceRecommendation[];
  allRows: LastChanceRecommendation[];
  athleteContextRows: LastChanceRecommendation[];
  coachSummaryRows: LastChanceRecommendation[];
  puebloMarks: PuebloMeetMarkRow[];
  scratchPredictions: ScratchPrediction[];
  stVrainStateMarkOpportunities?: StVrainStateMarkOpportunity[];
}) {
  const [mode, setMode] = useState<Mode>("event");
  const [showPueblo, setShowPueblo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedAthlete, setSelectedAthlete] =
    useState<LastChanceRecommendation | null>(null);
  const shortFocusTeam = shortSchoolName(focusTeam);

  const eventRows = useMemo(
    () => [...eventRecommendations].sort(seededEventSort),
    [eventRecommendations],
  );
  const entryForecast = useMemo(
    () => buildEventEntryForecast(eventRows),
    [eventRows],
  );
  const eventForecastRows = useMemo(
    () => eventRows.map(forecastEventEntryRow),
    [eventRows],
  );
  const eventForecastById = useMemo(
    () => new Map(eventForecastRows.map((row) => [row.id, row])),
    [eventForecastRows],
  );
  const weekendProbabilityRows = useMemo(
    () => eventForecastRows.slice(0, 30),
    [eventForecastRows],
  );
  const stVrainOpportunityByKey = useMemo(
    () =>
      new Map(
        stVrainStateMarkOpportunities.map(
          (opportunity) => [
            stVrainOpportunityKey(opportunity.athleteOrRelay, opportunity.school),
            opportunity,
          ],
        ),
      ),
    [stVrainStateMarkOpportunities],
  );
  const visibleRows =
    mode === "palmer"
      ? focusRows
      : mode === "event"
        ? eventRows
        : allRows;
  const edgePick = useMemo(
    () => projectedEdgePick(eventRecommendations, prediction),
    [eventRecommendations, prediction],
  );
  const scheduleRead = useMemo(
    () => scheduleReadFor(eventRecommendations, classification),
    [classification, eventRecommendations],
  );
  const athleteOutlook = useMemo(
    () =>
      selectedAthlete
        ? buildAthleteEventOutlook(athleteContextRows, selectedAthlete)
        : undefined,
    [athleteContextRows, selectedAthlete],
  );
  const urgentCount = focusRows.filter((row) => coachCall(row).urgent).length;
  const selectedStVrainOpportunity = selectedAthlete
    ? stVrainOpportunityByKey.get(
        stVrainOpportunityKey(selectedAthlete.athleteName, selectedAthlete.school),
      )
    : undefined;
  const topScratchPredictions = scratchPredictions.slice(0, 12);

  async function copySummary() {
    await navigator.clipboard.writeText(
      buildCoachSummary(coachSummaryRows, focusTeam),
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function inspectForecastEntry(entry: EventEntryForecastRow) {
    const row = eventRecommendations.find((candidate) => candidate.id === entry.id);

    if (!row || getEventDefinition(row.event).relay) {
      return;
    }

    setSelectedAthlete(row);
  }

  return (
    <section className="coach-surface mb-5 overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-4 border-b border-[#d8e2ea] bg-[#fbfcfd]/80 p-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="coach-kicker">Top 18 cutline</div>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            {eventTitle}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Seeded field first. Open athlete names for other events, relay likelihood,
            scratch risk, and the model&apos;s meet-week call.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={copySummary}
            className="coach-action inline-flex items-center justify-center gap-2 border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Clipboard size={16} />
            {copied ? "Copied" : "Copy coach summary"}
          </button>
          <button
            type="button"
            onClick={() => setShowPueblo((current) => !current)}
            className={modeButtonClass(showPueblo)}
          >
            <MapPin size={16} />
            Pueblo marks
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-0 border-b border-[#d8e2ea] xl:grid-cols-5">
        <div className="border-b border-slate-200 p-3 sm:border-r sm:p-4 xl:border-b-0">
          <div className="coach-kicker">
            Predicted cutoff
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950 sm:text-2xl">
            {prediction?.predictedCutoffRaw ?? "N/A"}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {prediction
              ? `${prediction.confidenceScoreLabel} confidence, ${prediction.movementRaw} movement${
                  prediction.historicalCutoffRaw
                    ? `, historical avg ${prediction.historicalCutoffRaw}`
                    : ""
                }`
              : "Need at least one ranked mark"}
          </div>
        </div>
        <div className="border-b border-slate-200 p-3 sm:p-4 xl:border-b-0 xl:border-r">
          <div className="coach-kicker">
            Current 18th
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950 sm:text-2xl">
            {prediction?.currentCutoffRaw ?? "N/A"}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {prediction ? `Rank ${prediction.currentCutoffRank}` : ""}
          </div>
        </div>
        <div className="border-b border-slate-200 p-3 sm:border-r sm:p-4 xl:border-b-0">
          <div className="coach-kicker">
            Cutoff confidence
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950 sm:text-2xl">
            {prediction?.confidenceScoreLabel ?? "N/A"}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {prediction?.sourceCoverageLabel ?? "Public sources only"}
          </div>
        </div>
        <div className="border-b border-slate-200 p-3 sm:p-4 xl:border-b-0 xl:border-r">
          <div className="coach-kicker">
            First bubble
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950 sm:text-2xl">
            {prediction?.firstBubbleRaw ?? "N/A"}
          </div>
          <div className="mt-1 truncate text-xs text-slate-500">
            {prediction?.firstBubbleName ?? ""}
          </div>
        </div>
        <div className="col-span-2 p-3 sm:p-4 xl:col-span-1">
          <div className="coach-kicker">
            {shortFocusTeam} urgent
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950 sm:text-2xl">
            {urgentCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Must race, bubble, or PR needed
          </div>
        </div>
      </div>

      {edgePick ? (
        <div className="grid gap-3 border-b border-slate-200 bg-[#fbfcfd] p-4 lg:grid-cols-[220px_1fr_1fr] lg:items-center">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">
              Projected #18 pick
            </div>
            {getEventDefinition(edgePick.row.event).relay ? (
              <div className="mt-1 text-xl font-semibold text-slate-950">
                {edgePick.row.athleteName}
              </div>
            ) : (
              <AthleteInspectButton
                athleteName={edgePick.row.athleteName}
                onClick={() => setSelectedAthlete(edgePick.row)}
              />
            )}
            <div className="mt-1 text-xs text-slate-500">
              {edgePick.row.school}
            </div>
          </div>
          <div className="text-sm leading-6 text-slate-700">
            <span className="font-semibold text-slate-950">
              {edgePick.row.rankLabel} · {edgePick.row.markRaw}
            </span>{" "}
            is the current model&apos;s best edge pick. Confidence:{" "}
            <span className="font-semibold text-slate-950">
              {edgePick.confidence}
            </span>
            .
            <div className="text-xs leading-5 text-slate-600">
              {edgePick.reason}
            </div>
          </div>
          <div className="text-xs leading-5 text-slate-600">
            <span className="font-semibold text-slate-950">Next names:</span>{" "}
            {edgePick.nextNames.length
              ? edgePick.nextNames.join(" / ")
              : "No close alternate loaded."}
          </div>
        </div>
      ) : null}

      {prediction ? (
        <div className="border-b border-slate-200 bg-[#f6faf8] px-4 py-3">
          <div className="grid gap-2 xl:grid-cols-2">
            <InsightDisclosure
              icon={<ShieldCheck size={18} />}
              title="How to read odds"
              summary="State odds, hold odds, improve odds, scratch odds, and pull-in openings are separate."
            >
              <p>
                State odds include the projected cutoff and scratch model. Hold
                odds show whether this exact mark survives if unchanged. Improve
                odds are the separate chance of getting the needed PR or seed
                jump. Scratch odds are separate from pull-in odds: seeded
                athletes get a scratch risk, while bubble athletes show modeled
                openings ahead. Distance runners are checked for 800/1600/3200
                profile fit before a scratch call is made. Relays are treated as
                declared and contested by default. Throws stay very low scratch
                unless the athlete also has a full track-event load. Top
                sprint/hurdle scoring seeds are protected before relay pressure
                is allowed to affect the model. Relay pressure only counts when
                the athlete projects as a relay leg, alternate, or fringe
                candidate from that school&apos;s loaded depth chart.
              </p>
            </InsightDisclosure>

            <InsightDisclosure
              icon={<CalendarDays size={18} />}
              title={`${classification} schedule load`}
              summary={`This event: ${scheduleRead?.primary ?? "Schedule not loaded."}`}
              defaultOpen
            >
              <p>
                <span className="font-semibold text-slate-950">
                  This event:
                </span>{" "}
                {scheduleRead?.primary ?? "Schedule not loaded."}
                {scheduleRead?.related.length ? (
                  <>
                    {" "}
                    <span className="font-semibold text-slate-950">
                      Checks:
                    </span>{" "}
                    {scheduleRead.related
                      .map((item) => `${item.event}: ${item.text}`)
                      .join("; ")}
                    .
                  </>
                ) : null}
              </p>
            </InsightDisclosure>

            <InsightDisclosure
              icon={<History size={18} />}
              title="Historical trend"
              summary={
                prediction.historicalBestCutoffRaw
                  ? `Hardest loaded 18th: ${prediction.historicalBestCutoffRaw} (${prediction.historicalBestCutoffYear})`
                  : "Open for loaded state heat-sheet trend."
              }
            >
              <p>
                {prediction.historicalTrendLabel
                  ? `${
                      prediction.historicalBestCutoffRaw
                        ? `Hardest loaded 18th: ${prediction.historicalBestCutoffRaw} (${prediction.historicalBestCutoffYear}). `
                        : ""
                    }${prediction.historicalRangeLabel ?? ""} ${prediction.historicalTrendLabel}. ${prediction.historicalTrendSummary}`
                  : "No state heat-sheet trend loaded for this event yet."}
              </p>
            </InsightDisclosure>

            <InsightDisclosure
              icon={<Activity size={18} />}
              title="Model inputs"
              summary={`Confidence: ${prediction.confidenceScoreLabel}. Late-wave pressure ${prediction.lateWaveRaw}.`}
            >
              <p>
                {prediction.confidenceSummary} {prediction.method}{" "}
                {prediction.historicalSourceQualityLabel}{" "}
                {prediction.historicalCaveatLabel}{" "}
                {prediction.lateWaveSummary} Late-wave pressure{" "}
                {prediction.lateWaveRaw}.
              </p>
            </InsightDisclosure>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-2 sm:flex sm:flex-row">
          <button
            type="button"
            onClick={() => setMode("event")}
            className={modeButtonClass(mode === "event")}
          >
            <ListChecks size={16} />
            This event
          </button>
          <button
            type="button"
            onClick={() => setMode("palmer")}
            className={modeButtonClass(mode === "palmer")}
          >
            <School size={16} />
            {shortFocusTeam}
          </button>
          <button
            type="button"
            onClick={() => setMode("all")}
            className={modeButtonClass(mode === "all")}
          >
            <Users size={16} />
            All teams
          </button>
        </div>
        <p className="text-sm text-slate-600">
          {mode === "palmer"
            ? `${focusTeam} priorities across every ${classification} event.`
            : mode === "event"
              ? `${eventTitle} seeded Top 18 first, then the bubble.`
              : `Likely last-chance targets from every ${classification} team.`}
        </p>
      </div>

      {mode === "event" ? (
        <div className="border-b border-slate-200 bg-[#fbfcfd] px-4 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">
                Projected Top 18 and bubble
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Rank, mark, state odds, hold/improve odds, and scratch or
                pull-in read are grouped for phone scanning.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold leading-5 text-slate-800 md:text-sm">
              {entryForecast.summary}
            </div>
          </div>
        </div>
      ) : null}

        <div className="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
          {visibleRows.map((row) => {
            const action = coachCall(row);
            const chance = chanceText(row.stateProbability);
            const canInspectAthlete = !getEventDefinition(row.event).relay;
            const forecast = eventForecastById.get(row.id);
            const stVrainOpportunity = stVrainOpportunityByKey.get(
              stVrainOpportunityKey(row.athleteName, row.school),
            );

          return (
            <article
              key={`${mode}-${row.id}-card`}
              className={`rounded-2xl border p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                row.isFocusTeam
                  ? "border-emerald-300 bg-emerald-50/60"
                  : row.rank <= 18
                    ? "border-[#d8e2ea] bg-white"
                    : "border-amber-200 bg-amber-50/20"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${entryWindowClass(
                        row.rank,
                      )}`}
                    >
                      {entryWindowLabel(row.rank)}
                    </span>
                    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                      {row.rankLabel}
                    </span>
                    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                      {row.eventLabel}
                    </span>
                  </div>
                  {canInspectAthlete ? (
                    <AthleteInspectButton
                      athleteName={row.athleteName}
                      onClick={() => setSelectedAthlete(row)}
                    />
                  ) : (
                    <div className="mt-1 break-words text-base font-semibold text-slate-950">
                      {row.athleteName}
                    </div>
                  )}
                  <div className="break-words text-sm text-slate-600">{row.school}</div>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2 sm:shrink-0 sm:bg-transparent sm:p-0 sm:text-right">
                  <div className="flex items-baseline justify-between gap-3 sm:block">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Mark
                    </span>
                    <span className="text-xl font-semibold tabular-nums text-slate-950">
                      {row.markRaw}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{row.gapRaw}</div>
                </div>
              </div>

              {forecast ? (
                <div className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 sm:grid-cols-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase text-slate-500">
                      Known
                    </div>
                    <div className="mt-1 text-xs font-semibold leading-4 text-slate-700">
                      {forecast.knownLabel}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase text-slate-500">
                      Entry
                    </div>
                    <ForecastBadge
                      label={forecast.projectedEntryLabel}
                      tone={forecast.projectedEntryTone}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase text-slate-500">
                      Weekend
                    </div>
                    <ForecastBadge
                      label={forecast.weekendRaceLabel}
                      tone={forecast.weekendRaceTone}
                    />
                  </div>
                </div>
              ) : null}

              {stVrainOpportunity ? (
                <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                        St. Vrain state-mark chance
                      </div>
                      <div className="mt-1 text-xs font-semibold leading-4 text-slate-950">
                        {stVrainOpportunity.projectedHeatLabel} · target{" "}
                        {stVrainOpportunity.targetMarkRaw}
                      </div>
                    </div>
                            <div className="text-left sm:text-right">
                      <div className="text-lg font-semibold tabular-nums text-slate-950">
                        {stVrainOpportunity.heatAdjustedChanceLabel}
                      </div>
                      <div className="text-[10px] font-semibold uppercase text-slate-500">
                        in this {stVrainOpportunity.sectionNoun}
                      </div>
                    </div>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {stVrainOpportunity.neededImprovementLabel};{" "}
                    {stVrainOpportunity.profileLabel.toLowerCase()},{" "}
                    {stVrainOpportunity.heatAdjustmentLabel}.
                  </p>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${coachCallClass(
                    action,
                  )}`}
                >
                  {action.label}
                </span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${scratchRiskClass(
                    row.scratchProbability,
                  )}`}
                >
                  {row.rank > 18
                    ? `Pull-in ${row.expectedScratchOpenings.toFixed(1)}`
                    : `Scratch ${row.scratchProbabilityLabel}`}
                </span>
              </div>

              <div className={`mt-3 rounded-md border border-slate-200 ${chance.bg} p-3`}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className={`text-[10px] font-semibold uppercase tracking-wide ${chance.text}`}>
                      State
                    </div>
                    <div className="text-xs font-semibold leading-4 text-slate-700">
                      {row.oddsBandLabel}
                    </div>
                  </div>
                  <div className="text-2xl font-semibold tabular-nums text-slate-950 sm:text-xl">
                    {row.stateProbabilityLabel}
                  </div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white">
                  <div
                    className={`h-2 rounded-full ${chance.bar}`}
                    style={{ width: `${row.stateProbability}%` }}
                  />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <ProbabilityStat
                    label="Hold"
                    value={row.holdProbabilityLabel}
                  />
                  <ProbabilityStat
                    label="Improve"
                    value={row.improveProbabilityLabel}
                  />
                  <ProbabilityStat
                    label={row.rank > 18 ? "Pull-in" : "Scratch"}
                    value={
                      row.rank > 18
                        ? row.expectedScratchOpenings.toFixed(1)
                        : row.scratchProbabilityLabel
                    }
                  />
                </div>
              </div>
              <p className="mt-3 text-sm leading-5 text-slate-600">
                {row.recommendation}
              </p>
            </article>
          );
        })}
        {!visibleRows.length ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No priorities in the current top 18 and bubble window.
          </div>
        ) : null}
      </div>

      <WeekendProbabilityDrawer
        rows={weekendProbabilityRows}
        onInspectEntry={inspectForecastEntry}
      />

      <div className="border-t border-slate-200">
        <div className="flex flex-col gap-1 p-4">
          <h3 className="text-sm font-semibold text-slate-950">
            Predicted scratches
          </h3>
          <p className="text-sm text-slate-600">
            Multi-event athletes most likely to skip a lower-priority state entry.
            Distance calls compare the athlete&apos;s 800, 1600, and 3200 profile
            before flagging a scratch.
          </p>
        </div>
        <div className="space-y-3 px-3 pb-3 md:hidden">
          {topScratchPredictions.map((row) => (
            <ScratchPredictionCard key={`${row.id}-mobile`} row={row} />
          ))}
          {!scratchPredictions.length ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
              No likely scratches detected from current multi-event state positions.
            </div>
          ) : null}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[900px] w-full table-fixed border-collapse text-left text-sm">
            <colgroup>
              <col className="w-[13%]" />
              <col className="w-[15%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              <col className="w-[13%]" />
              <col className="w-[23%]" />
            </colgroup>
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3 font-semibold">Risk</th>
                <th className="px-3 py-3 font-semibold">Event</th>
                <th className="px-3 py-3 font-semibold">Athlete</th>
                <th className="px-3 py-3 font-semibold">School</th>
                <th className="px-3 py-3 font-semibold">Seed</th>
                <th className="px-3 py-3 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody>
              {topScratchPredictions.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${scratchRiskClass(
                        row.scratchProbability,
                      )}`}
                    >
                      {row.scratchProbability}%
                    </span>
                    <div className="mt-1 text-xs text-slate-500">
                      Range {row.confidenceIntervalLabel}
                    </div>
                  </td>
                  <td className="break-words px-3 py-3 font-medium text-slate-950">
                    {row.eventLabel}
                  </td>
                  <td className="break-words px-3 py-3">{row.athleteName}</td>
                  <td className="break-words px-3 py-3">{row.school}</td>
                  <td className="px-3 py-3 font-semibold tabular-nums">
                    {row.rankLabel}, {row.markRaw}
                  </td>
                  <td className="break-words px-3 py-3 text-xs leading-5 text-slate-600">
                    {row.reason}
                  </td>
                </tr>
              ))}
              {!scratchPredictions.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    No likely scratches detected from current multi-event state
                    positions.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {showPueblo ? (
        <div className="border-t border-slate-200">
          <div className="flex flex-col gap-1 p-4">
            <h3 className="text-sm font-semibold text-slate-950">
              Pueblo Twilight {classification} marks for {eventTitle}
            </h3>
            <p className="text-sm text-slate-600">
              {puebloMarks.length} imported marks. Ranked labels only appear when
              that Pueblo mark is the current season best in this table.
            </p>
          </div>
          <div className="space-y-3 px-3 pb-3 md:hidden">
            {puebloMarks.map((row) => (
              <PuebloMarkCard key={`${row.id}-mobile`} row={row} />
            ))}
            {!puebloMarks.length ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                No Pueblo Twilight {classification} marks imported for this event.
              </div>
            ) : null}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[860px] w-full table-fixed border-collapse text-left text-sm">
              <colgroup>
                <col className="w-[10%]" />
                <col className="w-[24%]" />
                <col className="w-[22%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-semibold">Rank</th>
                  <th className="px-3 py-3 font-semibold">Athlete / Team</th>
                  <th className="px-3 py-3 font-semibold">School</th>
                  <th className="px-3 py-3 font-semibold">Mark</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {puebloMarks.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-semibold tabular-nums">
                      {row.rankLabel ?? "-"}
                    </td>
                    <td className="break-words px-3 py-3">{row.athleteName}</td>
                    <td className="break-words px-3 py-3">{row.school}</td>
                    <td className="px-3 py-3 font-semibold tabular-nums">
                      {row.markRaw}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={row.verificationStatus} />
                    </td>
                    <td className="break-words px-3 py-3 text-xs text-slate-600">
                      {row.isSeasonBest ? "Current season best" : row.notes ?? ""}
                    </td>
                  </tr>
                ))}
                {!puebloMarks.length ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-slate-500"
                    >
                      No Pueblo Twilight {classification} marks imported for this event.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {athleteOutlook ? (
        <AthleteOutlookBubble
          outlook={athleteOutlook}
          stVrainOpportunity={selectedStVrainOpportunity}
          onClose={() => setSelectedAthlete(null)}
        />
      ) : null}
    </section>
  );
}

function ScratchPredictionCard({ row }: { row: ScratchPrediction }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Scratch
          </div>
          <span
            className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${scratchRiskClass(
              row.scratchProbability,
            )}`}
          >
            {row.scratchProbability}%
          </span>
          <div className="mt-1 text-xs text-slate-500">
            Range {row.confidenceIntervalLabel}
          </div>
        </div>
        <div className="min-w-0 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Seed
          </div>
          <div className="mt-1 font-semibold tabular-nums text-slate-950">
            {row.rankLabel}, {row.markRaw}
          </div>
        </div>
      </div>
      <div className="mt-3 min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {row.eventLabel}
        </div>
        <div className="mt-1 break-words text-base font-semibold text-slate-950">
          {row.athleteName}
        </div>
        <div className="break-words text-sm text-slate-600">{row.school}</div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">{row.reason}</p>
    </article>
  );
}

function PuebloMarkCard({ row }: { row: PuebloMeetMarkRow }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              {row.rankLabel ?? "Unranked"}
            </span>
            <StatusBadge status={row.verificationStatus} />
          </div>
          <div className="mt-2 break-words text-base font-semibold text-slate-950">
            {row.athleteName}
          </div>
          <div className="break-words text-sm text-slate-600">{row.school}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Mark
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
            {row.markRaw}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">
        {row.isSeasonBest ? "Current season best" : row.notes ?? ""}
      </p>
    </article>
  );
}

function eventPillClass(status: AthleteEventOutlook["events"][number]["statusLabel"]) {
  if (status === "Scoring seed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "Qualified") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status === "Bubble chase") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function relayPillClass(tone: AthleteEventOutlook["relayOutlooks"][number]["tone"]) {
  if (tone === "strong") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "watch") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function forecastToneClass(tone: EventEntryForecastRow["projectedEntryTone"]) {
  const tones: Record<EventEntryForecastRow["projectedEntryTone"], string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return tones[tone];
}

function ForecastBadge({
  label,
  tone,
}: {
  label: string;
  tone: EventEntryForecastRow["projectedEntryTone"];
}) {
  return (
    <span
      className={`inline-flex w-fit max-w-full justify-center rounded-full border px-2 py-1 text-center text-[11px] font-semibold leading-4 sm:px-2.5 sm:text-xs ${forecastToneClass(
        tone,
      )}`}
    >
      {label}
    </span>
  );
}

function ProbabilityStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/80 px-2.5 py-2 sm:block sm:text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums text-slate-950 sm:mt-1">
        {value}
      </div>
    </div>
  );
}

function AthleteInspectButton({
  athleteName,
  onClick,
}: {
  athleteName: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap-row mt-2 inline-flex max-w-full items-center gap-2 rounded-xl border border-[#2f6f5e]/35 bg-[#f0faf6] px-3 py-2 text-left text-[#0f2a47] shadow-sm transition hover:bg-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16324f]"
      aria-label={`Open ${athleteName} athlete outlook`}
    >
      <span className="min-w-0 break-words text-base font-semibold leading-5 underline decoration-[#69b7a4] decoration-2 underline-offset-4">
        {athleteName}
      </span>
      <span className="shrink-0 rounded-full bg-[#102b47] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        View
      </span>
    </button>
  );
}

function WeekendProbabilityDrawer({
  rows,
  onInspectEntry,
}: {
  rows: EventEntryForecastRow[];
  onInspectEntry: (entry: EventEntryForecastRow) => void;
}) {
  const likelyCount = rows.filter((row) => row.likelyRacingThisWeekend).length;

  return (
    <details className="group border-t border-slate-200 bg-[#fbfcfd]">
      <summary className="tap-row flex cursor-pointer list-none items-center gap-3 p-4 marker:hidden">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf5f1] text-[#16324f]">
          <Activity size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-950">
            Weekend race probability
          </span>
          <span className="mt-0.5 block text-xs text-slate-600">
            {likelyCount} likely weekend racers from the top 18 plus bubble
            watch list. Open for state, hold, improve, and scratch odds.
          </span>
        </span>
        <ChevronDown
          size={18}
          className="shrink-0 text-slate-500 transition group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-slate-200 p-3">
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((entry) => (
            <article
              key={`${entry.id}-weekend-probability`}
              className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    {entry.rankLabel} · {entry.markRaw}
                  </div>
                  {entry.isRelay ? (
                    <div className="mt-1 font-semibold text-slate-950">
                      {entry.athleteName}
                    </div>
                  ) : (
                    <AthleteInspectButton
                      athleteName={entry.athleteName}
                      onClick={() => onInspectEntry(entry)}
                    />
                  )}
                  <div className="text-sm text-slate-600">{entry.school}</div>
                </div>
                <ForecastBadge
                  label={entry.weekendRaceLabel}
                  tone={entry.weekendRaceTone}
                />
              </div>

              <div className="mt-3 grid gap-2 rounded-md bg-slate-50 p-2 sm:grid-cols-4">
                <ProbabilityStat
                  label="State"
                  value={entry.stateProbabilityLabel}
                />
                <ProbabilityStat
                  label="Hold"
                  value={entry.holdProbabilityLabel}
                />
                <ProbabilityStat
                  label="Improve"
                  value={entry.improveProbabilityLabel}
                />
                <ProbabilityStat
                  label="Scratch"
                  value={entry.scratchProbabilityLabel}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                {entry.basis}
              </p>
            </article>
          ))}
        </div>
      </div>
    </details>
  );
}

function AthleteOutlookBubble({
  outlook,
  stVrainOpportunity,
  onClose,
}: {
  outlook: AthleteEventOutlook;
  stVrainOpportunity?: StVrainStateMarkOpportunity;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-x-3 bottom-3 z-50 max-h-[82vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl md:inset-x-auto md:bottom-auto md:right-5 md:top-24 md:w-[460px]"
      role="dialog"
      aria-modal="false"
      aria-label={`${outlook.athleteName} event outlook`}
    >
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Athlete outlook
            </div>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">
              {outlook.athleteName}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {outlook.school}
              {outlook.gradeLabel ? ` · ${outlook.gradeLabel}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Close athlete outlook"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Loaded profile
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-950">
            {outlook.qualifyingSummary}
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <section className="rounded-lg border border-[#d8e2ea] bg-[#fbfcfd] p-3">
          <div className="text-sm font-semibold text-slate-950">
            {outlook.likelyPlanTitle}
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            {outlook.likelyPlan}
          </p>
        </section>

        {stVrainOpportunity ? (
          <section className="rounded-lg border border-sky-200 bg-sky-50 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-950">
                  St. Vrain heat read
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  {stVrainOpportunity.projectedHeatLabel},{" "}
                  {stVrainOpportunity.heatRankRangeLabel}. Target{" "}
                  {stVrainOpportunity.targetMarkRaw};{" "}
                  {stVrainOpportunity.neededImprovementLabel.toLowerCase()}.
                </p>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <div className="text-2xl font-semibold tabular-nums text-slate-950">
                  {stVrainOpportunity.heatAdjustedChanceLabel}
                </div>
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  state mark
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {stVrainOpportunity.reason}
            </p>
          </section>
        ) : null}

        <section className="rounded-lg border border-slate-200 p-3">
          <div className="text-sm font-semibold text-slate-950">
            Scratch read
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            {outlook.scratchWatchSummary}
          </p>
        </section>

        <section>
          <div className="mb-2 text-sm font-semibold text-slate-950">
            Relay load
          </div>
          {outlook.relayOutlooks.length ? (
            <div className="space-y-2">
              {outlook.relayOutlooks.map((relay) => (
                <article
                  key={relay.id}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-semibold text-slate-950">
                        {relay.relayLabel}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {relay.rankLabel} · {relay.markRaw}
                      </div>
                    </div>
                    <span
                      className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${relayPillClass(
                        relay.tone,
                      )}`}
                    >
                      {relay.callLabel}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 rounded-md bg-slate-50 p-2 text-center sm:grid-cols-3">
                    <div>
                      <div className="text-base font-semibold tabular-nums text-slate-950">
                        #{relay.poolRank}
                      </div>
                      <div className="text-[11px] font-semibold uppercase text-slate-500">
                        Relay pool
                      </div>
                    </div>
                    <div>
                      <div className="text-base font-semibold tabular-nums text-slate-950">
                        {relay.sourceMarkRaw}
                      </div>
                      <div className="text-[11px] font-semibold uppercase text-slate-500">
                        {relay.sourceEventLabel}
                      </div>
                    </div>
                    <div>
                      <div className="text-base font-semibold tabular-nums text-slate-950">
                        {relay.stateProbabilityLabel}
                      </div>
                      <div className="text-[11px] font-semibold uppercase text-slate-500">
                        Relay odds
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    {relay.reason}
                  </p>
                  <p className="mt-2 text-[11px] font-semibold uppercase text-slate-500">
                    Projected legs: {relay.topLegs.join(", ")}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
              No likely relay role loaded from this school&apos;s current relay
              ranking and depth profile.
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 text-sm font-semibold text-slate-950">
            Events in this model
          </div>
          <div className="space-y-2">
            {outlook.events.map((event) => (
              <article
                key={event.id}
                className={`rounded-lg border p-3 ${
                  event.isSelected
                    ? "border-[#16324f] bg-[#f4f8fb]"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-semibold text-slate-950">
                      {event.eventLabel}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {event.rankLabel} · {event.markRaw}
                    </div>
                  </div>
                  <span
                    className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${eventPillClass(
                      event.statusLabel,
                    )}`}
                  >
                    {event.statusLabel}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 rounded-md bg-slate-50 p-2 text-center sm:grid-cols-3">
                  <div>
                    <div className="text-base font-semibold tabular-nums text-slate-950">
                      {event.stateProbabilityLabel}
                    </div>
                    <div className="text-[11px] font-semibold uppercase text-slate-500">
                      State
                    </div>
                  </div>
                  <div>
                    <div className="text-base font-semibold tabular-nums text-slate-950">
                      {event.holdProbabilityLabel}
                    </div>
                    <div className="text-[11px] font-semibold uppercase text-slate-500">
                      Hold
                    </div>
                  </div>
                  <div>
                    <div className="text-base font-semibold tabular-nums text-slate-950">
                      {event.scratchProbabilityLabel}
                    </div>
                    <div className="text-[11px] font-semibold uppercase text-slate-500">
                      Scratch
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {event.note}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
