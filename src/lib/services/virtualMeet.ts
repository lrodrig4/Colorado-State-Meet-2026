import type {
  Classification,
  EventKey,
  Gender,
  Performance,
  TeamScore,
  VirtualMeetEntry,
  VirtualStateMeet,
} from "@/types/domain";
import { eventDefinitions } from "@/lib/data/events";
import { stateMeetSchedule } from "@/lib/data/stateSchedule";
import { getSeasonBestRankings } from "@/lib/services/ranking";
import { normalizeEvent } from "@/lib/utils/time";

const SCORING = [10, 8, 7, 6, 5, 4, 3, 2, 1];

function getSchedule(
  classification: Classification,
  gender: Gender,
  event: EventKey,
) {
  return stateMeetSchedule.find(
    (item) =>
      item.classification === classification &&
      item.gender === gender &&
      normalizeEvent(item.event) === event,
  );
}

function scoreEntries(entries: VirtualMeetEntry[]): VirtualMeetEntry[] {
  return entries.map((entry, index) => ({
    ...entry,
    projectedPlace: index + 1,
    projectedPoints: SCORING[index] ?? 0,
  }));
}

function aggregateTeamScores(entries: VirtualMeetEntry[]): TeamScore[] {
  const bySchoolGender = new Map<string, TeamScore>();

  for (const entry of entries) {
    if (entry.projectedPoints <= 0) {
      continue;
    }

    const key = `${entry.school}|${entry.gender}`;
    const existing = bySchoolGender.get(key) ?? {
      school: entry.school,
      gender: entry.gender,
      points: 0,
      scoringEntries: 0,
    };

    existing.points += entry.projectedPoints;
    existing.scoringEntries += 1;
    bySchoolGender.set(key, existing);
  }

  return [...bySchoolGender.values()].sort(
    (a, b) => b.points - a.points || a.school.localeCompare(b.school),
  );
}

export function buildVirtualStateMeet(
  performances: Performance[],
  classification: Classification = "4A",
): VirtualStateMeet {
  const eventSpecs: Array<{ gender: Gender; event: EventKey }> =
    eventDefinitions.flatMap((definition) =>
      definition.genders.map((gender) => ({
        gender,
        event: definition.event,
      })),
    );

  const events = eventSpecs.map((spec) => {
    const ranking = getSeasonBestRankings(performances, {
      classification,
      gender: spec.gender,
      event: spec.event,
      topLimit: 18,
      bubbleLimit: 0,
    });
    const schedule = getSchedule(classification, spec.gender, spec.event);
    const entries = scoreEntries(
      ranking.top18.map((entry) => ({
        ...entry,
        seed: entry.rank,
        projectedPoints: 0,
        schedule,
      })),
    );

    return {
      ...spec,
      schedule,
      entries,
    };
  });

  return {
    classification,
    generatedAt: new Date().toISOString(),
    eventCap: 18,
    scoringPlaces: 9,
    events,
    teamScores: aggregateTeamScores(events.flatMap((event) => event.entries)),
    notes: [
      "Virtual meet uses ranking seed order as projected finish order.",
      "Boys and girls team scores are separated, matching state meet scoring.",
      "Only verified FAT track performances and verified field marks are included.",
      "Mile and 2 mile marks remain review-only and are not auto-converted.",
    ],
  };
}
