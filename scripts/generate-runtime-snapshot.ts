import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performances } from "@/lib/data/performances";
import { eventDefinitions } from "@/lib/data/events";
import { applyClassifications } from "@/lib/services/classification";
import { buildEventSquadRanking } from "@/lib/services/eventSquad";
import { getAllRankingResults } from "@/lib/services/ranking";
import { buildVirtualStateMeet } from "@/lib/services/virtualMeet";
import { bestRankingPath } from "@/lib/utils/bestRankingPath";
import { schoolOptionsFromPerformances } from "@/lib/utils/focusTeam";
import type {
  Classification,
  EventSquadAthlete,
  EventSquadIncompleteRow,
  EventSquadRankingRow,
  EventSquadScope,
  Gender,
  Performance,
  RankingResult,
  RankingRow,
} from "@/types/domain";

const classifications: Classification[] = ["1A", "2A", "3A", "4A", "5A"];
const scopes: EventSquadScope[] = ["All", ...classifications];
const outputPath = path.join(
  process.cwd(),
  "src/lib/data/appSnapshot.generated.json",
);
const eventSquadOutputPath = path.join(
  process.cwd(),
  "src/lib/data/eventSquadSnapshot.generated.json",
);
const homeOutputPath = path.join(
  process.cwd(),
  "src/lib/data/homeSnapshot.generated.json",
);

function compactPerformance(performance: Performance) {
  return {
    id: performance.id,
    athleteName: performance.athleteName,
    gender: performance.gender,
    grade: performance.grade,
    school: performance.school,
    classification: performance.classification,
    classificationVerified: performance.classificationVerified,
    event: performance.event,
    markRaw: performance.markRaw,
    markValue: performance.markValue,
    timingType: performance.timingType,
    isFAT: performance.isFAT,
    meetName: performance.meetName,
    meetDate: performance.meetDate,
    source: performance.source,
    sourceUrl: performance.sourceUrl,
    verificationStatus: performance.verificationStatus,
    notes: performance.notes,
  };
}

function compactRankingRow(row: RankingRow): RankingRow {
  return {
    ...compactPerformance(row),
    rank: row.rank,
    isBubble: row.isBubble,
  };
}

function compactRanking(ranking: RankingResult): RankingResult {
  return {
    classification: ranking.classification,
    event: ranking.event,
    gender: ranking.gender,
    top18: ranking.top18.map(compactRankingRow),
    bubble: ranking.bubble.slice(0, 32).map(compactRankingRow),
    excluded: [],
  };
}

function compactEventSquadAthlete(athlete: EventSquadAthlete) {
  return {
    id: athlete.id,
    athleteName: athlete.athleteName,
    grade: athlete.grade,
    school: athlete.school,
    classification: athlete.classification,
    rank: athlete.rank,
    squadSlot: athlete.squadSlot,
    markRaw: athlete.markRaw,
    meetDate: athlete.meetDate,
    meetName: athlete.meetName,
  };
}

function compactEventSquad(squad: EventSquadRankingRow) {
  return {
    rank: squad.rank,
    school: squad.school,
    classification: squad.classification,
    event: squad.event,
    gender: squad.gender,
    aggregateRaw: squad.aggregateRaw,
    averageRaw: squad.averageRaw,
    aggregateValue: squad.aggregateValue,
    averageValue: squad.averageValue,
    athletes: squad.athletes.map(compactEventSquadAthlete),
  };
}

function compactIncompleteSquad(squad: EventSquadIncompleteRow) {
  return {
    school: squad.school,
    classification: squad.classification,
    event: squad.event,
    gender: squad.gender,
    athleteCount: squad.athleteCount,
    bestAthlete: squad.bestAthlete
      ? {
          markRaw: squad.bestAthlete.markRaw,
        }
      : undefined,
  };
}

function eventSquadKey(scope: EventSquadScope, gender: Gender, event: string) {
  return `${scope}|${gender}|${event}`;
}

function latestVerifiedMeetDate(
  classifiedPerformances: Performance[],
  classification: Classification,
) {
  return classifiedPerformances
    .filter(
      (performance) =>
        performance.classification === classification &&
        performance.verificationStatus === "verified",
    )
    .reduce(
      (latest, performance) =>
        !latest || performance.meetDate > latest ? performance.meetDate : latest,
      "",
    );
}

async function main() {
  const classifiedPerformances = applyClassifications(performances);
  const schoolOptionsByScope = Object.fromEntries(
    scopes.map((scope) => [
      scope,
      schoolOptionsFromPerformances(
        scope === "All"
          ? classifiedPerformances
          : classifiedPerformances.filter(
              (performance) => performance.classification === scope,
            ),
      ),
    ]),
  ) as Record<EventSquadScope, string[]>;
  const latestMeetDateByClassification = Object.fromEntries(
    classifications.map((classification) => [
      classification,
      latestVerifiedMeetDate(classifiedPerformances, classification),
    ]),
  );
  const rankingsByClassification = Object.fromEntries(
    classifications.map((classification) => [
      classification,
      getAllRankingResults(classifiedPerformances, classification, {
        bubbleLimit: 32,
      }).map(compactRanking),
    ]),
  ) as Record<Classification, RankingResult[]>;
  const virtualMeetByClassification = Object.fromEntries(
    classifications.map((classification) => [
      classification,
      buildVirtualStateMeet(classifiedPerformances, classification),
    ]),
  );

  const snapshot = {
    generatedAt: new Date().toISOString(),
    sourcePerformanceRows: classifiedPerformances.length,
    eventCount: eventDefinitions.length,
    schoolOptionsByScope,
    latestMeetDateByClassification,
    rankingsByClassification,
    virtualMeetByClassification,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot)}\n`);
  console.log(`Wrote ${outputPath}`);

  const schoolOptionsByClassification = Object.fromEntries(
    classifications.map((classification) => [
      classification,
      schoolOptionsByScope[classification],
    ]),
  ) as Record<Classification, string[]>;
  const bestRankingPathByClassificationTeam = Object.fromEntries(
    classifications.map((classification) => [
      classification,
      Object.fromEntries(
        schoolOptionsByClassification[classification].map((school) => [
          school,
          bestRankingPath(rankingsByClassification[classification], school),
        ]),
      ),
    ]),
  ) as Record<Classification, Record<string, string>>;

  await writeFile(
    homeOutputPath,
    `${JSON.stringify({
      generatedAt: snapshot.generatedAt,
      sourcePerformanceRows: classifiedPerformances.length,
      schoolOptionsByClassification,
      bestRankingPathByClassificationTeam,
    })}\n`,
  );
  console.log(`Wrote ${homeOutputPath}`);

  const eventSquadRankings = Object.fromEntries(
    scopes.flatMap((scope) =>
      eventDefinitions.flatMap((definition) =>
        definition.relay
          ? []
          : definition.genders.map((gender) => {
              const ranking = buildEventSquadRanking(classifiedPerformances, {
                classification: scope,
                event: definition.event,
                gender,
              });

              return [
                eventSquadKey(scope, gender, definition.event),
                {
                  classification: ranking.classification,
                  event: ranking.event,
                  gender: ranking.gender,
                  squadSize: ranking.squadSize,
                  eligibleAthleteCount: ranking.eligibleAthleteCount,
                  squads: ranking.squads.map(compactEventSquad),
                  incompleteSquads: ranking.incompleteSquads.map(
                    compactIncompleteSquad,
                  ),
                },
              ];
            }),
      ),
    ),
  );

  await writeFile(
    eventSquadOutputPath,
    `${JSON.stringify({
      generatedAt: snapshot.generatedAt,
      sourcePerformanceRows: classifiedPerformances.length,
      eventSquadRankings,
    })}\n`,
  );
  console.log(`Wrote ${eventSquadOutputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
