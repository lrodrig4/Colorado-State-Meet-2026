import { performances } from "@/lib/data/performances";
import { applyClassifications } from "@/lib/services/classification";
import { buildTeamDepthChart, type TeamDepthChart } from "@/lib/services/depthChart";
import {
  buildLastChanceDashboard,
  type LastChanceDashboard,
} from "@/lib/services/lastChance";
import {
  buildRelayChaseDecisions,
  type RelayChaseDecision,
} from "@/lib/services/relayStrategy";
import { buildReviewQueue } from "@/lib/services/review";
import { getAllRankingResults } from "@/lib/services/ranking";
import { buildVirtualStateMeet } from "@/lib/services/virtualMeet";
import {
  buildWeekendStrategy,
  type FinalizedHokaEntry,
  type WeekendStrategy,
} from "@/lib/services/weekendStrategy";
import { schoolOptionsFromPerformances } from "@/lib/utils/focusTeam";
import type {
  Classification,
  Performance,
  RankingResult,
  VirtualStateMeet,
} from "@/types/domain";

let classifiedPerformances: Performance[] | undefined;
let reviewQueue: ReturnType<typeof buildReviewQueue> | undefined;

const performancesByClassification = new Map<Classification, Performance[]>();
const schoolOptionsByClassification = new Map<Classification, string[]>();
const rankingResultsByClassification = new Map<string, RankingResult[]>();
const virtualMeetByClassification = new Map<Classification, VirtualStateMeet>();
const lastChanceByTeam = new Map<string, LastChanceDashboard>();
const depthChartByTeam = new Map<string, TeamDepthChart>();
const relayDecisionsByTeam = new Map<string, RelayChaseDecision[]>();
const weekendStrategyByTeam = new Map<string, WeekendStrategy>();

function teamKey(classification: Classification, school: string) {
  return `${classification}|${school}`;
}

export function getClassifiedPerformances(): Performance[] {
  if (!classifiedPerformances) {
    classifiedPerformances = applyClassifications(performances);
  }

  return classifiedPerformances;
}

export function getPerformancesForClassification(
  classification: Classification,
): Performance[] {
  const cached = performancesByClassification.get(classification);
  if (cached) return cached;

  const scoped = getClassifiedPerformances().filter(
    (performance) => performance.classification === classification,
  );
  performancesByClassification.set(classification, scoped);
  return scoped;
}

export function getSchoolOptionsForClassification(
  classification: Classification,
): string[] {
  const cached = schoolOptionsByClassification.get(classification);
  if (cached) return cached;

  const schools = schoolOptionsFromPerformances(
    getPerformancesForClassification(classification),
  );
  schoolOptionsByClassification.set(classification, schools);
  return schools;
}

export function getRankingsForClassification(
  classification: Classification,
  options: { bubbleLimit?: number } = {},
): RankingResult[] {
  const cacheKey = `${classification}|${options.bubbleLimit ?? "default"}`;
  const cached = rankingResultsByClassification.get(cacheKey);
  if (cached) return cached;

  const rankings = getAllRankingResults(getClassifiedPerformances(), classification, {
    bubbleLimit: options.bubbleLimit,
  });
  rankingResultsByClassification.set(cacheKey, rankings);
  return rankings;
}

export function getReviewQueue(): ReturnType<typeof buildReviewQueue> {
  if (!reviewQueue) {
    reviewQueue = buildReviewQueue(getClassifiedPerformances());
  }

  return reviewQueue;
}

export function getVirtualMeetForClassification(
  classification: Classification,
): VirtualStateMeet {
  const cached = virtualMeetByClassification.get(classification);
  if (cached) return cached;

  const meet = buildVirtualStateMeet(getClassifiedPerformances(), classification);
  virtualMeetByClassification.set(classification, meet);
  return meet;
}

export function getLastChanceDashboardForTeam(
  classification: Classification,
  school: string,
): LastChanceDashboard {
  const key = teamKey(classification, school);
  const cached = lastChanceByTeam.get(key);
  if (cached) return cached;

  const dashboard = buildLastChanceDashboard(
    getClassifiedPerformances(),
    classification,
    school,
  );
  lastChanceByTeam.set(key, dashboard);
  return dashboard;
}

export function getTeamDepthChart(
  classification: Classification,
  school: string,
): TeamDepthChart {
  const key = teamKey(classification, school);
  const cached = depthChartByTeam.get(key);
  if (cached) return cached;

  const depthChart = buildTeamDepthChart(
    getClassifiedPerformances(),
    classification,
    school,
  );
  depthChartByTeam.set(key, depthChart);
  return depthChart;
}

export function getRelayChaseDecisionsForTeam(
  classification: Classification,
  school: string,
): RelayChaseDecision[] {
  const key = teamKey(classification, school);
  const cached = relayDecisionsByTeam.get(key);
  if (cached) return cached;

  const depthChart = getTeamDepthChart(classification, school);
  const lastChance = getLastChanceDashboardForTeam(classification, school);
  const rankings = getRankingsForClassification(classification, {
    bubbleLimit: 32,
  });
  const decisions = buildRelayChaseDecisions(
    getClassifiedPerformances(),
    classification,
    school,
    {
      depthChart,
      lastChance,
      rankings,
    },
  );
  relayDecisionsByTeam.set(key, decisions);
  return decisions;
}

export function getWeekendStrategyForTeam(
  classification: Classification,
  school: string,
  options: { finalizedHokaEntries?: Iterable<FinalizedHokaEntry> } = {},
): WeekendStrategy {
  const key = teamKey(classification, school);
  if (options.finalizedHokaEntries) {
    return buildWeekendStrategy({
      focusTeam: school,
      recommendations: getLastChanceDashboardForTeam(classification, school)
        .recommendations,
      relayDecisions: getRelayChaseDecisionsForTeam(classification, school),
      finalizedHokaEntries: options.finalizedHokaEntries,
    });
  }
  const cached = weekendStrategyByTeam.get(key);
  if (cached) return cached;

  const strategy = buildWeekendStrategy({
    focusTeam: school,
    recommendations: getLastChanceDashboardForTeam(classification, school)
      .recommendations,
    relayDecisions: getRelayChaseDecisionsForTeam(classification, school),
  });
  weekendStrategyByTeam.set(key, strategy);
  return strategy;
}
