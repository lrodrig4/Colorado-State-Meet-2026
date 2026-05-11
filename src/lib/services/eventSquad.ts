import { getEventDefinition } from "@/lib/data/events";
import { applyClassifications } from "@/lib/services/classification";
import { isRankingEligible } from "@/lib/services/review";
import {
  hasMoreCompleteAthleteName,
  resolvePerformanceIdentityKey,
} from "@/lib/services/athleteIdentity";
import {
  comparePerformanceMarks,
  formatPerformanceValue,
} from "@/lib/utils/time";
import type {
  EventKey,
  EventSquadIncompleteRow,
  EventSquadRankingResult,
  EventSquadRankingRow,
  EventSquadScope,
  Gender,
  Performance,
  RankingRow,
} from "@/types/domain";

export const EVENT_SQUAD_SIZE = 4;

function ensureClassified(performances: Performance[]) {
  return performances.every(
    (performance) =>
      performance.classification !== undefined &&
      performance.classificationVerified,
  )
    ? performances
    : applyClassifications(performances);
}

function matchesScope(performance: Performance, classification: EventSquadScope) {
  if (classification === "All") {
    return Boolean(performance.classification);
  }

  return performance.classification === classification;
}

function seasonBestRowsForSquad(
  rawPerformances: Performance[],
  options: {
    classification: EventSquadScope;
    event: EventKey;
    gender: Gender;
  },
) {
  const performances = ensureClassified(rawPerformances);
  const bestByAthlete = new Map<string, Performance>();

  for (const performance of performances) {
    if (
      performance.event !== options.event ||
      performance.gender !== options.gender ||
      !matchesScope(performance, options.classification) ||
      !isRankingEligible(performance)
    ) {
      continue;
    }

    const key = resolvePerformanceIdentityKey(performance, bestByAthlete);
    const existing = bestByAthlete.get(key);
    const comparison = existing
      ? comparePerformanceMarks(
          performance.event,
          performance.markValue,
          existing.markValue,
        )
      : -1;
    const shouldReplace =
      !existing ||
      comparison < 0 ||
      (comparison === 0 &&
        ((performance.source === "maxpreps" &&
          existing.source !== "maxpreps") ||
          hasMoreCompleteAthleteName(performance, existing)));

    if (shouldReplace) {
      bestByAthlete.set(key, performance);
    }
  }

  return [...bestByAthlete.values()]
    .sort((a, b) =>
      comparePerformanceMarks(options.event, a.markValue, b.markValue),
    )
    .map((performance, index): RankingRow => ({
      ...performance,
      rank: index + 1,
      isBubble: false,
    }));
}

function rowsBySchool(rows: RankingRow[]) {
  const bySchool = new Map<string, RankingRow[]>();

  for (const row of rows) {
    const schoolRows = bySchool.get(row.school) ?? [];
    schoolRows.push(row);
    bySchool.set(row.school, schoolRows);
  }

  return bySchool;
}

function rankSquads(event: EventKey, squads: EventSquadRankingRow[]) {
  return [...squads]
    .sort(
      (a, b) =>
        comparePerformanceMarks(event, a.averageValue, b.averageValue) ||
        comparePerformanceMarks(event, a.aggregateValue, b.aggregateValue) ||
        a.school.localeCompare(b.school),
    )
    .map((squad, index): EventSquadRankingRow => ({
      ...squad,
      rank: index + 1,
    }));
}

export function buildEventSquadRanking(
  performances: Performance[],
  options: {
    classification: EventSquadScope;
    event: EventKey;
    gender: Gender;
    squadSize?: number;
  },
): EventSquadRankingResult {
  const definition = getEventDefinition(options.event);
  const squadSize = options.squadSize ?? EVENT_SQUAD_SIZE;

  if (definition.relay) {
    return {
      classification: options.classification,
      event: options.event,
      gender: options.gender,
      squadSize,
      squads: [],
      incompleteSquads: [],
      eligibleAthleteCount: 0,
    };
  }

  const seasonBestRows = seasonBestRowsForSquad(performances, {
    classification: options.classification,
    event: options.event,
    gender: options.gender,
  });
  const squads: EventSquadRankingRow[] = [];
  const incompleteSquads: EventSquadIncompleteRow[] = [];

  for (const [school, schoolRows] of rowsBySchool(seasonBestRows)) {
    const sortedRows = [...schoolRows].sort((a, b) =>
      comparePerformanceMarks(options.event, a.markValue, b.markValue),
    );

    if (sortedRows.length < squadSize) {
      incompleteSquads.push({
        school,
        classification: options.classification,
        event: options.event,
        gender: options.gender,
        athleteCount: sortedRows.length,
        bestAthlete: sortedRows[0],
      });
      continue;
    }

    const athletes = sortedRows.slice(0, squadSize).map((row, index) => ({
      ...row,
      squadSlot: index + 1,
    }));
    const aggregateValue = athletes.reduce(
      (total, athlete) => total + athlete.markValue,
      0,
    );
    const averageValue = aggregateValue / squadSize;

    squads.push({
      rank: 0,
      school,
      classification: options.classification,
      event: options.event,
      gender: options.gender,
      athletes,
      aggregateValue,
      aggregateRaw: formatPerformanceValue(options.event, aggregateValue),
      averageValue,
      averageRaw: formatPerformanceValue(options.event, averageValue),
    });
  }

  incompleteSquads.sort(
    (a, b) =>
      b.athleteCount - a.athleteCount ||
      (a.bestAthlete && b.bestAthlete
        ? comparePerformanceMarks(
            options.event,
            a.bestAthlete.markValue,
            b.bestAthlete.markValue,
          )
        : 0) ||
      a.school.localeCompare(b.school),
  );

  return {
    classification: options.classification,
    event: options.event,
    gender: options.gender,
    squadSize,
    squads: rankSquads(options.event, squads),
    incompleteSquads,
    eligibleAthleteCount: seasonBestRows.length,
  };
}
