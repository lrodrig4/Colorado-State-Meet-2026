import { bestRankingPath } from "@/lib/utils/bestRankingPath";
import { getPerformanceDataSource } from "@/lib/services/performanceStore";
import {
  getHomeSnapshotBestRankingPath,
  getHomeSnapshotSchoolOptions,
} from "@/lib/services/homeSnapshot";
import type { Classification } from "@/types/domain";

const schoolOptionsByClassification = new Map<Classification, string[]>();
const bestPathByTeam = new Map<string, string>();

function teamKey(classification: Classification, focusTeam: string) {
  return `${classification}|${focusTeam}`;
}

export async function getHomeSchoolOptionsForClassification(
  classification: Classification,
) {
  const cached = schoolOptionsByClassification.get(classification);
  if (cached) return cached;

  if (getPerformanceDataSource() === "static") {
    const schools = await getHomeSnapshotSchoolOptions(classification);
    schoolOptionsByClassification.set(classification, schools);
    return schools;
  }

  const { getSchoolOptionsForClassification } = await import(
    "@/lib/services/appData"
  );
  const schools = await getSchoolOptionsForClassification(classification);
  schoolOptionsByClassification.set(classification, schools);
  return schools;
}

export async function getHomeBestRankingPathForTeam(
  classification: Classification,
  focusTeam: string,
) {
  const cacheKey = teamKey(classification, focusTeam);
  const cached = bestPathByTeam.get(cacheKey);
  if (cached) return cached;

  if (getPerformanceDataSource() === "static") {
    const href = await getHomeSnapshotBestRankingPath(classification, focusTeam);
    bestPathByTeam.set(cacheKey, href);
    return href;
  }

  const { getRankingsForClassification } = await import(
    "@/lib/services/appData"
  );
  const rankings = await getRankingsForClassification(classification, {
    bubbleLimit: 24,
  });
  const href = bestRankingPath(rankings, focusTeam);
  bestPathByTeam.set(cacheKey, href);
  return href;
}
