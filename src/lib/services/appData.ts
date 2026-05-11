import { unstable_cache } from "next/cache";
import { applyClassifications } from "@/lib/services/classification";
import { buildTeamDepthChart, type TeamDepthChart } from "@/lib/services/depthChart";
import {
  buildLastChanceDashboard,
  type LastChanceDashboard,
} from "@/lib/services/lastChance";
import {
  getPerformanceDataSource,
  getSourcePerformances,
} from "@/lib/services/performanceStore";
import {
  buildRelayChaseDecisions,
  type RelayChaseDecision,
} from "@/lib/services/relayStrategy";
import { buildReviewQueue } from "@/lib/services/review";
import { getAllRankingResults } from "@/lib/services/ranking";
import { buildEventSquadRanking } from "@/lib/services/eventSquad";
import { getSnapshotEventSquadRanking } from "@/lib/services/eventSquadSnapshot";
import { buildVirtualStateMeet } from "@/lib/services/virtualMeet";
import type {
  FinalizedHokaEntry,
  WeekendStrategy,
} from "@/lib/services/weekendStrategy";
import {
  getSnapshotLatestMeetDate,
  getSnapshotRankings,
  getSnapshotSchoolOptions,
  getSnapshotVirtualMeet,
} from "@/lib/services/staticSnapshot";
import { schoolOptionsFromPerformances } from "@/lib/utils/focusTeam";
import type {
  Classification,
  EventKey,
  EventSquadRankingResult,
  EventSquadScope,
  Gender,
  Performance,
  RankingResult,
  VirtualStateMeet,
} from "@/types/domain";

let classifiedPerformances: Performance[] | undefined;
let classifiedPerformancesPromise: Promise<Performance[]> | undefined;
let reviewQueue: ReturnType<typeof buildReviewQueue> | undefined;
let reviewQueuePromise: Promise<ReturnType<typeof buildReviewQueue>> | undefined;

const performancesByClassification = new Map<Classification, Performance[]>();
const schoolOptionsByClassification = new Map<Classification, string[]>();
const schoolOptionsByEventSquadScope = new Map<EventSquadScope, string[]>();
const rankingResultsByClassification = new Map<string, RankingResult[]>();
const eventSquadRankingsBySelection = new Map<string, EventSquadRankingResult>();
const virtualMeetByClassification = new Map<Classification, VirtualStateMeet>();
const lastChanceByTeam = new Map<string, LastChanceDashboard>();
const depthChartByTeam = new Map<string, TeamDepthChart>();
const relayDecisionsByTeam = new Map<string, RelayChaseDecision[]>();
const weekendStrategyByTeam = new Map<string, WeekendStrategy>();
const latestVerifiedMeetDateByClassification = new Map<Classification, string>();
const revalidateSeconds = Number(process.env.SUPABASE_REVALIDATE_SECONDS ?? 300);

function teamKey(classification: Classification, school: string) {
  return `${classification}|${school}`;
}

function canUseStaticSnapshot() {
  return getPerformanceDataSource() === "static";
}

const cachedRankingsForClassification = unstable_cache(
  async (classification: Classification, bubbleLimit: number | null) =>
    getAllRankingResults(await getClassifiedPerformances(), classification, {
      bubbleLimit: bubbleLimit ?? undefined,
    }),
  ["app-data-rankings"],
  {
    revalidate: revalidateSeconds,
    tags: ["performances", "rankings"],
  },
);

const cachedEventSquadRankingForSelection = unstable_cache(
  async (classification: EventSquadScope, gender: Gender, event: EventKey) =>
    buildEventSquadRanking(await getClassifiedPerformances(), {
      classification,
      event,
      gender,
    }),
  ["app-data-event-squads"],
  {
    revalidate: revalidateSeconds,
    tags: ["performances", "event-squads"],
  },
);

const cachedVirtualMeetForClassification = unstable_cache(
  async (classification: Classification) =>
    buildVirtualStateMeet(await getClassifiedPerformances(), classification),
  ["app-data-virtual-meet"],
  {
    revalidate: revalidateSeconds,
    tags: ["performances", "virtual-meet"],
  },
);

const cachedLastChanceDashboardForTeam = unstable_cache(
  async (classification: Classification, school: string) =>
    buildLastChanceDashboard(
      await getClassifiedPerformances(),
      classification,
      school,
    ),
  ["app-data-last-chance"],
  {
    revalidate: revalidateSeconds,
    tags: ["performances", "last-chance"],
  },
);

const cachedTeamDepthChart = unstable_cache(
  async (classification: Classification, school: string) =>
    buildTeamDepthChart(await getClassifiedPerformances(), classification, school),
  ["app-data-depth-chart"],
  {
    revalidate: revalidateSeconds,
    tags: ["performances", "depth-chart"],
  },
);

const cachedRelayChaseDecisionsForTeam = unstable_cache(
  async (classification: Classification, school: string) => {
    const [depthChart, lastChance, rankings, performances] = await Promise.all([
      getTeamDepthChart(classification, school),
      getLastChanceDashboardForTeam(classification, school),
      getRankingsForClassification(classification, {
        bubbleLimit: 32,
      }),
      getClassifiedPerformances(),
    ]);

    return buildRelayChaseDecisions(
      performances,
      classification,
      school,
      {
        depthChart,
        lastChance,
        rankings,
      },
    );
  },
  ["app-data-relay-decisions"],
  {
    revalidate: revalidateSeconds,
    tags: ["performances", "relay-decisions"],
  },
);

const cachedWeekendStrategyForTeam = unstable_cache(
  async (classification: Classification, school: string) => {
    const lastChance = await getLastChanceDashboardForTeam(classification, school);
    const relayDecisions = await getRelayChaseDecisionsForTeam(
      classification,
      school,
    );
    const { buildWeekendStrategy } = await import(
      "@/lib/services/weekendStrategy"
    );

    return buildWeekendStrategy({
      focusTeam: school,
      recommendations: lastChance.recommendations,
      relayDecisions,
    });
  },
  ["app-data-weekend-strategy"],
  {
    revalidate: revalidateSeconds,
    tags: ["performances", "weekend-strategy"],
  },
);

const cachedLatestVerifiedMeetDateForClassification = unstable_cache(
  async (classification: Classification) =>
    (await getPerformancesForClassification(classification))
      .filter((performance) => performance.verificationStatus === "verified")
      .reduce<string | undefined>(
        (latest, performance) =>
          !latest || performance.meetDate > latest ? performance.meetDate : latest,
        undefined,
      ) ?? "",
  ["app-data-latest-meet-date"],
  {
    revalidate: revalidateSeconds,
    tags: ["performances", "latest-meet-date"],
  },
);

export async function getClassifiedPerformances(): Promise<Performance[]> {
  if (classifiedPerformances) {
    return classifiedPerformances;
  }

  classifiedPerformancesPromise ??= getSourcePerformances().then((sourcePerformances) => {
    classifiedPerformances = applyClassifications(sourcePerformances);
    return classifiedPerformances;
  });

  return classifiedPerformancesPromise;
}

export async function getPerformancesForClassification(
  classification: Classification,
): Promise<Performance[]> {
  const cached = performancesByClassification.get(classification);
  if (cached) return cached;

  const performances = await getClassifiedPerformances();
  const scoped = performances.filter(
    (performance) => performance.classification === classification,
  );
  performancesByClassification.set(classification, scoped);
  return scoped;
}

export async function getSchoolOptionsForClassification(
  classification: Classification,
): Promise<string[]> {
  const cached = schoolOptionsByClassification.get(classification);
  if (cached) return cached;

  if (canUseStaticSnapshot()) {
    const schools = await getSnapshotSchoolOptions(classification);
    schoolOptionsByClassification.set(classification, schools);
    return schools;
  }

  const schools = schoolOptionsFromPerformances(
    await getPerformancesForClassification(classification),
  );
  schoolOptionsByClassification.set(classification, schools);
  return schools;
}

export async function getSchoolOptionsForEventSquadScope(
  classification: EventSquadScope,
): Promise<string[]> {
  const cached = schoolOptionsByEventSquadScope.get(classification);
  if (cached) return cached;

  if (canUseStaticSnapshot()) {
    const schools = await getSnapshotSchoolOptions(classification);
    schoolOptionsByEventSquadScope.set(classification, schools);
    return schools;
  }

  if (classification !== "All") {
    const schools = await getSchoolOptionsForClassification(classification);
    schoolOptionsByEventSquadScope.set(classification, schools);
    return schools;
  }

  const schools = schoolOptionsFromPerformances(await getClassifiedPerformances());
  schoolOptionsByEventSquadScope.set(classification, schools);
  return schools;
}

export async function getRankingsForClassification(
  classification: Classification,
  options: { bubbleLimit?: number } = {},
): Promise<RankingResult[]> {
  const cacheKey = `${classification}|${options.bubbleLimit ?? "default"}`;
  const cached = rankingResultsByClassification.get(cacheKey);
  if (cached) return cached;

  if (canUseStaticSnapshot()) {
    const rankings = await getSnapshotRankings(
      classification,
      options.bubbleLimit,
    );
    rankingResultsByClassification.set(cacheKey, rankings);
    return rankings;
  }

  const rankings = await cachedRankingsForClassification(
    classification,
    options.bubbleLimit ?? null,
  );
  rankingResultsByClassification.set(cacheKey, rankings);
  return rankings;
}

export async function getEventSquadRankingForSelection(options: {
  classification: EventSquadScope;
  event: EventKey;
  gender: Gender;
}): Promise<EventSquadRankingResult> {
  const cacheKey = `${options.classification}|${options.gender}|${options.event}`;
  const cached = eventSquadRankingsBySelection.get(cacheKey);
  if (cached) return cached;

  if (canUseStaticSnapshot()) {
    const ranking = await getSnapshotEventSquadRanking(options);
    eventSquadRankingsBySelection.set(cacheKey, ranking);
    return ranking;
  }

  const ranking = await cachedEventSquadRankingForSelection(
    options.classification,
    options.gender,
    options.event,
  );
  eventSquadRankingsBySelection.set(cacheKey, ranking);
  return ranking;
}

export async function getReviewQueue(): Promise<ReturnType<typeof buildReviewQueue>> {
  if (reviewQueue) {
    return reviewQueue;
  }

  reviewQueuePromise ??= getClassifiedPerformances().then((performances) => {
    reviewQueue = buildReviewQueue(performances);
    return reviewQueue;
  });

  return reviewQueuePromise;
}

export async function getVirtualMeetForClassification(
  classification: Classification,
): Promise<VirtualStateMeet> {
  const cached = virtualMeetByClassification.get(classification);
  if (cached) return cached;

  if (canUseStaticSnapshot()) {
    const meet = await getSnapshotVirtualMeet(classification);
    virtualMeetByClassification.set(classification, meet);
    return meet;
  }

  const meet = await cachedVirtualMeetForClassification(classification);
  virtualMeetByClassification.set(classification, meet);
  return meet;
}

export async function getLastChanceDashboardForTeam(
  classification: Classification,
  school: string,
): Promise<LastChanceDashboard> {
  const key = teamKey(classification, school);
  const cached = lastChanceByTeam.get(key);
  if (cached) return cached;

  const dashboard = await cachedLastChanceDashboardForTeam(classification, school);
  lastChanceByTeam.set(key, dashboard);
  return dashboard;
}

export async function getTeamDepthChart(
  classification: Classification,
  school: string,
): Promise<TeamDepthChart> {
  const key = teamKey(classification, school);
  const cached = depthChartByTeam.get(key);
  if (cached) return cached;

  const depthChart = await cachedTeamDepthChart(classification, school);
  depthChartByTeam.set(key, depthChart);
  return depthChart;
}

export async function getRelayChaseDecisionsForTeam(
  classification: Classification,
  school: string,
): Promise<RelayChaseDecision[]> {
  const key = teamKey(classification, school);
  const cached = relayDecisionsByTeam.get(key);
  if (cached) return cached;

  const decisions = await cachedRelayChaseDecisionsForTeam(classification, school);
  relayDecisionsByTeam.set(key, decisions);
  return decisions;
}

export async function getWeekendStrategyForTeam(
  classification: Classification,
  school: string,
  options: { finalizedHokaEntries?: Iterable<FinalizedHokaEntry> } = {},
): Promise<WeekendStrategy> {
  const key = teamKey(classification, school);
  if (options.finalizedHokaEntries) {
    const lastChance = await getLastChanceDashboardForTeam(classification, school);
    const relayDecisions = await getRelayChaseDecisionsForTeam(
      classification,
      school,
    );
    const { buildWeekendStrategy } = await import(
      "@/lib/services/weekendStrategy"
    );

    return buildWeekendStrategy({
      focusTeam: school,
      recommendations: lastChance.recommendations,
      relayDecisions,
      finalizedHokaEntries: options.finalizedHokaEntries,
    });
  }
  const cached = weekendStrategyByTeam.get(key);
  if (cached) return cached;

  const strategy = await cachedWeekendStrategyForTeam(classification, school);
  weekendStrategyByTeam.set(key, strategy);
  return strategy;
}

export async function getLatestVerifiedMeetDateForClassification(
  classification: Classification,
): Promise<string> {
  const cached = latestVerifiedMeetDateByClassification.get(classification);
  if (cached !== undefined) return cached;

  if (canUseStaticSnapshot()) {
    const latestMeetDate = await getSnapshotLatestMeetDate(classification);
    latestVerifiedMeetDateByClassification.set(classification, latestMeetDate);
    return latestMeetDate;
  }

  const latestMeetDate =
    await cachedLatestVerifiedMeetDateForClassification(classification);
  latestVerifiedMeetDateByClassification.set(classification, latestMeetDate);
  return latestMeetDate;
}
