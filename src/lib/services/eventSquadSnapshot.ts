import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import type {
  EventKey,
  EventSquadRankingResult,
  EventSquadScope,
  Gender,
} from "@/types/domain";

type EventSquadSnapshot = {
  generatedAt: string;
  sourcePerformanceRows: number;
  eventSquadRankings: Record<string, EventSquadRankingResult>;
};

let snapshotPromise: Promise<EventSquadSnapshot> | undefined;
const eventSquadSnapshotPath = path.join(
  process.cwd(),
  "src/lib/data/eventSquadSnapshot.generated.json",
);

function eventSquadKey(classification: EventSquadScope, gender: Gender, event: EventKey) {
  return `${classification}|${gender}|${event}`;
}

async function getEventSquadSnapshot() {
  snapshotPromise ??= Promise.resolve(
    JSON.parse(
      readFileSync(eventSquadSnapshotPath, "utf8"),
    ) as EventSquadSnapshot,
  );
  return snapshotPromise;
}

export async function getSnapshotEventSquadRanking(options: {
  classification: EventSquadScope;
  event: EventKey;
  gender: Gender;
}) {
  const snapshot = await getEventSquadSnapshot();
  const ranking = snapshot.eventSquadRankings[
    eventSquadKey(options.classification, options.gender, options.event)
  ];

  if (!ranking) {
    throw new Error(
      `Missing event squad snapshot for ${options.classification} ${options.gender} ${options.event}`,
    );
  }

  return ranking;
}
