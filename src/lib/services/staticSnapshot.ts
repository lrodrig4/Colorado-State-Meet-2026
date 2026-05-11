import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import type {
  Classification,
  EventSquadScope,
  RankingResult,
  VirtualStateMeet,
} from "@/types/domain";

type RuntimeSnapshot = {
  generatedAt: string;
  sourcePerformanceRows: number;
  schoolOptionsByScope: Record<EventSquadScope, string[]>;
  latestMeetDateByClassification: Record<Classification, string>;
  rankingsByClassification: Record<Classification, RankingResult[]>;
  virtualMeetByClassification: Record<Classification, VirtualStateMeet>;
};

let snapshotPromise: Promise<RuntimeSnapshot> | undefined;
const runtimeSnapshotPath = path.join(
  process.cwd(),
  "src/lib/data/appSnapshot.generated.json",
);

async function getRuntimeSnapshot() {
  snapshotPromise ??= Promise.resolve(
    JSON.parse(readFileSync(runtimeSnapshotPath, "utf8")) as RuntimeSnapshot,
  );
  return snapshotPromise;
}

export async function getSnapshotSchoolOptions(scope: EventSquadScope) {
  const snapshot = await getRuntimeSnapshot();
  return snapshot.schoolOptionsByScope[scope] ?? [];
}

export async function getSnapshotLatestMeetDate(classification: Classification) {
  const snapshot = await getRuntimeSnapshot();
  return snapshot.latestMeetDateByClassification[classification] ?? "";
}

export async function getSnapshotRankings(
  classification: Classification,
  bubbleLimit: number | undefined,
) {
  const snapshot = await getRuntimeSnapshot();
  const limit = bubbleLimit ?? 10;
  const rankings = snapshot.rankingsByClassification[classification] ?? [];

  return rankings.map((ranking) => ({
    ...ranking,
    bubble: ranking.bubble.slice(0, limit),
    excluded: [],
  }));
}

export async function getSnapshotVirtualMeet(classification: Classification) {
  const snapshot = await getRuntimeSnapshot();
  return snapshot.virtualMeetByClassification[classification];
}
