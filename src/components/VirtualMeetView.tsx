"use client";

import { Fragment, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  GitCompare,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import type {
  EventDiscipline,
  EventKey,
  Gender,
  VirtualMeetEntry,
  VirtualStateMeet,
} from "@/types/domain";
import { getEventDefinition } from "@/lib/data/events";
import { DEFAULT_FOCUS_TEAM, shortSchoolName } from "@/lib/utils/focusTeam";

const SCORING = [10, 8, 7, 6, 5, 4, 3, 2, 1];

type ScenarioValue = {
  place: number;
  best: number;
  worst: number;
};

type ScenarioState = Record<string, ScenarioValue>;

type ProjectionMode = "seed" | "realistic";

type RealisticTone = "keep" | "adjust" | "scratch";

type RealisticAdjustment = {
  scratched: boolean;
  placeDelta: number;
  label: string;
  reason: string;
  tone: RealisticTone;
};

type ProjectedEntry = VirtualMeetEntry & {
  eventTitle: string;
  discipline: EventDiscipline;
  baselinePoints: number;
  scenarioPlace: number;
  confidenceBest: number;
  confidenceWorst: number;
  scenarioPoints: number;
  lowPoints: number;
  highPoints: number;
  realisticLabel?: string;
  realisticReason?: string;
  realisticTone?: RealisticTone;
  realisticScratched?: boolean;
  realisticPlaceDelta?: number;
};

type TeamProjection = {
  school: string;
  gender: Gender;
  rank: number;
  points: number;
  lowPoints: number;
  highPoints: number;
  scoringEntries: number;
  entries: ProjectedEntry[];
};

type PalmerPriority = {
  id: string;
  label: string;
  eventTitle: string;
  athleteName: string;
  seed: number;
  markRaw: string;
  points: number;
  range: string;
  target: string;
  action: string;
  priorityScore: number;
};

const stateMeetPriorityLabels = [
  "Score opportunity",
  "Upgrade scorer",
  "Secure big points",
];

const disciplineColors: Record<EventDiscipline, string> = {
  sprint: "#2563eb",
  hurdle: "#7c3aed",
  distance: "#059669",
  relay: "#dc2626",
  jump: "#d97706",
  throw: "#475569",
};

const disciplineLabels: Record<EventDiscipline, string> = {
  sprint: "Sprints",
  hurdle: "Hurdles",
  distance: "Distance",
  relay: "Relays",
  jump: "Jumps",
  throw: "Throws",
};

const projectionModeCopy: Record<
  ProjectionMode,
  { label: string; shortLabel: string; detail: string }
> = {
  seed: {
    label: "Seed order",
    shortLabel: "Seed",
    detail: "Scores the Top 18 exactly in ranked order.",
  },
  realistic: {
    label: "Realistic coach choices",
    shortLabel: "Realistic",
    detail: "Protects big individual points, clears obvious scratches, and prices relay alternate risk.",
  },
};

function clampPlace(value: number) {
  if (!Number.isFinite(value)) return 18;
  return Math.min(18, Math.max(1, Math.round(value)));
}

function pointsForPlace(place: number) {
  return SCORING[clampPlace(place) - 1] ?? 0;
}

function rangeWidth(place: number) {
  return place <= 3 ? 1 : place <= 9 ? 2 : place <= 12 ? 3 : 4;
}

function defaultScenario(entry: VirtualMeetEntry): ScenarioValue {
  const place = clampPlace(entry.projectedPlace ?? entry.seed);
  const width = rangeWidth(place);

  return {
    place,
    best: clampPlace(place - width),
    worst: clampPlace(place + width),
  };
}

function normalizeScenario(value: ScenarioValue): ScenarioValue {
  const place = clampPlace(value.place);
  const best = clampPlace(value.best);
  const worst = clampPlace(value.worst);

  return {
    place,
    best: Math.min(best, worst),
    worst: Math.max(best, worst),
  };
}

function scenarioFor(entry: VirtualMeetEntry, scenario: ScenarioState) {
  return normalizeScenario(scenario[entry.id] ?? defaultScenario(entry));
}

function autoScenarioForPlace(place: number): ScenarioValue {
  const normalized = clampPlace(place);
  const width = rangeWidth(normalized);

  return {
    place: normalized,
    best: clampPlace(normalized - width),
    worst: clampPlace(normalized + width),
  };
}

function scoreRangeLabel(entry: ProjectedEntry) {
  if (entry.lowPoints === entry.highPoints) {
    return `${entry.scenarioPoints} pts`;
  }

  return `${entry.lowPoints}-${entry.highPoints} pts`;
}

function athleteLoadKey(entry: VirtualMeetEntry) {
  return `${entry.gender}|${entry.school}|${entry.athleteName.toLowerCase()}`;
}

function teamGenderKey(entry: VirtualMeetEntry) {
  return `${entry.gender}|${entry.school}`;
}

function isManualScenario(entry: VirtualMeetEntry, scenario: ScenarioState) {
  return Boolean(scenario[entry.id]);
}

function protectedEventNote(event: EventKey) {
  if (event === "1600m") {
    return "Saturday 1600s are protected by default unless the point tradeoff is obvious.";
  }
  if (event === "Shot Put" || event === "Discus") {
    return "Throws rarely scratch unless the athlete has a heavy track load.";
  }
  return "Scoring entries are protected unless another event is clearly worth more.";
}

function buildAthleteLoads(meet: VirtualStateMeet, activeGender?: Gender) {
  const loads = new Map<string, VirtualMeetEntry[]>();

  for (const event of meet.events) {
    if (activeGender && event.gender !== activeGender) continue;
    const definition = getEventDefinition(event.event);
    if (definition.relay) continue;

    for (const entry of event.entries) {
      const key = athleteLoadKey(entry);
      const rows = loads.get(key) ?? [];
      rows.push(entry);
      loads.set(key, rows);
    }
  }

  for (const rows of loads.values()) {
    rows.sort(
      (a, b) =>
        pointsForPlace(b.seed) - pointsForPlace(a.seed) ||
        a.seed - b.seed ||
        a.event.localeCompare(b.event),
    );
  }

  return loads;
}

function distanceEvents(rows: VirtualMeetEntry[]) {
  return new Set(
    rows
      .filter((row) => getEventDefinition(row.event).discipline === "distance")
      .map((row) => row.event),
  );
}

function individualRealisticAdjustment(
  entry: VirtualMeetEntry,
  rows: VirtualMeetEntry[],
): RealisticAdjustment {
  const definition = getEventDefinition(entry.event);
  const keepValue = pointsForPlace(entry.seed);
  const otherRows = rows.filter((row) => row.id !== entry.id);
  const bestOther = otherRows[0];
  const bestOtherValue = bestOther ? pointsForPlace(bestOther.seed) : 0;
  const pointDelta = bestOtherValue - keepValue;
  const hasFourPlusIndividualEvents = rows.length > 4;
  const hasThreePlusIndividualEvents = rows.length >= 3;
  const eventSet = distanceEvents(rows);
  const distanceTriple =
    eventSet.has("800m") && eventSet.has("1600m") && eventSet.has("3200m");
  const weakDistance =
    definition.discipline === "distance" &&
    entry.seed > 9 &&
    bestOtherValue >= 5 &&
    pointDelta >= 3;
  const weakSprintOrHurdle =
    (definition.discipline === "sprint" || definition.discipline === "hurdle") &&
    entry.seed > 9 &&
    bestOtherValue >= 6 &&
    pointDelta >= 4;

  if (rows.length <= 1) {
    return {
      scratched: false,
      placeDelta: 0,
      label: "Keep",
      reason: "No multi-event pressure in the top-18 data.",
      tone: "keep",
    };
  }

  if (definition.discipline === "throw") {
    return {
      scratched: false,
      placeDelta: 0,
      label: "Keep",
      reason: protectedEventNote(entry.event),
      tone: "keep",
    };
  }

  if (entry.seed <= 6) {
    return {
      scratched: false,
      placeDelta: 0,
      label: "Protect scorer",
      reason: `Seed ${entry.seed} is a major scoring position. ${protectedEventNote(entry.event)}`,
      tone: "keep",
    };
  }

  if (entry.event === "1600m" && !hasFourPlusIndividualEvents) {
    return {
      scratched: false,
      placeDelta: 0,
      label: "Protect",
      reason: protectedEventNote(entry.event),
      tone: "keep",
    };
  }

  if (entry.seed <= 9 && pointDelta < 5 && !hasFourPlusIndividualEvents) {
    return {
      scratched: false,
      placeDelta: 0,
      label: "Keep scorer",
      reason: `Projected points stay in this event. ${protectedEventNote(entry.event)}`,
      tone: "keep",
    };
  }

  if (hasFourPlusIndividualEvents && bestOther && pointDelta >= 2 && entry.seed >= 10) {
    return {
      scratched: true,
      placeDelta: 0,
      label: "Likely scratch",
      reason: `Four-event pressure: ${bestOther.event} projects ${bestOtherValue} pts vs ${keepValue} here.`,
      tone: "scratch",
    };
  }

  if (distanceTriple && weakDistance && bestOther) {
    return {
      scratched: true,
      placeDelta: 0,
      label: "Likely scratch",
      reason: `Distance triple pressure: ${bestOther.event} is the better scoring path.`,
      tone: "scratch",
    };
  }

  if ((weakDistance || weakSprintOrHurdle) && bestOther && hasThreePlusIndividualEvents) {
    return {
      scratched: true,
      placeDelta: 0,
      label: "Likely scratch",
      reason: `${bestOther.event} has a clearer scoring path, so this lower-value entry is removed in realistic mode.`,
      tone: "scratch",
    };
  }

  if (entry.seed >= 14 && hasThreePlusIndividualEvents && bestOtherValue >= 4) {
    return {
      scratched: false,
      placeDelta: 1,
      label: "Coach call",
      reason: `Lower seed with multi-event load. Kept in, but moved down one place for realistic fatigue/priority risk.`,
      tone: "adjust",
    };
  }

  return {
    scratched: false,
    placeDelta: 0,
    label: "Keep",
    reason: `No clear point gain from scratching this event.`,
    tone: "keep",
  };
}

function relayPoolEvents(event: EventKey): EventKey[] {
  switch (event) {
    case "4x100m Relay":
      return ["100m", "200m", "100m Hurdles", "110m Hurdles", "300m Hurdles"];
    case "4x200m Relay":
      return ["200m", "100m", "400m", "300m Hurdles"];
    case "4x400m Relay":
      return ["400m", "800m", "200m", "300m Hurdles", "1600m"];
    case "4x800m Relay":
      return ["800m", "1600m", "3200m", "400m"];
    default:
      return [];
  }
}

function relayRealisticAdjustment(
  entry: VirtualMeetEntry,
  individualRows: VirtualMeetEntry[],
): RealisticAdjustment {
  const pool = new Set(relayPoolEvents(entry.event));
  const relevant = individualRows.filter((row) => pool.has(row.event));
  const scoringLegs = relevant.filter((row) => row.seed <= 9);
  const majorScorers = relevant.filter((row) => row.seed <= 4);
  const relayPoints = pointsForPlace(entry.seed);

  if (!relevant.length) {
    return {
      scratched: false,
      placeDelta: 0,
      label: "Repeatable",
      reason: "No top-18 individual conflict found; relay stays at seed projection.",
      tone: "keep",
    };
  }

  if (entry.seed <= 3 && relevant.length >= 4 && majorScorers.length <= 1) {
    return {
      scratched: false,
      placeDelta: 0,
      label: "Alternate-safe",
      reason: "Relay is strong and the top-18 depth suggests it can survive normal substitutions.",
      tone: "keep",
    };
  }

  if (scoringLegs.length >= 3 && relayPoints <= 6) {
    return {
      scratched: false,
      placeDelta: 3,
      label: "Loaded qualifier",
      reason: "Relay likely used individual scorers to qualify; realistic mode keeps it entered but scores an alternate lineup.",
      tone: "adjust",
    };
  }

  if (majorScorers.length >= 2 && relayPoints <= 7) {
    return {
      scratched: false,
      placeDelta: 2,
      label: "Lineup risk",
      reason: "Multiple major individual scorers are in this relay pool, so alternates may cost places.",
      tone: "adjust",
    };
  }

  if (scoringLegs.length >= 1 && relayPoints <= 5) {
    return {
      scratched: false,
      placeDelta: 1,
      label: "Lineup risk",
      reason: "At least one individual scorer may be protected; relay remains entered with a small alternate penalty.",
      tone: "adjust",
    };
  }

  return {
    scratched: false,
    placeDelta: 0,
    label: "Repeatable",
    reason: "Relay stays declared and the top-18 data does not show a clear alternate penalty.",
    tone: "keep",
  };
}

function buildRealisticAdjustments(
  meet: VirtualStateMeet,
  scenario: ScenarioState,
  activeGender?: Gender,
) {
  const adjustments = new Map<string, RealisticAdjustment>();
  const athleteLoads = buildAthleteLoads(meet, activeGender);
  const individualByTeam = new Map<string, VirtualMeetEntry[]>();

  for (const rows of athleteLoads.values()) {
    for (const row of rows) {
      const key = teamGenderKey(row);
      const teamRows = individualByTeam.get(key) ?? [];
      teamRows.push(row);
      individualByTeam.set(key, teamRows);
    }
  }

  for (const event of meet.events) {
    if (activeGender && event.gender !== activeGender) continue;
    const definition = getEventDefinition(event.event);

    for (const entry of event.entries) {
      if (isManualScenario(entry, scenario)) {
        adjustments.set(entry.id, {
          scratched: false,
          placeDelta: 0,
          label: "Manual override",
          reason: "Coach scenario edit overrides the automatic realistic model.",
          tone: "keep",
        });
        continue;
      }

      if (definition.relay) {
        adjustments.set(
          entry.id,
          relayRealisticAdjustment(
            entry,
            individualByTeam.get(teamGenderKey(entry)) ?? [],
          ),
        );
        continue;
      }

      adjustments.set(
        entry.id,
        individualRealisticAdjustment(
          entry,
          athleteLoads.get(athleteLoadKey(entry)) ?? [entry],
        ),
      );
    }
  }

  return adjustments;
}

function buildProjectedEntries(
  meet: VirtualStateMeet,
  scenario: ScenarioState,
  activeGender?: Gender,
  projectionMode: ProjectionMode = "seed",
): ProjectedEntry[] {
  const realisticAdjustments =
    projectionMode === "realistic"
      ? buildRealisticAdjustments(meet, scenario, activeGender)
      : new Map<string, RealisticAdjustment>();

  return meet.events.flatMap((event) => {
    if (activeGender && event.gender !== activeGender) {
      return [];
    }

    const definition = getEventDefinition(event.event);
    const eventRows = event.entries.map((entry) => {
      const adjustment = realisticAdjustments.get(entry.id);
      const manual = isManualScenario(entry, scenario);

      return {
        entry,
        adjustment,
        manual,
        sortPlace:
          projectionMode === "realistic" && adjustment && !manual
            ? entry.seed + adjustment.placeDelta
            : scenarioFor(entry, scenario).place,
      };
    });
    const placeById =
      projectionMode === "realistic"
        ? new Map(
            eventRows
              .filter((row) => row.manual || !row.adjustment?.scratched)
              .sort(
                (a, b) =>
                  a.sortPlace - b.sortPlace ||
                  a.entry.seed - b.entry.seed ||
                  a.entry.markValue - b.entry.markValue,
              )
              .map((row, index) => [row.entry.id, clampPlace(index + 1)]),
          )
        : new Map<string, number>();

    return eventRows.map(({ entry, adjustment, manual }) => {
      const baselinePoints = pointsForPlace(entry.seed);
      const scratched =
        projectionMode === "realistic" && adjustment?.scratched && !manual;
      const value =
        projectionMode === "realistic" && !manual
          ? scratched
            ? { place: clampPlace(entry.seed), best: clampPlace(entry.seed), worst: 18 }
            : autoScenarioForPlace(placeById.get(entry.id) ?? entry.seed)
          : scenarioFor(entry, scenario);
      const scenarioPoints = scratched ? 0 : pointsForPlace(value.place);
      const lowPoints = scratched ? 0 : pointsForPlace(value.worst);
      const highPoints = scratched ? 0 : pointsForPlace(value.best);

      return {
        ...entry,
        eventTitle: `${event.gender} ${definition.displayName}`,
        discipline: definition.discipline,
        baselinePoints,
        scenarioPlace: value.place,
        confidenceBest: value.best,
        confidenceWorst: value.worst,
        scenarioPoints,
        lowPoints,
        highPoints,
        realisticLabel:
          projectionMode === "realistic" && adjustment
            ? adjustment.label
            : undefined,
        realisticReason:
          projectionMode === "realistic" && adjustment
            ? adjustment.reason
            : undefined,
        realisticTone:
          projectionMode === "realistic" && adjustment
            ? adjustment.tone
            : undefined,
        realisticScratched: scratched,
        realisticPlaceDelta:
          projectionMode === "realistic" && adjustment
            ? adjustment.placeDelta
            : undefined,
      };
    });
  });
}

function buildTeamProjections(entries: ProjectedEntry[]): TeamProjection[] {
  const byTeam = new Map<string, TeamProjection>();

  for (const entry of entries) {
    const key = `${entry.gender}|${entry.school}`;
    const existing = byTeam.get(key) ?? {
      school: entry.school,
      gender: entry.gender,
      rank: 0,
      points: 0,
      lowPoints: 0,
      highPoints: 0,
      scoringEntries: 0,
      entries: [],
    };

    existing.points += entry.scenarioPoints;
    existing.lowPoints += entry.lowPoints;
    existing.highPoints += entry.highPoints;
    if (entry.scenarioPoints > 0) {
      existing.scoringEntries += 1;
    }
    if (
      entry.scenarioPoints > 0 ||
      entry.highPoints > 0 ||
      entry.baselinePoints > 0 ||
      entry.realisticScratched ||
      (entry.realisticPlaceDelta ?? 0) > 0
    ) {
      existing.entries.push(entry);
    }
    byTeam.set(key, existing);
  }

  return [...byTeam.values()]
    .filter(
      (team) =>
        team.points > 0 ||
        team.highPoints > 0 ||
        team.entries.some((entry) => entry.baselinePoints > 0),
    )
    .map((team) => ({
      ...team,
      entries: team.entries.sort(
        (a, b) =>
          b.scenarioPoints - a.scenarioPoints ||
          a.scenarioPlace - b.scenarioPlace ||
          a.eventTitle.localeCompare(b.eventTitle),
      ),
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.highPoints - a.highPoints ||
        a.school.localeCompare(b.school),
    )
    .map((team, index) => ({
      ...team,
      rank: index + 1,
    }));
}

function teamRank(teams: TeamProjection[], school: string) {
  const index = teams.findIndex((team) => team.school === school);
  return index === -1 ? undefined : index + 1;
}

function pointRange(team?: TeamProjection) {
  if (!team) return "0 pts";
  if (team.lowPoints === team.highPoints) return `${team.points} pts`;
  return `${team.lowPoints}-${team.highPoints} pts`;
}

function buildPalmerPriorities(
  entries: ProjectedEntry[],
  meet: VirtualStateMeet,
  focusTeam: string,
) {
  return entries
    .filter((entry) => entry.school === focusTeam)
    .map((entry): PalmerPriority | undefined => {
      const event = meet.events.find(
        (item) => item.gender === entry.gender && item.event === entry.event,
      );
      const targetScorer = event?.entries[8];
      const nextSeed = event?.entries[entry.seed - 2];
      const upside = Math.max(0, entry.highPoints - entry.scenarioPoints);
      const canReachPoints = entry.confidenceBest <= 9;

      if (entry.scenarioPoints <= 0 && !canReachPoints && entry.seed > 12) {
        return undefined;
      }

      if (entry.seed <= 4) {
        return {
          id: `${entry.id}-priority`,
          label: "Secure big points",
          eventTitle: entry.eventTitle,
          athleteName: entry.athleteName,
          seed: entry.seed,
          markRaw: entry.markRaw,
          points: entry.scenarioPoints,
          range: scoreRangeLabel(entry),
          target: nextSeed
            ? `Next seed: ${nextSeed.athleteName}, ${nextSeed.markRaw}`
            : "Already at the front",
          action:
            "At state, treat this as a top-priority entry. It carries major team points, so only add events if they do not weaken this one.",
          priorityScore: 90 + entry.scenarioPoints * 4 + upside * 8,
        };
      }

      if (entry.scenarioPoints > 0) {
        return {
          id: `${entry.id}-priority`,
          label: "Upgrade scorer",
          eventTitle: entry.eventTitle,
          athleteName: entry.athleteName,
          seed: entry.seed,
          markRaw: entry.markRaw,
          points: entry.scenarioPoints,
          range: scoreRangeLabel(entry),
          target: nextSeed
            ? `Next seed: ${nextSeed.athleteName}, ${nextSeed.markRaw}`
            : "Hold projected points",
          action:
            upside > 0
              ? `At state, this is a high-value place to steal points; a clean race can add up to ${upside} team points.`
              : "At state, preserve the projected point and avoid choices that make this event worse.",
          priorityScore: 75 + entry.scenarioPoints * 5 + upside * 12,
        };
      }

      return {
        id: `${entry.id}-priority`,
        label: "Score opportunity",
        eventTitle: entry.eventTitle,
        athleteName: entry.athleteName,
        seed: entry.seed,
        markRaw: entry.markRaw,
        points: entry.scenarioPoints,
        range: scoreRangeLabel(entry),
        target: targetScorer
          ? `8th seed: ${targetScorer.athleteName}, ${targetScorer.markRaw}`
          : "Need top 9",
        action:
          "At state, this is one of the clearest paths from no points to points if the athlete/team beats seed.",
        priorityScore: 86 - entry.seed + entry.highPoints * 14,
      };
    })
    .filter((row): row is PalmerPriority => Boolean(row))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 12);
}

function updateScenarioValue(
  scenario: ScenarioState,
  entry: ProjectedEntry,
  key: keyof ScenarioValue,
  rawValue: string,
) {
  const value = Number(rawValue);
  const current = scenarioFor(entry, scenario);

  return {
    ...scenario,
    [entry.id]: normalizeScenario({
      ...current,
      [key]: Number.isFinite(value) ? value : current[key],
    }),
  };
}

function ScoreBars({
  title,
  teams,
  focusTeam,
}: {
  title: string;
  teams: TeamProjection[];
  focusTeam: string;
}) {
  const topTeams = teams.slice(0, 8);
  const maxPoints = Math.max(1, ...topTeams.map((team) => team.points));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <BarChart3 size={17} className="text-[#16324f]" />
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      </div>
      <div className="mt-4 space-y-3">
        {topTeams.map((team, index) => (
          <div key={`${team.gender}-${team.school}-bar`}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium text-slate-700">
                {index + 1}. {team.school}
              </span>
              <span className="font-semibold tabular-nums text-slate-950">
                {team.points}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full ${
                  team.school === focusTeam ? "bg-emerald-500" : "bg-[#16324f]"
                }`}
                style={{ width: `${Math.max(4, (team.points / maxPoints) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PalmerPointMix({
  entries,
  focusTeam,
}: {
  entries: ProjectedEntry[];
  focusTeam: string;
}) {
  const rows = entries.filter(
    (entry) => entry.school === focusTeam && entry.scenarioPoints > 0,
  );
  const byDiscipline = rows.reduce(
    (totals, entry) => ({
      ...totals,
      [entry.discipline]: (totals[entry.discipline] ?? 0) + entry.scenarioPoints,
    }),
    {} as Partial<Record<EventDiscipline, number>>,
  );
  const total = rows.reduce((sum, entry) => sum + entry.scenarioPoints, 0);
  let degrees = 0;
  const slices = Object.entries(byDiscipline).map(([discipline, points]) => {
    const start = degrees;
    const end = degrees + ((points ?? 0) / Math.max(1, total)) * 360;
    degrees = end;
    return `${disciplineColors[discipline as EventDiscipline]} ${start}deg ${end}deg`;
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Trophy size={17} className="text-[#16324f]" />
        <h3 className="text-sm font-semibold text-slate-950">
          {shortSchoolName(focusTeam)} point mix
        </h3>
      </div>
      <div className="mt-4 flex items-center gap-5">
        <div
          className="flex size-28 shrink-0 items-center justify-center rounded-full"
          style={{
            background: total
              ? `conic-gradient(${slices.join(", ")})`
              : "#e2e8f0",
          }}
        >
          <div className="flex size-16 items-center justify-center rounded-full bg-white text-lg font-semibold tabular-nums">
            {total}
          </div>
        </div>
        <div className="grid flex-1 gap-2 text-sm">
          {Object.entries(byDiscipline).map(([discipline, points]) => (
            <div
              key={discipline}
              className="flex items-center justify-between gap-3"
            >
              <span className="inline-flex items-center gap-2 text-slate-600">
                <span
                  className="size-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      disciplineColors[discipline as EventDiscipline],
                  }}
                />
                {disciplineLabels[discipline as EventDiscipline]}
              </span>
              <span className="font-semibold tabular-nums text-slate-950">
                {points}
              </span>
            </div>
          ))}
          {!total ? (
            <div className="text-sm text-slate-500">
              No {shortSchoolName(focusTeam)} points in this scenario yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function opportunityBuckets(entries: ProjectedEntry[], focusTeam: string) {
  const focusEntries = entries.filter((entry) => entry.school === focusTeam);
  const protect = focusEntries
    .filter((entry) => entry.scenarioPoints >= 5)
    .sort((a, b) => b.scenarioPoints - a.scenarioPoints || a.scenarioPlace - b.scenarioPlace)
    .slice(0, 4);
  const steal = focusEntries
    .filter((entry) => entry.scenarioPoints > 0 && entry.highPoints > entry.scenarioPoints)
    .sort((a, b) => b.highPoints - b.scenarioPoints - (a.highPoints - a.scenarioPoints))
    .slice(0, 4);
  const breakthrough = focusEntries
    .filter((entry) => entry.scenarioPoints === 0 && entry.confidenceBest <= 9)
    .sort((a, b) => a.confidenceBest - b.confidenceBest || a.seed - b.seed)
    .slice(0, 4);
  const risk = focusEntries
    .filter((entry) => entry.scenarioPoints > 0 && entry.lowPoints < entry.scenarioPoints)
    .sort((a, b) => a.lowPoints - b.lowPoints || b.scenarioPoints - a.scenarioPoints)
    .slice(0, 4);

  return { protect, steal, breakthrough, risk };
}

function OpportunityList({
  title,
  detail,
  rows,
  empty,
}: {
  title: string;
  detail: string;
  rows: ProjectedEntry[];
  empty: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-950">{title}</div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
      <div className="mt-3 space-y-2">
        {rows.map((entry) => (
          <div
            key={`${title}-${entry.id}`}
            className="rounded-md bg-slate-50 px-3 py-2 text-sm"
          >
            <div className="font-semibold text-slate-950">
              {entry.athleteName}
            </div>
            <div className="mt-0.5 text-xs leading-5 text-slate-600">
              {entry.eventTitle} · seed {entry.seed} · {scoreRangeLabel(entry)}
            </div>
          </div>
        ))}
        {!rows.length ? (
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
            {empty}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function FocusOpportunityPanel({
  entries,
  focusTeam,
}: {
  entries: ProjectedEntry[];
  focusTeam: string;
}) {
  const buckets = opportunityBuckets(entries, focusTeam);

  return (
    <section className="grid gap-3 xl:grid-cols-4">
      <OpportunityList
        title="Protect"
        detail="Highest projected scoring value. Do not weaken these without a clear points gain."
        rows={buckets.protect}
        empty="No high-value scoring entries loaded."
      />
      <OpportunityList
        title="Steal points"
        detail="Already scoring, but the best-case range can add team points."
        rows={buckets.steal}
        empty="No obvious scoring upgrades in the current range."
      />
      <OpportunityList
        title="Break through"
        detail="Currently outside points, but the best-case range reaches top nine."
        rows={buckets.breakthrough}
        empty="No non-scoring entries with a top-nine range."
      />
      <OpportunityList
        title="Point risk"
        detail="Current scorers whose lower range can lose points."
        rows={buckets.risk}
        empty="No major point-risk entries in this scenario."
      />
    </section>
  );
}

type TeamDelta = {
  key: string;
  school: string;
  gender: Gender;
  baselinePoints: number;
  projectedPoints: number;
  delta: number;
  baselineRank?: number;
  projectedRank?: number;
};

function buildTeamDeltas(
  baselineTeams: TeamProjection[],
  projectedTeams: TeamProjection[],
) {
  const byKey = new Map<string, TeamDelta>();

  for (const team of baselineTeams) {
    const key = `${team.gender}|${team.school}`;
    byKey.set(key, {
      key,
      school: team.school,
      gender: team.gender,
      baselinePoints: team.points,
      projectedPoints: 0,
      delta: -team.points,
      baselineRank: team.rank,
    });
  }

  for (const team of projectedTeams) {
    const key = `${team.gender}|${team.school}`;
    const existing = byKey.get(key);
    byKey.set(key, {
      key,
      school: team.school,
      gender: team.gender,
      baselinePoints: existing?.baselinePoints ?? 0,
      projectedPoints: team.points,
      delta: team.points - (existing?.baselinePoints ?? 0),
      baselineRank: existing?.baselineRank,
      projectedRank: team.rank,
    });
  }

  return [...byKey.values()].sort(
    (a, b) =>
      Math.abs(b.delta) - Math.abs(a.delta) ||
      b.projectedPoints - a.projectedPoints ||
      a.school.localeCompare(b.school),
  );
}

function RealisticScoreDeltaPanel({
  projectionMode,
  baselineTeams,
  projectedTeams,
  focusTeam,
}: {
  projectionMode: ProjectionMode;
  baselineTeams: TeamProjection[];
  projectedTeams: TeamProjection[];
  focusTeam: string;
}) {
  const deltas = buildTeamDeltas(baselineTeams, projectedTeams);
  const focusDelta = deltas.find((row) => row.school === focusTeam);
  const gainers = deltas.filter((row) => row.delta > 0).slice(0, 4);
  const losses = deltas.filter((row) => row.delta < 0).slice(0, 4);

  if (projectionMode === "seed") {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <GitCompare size={17} className="text-[#16324f]" />
          <h3 className="text-sm font-semibold text-slate-950">
            Realistic score delta
          </h3>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Switch to realistic coach choices to compare seed-order scoring
          against projected scratches, protected individual scorers, and relays
          scored with alternate lineups.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={17} className="text-amber-800" />
        <h3 className="text-sm font-semibold text-amber-950">
          Realistic coach-choice score swing
        </h3>
      </div>
      <p className="mt-2 text-sm leading-6 text-amber-950/80">
        Seed order assumes every qualifier repeats the listed mark. Realistic
        mode assumes coaches protect the biggest point opportunities, scratch
        only lower-value individual events when the math is clear, and keep
        relays entered while replacing overloaded legs with alternates.
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-md bg-white p-3">
          <div className="text-xs font-semibold uppercase text-slate-500">
            {shortSchoolName(focusTeam)}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
            {focusDelta
              ? `${focusDelta.delta > 0 ? "+" : ""}${focusDelta.delta}`
              : "0"}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {focusDelta
              ? `${focusDelta.baselinePoints} seed pts to ${focusDelta.projectedPoints} realistic pts`
              : "No score change in this gender."}
          </div>
        </div>
        <div className="rounded-md bg-white p-3">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Biggest gains
          </div>
          <div className="mt-2 space-y-1">
            {gainers.map((row) => (
              <div
                key={`${row.key}-gain`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="truncate text-slate-700">{row.school}</span>
                <span className="font-semibold tabular-nums text-emerald-700">
                  +{row.delta}
                </span>
              </div>
            ))}
            {!gainers.length ? (
              <div className="text-sm text-slate-500">No teams gain points.</div>
            ) : null}
          </div>
        </div>
        <div className="rounded-md bg-white p-3">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Biggest losses
          </div>
          <div className="mt-2 space-y-1">
            {losses.map((row) => (
              <div
                key={`${row.key}-loss`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="truncate text-slate-700">{row.school}</span>
                <span className="font-semibold tabular-nums text-rose-700">
                  {row.delta}
                </span>
              </div>
            ))}
            {!losses.length ? (
              <div className="text-sm text-slate-500">No teams lose points.</div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function realisticBadgeClass(tone?: RealisticTone) {
  if (tone === "scratch") return "bg-rose-100 text-rose-800";
  if (tone === "adjust") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}

function PalmerNarrative({
  teams,
  priorities,
  focusTeam,
  activeGender,
  detailsOpen,
  onDetailsToggle,
}: {
  teams: TeamProjection[];
  priorities: PalmerPriority[];
  focusTeam: string;
  activeGender: Gender;
  detailsOpen: boolean;
  onDetailsToggle: () => void;
}) {
  const focusProjection = teams.find((team) => team.school === focusTeam);
  const focusRank = teamRank(teams, focusTeam);
  const nextAhead = focusRank && focusRank > 1 ? teams[focusRank - 2] : undefined;
  const statePointRows = priorities.filter((row) =>
    stateMeetPriorityLabels.includes(row.label),
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-[#16324f]" />
          <h2 className="text-base font-semibold text-slate-950">
            {shortSchoolName(focusTeam)} score-max plan
          </h2>
        </div>
        <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
          This assumes it is state meet weekend. It ranks the events that matter
          most for team points: current state scorers, athletes who can move into
          the top 9, and spots where one better finish changes the team race.
        </p>
      </div>

      <div className="grid gap-0 border-b border-slate-200 md:grid-cols-3">
        <div className="border-b border-slate-200 p-4 md:border-b-0 md:border-r">
          <div className="text-xs font-semibold uppercase text-slate-500">
            {activeGender} path
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {focusRank ? `#${focusRank}` : "N/A"} / {focusProjection?.points ?? 0}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {nextAhead
              ? `${nextAhead.points - (focusProjection?.points ?? 0)} pts behind ${nextAhead.school}. Range ${pointRange(focusProjection)}.`
              : `Currently projected first or no ${activeGender.toLowerCase()} points loaded.`}
          </p>
        </div>
        <div className="border-b border-slate-200 p-4 md:border-b-0 md:border-r">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Current leader
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {teams[0]?.points ?? 0}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {teams[0]
              ? `${teams[0].school} leads the ${activeGender.toLowerCase()} projection.`
              : `No ${activeGender.toLowerCase()} projected points loaded.`}
          </p>
        </div>
        <div className="p-4">
          <div className="text-xs font-semibold uppercase text-slate-500">
            State meet priorities
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {statePointRows.length}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Events to hold, upgrade, or attack for points.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onDetailsToggle}
        className="flex w-full items-center justify-between gap-3 p-4 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
        aria-expanded={detailsOpen}
      >
        <span>
          {detailsOpen ? "Hide" : "Show"} event priorities ({priorities.length})
        </span>
        {detailsOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
      </button>

      {detailsOpen ? (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {priorities.map((row, index) => (
            <div
              key={row.id}
              className="grid min-w-0 gap-3 p-4 lg:grid-cols-[4rem_11rem_minmax(0,1fr)_12rem]"
            >
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">
                  Priority
                </div>
                <div className="mt-1 text-xl font-semibold tabular-nums">
                  {index + 1}
                </div>
              </div>
              <div className="min-w-0">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    row.label === "Score opportunity"
                      ? "bg-rose-100 text-rose-800"
                      : row.label === "Upgrade scorer"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {row.label}
                </span>
                <div className="mt-2 text-xs text-slate-500">
                  Seed {row.seed}, {row.range}
                </div>
              </div>
              <div className="min-w-0">
                <div className="break-words font-semibold text-slate-950">
                  {row.eventTitle} - {row.athleteName}
                </div>
                <div className="mt-1 break-words text-sm text-slate-600">
                  {row.action}
                </div>
              </div>
              <div className="min-w-0 text-sm text-slate-600">
                <div className="break-words font-semibold text-slate-950">
                  {row.markRaw}
                </div>
                <div className="mt-1 break-words">{row.target}</div>
              </div>
            </div>
          ))}
          {!priorities.length ? (
            <div className="p-6 text-center text-sm text-slate-500">
              No {shortSchoolName(focusTeam)} scoring priorities in the current virtual field.
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function TeamScoreTable({
  title,
  teams,
  totalTeams,
  expanded,
  onToggle,
  onScenarioChange,
  focusTeam,
}: {
  title: string;
  teams: TeamProjection[];
  totalTeams: number;
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
  onScenarioChange: (
    entry: ProjectedEntry,
    key: keyof ScenarioValue,
    value: string,
  ) => void;
  focusTeam: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Showing {teams.length} of {totalTeams} teams. CHSAA points score 9
          places: 10-8-7-6-5-4-3-2-1. Open a team to edit projected place and
          best-to-worst range.
        </p>
      </div>
      <div className="divide-y divide-slate-100 md:hidden">
        {teams.map((team) => {
          const key = `${team.gender}-${team.school}`;
          const open = Boolean(expanded[key]);

          return (
            <article
              key={`${key}-mobile`}
              className={team.school === focusTeam ? "bg-emerald-50/50" : "bg-white"}
            >
              <button
                type="button"
                onClick={() => onToggle(key)}
                className="flex w-full min-w-0 items-center justify-between gap-3 p-4 text-left"
                aria-expanded={open}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-sm font-semibold tabular-nums text-slate-800">
                    {team.rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="truncate font-semibold text-slate-950">
                        {team.school}
                      </div>
                      {team.school === focusTeam ? (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          Focus
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      <span className="font-semibold tabular-nums text-slate-950">
                        {team.points} pts
                      </span>{" "}
                      · range {team.lowPoints}-{team.highPoints} ·{" "}
                      {team.scoringEntries} scorers
                    </div>
                  </div>
                </div>
                <span className="shrink-0 text-slate-500">
                  {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                </span>
              </button>
              {open ? (
                <div className="space-y-3 border-t border-slate-100 bg-slate-50 p-3">
                  {team.entries.map((entry) => (
                    <div
                      key={`${key}-${entry.id}-mobile`}
                      className="min-w-0 rounded-md border border-slate-200 bg-white p-3"
                    >
                      <div className="break-words font-semibold text-slate-950">
                        {entry.athleteName}
                      </div>
                      <div className="mt-1 break-words text-sm text-slate-600">
                        {entry.eventTitle} · seed {entry.seed} · {entry.markRaw}
                      </div>
                      {entry.realisticLabel ? (
                        <div className="mt-2 break-words rounded-md bg-slate-50 p-2 text-xs leading-5 text-slate-600">
                          <span
                            className={`mr-2 inline-flex rounded-full px-2 py-0.5 font-semibold ${realisticBadgeClass(
                              entry.realisticTone,
                            )}`}
                          >
                            {entry.realisticLabel}
                          </span>
                          {entry.realisticReason}
                        </div>
                      ) : null}
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <label className="text-xs font-semibold uppercase text-slate-500">
                          Place
                          <input
                            type="number"
                            min={1}
                            max={18}
                            value={entry.scenarioPlace}
                            onChange={(event) =>
                              onScenarioChange(entry, "place", event.target.value)
                            }
                            className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm font-semibold tabular-nums text-slate-950"
                          />
                        </label>
                        <label className="text-xs font-semibold uppercase text-slate-500">
                          Best
                          <input
                            type="number"
                            min={1}
                            max={18}
                            value={entry.confidenceBest}
                            onChange={(event) =>
                              onScenarioChange(entry, "best", event.target.value)
                            }
                            className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm tabular-nums text-slate-950"
                          />
                        </label>
                        <label className="text-xs font-semibold uppercase text-slate-500">
                          Worst
                          <input
                            type="number"
                            min={1}
                            max={18}
                            value={entry.confidenceWorst}
                            onChange={(event) =>
                              onScenarioChange(entry, "worst", event.target.value)
                            }
                            className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm tabular-nums text-slate-950"
                          />
                        </label>
                      </div>
                      <div className="mt-2 text-sm font-semibold tabular-nums text-slate-950">
                        {entry.scenarioPoints} pts · range {entry.lowPoints}-
                        {entry.highPoints}
                      </div>
                    </div>
                  ))}
                  {!team.entries.length ? (
                    <div className="rounded-md bg-white px-3 py-4 text-center text-sm text-slate-500">
                      No scoring or point-range entries for this team.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      <div className="hidden overflow-hidden md:block">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[8%]" />
            <col className="w-[29%]" />
            <col className="w-[13%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3">Rank</th>
              <th className="px-3 py-3">School</th>
              <th className="px-3 py-3">Points</th>
              <th className="px-3 py-3">Score range</th>
              <th className="px-3 py-3">Scoring entries</th>
              <th className="px-3 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const key = `${team.gender}-${team.school}`;
              const open = Boolean(expanded[key]);

              return (
                <Fragment key={key}>
                  <tr
                    key={key}
                    className={`border-t border-slate-100 ${
                      team.school === focusTeam ? "bg-emerald-50/50" : "bg-white"
                    }`}
                  >
                    <td className="px-3 py-3 font-semibold tabular-nums">
                      {team.rank}
                    </td>
                    <td className="break-words px-3 py-3">
                      <div className="font-medium text-slate-950">
                        {team.school}
                      </div>
                      <div className="text-xs text-slate-500">{team.gender}</div>
                    </td>
                    <td className="px-3 py-3 text-lg font-semibold tabular-nums">
                      {team.points}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {team.lowPoints}-{team.highPoints}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {team.scoringEntries}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => onToggle(key)}
                        aria-expanded={open}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {open ? (
                          <ChevronDown size={15} />
                        ) : (
                          <ChevronRight size={15} />
                        )}
                        {open ? "Hide edits" : "Edit scorers"}
                      </button>
                    </td>
                  </tr>
                  {open ? (
                    <tr key={`${key}-details`} className="border-t border-slate-100">
                      <td colSpan={6} className="bg-slate-50 p-3">
                        <table className="w-full table-fixed text-left text-xs">
                          <colgroup>
                            <col className="w-[18%]" />
                            <col className="w-[22%]" />
                            <col className="w-[8%]" />
                            <col className="w-[12%]" />
                            <col className="w-[15%]" />
                            <col className="w-[17%]" />
                            <col className="w-[8%]" />
                          </colgroup>
                          <thead className="uppercase text-slate-500">
                            <tr>
                              <th className="px-2 py-2">Event</th>
                              <th className="px-2 py-2">Athlete / Team</th>
                              <th className="px-2 py-2">Seed</th>
                              <th className="px-2 py-2">Mark</th>
                              <th className="px-2 py-2">Projected finish</th>
                              <th className="px-2 py-2">Finish range</th>
                              <th className="px-2 py-2">Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {team.entries.map((entry) => (
                              <tr
                                key={`${key}-${entry.id}`}
                                className="border-t border-slate-200 bg-white"
                              >
                                <td className="break-words px-2 py-2 font-medium text-slate-950">
                                  {entry.eventTitle}
                                </td>
                                <td className="min-w-0 break-words px-2 py-2">
                                  <div>{entry.athleteName}</div>
                                  {entry.realisticLabel ? (
                                    <div className="mt-1 break-words text-[11px] leading-4 text-slate-500">
                                      <span
                                        className={`mr-1 inline-flex rounded-full px-1.5 py-0.5 font-semibold ${realisticBadgeClass(
                                          entry.realisticTone,
                                        )}`}
                                      >
                                        {entry.realisticLabel}
                                      </span>
                                      {entry.realisticReason}
                                    </div>
                                  ) : null}
                                </td>
                                <td className="px-2 py-2 tabular-nums">
                                  {entry.seed}
                                </td>
                                <td className="px-2 py-2 font-semibold tabular-nums">
                                  {entry.markRaw}
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    type="number"
                                    min={1}
                                    max={18}
                                    value={entry.scenarioPlace}
                                    onChange={(event) =>
                                      onScenarioChange(
                                        entry,
                                        "place",
                                        event.target.value,
                                      )
                                    }
                                    className="h-8 w-16 rounded-md border border-slate-300 px-2 text-sm font-semibold tabular-nums"
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex flex-wrap items-center gap-1">
                                    <input
                                      aria-label={`${entry.athleteName} best finish`}
                                      type="number"
                                      min={1}
                                      max={18}
                                      value={entry.confidenceBest}
                                      onChange={(event) =>
                                        onScenarioChange(
                                          entry,
                                          "best",
                                          event.target.value,
                                        )
                                      }
                                      className="h-8 w-14 rounded-md border border-slate-300 px-2 text-sm tabular-nums"
                                    />
                                    <span className="text-slate-400">to</span>
                                    <input
                                      aria-label={`${entry.athleteName} worst finish`}
                                      type="number"
                                      min={1}
                                      max={18}
                                      value={entry.confidenceWorst}
                                      onChange={(event) =>
                                        onScenarioChange(
                                          entry,
                                          "worst",
                                          event.target.value,
                                        )
                                      }
                                      className="h-8 w-14 rounded-md border border-slate-300 px-2 text-sm tabular-nums"
                                    />
                                  </div>
                                </td>
                                <td className="px-2 py-2">
                                  <div className="font-semibold tabular-nums text-slate-950">
                                    {entry.scenarioPoints}
                                  </div>
                                  <div className="text-slate-500">
                                    range {entry.lowPoints}-{entry.highPoints}
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {!team.entries.length ? (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="px-2 py-5 text-center text-slate-500"
                                >
                                  No scoring or point-range entries for this team.
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function VirtualMeetView({
  meet,
  focusTeam = DEFAULT_FOCUS_TEAM,
}: {
  meet: VirtualStateMeet;
  focusTeam?: string;
}) {
  const [scenario, setScenario] = useState<ScenarioState>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeGender, setActiveGender] = useState<Gender>("Boys");
  const [showAllTeams, setShowAllTeams] = useState(false);
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>("seed");
  const [priorityDetailsOpen, setPriorityDetailsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const projectedEntries = useMemo(
    () => buildProjectedEntries(meet, scenario, activeGender, projectionMode),
    [activeGender, meet, projectionMode, scenario],
  );
  const baselineEntries = useMemo(
    () => buildProjectedEntries(meet, {}, activeGender, "seed"),
    [activeGender, meet],
  );
  const teamProjections = useMemo(
    () => buildTeamProjections(projectedEntries),
    [projectedEntries],
  );
  const baselineTeamProjections = useMemo(
    () => buildTeamProjections(baselineEntries),
    [baselineEntries],
  );
  const visibleTeamProjections = useMemo(() => {
    if (showAllTeams) return teamProjections;

    const topTeams = teamProjections.slice(0, 10);
    const focusProjection = teamProjections.find((team) => team.school === focusTeam);

    if (
      focusProjection &&
      !topTeams.some((team) => team.school === focusProjection.school)
    ) {
      return [...topTeams, focusProjection].sort((a, b) => a.rank - b.rank);
    }

    return topTeams;
  }, [focusTeam, showAllTeams, teamProjections]);
  const priorities = useMemo(
    () => buildPalmerPriorities(projectedEntries, meet, focusTeam),
    [focusTeam, meet, projectedEntries],
  );
  const editedCount = Object.keys(scenario).length;
  const focusProjection = teamProjections.find((team) => team.school === focusTeam);
  const shortFocusTeam = shortSchoolName(focusTeam);
  const projectionLabel =
    projectionMode === "realistic" ? "Realistic" : "Seed-order";
  const activeMeetEvents = meet.events.filter(
    (event) => event.gender === activeGender,
  );

  function toggleTeam(key: string) {
    setExpanded((current) => ({ ...current, [key]: !current[key] }));
  }

  function selectGender(gender: Gender) {
    setActiveGender(gender);
    setExpanded({});
    setPriorityDetailsOpen(false);
    setScheduleOpen(false);
  }

  function updateScenario(
    entry: ProjectedEntry,
    key: keyof ScenarioValue,
    value: string,
  ) {
    setScenario((current) => updateScenarioValue(current, entry, key, value));
  }

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      <section className="coach-surface overflow-hidden rounded-2xl">
        <div className="border-b border-slate-200 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-[#16324f]" />
              <h2 className="text-base font-semibold text-slate-950">
                Team score simulator
              </h2>
            </div>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
              Pick one gender, choose the scoring model, then open only the
              teams you want to edit.
            </p>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <div className="flex items-center gap-2 px-1 pb-2 text-xs font-semibold uppercase text-slate-500">
                <Users size={14} className="text-[#16324f]" />
                Viewing
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["Boys", "Girls"] as const).map((gender) => {
                  const active = activeGender === gender;

                  return (
                    <button
                      key={gender}
                      type="button"
                      aria-pressed={active}
                      onClick={() => selectGender(gender)}
                      className={`tap-row min-h-14 rounded-xl border px-3 py-2 text-left transition ${
                        active
                          ? "border-[#0f2a47] bg-[#0f2a47] text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-[#8aa2b8]"
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {gender}
                      </span>
                      <span
                        className={`mt-0.5 block text-xs ${
                          active ? "text-white/80" : "text-slate-500"
                        }`}
                      >
                        {active ? "Active meet" : "Tap to switch"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <div className="flex items-center gap-2 px-1 pb-2 text-xs font-semibold uppercase text-slate-500">
                <ShieldCheck size={14} className="text-amber-700" />
                Scoring model
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["seed", "realistic"] as const).map((mode) => {
                  const active = projectionMode === mode;
                  const copy = projectionModeCopy[mode];

                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setProjectionMode(mode)}
                      className={`tap-row min-h-20 rounded-xl border px-3 py-2 text-left transition ${
                        active
                          ? mode === "realistic"
                            ? "border-amber-700 bg-amber-600 text-white shadow-sm"
                            : "border-[#0f2a47] bg-[#0f2a47] text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-[#8aa2b8]"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        {mode === "realistic" ? (
                          <ShieldCheck size={15} />
                        ) : (
                          <BarChart3 size={15} />
                        )}
                        {copy.label}
                      </span>
                      <span
                        className={`mt-1 block text-xs leading-5 ${
                          active ? "text-white/85" : "text-slate-500"
                        }`}
                      >
                        {copy.detail}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
            <button
              type="button"
              onClick={() => setScenario({})}
              className="coach-action inline-flex min-w-0 items-center justify-center gap-2 border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw size={16} className="shrink-0" />
              <span className="truncate">
                Reset scenario {editedCount ? `(${editedCount})` : ""}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowAllTeams((current) => !current)}
              className="coach-action inline-flex min-w-0 items-center justify-center border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="truncate">
                {showAllTeams ? "Show contenders" : "Show all teams"}
              </span>
            </button>
          </div>
        </div>

        <div className="grid gap-0 md:grid-cols-3">
          <div className="border-b border-slate-200 p-4 md:border-b-0 md:border-r">
            <div className="text-xs font-semibold uppercase text-slate-500">
              {activeGender} {shortFocusTeam}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              #{teamRank(teamProjections, focusTeam) ?? "-"} /{" "}
              {focusProjection?.points ?? 0}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              Range {pointRange(focusProjection)}
            </div>
          </div>
          <div className="border-b border-slate-200 p-4 md:border-b-0 md:border-r">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Simulator mode
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {projectionModeCopy[projectionMode].shortLabel}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              10-8-7-6-5-4-3-2-1 through 9 places
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Editable entries
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {editedCount}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              Scenario overrides active
            </div>
          </div>
        </div>
      </section>

      <RealisticScoreDeltaPanel
        projectionMode={projectionMode}
        baselineTeams={baselineTeamProjections}
        projectedTeams={teamProjections}
        focusTeam={focusTeam}
      />

      <FocusOpportunityPanel entries={projectedEntries} focusTeam={focusTeam} />

      <section className="grid gap-5 xl:grid-cols-3">
        <ScoreBars
          title={`${projectionLabel} ${activeGender.toLowerCase()} scores`}
          teams={teamProjections}
          focusTeam={focusTeam}
        />
        <PalmerPointMix entries={projectedEntries} focusTeam={focusTeam} />
        <div className="coach-panel rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <Target size={17} className="text-[#16324f]" />
            <h3 className="text-sm font-semibold text-slate-950">
              Showing one meet at a time
            </h3>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Use the Boys/Girls toggle above to switch scoreboards. This keeps
            the virtual meet focused and avoids loading both full team tables at
            once.
          </p>
        </div>
      </section>

      <PalmerNarrative
        teams={teamProjections}
        priorities={priorities}
        focusTeam={focusTeam}
        activeGender={activeGender}
        detailsOpen={priorityDetailsOpen}
        onDetailsToggle={() => setPriorityDetailsOpen((current) => !current)}
      />

      <TeamScoreTable
        title={`${projectionLabel} ${activeGender.toLowerCase()} scores`}
        teams={visibleTeamProjections}
        totalTeams={teamProjections.length}
        expanded={expanded}
        onToggle={toggleTeam}
        onScenarioChange={updateScenario}
        focusTeam={focusTeam}
      />

      <section className="coach-panel overflow-hidden rounded-2xl">
        <button
          type="button"
          onClick={() => setScheduleOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50"
          aria-expanded={scheduleOpen}
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950">
              State meet schedule
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {activeGender} event slots from the 2026 schedule PDFs.
            </p>
          </div>
          <span className="shrink-0 text-slate-500">
            {scheduleOpen ? (
              <ChevronDown size={17} />
            ) : (
              <ChevronRight size={17} />
            )}
          </span>
        </button>
        {scheduleOpen ? (
          <div className="border-t border-slate-100 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeMeetEvents.map((event) => (
                <div
                  key={`${event.gender}-${event.event}`}
                  className="min-w-0 rounded-md border border-slate-200 p-3"
                >
                  <div className="break-words text-sm font-semibold">
                    {event.gender} {event.event}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {event.schedule
                      ? `${event.schedule.day} ${event.schedule.startTime}`
                      : "Schedule not found"}
                  </div>
                  <div className="mt-2 break-words text-xs text-slate-500">
                    {event.schedule?.sourceFile}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              {meet.notes.join(" ")}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
