import { eventDefinitions, getEventDefinition } from "@/lib/data/events";
import type { LastChanceRecommendation } from "@/lib/services/lastChance";
import type { EventKey, Gender } from "@/types/domain";

const SCORING_POINTS = [10, 8, 7, 6, 5, 4, 3, 2, 1];
const RELAY_POOL_SIZE = 4;
const RELAY_ALTERNATE_SIZE = 6;
const RELAY_DEPTH_SIZE = 8;

const relayDepthEvents = {
  "4x100m Relay": [
    { event: "100m", weight: 1 },
    { event: "200m", weight: 0.7 },
    { event: "400m", weight: 0.25 },
    { event: "100m Hurdles", weight: 0.22 },
    { event: "110m Hurdles", weight: 0.22 },
  ],
  "4x200m Relay": [
    { event: "200m", weight: 1 },
    { event: "100m", weight: 0.75 },
    { event: "400m", weight: 0.48 },
    { event: "300m Hurdles", weight: 0.25 },
  ],
  "4x400m Relay": [
    { event: "400m", weight: 1 },
    { event: "800m", weight: 0.7 },
    { event: "200m", weight: 0.55 },
    { event: "300m Hurdles", weight: 0.45 },
    { event: "1600m", weight: 0.28 },
  ],
  "4x800m Relay": [
    { event: "800m", weight: 1 },
    { event: "1600m", weight: 0.78 },
    { event: "3200m", weight: 0.5 },
    { event: "400m", weight: 0.32 },
  ],
} satisfies Record<
  Extract<EventKey, "4x100m Relay" | "4x200m Relay" | "4x400m Relay" | "4x800m Relay">,
  Array<{ event: EventKey; weight: number }>
>;

type RelayEventKey = keyof typeof relayDepthEvents;

interface RelayDepthCandidate {
  athleteName: string;
  school: string;
  gender: Gender;
  score: number;
  bestScore: number;
  bestEvent: EventKey;
  bestRank: number;
  bestMarkRaw: string;
  eventCount: number;
}

type RelayDepthChart = Map<string, RelayDepthCandidate[]>;

export interface AthleteEventSummary {
  id: string;
  eventLabel: string;
  rankLabel: string;
  markRaw: string;
  stateProbabilityLabel: string;
  holdProbabilityLabel: string;
  improveProbabilityLabel: string;
  scratchProbabilityLabel: string;
  scratchRiskLabel: string;
  netScratchCall: LastChanceRecommendation["netScratchCall"];
  statusLabel: "Scoring seed" | "Qualified" | "Bubble chase" | "Long shot";
  note: string;
  isSelected: boolean;
  isQualified: boolean;
  isScoring: boolean;
  projectedPoints: number;
  stateProbability: number;
  scratchProbability: number;
  rank: number;
}

export interface AthleteRelayOutlook {
  id: string;
  relayLabel: string;
  rankLabel: string;
  markRaw: string;
  stateProbabilityLabel: string;
  callLabel:
    | "Most likely to run"
    | "Likely relay chase"
    | "Alternate / possible leg"
    | "Relay depth only";
  tone: "strong" | "watch" | "soft";
  poolRank: number;
  sourceEventLabel: string;
  sourceMarkRaw: string;
  reason: string;
  topLegs: string[];
  isQualified: boolean;
  stateProbability: number;
}

export interface AthleteEventOutlook {
  athleteName: string;
  school: string;
  gender: LastChanceRecommendation["gender"];
  gradeLabel?: string;
  selectedEventLabel: string;
  qualifyingSummary: string;
  scratchWatchSummary: string;
  likelyPlanTitle: string;
  likelyPlan: string;
  events: AthleteEventSummary[];
  relayOutlooks: AthleteRelayOutlook[];
}

function projectedPoints(rank: number) {
  return SCORING_POINTS[rank - 1] ?? 0;
}

function eventOrder(event: LastChanceRecommendation["event"]) {
  const index = eventDefinitions.findIndex((definition) => definition.event === event);

  return index === -1 ? eventDefinitions.length : index;
}

function statusLabel(row: LastChanceRecommendation): AthleteEventSummary["statusLabel"] {
  if (row.rank <= 9) return "Scoring seed";
  if (row.rank <= 18) return "Qualified";
  if (row.stateProbability >= 24 || row.expectedScratchOpenings >= 0.25) {
    return "Bubble chase";
  }

  return "Long shot";
}

function eventNote(row: LastChanceRecommendation) {
  if (row.rank <= 9) {
    return `${projectedPoints(row.rank)} projected points. ${row.scratchTradeoffExplanation}`;
  }

  if (row.rank <= 18) {
    return `${row.scratchRiskLabel} scratch read. ${row.scratchTradeoffExplanation}`;
  }

  return `Needs the cutline to move or scratches ahead. ${row.recommendation}`;
}

function scratchReadLabel(event: AthleteEventSummary) {
  if (event.netScratchCall === "Likely scratch" || event.scratchProbability >= 55) {
    return "likely scratch";
  }

  if (event.netScratchCall === "Maybe scratch" || event.scratchProbability >= 35) {
    return "scratch watch";
  }

  if (event.scratchProbability >= 18) {
    return "coach call";
  }

  return "keep entered";
}

function eventSummary(
  row: LastChanceRecommendation,
  selected: LastChanceRecommendation,
): AthleteEventSummary {
  const points = projectedPoints(row.rank);

  return {
    id: row.id,
    eventLabel: row.eventLabel,
    rankLabel: row.rankLabel,
    markRaw: row.markRaw,
    stateProbabilityLabel: row.stateProbabilityLabel,
    holdProbabilityLabel: row.holdProbabilityLabel,
    improveProbabilityLabel: row.improveProbabilityLabel,
    scratchProbabilityLabel: row.scratchProbabilityLabel,
    scratchRiskLabel: row.scratchRiskLabel,
    netScratchCall: row.netScratchCall,
    statusLabel: statusLabel(row),
    note: eventNote(row),
    isSelected: row.id === selected.id,
    isQualified: row.rank <= 18,
    isScoring: row.rank <= 9,
    projectedPoints: points,
    stateProbability: row.stateProbability,
    scratchProbability: row.scratchProbability,
    rank: row.rank,
  };
}

function relayDepthKey(gender: Gender, school: string, relay: RelayEventKey) {
  return `${gender}|${school}|${relay}`;
}

function isRelayDepthEvent(event: EventKey): event is RelayEventKey {
  return event in relayDepthEvents;
}

function sameAthlete(a: LastChanceRecommendation, b: LastChanceRecommendation) {
  return (
    a.athleteName === b.athleteName &&
    a.school === b.school &&
    a.gender === b.gender
  );
}

function relayCandidateScore(row: LastChanceRecommendation, weight: number) {
  return (
    Math.max(0, 58 - row.rank) * weight +
    projectedPoints(row.rank) * 3 +
    (row.rank <= 18 ? 4 : 0) +
    row.stateProbability * 0.04 +
    row.improveProbability * 0.02
  );
}

function buildRelayDepthCharts(
  recommendations: LastChanceRecommendation[],
): RelayDepthChart {
  const charts: RelayDepthChart = new Map();

  for (const row of recommendations) {
    if (getEventDefinition(row.event).relay) continue;

    for (const [relay, components] of Object.entries(relayDepthEvents) as Array<
      [RelayEventKey, (typeof relayDepthEvents)[RelayEventKey]]
    >) {
      const component = components.find((item) => item.event === row.event);
      if (!component) continue;

      const key = relayDepthKey(row.gender, row.school, relay);
      const chart = charts.get(key) ?? [];
      const candidateKey = `${row.athleteName}|${row.school}|${row.gender}`;
      const existing = chart.find(
        (candidate) =>
          `${candidate.athleteName}|${candidate.school}|${candidate.gender}` === candidateKey,
      );
      const score = relayCandidateScore(row, component.weight);

      if (existing) {
        existing.score += score * 0.45;
        existing.eventCount += 1;

        if (score > existing.bestScore) {
          existing.bestScore = score;
          existing.bestEvent = row.event;
          existing.bestRank = row.rank;
          existing.bestMarkRaw = row.markRaw;
        }
      } else {
        chart.push({
          athleteName: row.athleteName,
          school: row.school,
          gender: row.gender,
          score,
          bestScore: score,
          bestEvent: row.event,
          bestRank: row.rank,
          bestMarkRaw: row.markRaw,
          eventCount: 1,
        });
      }

      charts.set(
        key,
        chart.sort(
          (a, b) =>
            b.score - a.score ||
            a.bestRank - b.bestRank ||
            a.athleteName.localeCompare(b.athleteName),
        ),
      );
    }
  }

  return charts;
}

function relayCallFor(
  relay: LastChanceRecommendation,
  poolRank: number,
): Pick<AthleteRelayOutlook, "callLabel" | "tone"> {
  if (poolRank <= RELAY_POOL_SIZE && relay.rank <= 18) {
    return { callLabel: "Most likely to run", tone: "strong" };
  }

  if (poolRank <= RELAY_POOL_SIZE) {
    return { callLabel: "Likely relay chase", tone: "watch" };
  }

  if (poolRank <= RELAY_ALTERNATE_SIZE) {
    return { callLabel: "Alternate / possible leg", tone: "watch" };
  }

  return { callLabel: "Relay depth only", tone: "soft" };
}

function relayReason(
  relay: LastChanceRecommendation,
  candidate: RelayDepthCandidate,
  poolRank: number,
  callLabel: AthleteRelayOutlook["callLabel"],
) {
  const relayName = relay.eventLabel.replace(`${relay.gender} `, "");
  const sourceEvent = getEventDefinition(candidate.bestEvent).displayName;

  if (callLabel === "Most likely to run") {
    return `${relayName} is ${relay.rankLabel} at ${relay.markRaw}, and this athlete projects as relay pool #${poolRank} from ${sourceEvent}. Treat it as part of the state plan; relays are modeled as contested, not scratch openings.`;
  }

  if (callLabel === "Likely relay chase") {
    return `${relayName} is just outside or near the state field, and this athlete projects as one of the four best relay options from ${sourceEvent}. If the team chases this relay, assume this athlete is in the lineup.`;
  }

  if (callLabel === "Alternate / possible leg") {
    return `${relayName} depth puts this athlete around pool #${poolRank}. They are a realistic alternate or lineup option if a stronger leg is protected elsewhere.`;
  }

  return `${relayName} depth sees this athlete as pool #${poolRank}. Keep them on the depth chart, but the model does not make them a primary relay leg.`;
}

function buildAthleteRelayOutlooks(
  recommendations: LastChanceRecommendation[],
  selected: LastChanceRecommendation,
): AthleteRelayOutlook[] {
  const charts = buildRelayDepthCharts(recommendations);
  const relayRows = recommendations.filter(
    (row) =>
      row.gender === selected.gender &&
      row.school === selected.school &&
      getEventDefinition(row.event).relay &&
      isRelayDepthEvent(row.event),
  );

  return relayRows
    .flatMap((relay) => {
      if (!isRelayDepthEvent(relay.event)) return [];

      const chart = charts.get(relayDepthKey(relay.gender, relay.school, relay.event)) ?? [];
      const index = chart.findIndex(
        (candidate) =>
          candidate.athleteName === selected.athleteName &&
          candidate.school === selected.school &&
          candidate.gender === selected.gender,
      );

      if (index < 0 || index >= RELAY_DEPTH_SIZE) return [];

      const candidate = chart[index];
      const poolRank = index + 1;
      const call = relayCallFor(relay, poolRank);
      const sourceEventLabel = getEventDefinition(candidate.bestEvent).displayName;

      return [
        {
          id: `${relay.id}-relay-outlook`,
          relayLabel: relay.eventLabel,
          rankLabel: relay.rankLabel,
          markRaw: relay.markRaw,
          stateProbabilityLabel: relay.stateProbabilityLabel,
          callLabel: call.callLabel,
          tone: call.tone,
          poolRank,
          sourceEventLabel,
          sourceMarkRaw: candidate.bestMarkRaw,
          reason: relayReason(relay, candidate, poolRank, call.callLabel),
          topLegs: chart.slice(0, RELAY_POOL_SIZE).map((leg) => leg.athleteName),
          isQualified: relay.rank <= 18,
          stateProbability: relay.stateProbability,
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(b.callLabel === "Most likely to run") -
          Number(a.callLabel === "Most likely to run") ||
        Number(b.isQualified) - Number(a.isQualified) ||
        a.poolRank - b.poolRank ||
        b.stateProbability - a.stateProbability ||
        a.relayLabel.localeCompare(b.relayLabel),
    );
}

function summarizeCounts(
  events: AthleteEventSummary[],
  relays: AthleteRelayOutlook[],
) {
  const scoring = events.filter((event) => event.isScoring).length;
  const qualified = events.filter((event) => event.isQualified).length;
  const bubble = events.filter((event) => !event.isQualified && event.statusLabel === "Bubble chase").length;
  const likelyRelays = relays.filter(
    (relay) => relay.callLabel === "Most likely to run",
  ).length;

  return [
    scoring ? `${scoring} scoring seed${scoring === 1 ? "" : "s"}` : "",
    qualified ? `${qualified} state-qualified event${qualified === 1 ? "" : "s"}` : "",
    bubble ? `${bubble} bubble chase${bubble === 1 ? "" : "s"}` : "",
    likelyRelays ? `${likelyRelays} likely relay role${likelyRelays === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(" · ");
}

function relayLoadSentence(relays: AthleteRelayOutlook[]) {
  const likelyRelays = relays.filter(
    (relay) =>
      relay.callLabel === "Most likely to run" ||
      relay.callLabel === "Likely relay chase",
  );

  if (!likelyRelays.length) return "";

  return ` Relay load: ${likelyRelays
    .slice(0, 2)
    .map((relay) => `${relay.relayLabel.replace(`${relay.relayLabel.split(" ")[0]} `, "")} (${relay.callLabel.toLowerCase()})`)
    .join(" / ")}.`;
}

function scratchSummary(
  events: AthleteEventSummary[],
  relays: AthleteRelayOutlook[],
) {
  const scratchWatch = events
    .filter(
      (event) =>
        event.isQualified &&
        (event.scratchProbability >= 18 ||
          event.netScratchCall === "Maybe scratch" ||
          event.netScratchCall === "Likely scratch"),
    )
    .sort((a, b) => b.scratchProbability - a.scratchProbability);

  if (!scratchWatch.length) {
    return `No strong scratch signal. The model keeps qualified individual events unless schedule load and team-point value clearly say otherwise.${relayLoadSentence(relays)}`;
  }

  return `${scratchWatch
    .slice(0, 3)
    .map(
      (event) =>
        `${event.eventLabel.replace(`${event.eventLabel.split(" ")[0]} `, "")}: ${scratchReadLabel(event)}`,
    )
    .join("; ")}${relayLoadSentence(relays)}`;
}

function likelyPlan(
  selected: LastChanceRecommendation,
  events: AthleteEventSummary[],
  relays: AthleteRelayOutlook[],
) {
  const scoring = events
    .filter((event) => event.isScoring)
    .sort((a, b) => b.projectedPoints - a.projectedPoints || a.rank - b.rank);
  const qualified = events.filter((event) => event.isQualified);
  const bubble = events
    .filter((event) => !event.isQualified && event.statusLabel === "Bubble chase")
    .sort((a, b) => b.stateProbability - a.stateProbability);
  const maybeScratch = events.filter(
    (event) =>
      event.isQualified &&
      (event.netScratchCall === "Maybe scratch" ||
        event.netScratchCall === "Likely scratch"),
  );

  const selectedDefinition = getEventDefinition(selected.event);
  const relayPlan = relays.find(
    (relay) =>
      relay.callLabel === "Most likely to run" ||
      relay.callLabel === "Likely relay chase",
  );
  const relayText = relayPlan
    ? ` Also plan around ${relayPlan.relayLabel.replace(`${relayPlan.relayLabel.split(" ")[0]} `, "")}; ${relayPlan.callLabel.toLowerCase()} from ${relayPlan.sourceEventLabel} depth.`
    : "";

  if (events.length === 1) {
    if (selected.rank <= 9) {
      return {
        title: "Likely plan",
        text: `Keep ${selected.eventLabel}. It is currently a scoring seed worth ${projectedPoints(selected.rank)} projected points, so the model protects it by default.${relayText}`,
      };
    }

    if (selected.rank <= 18) {
      return {
        title: "Likely plan",
        text: `Declare ${selected.eventLabel} unless the coach has a specific injury or team-points reason. There is no stronger event from this ranking set pushing a scratch.${relayText}`,
      };
    }

    return {
      title: "Likely plan",
      text: `This is a chase, not a current state entry. The model would only prioritize it if the needed improvement fits the athlete profile and the weekend schedule is realistic.${relayText}`,
    };
  }

  if (scoring.length) {
    const topEvents = scoring
      .slice(0, 2)
      .map((event) => `${event.eventLabel} (${event.rankLabel}, ${event.projectedPoints} pts)`)
      .join(" and ");
    const scratchText = maybeScratch.length
      ? ` Watch ${maybeScratch
          .slice(0, 2)
          .map((event) => event.eventLabel)
          .join(" / ")} as the possible lower-value scratch.`
      : " The model does not see a strong scratch signal right now.";

    return {
      title: "Most likely state plan",
      text: `Prioritize ${topEvents}. Scoring entries beat speculative volume unless another event creates a clear team-points gain.${scratchText}${relayText}`,
    };
  }

  if (qualified.length) {
    const strongest = qualified
      .slice()
      .sort((a, b) => b.stateProbability - a.stateProbability || a.rank - b.rank)[0];
    const bubbleText = bubble.length
      ? ` If chasing another event, ${bubble[0].eventLabel} is the best bubble target from the loaded rankings.`
      : "";

    return {
      title: "Most likely state plan",
      text: `Keep ${strongest.eventLabel} first because it is the strongest current accepted event. Qualified non-scoring events are usually kept unless the team needs a better point path elsewhere.${bubbleText}${relayText}`,
    };
  }

  if (selectedDefinition.discipline === "distance") {
    return {
      title: "Best chase read",
      text: `${bubble[0]?.eventLabel ?? selected.eventLabel} is the best loaded chase from this athlete's ranked events. Avoid stacking hard 3200 attempts on back-to-back days unless this is clearly the cleanest state path.${relayText}`,
    };
  }

  return {
    title: "Best chase read",
    text: `${bubble[0]?.eventLabel ?? selected.eventLabel} is the best loaded chase from this athlete's ranked events. Prioritize the event with the strongest state path and cleanest schedule fit.${relayText}`,
  };
}

export function buildAthleteEventOutlook(
  recommendations: LastChanceRecommendation[],
  selected: LastChanceRecommendation,
): AthleteEventOutlook | undefined {
  if (getEventDefinition(selected.event).relay) {
    return undefined;
  }

  const events = recommendations
    .filter((row) => !getEventDefinition(row.event).relay && sameAthlete(row, selected))
    .map((row) => eventSummary(row, selected))
    .sort(
      (a, b) =>
        Number(b.isScoring) - Number(a.isScoring) ||
        Number(b.isQualified) - Number(a.isQualified) ||
        b.stateProbability - a.stateProbability ||
        eventOrder(recommendations.find((row) => row.id === a.id)?.event ?? selected.event) -
          eventOrder(recommendations.find((row) => row.id === b.id)?.event ?? selected.event),
    );
  const relayOutlooks = buildAthleteRelayOutlooks(recommendations, selected);
  const plan = likelyPlan(selected, events, relayOutlooks);

  return {
    athleteName: selected.athleteName,
    school: selected.school,
    gender: selected.gender,
    gradeLabel: selected.grade ? `Grade ${selected.grade}` : undefined,
    selectedEventLabel: selected.eventLabel,
    qualifyingSummary: summarizeCounts(events, relayOutlooks) || "No other ranked events loaded.",
    scratchWatchSummary: scratchSummary(events, relayOutlooks),
    likelyPlanTitle: plan.title,
    likelyPlan: plan.text,
    events,
    relayOutlooks,
  };
}
