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

function entryWindowLabel(rank: number) {
  return rank <= 18 ? "In field" : "Just outside";
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

type FriendlyRead = {
  label: string;
  detail: string;
  tone: EventEntryForecastRow["projectedEntryTone"];
};

function scoreRead(row: LastChanceRecommendation): FriendlyRead {
  const definition = getEventDefinition(row.event);

  if (row.rank <= 9 && row.scratchProbability >= 35) {
    return {
      label: "Scores if entered",
      detail: `${row.rankLabel} is in scoring range, but the drop chance needs a coach check.`,
      tone: "amber",
    };
  }

  if (row.rank <= 9) {
    return {
      label: definition.relay ? "Relay scores" : "Scores",
      detail: `${row.rankLabel} is inside the top-nine scoring positions.`,
      tone: "emerald",
    };
  }

  if (row.rank <= 18) {
    return {
      label: "In field",
      detail: "Currently in the state field, not projected to score from seed.",
      tone: "sky",
    };
  }

  if (row.expectedScratchOpenings >= 0.5) {
    return {
      label: "Could get pulled in",
      detail: "Needs someone ahead to drop or a better mark to enter the field.",
      tone: "amber",
    };
  }

  return {
    label: "Needs better mark",
    detail: "Outside the field right now.",
    tone: "slate",
  };
}

function scratchRead(row: LastChanceRecommendation): FriendlyRead {
  const definition = getEventDefinition(row.event);

  if (definition.relay) {
    return {
      label: "Relay stays listed",
      detail: "Relays are treated as contested unless a coach manually removes them.",
      tone: "sky",
    };
  }

  if (row.netScratchCall === "Likely scratch" || row.scratchProbability >= 55) {
    return {
      label: "Likely drop",
      detail: "Model sees a stronger event load or team-points path elsewhere.",
      tone: "rose",
    };
  }

  if (row.netScratchCall === "Maybe scratch" || row.scratchProbability >= 35) {
    return {
      label: "May drop",
      detail: "Worth checking against the athlete's other state entries.",
      tone: "amber",
    };
  }

  if (row.scratchProbability >= 18) {
    return {
      label: "Check",
      detail: "Some load pressure, but not enough to call a drop.",
      tone: "amber",
    };
  }

  return {
    label: "Keep entered",
    detail: "No strong drop signal from the loaded marks.",
    tone: "emerald",
  };
}

function scratchPredictionRead(row: ScratchPrediction): FriendlyRead {
  if (row.netScratchCall === "Likely scratch" || row.scratchProbability >= 55) {
    return {
      label: "Likely drop",
      detail: row.scratchTradeoffExplanation,
      tone: "rose",
    };
  }

  if (row.scratchProbability >= 35 || row.netScratchCall === "Maybe scratch") {
    return {
      label: "May drop",
      detail: row.scratchTradeoffExplanation,
      tone: "amber",
    };
  }

  return {
    label: "Check",
    detail: row.scratchTradeoffExplanation,
    tone: "slate",
  };
}

function stVrainRead(opportunity: StVrainStateMarkOpportunity): FriendlyRead {
  const toneByChance: Record<
    StVrainStateMarkOpportunity["chanceTone"],
    EventEntryForecastRow["projectedEntryTone"]
  > = {
    green: "emerald",
    amber: "amber",
    rose: "rose",
    slate: "slate",
  };
  const label =
    opportunity.heatAdjustedChance >= 65
      ? "Strong state-mark path"
      : opportunity.heatAdjustedChance >= 35
        ? "State-mark watch"
        : opportunity.heatAdjustedChance >= 15
          ? "Needs clean race"
          : "Long shot";

  return {
    label,
    detail: `${opportunity.neededImprovementLabel}; ${opportunity.profileLabel.toLowerCase()}, ${opportunity.heatAdjustmentLabel}.`,
    tone: toneByChance[opportunity.chanceTone],
  };
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
    reason: `${best.row.markRaw} is closest to the projected cut ${prediction.predictedCutoffRaw}; ${scoreRead(
      best.row,
    ).label.toLowerCase()}, ${scratchRead(best.row).label.toLowerCase()}.`,
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
    return `${focusTeam}: no urgent priorities in the current state-field window.`;
  }

  return [
    `${focusTeam} last-chance priorities`,
    ...urgent.map(
      (row) => {
        const call = coachCall(row);
        const score = scoreRead(row);
        const scratch = scratchRead(row);

        return `${call.label}: ${row.eventLabel} - ${row.athleteName}, ${row.rankLabel}, ${row.markRaw}, ${row.gapRaw}. Point chance: ${score.label}. Drop chance: ${scratch.label}. ${row.recommendation}`;
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
  const eventScratchPredictions = useMemo(() => {
    const sample = eventRecommendations[0];

    return sample
      ? scratchPredictions.filter(
          (row) => row.gender === sample.gender && row.event === sample.event,
        )
      : [];
  }, [eventRecommendations, scratchPredictions]);
  const topScratchPredictions = eventScratchPredictions.slice(0, 12);

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
    <section className="coach-surface mb-5 overflow-hidden rounded-lg">
      <div className="flex flex-col gap-4 border-b border-[#d8e2ea] bg-[#fbfcfd]/80 p-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="coach-kicker">State field</div>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            {eventTitle}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Start with who is in. Open an athlete name to see other events,
            relay notes, and whether they may drop this event.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={copySummary}
            className="coach-action inline-flex items-center justify-center gap-2 border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Clipboard size={16} />
            {copied ? "Copied" : "Copy summary"}
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
            Predicted last mark
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950 sm:text-2xl">
            {prediction?.predictedCutoffRaw ?? "N/A"}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {prediction
              ? `${prediction.confidence} confidence, ${prediction.movementRaw} movement${
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
            Confidence
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950 sm:text-2xl">
            {prediction?.confidence ?? "N/A"}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {prediction?.sourceCoverageLabel ?? "Public sources only"}
          </div>
        </div>
        <div className="border-b border-slate-200 p-3 sm:p-4 xl:border-b-0 xl:border-r">
          <div className="coach-kicker">
            First out
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
            Need a race, PR, or coach check
          </div>
        </div>
      </div>

      {edgePick ? (
        <div className="grid gap-3 border-b border-slate-200 bg-[#fbfcfd] p-4 lg:grid-cols-[220px_1fr_1fr] lg:items-center">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">
              Likely last spot
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
            is the app&apos;s current pick for the last spot. Confidence:{" "}
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
              title="How to read this"
              summary="Each row says if the athlete is scoring, in the field, just outside, or may drop the event."
            >
              <p>
                Top nine score. Ranks 10-18 are in the state field. Rows
                outside the field need a better mark or an opening. The drop
                read checks event load, schedule pressure, team points, and
                relay conflicts.
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
              title="Past years"
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
              title="Why the app says this"
              summary={`Confidence: ${prediction.confidence}. Late-wave pressure ${prediction.lateWaveRaw}.`}
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
            ? `${focusTeam} things to check across every ${classification} event.`
            : mode === "event"
              ? `${eventTitle}: athletes in first, then athletes just outside.`
              : `Things to check from every ${classification} team.`}
        </p>
      </div>

      {mode === "event" ? (
        <div className="border-b border-slate-200 bg-[#fbfcfd] px-4 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">
                In the field and just outside
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Rank, mark, point chance, and drop chance are grouped for easy
                reading.
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
            const canInspectAthlete = !getEventDefinition(row.event).relay;
            const forecast = eventForecastById.get(row.id);
            const score = scoreRead(row);
            const scratch = scratchRead(row);
            const stVrainOpportunity = stVrainOpportunityByKey.get(
              stVrainOpportunityKey(row.athleteName, row.school),
            );
            const stVrainReadout = stVrainOpportunity
              ? stVrainRead(stVrainOpportunity)
              : undefined;

          return (
            <article
              key={`${mode}-${row.id}-card`}
              className={`rounded-lg border p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
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
                      Last chance
                    </div>
                    <ForecastBadge
                      label={forecast.weekendRaceLabel}
                      tone={forecast.weekendRaceTone}
                    />
                  </div>
                </div>
              ) : null}

              {stVrainOpportunity && stVrainReadout ? (
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
                      <ForecastBadge
                        label={stVrainReadout.label}
                        tone={stVrainReadout.tone}
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {stVrainReadout.detail}
                  </p>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <ForecastBadge label={score.label} tone={score.tone} />
                <ForecastBadge label={scratch.label} tone={scratch.tone} />
                <span
                  className={`inline-flex w-fit max-w-full justify-center rounded-full px-2 py-1 text-center text-[11px] font-semibold leading-4 sm:px-2.5 sm:text-xs ${coachCallClass(
                    action,
                  )}`}
                >
                  {action.label}
                </span>
              </div>

              <div className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
                <ReadPanel title="Point chance" read={score} />
                <ReadPanel title="Drop chance" read={scratch} />
              </div>

              {forecast ? (
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {forecast.basis}
                </p>
              ) : null}
              <p className="mt-3 text-sm leading-5 text-slate-600">
                {row.recommendation}
              </p>
            </article>
          );
        })}
        {!visibleRows.length ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No urgent items in the current state-field window.
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
            People who may drop this event
          </h3>
          <p className="text-sm text-slate-600">
            Current entries with the strongest drop signal. Distance checks
            compare the athlete&apos;s 800, 1600, and 3200 before flagging one.
          </p>
        </div>
        <div className="space-y-3 px-3 pb-3 md:hidden">
          {topScratchPredictions.map((row) => (
            <ScratchPredictionCard key={`${row.id}-mobile`} row={row} />
          ))}
          {!eventScratchPredictions.length ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
              No one is likely to drop this event right now.
            </div>
          ) : null}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="app-data-table min-w-[900px] table-fixed">
            <colgroup>
              <col className="w-[13%]" />
              <col className="w-[15%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              <col className="w-[13%]" />
              <col className="w-[23%]" />
            </colgroup>
            <thead>
              <tr>
                <th className="px-3 py-3 font-semibold">Read</th>
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
                    <ForecastBadge
                      label={scratchPredictionRead(row).label}
                      tone={scratchPredictionRead(row).tone}
                    />
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
              {!eventScratchPredictions.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    No one is likely to drop this event right now.
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
            <table className="app-data-table min-w-[860px] table-fixed">
              <colgroup>
                <col className="w-[10%]" />
                <col className="w-[24%]" />
                <col className="w-[22%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead>
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
  const read = scratchPredictionRead(row);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Drop chance
          </div>
          <div className="mt-1">
            <ForecastBadge label={read.label} tone={read.tone} />
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
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-700">
        {read.detail}
      </p>
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

function ReadPanel({ title, read }: { title: string; read: FriendlyRead }) {
  return (
    <div className="rounded-md bg-white p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-1">
        <ForecastBadge label={read.label} tone={read.tone} />
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">{read.detail}</p>
    </div>
  );
}

function forecastScoreRead(entry: EventEntryForecastRow): FriendlyRead {
  if (entry.rank <= 9 && entry.projectedEntryLabel !== "Scratch watch") {
    return {
      label: "Scores",
      detail: `${entry.rankLabel} is in the scoring range if seed order holds.`,
      tone: "emerald",
    };
  }

  if (entry.rank <= 18) {
    return {
      label: "In field",
      detail: "Currently in the state field.",
      tone: entry.projectedEntryTone === "rose" ? "amber" : "sky",
    };
  }

  return {
    label: "Just outside",
    detail: "Needs an opening or a better mark.",
    tone: "amber",
  };
}

function forecastScratchRead(entry: EventEntryForecastRow): FriendlyRead {
  if (entry.projectedEntryLabel === "Scratch watch") {
    return {
      label: "May drop",
      detail: entry.basis,
      tone: "rose",
    };
  }

  if (entry.projectedEntryLabel === "Coach call") {
    return {
      label: "Check",
      detail: entry.basis,
      tone: "amber",
    };
  }

  return {
    label: "Keep entered",
    detail: entry.basis,
    tone: "emerald",
  };
}

function athleteEventScoreRead(
  event: AthleteEventOutlook["events"][number],
): FriendlyRead {
  if (event.isScoring) {
    return {
      label: "Scores",
      detail: `${event.rankLabel} is seeded for ${event.projectedPoints} state point${
        event.projectedPoints === 1 ? "" : "s"
      }.`,
      tone: "emerald",
    };
  }

  if (event.isQualified) {
    return {
      label: "In field",
      detail: "Qualified for the state field, but outside scoring range from seed.",
      tone: "sky",
    };
  }

  if (event.statusLabel === "Bubble chase") {
    return {
      label: "Needs better mark",
      detail: "Needs an opening or a better mark to enter the field.",
      tone: "amber",
    };
  }

  return {
    label: "Long shot",
    detail: "Needs a major mark update to enter the field.",
    tone: "slate",
  };
}

function athleteEventScratchRead(
  event: AthleteEventOutlook["events"][number],
): FriendlyRead {
  if (event.netScratchCall === "Likely scratch" || event.scratchProbability >= 55) {
    return {
      label: "Likely drop",
      detail: event.note,
      tone: "rose",
    };
  }

  if (event.netScratchCall === "Maybe scratch" || event.scratchProbability >= 35) {
    return {
      label: "May drop",
      detail: event.note,
      tone: "amber",
    };
  }

  if (event.scratchProbability >= 18) {
    return {
      label: "Check",
      detail: event.note,
      tone: "amber",
    };
  }

  return {
    label: "Keep entered",
    detail: event.note,
    tone: "emerald",
  };
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
            Weekend race checklist
          </span>
          <span className="mt-0.5 block text-xs text-slate-600">
            {likelyCount} entries need a weekend check. Open for the point and
            drop read behind each row.
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
            <WeekendChecklistCard
              key={`${entry.id}-weekend-probability`}
              entry={entry}
              onInspectEntry={onInspectEntry}
            />
          ))}
        </div>
      </div>
    </details>
  );
}

function WeekendChecklistCard({
  entry,
  onInspectEntry,
}: {
  entry: EventEntryForecastRow;
  onInspectEntry: (entry: EventEntryForecastRow) => void;
}) {
  const score = forecastScoreRead(entry);
  const scratch = forecastScratchRead(entry);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
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

      <div className="mt-3 grid gap-2 rounded-md bg-slate-50 p-2 sm:grid-cols-2">
        <ReadPanel title="Point chance" read={score} />
        <ReadPanel title="Drop chance" read={scratch} />
      </div>
    </article>
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
  const stVrainReadout = stVrainOpportunity
    ? stVrainRead(stVrainOpportunity)
    : undefined;

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

        {stVrainOpportunity && stVrainReadout ? (
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
                <ForecastBadge
                  label={stVrainReadout.label}
                  tone={stVrainReadout.tone}
                />
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {stVrainReadout.detail} {stVrainOpportunity.reason}
            </p>
          </section>
        ) : null}

        <section className="rounded-lg border border-slate-200 p-3">
          <div className="text-sm font-semibold text-slate-950">
            Drop chance
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
                        {relay.callLabel}
                      </div>
                      <div className="text-[11px] font-semibold uppercase text-slate-500">
                        Relay read
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
            {outlook.events.map((event) => {
              const score = athleteEventScoreRead(event);
              const scratch = athleteEventScratchRead(event);

              return (
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
                  <div className="mt-3 grid gap-2 rounded-md bg-slate-50 p-2 sm:grid-cols-2">
                    <ReadPanel title="Point chance" read={score} />
                    <ReadPanel title="Drop chance" read={scratch} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
