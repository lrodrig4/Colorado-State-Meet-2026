import { getEventDefinition } from "@/lib/data/events";
import type { LastChanceRecommendation } from "@/lib/services/lastChance";

type ForecastTone = "emerald" | "sky" | "amber" | "rose" | "slate";

export interface EventEntryForecastRow {
  id: string;
  rank: number;
  rankLabel: string;
  athleteName: string;
  school: string;
  markRaw: string;
  isRelay: boolean;
  knownLabel: string;
  projectedEntryLabel: string;
  projectedEntryTone: ForecastTone;
  weekendRaceLabel: string;
  weekendRaceTone: ForecastTone;
  likelyRacingThisWeekend: boolean;
  basis: string;
  stateProbabilityLabel: string;
  holdProbabilityLabel: string;
  improveProbabilityLabel: string;
  scratchProbabilityLabel: string;
  scratchRiskLabel: string;
}

export interface EventEntryForecast {
  entries: EventEntryForecastRow[];
  expectedEntries: number;
  coachCallEntries: number;
  likelyWeekendRacers: number;
  summary: string;
}

function projectedEntry(row: LastChanceRecommendation): Pick<
  EventEntryForecastRow,
  "projectedEntryLabel" | "projectedEntryTone"
> {
  const definition = getEventDefinition(row.event);

  if (definition.relay) {
    return {
      projectedEntryLabel: "Relay expected",
      projectedEntryTone: "sky",
    };
  }

  if (row.netScratchCall === "Likely scratch" || row.scratchProbability >= 55) {
    return {
      projectedEntryLabel: "Scratch watch",
      projectedEntryTone: "rose",
    };
  }

  if (row.netScratchCall === "Maybe scratch" || row.scratchProbability >= 18) {
    return {
      projectedEntryLabel: "Coach call",
      projectedEntryTone: "amber",
    };
  }

  if (row.rank <= 18 && row.stateProbability >= 78) {
    return {
      projectedEntryLabel: "Expected to go",
      projectedEntryTone: "emerald",
    };
  }

  if (row.rank <= 18) {
    return {
      projectedEntryLabel: "At-risk seed",
      projectedEntryTone: "amber",
    };
  }

  return {
    projectedEntryLabel: "Needs help",
    projectedEntryTone: "slate",
  };
}

function weekendRace(row: LastChanceRecommendation): Pick<
  EventEntryForecastRow,
  "weekendRaceLabel" | "weekendRaceTone" | "likelyRacingThisWeekend" | "basis"
> {
  const definition = getEventDefinition(row.event);

  if (definition.relay) {
    if (row.rank > 18 || row.stateProbability < 72 || row.holdProbability < 68) {
      return {
        weekendRaceLabel: "May run relay",
        weekendRaceTone: "amber",
        likelyRacingThisWeekend: true,
        basis:
          "Relay is near the cutline, so the model guesses they may re-run if they have a clean lineup. Relays are not treated as scratch openings.",
      };
    }

    return {
      weekendRaceLabel: "Protect lineup",
      weekendRaceTone: "sky",
      likelyRacingThisWeekend: false,
      basis:
        "Relay is currently inside the field. The model expects the relay to stay entered and focuses on repeatability, not a scratch.",
    };
  }

  if (row.rank > 18) {
    if (row.stateProbability >= 24 || row.improveProbability >= 52) {
      return {
        weekendRaceLabel: "Likely chase",
        weekendRaceTone: "amber",
        likelyRacingThisWeekend: true,
        basis:
          "Outside the current top 18 but close enough that a last-chance mark or scratch path matters.",
      };
    }

    return {
      weekendRaceLabel: "Long-shot chase",
      weekendRaceTone: "slate",
      likelyRacingThisWeekend: false,
      basis:
        "Outside the current top 18 and not close enough for the model to call this a priority race.",
    };
  }

  if (row.scratchProbability >= 35 || row.netScratchCall === "Likely scratch") {
    return {
      weekendRaceLabel: "May skip focus",
      weekendRaceTone: "rose",
      likelyRacingThisWeekend: false,
      basis:
        "Scratch pressure is elevated because the model sees a stronger team-points path or event-load conflict elsewhere.",
    };
  }

  if (row.rank <= 9 && row.stateProbability >= 88) {
    return {
      weekendRaceLabel: "State focus",
      weekendRaceTone: "emerald",
      likelyRacingThisWeekend: false,
      basis:
        "Current seed projects to score, so the model protects the state event instead of assuming another hard last-chance attempt.",
    };
  }

  if (row.stateProbability < 78 || row.holdProbability < 68) {
    return {
      weekendRaceLabel: "Needs update",
      weekendRaceTone: "amber",
      likelyRacingThisWeekend: true,
      basis:
        "Current top-18 mark is thin enough that another last-chance attempt may be needed.",
    };
  }

  if (row.stateProbability < 90 && row.improveProbability >= 56) {
    return {
      weekendRaceLabel: "Could run",
      weekendRaceTone: "sky",
      likelyRacingThisWeekend: true,
      basis:
        "Seed is probably safe, but the improve odds are high enough that another controlled attempt could make sense.",
    };
  }

  return {
    weekendRaceLabel: "No chase",
    weekendRaceTone: "emerald",
    likelyRacingThisWeekend: false,
    basis:
      "Current mark should hold and there is no strong model signal to chase this event again.",
  };
}

export function forecastEventEntryRow(
  row: LastChanceRecommendation,
): EventEntryForecastRow {
  const definition = getEventDefinition(row.event);
  const projected = projectedEntry(row);
  const weekend = weekendRace(row);

  return {
    id: row.id,
    rank: row.rank,
    rankLabel: row.rankLabel,
    athleteName: row.athleteName,
    school: row.school,
    markRaw: row.markRaw,
    isRelay: definition.relay,
    knownLabel: row.rank <= 18 ? "Known top 18 mark" : "Bubble mark",
    projectedEntryLabel: projected.projectedEntryLabel,
    projectedEntryTone: projected.projectedEntryTone,
    weekendRaceLabel: weekend.weekendRaceLabel,
    weekendRaceTone: weekend.weekendRaceTone,
    likelyRacingThisWeekend: weekend.likelyRacingThisWeekend,
    basis: weekend.basis,
    stateProbabilityLabel: row.stateProbabilityLabel,
    holdProbabilityLabel: row.holdProbabilityLabel,
    improveProbabilityLabel: row.improveProbabilityLabel,
    scratchProbabilityLabel: row.scratchProbabilityLabel,
    scratchRiskLabel: row.scratchRiskLabel,
  };
}

export function buildEventEntryForecast(
  rows: LastChanceRecommendation[],
): EventEntryForecast {
  const entries = rows
    .filter((row) => row.rank <= 18)
    .sort((a, b) => a.rank - b.rank)
    .map(forecastEventEntryRow);
  const expectedEntries = entries.filter(
    (entry) =>
      entry.projectedEntryLabel === "Expected to go" ||
      entry.projectedEntryLabel === "Relay expected",
  ).length;
  const coachCallEntries = entries.filter(
    (entry) =>
      entry.projectedEntryLabel === "Coach call" ||
      entry.projectedEntryLabel === "Scratch watch" ||
      entry.projectedEntryLabel === "At-risk seed",
  ).length;
  const likelyWeekendRacers = entries.filter(
    (entry) => entry.likelyRacingThisWeekend,
  ).length;

  return {
    entries,
    expectedEntries,
    coachCallEntries,
    likelyWeekendRacers,
    summary: `${expectedEntries} expected entries, ${coachCallEntries} coach-call/watch entries, ${likelyWeekendRacers} with last-chance pressure.`,
  };
}
