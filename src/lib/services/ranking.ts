import type {
  Classification,
  EventKey,
  Gender,
  Performance,
  RankingResult,
  RankingRow,
} from "@/types/domain";
import { eventDefinitions } from "@/lib/data/events";
import { comparePerformanceMarks } from "@/lib/utils/time";
import { applyClassifications } from "@/lib/services/classification";
import { isRankingEligible } from "@/lib/services/review";
import {
  hasMoreCompleteAthleteName,
  resolvePerformanceIdentityKey,
} from "@/lib/services/athleteIdentity";

function ensureClassified(performances: Performance[]) {
  return performances.every(
    (performance) =>
      performance.classification !== undefined &&
      performance.classificationVerified,
  )
    ? performances
    : applyClassifications(performances);
}

export function getSeasonBestRankings(
  rawPerformances: Performance[],
  options: {
    classification: Classification;
    event: EventKey;
    gender: Gender;
    topLimit?: number;
    bubbleLimit?: number;
  },
): RankingResult {
  const topLimit = options.topLimit ?? 18;
  const bubbleLimit = options.bubbleLimit ?? 10;
  const performances = ensureClassified(rawPerformances);
  const bestByAthlete = new Map<string, Performance>();
  const excluded: Performance[] = [];

  for (const performance of performances) {
    const matchesScope =
      performance.event === options.event &&
      performance.gender === options.gender &&
      performance.classification === options.classification;

    if (!matchesScope) {
      continue;
    }

    if (!isRankingEligible(performance)) {
      excluded.push(performance);
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
      if (existing) {
        excluded.push(existing);
        bestByAthlete.delete(key);
      }
      bestByAthlete.set(key, performance);
    } else {
      excluded.push(performance);
    }
  }

  const ranked = [...bestByAthlete.values()]
    .sort((a, b) =>
      comparePerformanceMarks(options.event, a.markValue, b.markValue),
    )
    .map<RankingRow>((performance, index) => ({
      ...performance,
      rank: index + 1,
      isBubble: index >= topLimit,
    }));

  return {
    classification: options.classification,
    event: options.event,
    gender: options.gender,
    top18: ranked.slice(0, topLimit),
    bubble: ranked.slice(topLimit, topLimit + bubbleLimit),
    excluded,
  };
}

export function getAllRankingResults(
  performances: Performance[],
  classification: Classification = "4A",
  options: {
    bubbleLimit?: number;
  } = {},
): RankingResult[] {
  return eventDefinitions.flatMap((definition) =>
    definition.genders.map((gender) =>
      getSeasonBestRankings(performances, {
        classification,
        gender,
        event: definition.event,
        bubbleLimit: options.bubbleLimit,
      }),
    ),
  );
}
