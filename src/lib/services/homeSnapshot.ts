import type { Classification } from "@/types/domain";

type HomeSnapshot = {
  generatedAt: string;
  sourcePerformanceRows: number;
  schoolOptionsByClassification: Record<Classification, string[]>;
  bestRankingPathByClassificationTeam: Record<Classification, Record<string, string>>;
};

let homeSnapshotPromise: Promise<HomeSnapshot> | undefined;

async function getHomeSnapshot() {
  homeSnapshotPromise ??= import("@/lib/data/homeSnapshot.generated.json").then(
    (module) => module.default as HomeSnapshot,
  );

  return homeSnapshotPromise;
}

export async function getHomeSnapshotSchoolOptions(
  classification: Classification,
) {
  const snapshot = await getHomeSnapshot();
  return snapshot.schoolOptionsByClassification[classification] ?? [];
}

export async function getHomeSnapshotBestRankingPath(
  classification: Classification,
  focusTeam: string,
) {
  const snapshot = await getHomeSnapshot();

  return (
    snapshot.bestRankingPathByClassificationTeam[classification]?.[focusTeam] ??
    "/rankings"
  );
}
