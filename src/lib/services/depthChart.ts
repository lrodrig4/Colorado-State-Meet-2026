import type {
  Classification,
  EventKey,
  Gender,
  Performance,
} from "@/types/domain";
import { eventDefinitions, getEventDefinition } from "@/lib/data/events";
import { applyClassifications } from "@/lib/services/classification";
import { isDepthOnlyPerformance } from "@/lib/services/nonQualifying";
import { isDepthChartEligible } from "@/lib/services/review";
import { comparePerformanceMarks } from "@/lib/utils/time";

export interface DepthChartEntry {
  id: string;
  athleteName: string;
  school: string;
  gender: Gender;
  event: EventKey;
  eventLabel: string;
  markRaw: string;
  markValue: number;
  rank: number;
  grade?: number;
  meetName?: string;
  meetDate?: string;
  fitLabel: string;
  fitDetail: string;
  manual?: boolean;
}

export interface EventDepthChart {
  gender: Gender;
  event: EventKey;
  eventLabel: string;
  discipline: string;
  entries: DepthChartEntry[];
}

export interface RelayDepthCandidate extends DepthChartEntry {
  sourceEvent: EventKey;
  sourceEventLabel: string;
  relayScore: number;
}

export interface RelayDepthProjection {
  gender: Gender;
  relay: EventKey;
  relayLabel: string;
  candidates: RelayDepthCandidate[];
  alternates: RelayDepthCandidate[];
  directCount: number;
  projectedQualityLabel: string;
  note: string;
}

export interface TeamDepthChart {
  school: string;
  classification: Classification;
  eventCharts: EventDepthChart[];
  relayProjections: RelayDepthProjection[];
}

interface RelayComponent {
  event: EventKey;
  weight: number;
  fitLabel: string;
  fitDetail: string;
}

const relayComponents: Record<EventKey, RelayComponent[]> = {
  "4x100m Relay": [
    {
      event: "100m",
      weight: 1,
      fitLabel: "Direct 100 speed",
      fitDetail: "Primary 4x100 pool because the athlete has an open 100 mark.",
    },
    {
      event: "200m",
      weight: 0.74,
      fitLabel: "Can move down",
      fitDetail: "Open 200 speed suggests this athlete can cover a short relay leg.",
    },
    {
      event: "400m",
      weight: 0.3,
      fitLabel: "Long-sprint depth",
      fitDetail: "400 strength is a reserve signal if pure 100 depth is thin.",
    },
    {
      event: "300m Hurdles",
      weight: 0.22,
      fitLabel: "Hurdle speed reserve",
      fitDetail: "Hurdle speed can matter when a relay needs a fourth leg.",
    },
  ],
  "4x200m Relay": [
    {
      event: "200m",
      weight: 1,
      fitLabel: "Direct 200 leg",
      fitDetail: "Primary 4x200 pool because the athlete has an open 200 mark.",
    },
    {
      event: "100m",
      weight: 0.8,
      fitLabel: "Can move up",
      fitDetail: "Open 100 speed suggests usable 200 relay upside.",
    },
    {
      event: "400m",
      weight: 0.62,
      fitLabel: "Can move down",
      fitDetail: "Open 400 strength suggests a reliable long relay leg.",
    },
    {
      event: "300m Hurdles",
      weight: 0.48,
      fitLabel: "Hurdle strength",
      fitDetail: "300 hurdle profile often transfers to a 200 relay leg.",
    },
  ],
  "4x400m Relay": [
    {
      event: "400m",
      weight: 1,
      fitLabel: "Direct 400 leg",
      fitDetail: "Primary 4x400 pool because the athlete has an open 400 mark.",
    },
    {
      event: "800m",
      weight: 0.82,
      fitLabel: "Can move down",
      fitDetail: "800 strength usually transfers well to a 4x400 carry.",
    },
    {
      event: "200m",
      weight: 0.58,
      fitLabel: "Can move up",
      fitDetail: "200 speed is useful if the team needs more front-end pace.",
    },
    {
      event: "300m Hurdles",
      weight: 0.76,
      fitLabel: "Hurdle 400 fit",
      fitDetail: "300 hurdle rhythm and strength often fit the 4x400.",
    },
    {
      event: "1600m",
      weight: 0.36,
      fitLabel: "Strength reserve",
      fitDetail: "1600 strength is a fallback signal when 400/800 depth is thin.",
    },
  ],
  "4x800m Relay": [
    {
      event: "800m",
      weight: 1,
      fitLabel: "Direct 800 leg",
      fitDetail: "Primary 4x800 pool because the athlete has an open 800 mark.",
    },
    {
      event: "1600m",
      weight: 0.86,
      fitLabel: "Can move down",
      fitDetail: "1600 strength is a strong signal for a state 4x800 leg.",
    },
    {
      event: "3200m",
      weight: 0.62,
      fitLabel: "Distance strength",
      fitDetail: "3200 strength can fill a 4x800 leg if the schedule allows it.",
    },
    {
      event: "400m",
      weight: 0.38,
      fitLabel: "Speed reserve",
      fitDetail: "400 speed is useful context when choosing between endurance options.",
    },
  ],
  "100m": [],
  "200m": [],
  "400m": [],
  "800m": [],
  "1600m": [],
  "3200m": [],
  "100m Hurdles": [],
  "110m Hurdles": [],
  "300m Hurdles": [],
  "High Jump": [],
  "Pole Vault": [],
  "Long Jump": [],
  "Triple Jump": [],
  "Shot Put": [],
  "Discus": [],
};

function bestPerformanceKey(performance: Performance) {
  return `${performance.gender}|${performance.event}|${performance.athleteName.toLowerCase()}`;
}

function compactDepthEntryId(performance: Performance) {
  return [
    performance.gender,
    performance.event,
    performance.athleteName,
    performance.markRaw,
  ]
    .join("-")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function toDepthEntry(performance: Performance, rank: number): DepthChartEntry {
  const definition = getEventDefinition(performance.event);
  const depthOnly = isDepthOnlyPerformance(performance);

  return {
    id: compactDepthEntryId(performance),
    athleteName: performance.athleteName,
    school: performance.school,
    gender: performance.gender,
    event: performance.event,
    eventLabel: definition.displayName,
    markRaw: performance.markRaw,
    markValue: performance.markValue,
    rank,
    grade: performance.grade,
    meetName: performance.meetName,
    meetDate: performance.meetDate,
    fitLabel: depthOnly ? "Depth-only mark" : "Verified mark",
    fitDetail: depthOnly
      ? `Best ${definition.displayName} depth mark for this team; excluded from CHSAA qualifying.`
      : `Best verified ${definition.displayName} mark for this team.`,
  };
}

function buildBestByAthlete(
  performances: Performance[],
  classification: Classification,
  school: string,
) {
  const best = new Map<string, Performance>();
  const classifiedPerformances = performances.every(
    (performance) =>
      performance.classification !== undefined &&
      performance.classificationVerified,
  )
    ? performances
    : applyClassifications(performances);

  for (const performance of classifiedPerformances) {
    const definition = getEventDefinition(performance.event);
    if (
      definition.relay ||
      performance.classification !== classification ||
      performance.school !== school ||
      !isDepthChartEligible(performance)
    ) {
      continue;
    }

    const key = bestPerformanceKey(performance);
    const existing = best.get(key);
    if (
      !existing ||
      comparePerformanceMarks(
        performance.event,
        performance.markValue,
        existing.markValue,
      ) < 0
    ) {
      best.set(key, performance);
    }
  }

  return best;
}

function eventChartsFromBest(best: Map<string, Performance>) {
  return eventDefinitions
    .filter((definition) => !definition.relay)
    .flatMap((definition) =>
      definition.genders.map((gender) => {
        const entries = [...best.values()]
          .filter(
            (performance) =>
              performance.gender === gender && performance.event === definition.event,
          )
          .sort((a, b) =>
            comparePerformanceMarks(definition.event, a.markValue, b.markValue),
          )
          .map((performance, index) => toDepthEntry(performance, index + 1));

        return {
          gender,
          event: definition.event,
          eventLabel: definition.displayName,
          discipline: definition.discipline,
          entries,
        } satisfies EventDepthChart;
      }),
    );
}

function candidateBaseScore(entry: DepthChartEntry, component: RelayComponent) {
  const rankScore = Math.max(8, 46 - entry.rank * 5);
  const recencyBoost = entry.meetDate?.startsWith("2026-05") ? 3 : 0;
  const gradeBoost = entry.grade && entry.grade >= 11 ? 1 : 0;
  return Math.round((rankScore + recencyBoost + gradeBoost) * component.weight);
}

export function buildRelayProjection(
  gender: Gender,
  relay: EventKey,
  eventCharts: EventDepthChart[],
): RelayDepthProjection {
  const definition = getEventDefinition(relay);
  const components = relayComponents[relay] ?? [];
  const bestByAthlete = new Map<string, RelayDepthCandidate>();

  for (const component of components) {
    const chart = eventCharts.find(
      (item) => item.gender === gender && item.event === component.event,
    );

    for (const entry of chart?.entries ?? []) {
      const sourceDefinition = getEventDefinition(component.event);
      const candidate: RelayDepthCandidate = {
        ...entry,
        id: `${relay}-${entry.id}`,
        sourceEvent: component.event,
        sourceEventLabel: sourceDefinition.displayName,
        relayScore: candidateBaseScore(entry, component),
        fitLabel: component.fitLabel,
        fitDetail: component.fitDetail,
      };
      const existing = bestByAthlete.get(entry.athleteName.toLowerCase());
      if (!existing || candidate.relayScore > existing.relayScore) {
        bestByAthlete.set(entry.athleteName.toLowerCase(), candidate);
      }
    }
  }

  const ordered = [...bestByAthlete.values()].sort(
    (a, b) =>
      b.relayScore - a.relayScore ||
      a.rank - b.rank ||
      a.athleteName.localeCompare(b.athleteName),
  );
  const candidates = ordered.slice(0, 4);
  const alternates = ordered.slice(4, 8);
  const directEvent = components[0]?.event;
  const directCount = directEvent
    ? candidates.filter((candidate) => candidate.sourceEvent === directEvent).length
    : 0;
  const projectedQualityLabel =
    candidates.length >= 4 && directCount >= 3
      ? "Clear relay pool"
      : candidates.length >= 4
        ? "Needs lineup choice"
        : "Needs missing marks";

  return {
    gender,
    relay,
    relayLabel: definition.displayName,
    candidates,
    alternates,
    directCount,
    projectedQualityLabel,
    note:
      candidates.length >= 4
        ? `${directCount} of the projected top four come from direct ${components[0]?.event.replace("m", "") ?? "relay"} marks.`
        : "Add missing athletes or marks to complete this relay pool.",
  };
}

export function buildTeamDepthChart(
  performances: Performance[],
  classification: Classification,
  school: string,
): TeamDepthChart {
  const best = buildBestByAthlete(performances, classification, school);
  const eventCharts = eventChartsFromBest(best);
  const relayProjections = buildRelayProjectionsFromEventCharts(eventCharts);

  return {
    school,
    classification,
    eventCharts,
    relayProjections,
  };
}

export function buildRelayProjectionsFromEventCharts(
  eventCharts: EventDepthChart[],
): RelayDepthProjection[] {
  const relayEvents = eventDefinitions.filter((definition) => definition.relay);

  return relayEvents.flatMap((definition) =>
    definition.genders.map((gender) =>
      buildRelayProjection(gender, definition.event, eventCharts),
    ),
  );
}
