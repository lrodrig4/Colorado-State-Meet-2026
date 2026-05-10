import type {
  Classification,
  EventKey,
  Gender,
  Performance,
  RankingRow,
} from "@/types/domain";
import { getEventDefinition } from "@/lib/data/events";
import {
  buildTeamDepthChart,
  type RelayDepthCandidate,
  type RelayDepthProjection,
} from "@/lib/services/depthChart";
import {
  buildLastChanceDashboard,
  type LastChanceDashboard,
  type LastChanceRecommendation,
} from "@/lib/services/lastChance";
import { getAllRankingResults } from "@/lib/services/ranking";
import {
  formatPerformanceGap,
  formatPerformanceValue,
} from "@/lib/utils/time";

interface RelayChaseContext {
  depthChart?: ReturnType<typeof buildTeamDepthChart>;
  lastChance?: LastChanceDashboard;
  rankings?: ReturnType<typeof getAllRankingResults>;
}

export interface RelayLineupTradeoff {
  athleteName: string;
  grade?: number;
  gradeLabel: string;
  sourceEventLabel: string;
  sourceMarkRaw: string;
  relayLegEstimateRaw: string;
  opportunityCost: number;
  opportunityLabel: string;
  opportunityDetail: string;
}

export interface RelayChaseDecision {
  id: string;
  gender: Gender;
  relay: EventKey;
  relayLabel: string;
  currentRankLabel: string;
  currentMarkRaw?: string;
  relayStateOddsLabel: string;
  relayStateIntervalLabel: string;
  relayImproveOddsLabel: string;
  projectedLineupRaw?: string;
  projectedGapLabel?: string;
  adjustedProjectedMarkRaw?: string;
  repeatabilityLabel: "Repeatable" | "Loaded qualifier" | "Lineup risk" | "Alternate-safe";
  repeatabilitySummary: string;
  alternateLossRaw?: string;
  projectedPointsSwingLabel: string;
  projectedQualifyOdds: number;
  projectedQualifyOddsLabel: string;
  confidenceIntervalLabel: string;
  lineupCost: number;
  call:
    | "Chase relay"
    | "Conditional chase"
    | "Protect individuals"
    | "Low ROI"
    | "Already qualified";
  tone: "green" | "amber" | "rose" | "slate";
  summary: string;
  tradeoffSummary: string;
  lineup: RelayLineupTradeoff[];
  alternateSummary?: string;
}

const relayEvents: EventKey[] = [
  "4x100m Relay",
  "4x200m Relay",
  "4x400m Relay",
  "4x800m Relay",
];

const relayMovementWindow: Record<EventKey, number> = {
  "4x100m Relay": 0.65,
  "4x200m Relay": 2.4,
  "4x400m Relay": 5.5,
  "4x800m Relay": 14,
  "100m": 0,
  "200m": 0,
  "400m": 0,
  "800m": 0,
  "1600m": 0,
  "3200m": 0,
  "100m Hurdles": 0,
  "110m Hurdles": 0,
  "300m Hurdles": 0,
  "High Jump": 0,
  "Pole Vault": 0,
  "Long Jump": 0,
  "Triple Jump": 0,
  "Shot Put": 0,
  "Discus": 0,
};

const gradeWeight: Record<number, number> = {
  9: -4,
  10: -1,
  11: 3,
  12: 9,
};

const individualScoring = [10, 8, 7, 6, 5, 4, 3, 2, 1];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function gradeLabel(grade?: number) {
  if (!grade) return "Grade unknown";
  if (grade === 12) return "Senior";
  if (grade === 11) return "Junior";
  if (grade === 10) return "Sophomore";
  if (grade === 9) return "Freshman";
  return `Grade ${grade}`;
}

function relayLegEstimate(candidate: RelayDepthCandidate, relay: EventKey) {
  const value = candidate.markValue;

  if (relay === "4x800m Relay") {
    if (candidate.sourceEvent === "800m") return value * 0.988;
    if (candidate.sourceEvent === "1600m") return value * 0.466;
    if (candidate.sourceEvent === "3200m") return value * 0.224;
    if (candidate.sourceEvent === "400m") return value * 2.36;
  }

  if (relay === "4x400m Relay") {
    if (candidate.sourceEvent === "400m") return value * 0.988;
    if (candidate.sourceEvent === "800m") return value * 0.456;
    if (candidate.sourceEvent === "200m") return value * 2.16;
    if (candidate.sourceEvent === "300m Hurdles") return value + 7.6;
    if (candidate.sourceEvent === "1600m") return value * 0.21;
  }

  if (relay === "4x200m Relay") {
    if (candidate.sourceEvent === "200m") return value * 0.988;
    if (candidate.sourceEvent === "100m") return value * 2.04;
    if (candidate.sourceEvent === "400m") return value * 0.49;
    if (candidate.sourceEvent === "300m Hurdles") return value * 0.56;
  }

  if (relay === "4x100m Relay") {
    if (candidate.sourceEvent === "100m") return value * 0.985;
    if (candidate.sourceEvent === "200m") return value * 0.49;
    if (candidate.sourceEvent === "400m") return value * 0.235;
    if (candidate.sourceEvent === "300m Hurdles") return value * 0.27;
  }

  return value;
}

function relayLineupEstimate(lineup: RelayDepthCandidate[], relay: EventKey) {
  if (lineup.length < 4) return undefined;
  return lineup
    .slice(0, 4)
    .reduce((sum, candidate) => sum + relayLegEstimate(candidate, relay), 0);
}

function recommendationPriority(row: LastChanceRecommendation) {
  if (row.status === "Must race") return 5;
  if (row.status === "At risk") return 4;
  if (row.rank <= 9) return 3;
  if (row.rank <= 18) return 2;
  if (row.status === "Monitor") return 1;
  return 0;
}

function athleteIndividualRows(
  candidate: RelayDepthCandidate,
  recommendations: LastChanceRecommendation[],
) {
  return recommendations
    .filter(
      (row) =>
        row.school === candidate.school &&
        row.gender === candidate.gender &&
        row.athleteName === candidate.athleteName &&
        !getEventDefinition(row.event).relay,
    )
    .sort(
      (a, b) =>
        recommendationPriority(b) - recommendationPriority(a) ||
        b.improveProbability - a.improveProbability ||
        a.rank - b.rank,
    );
}

function lineupTradeoff(
  candidate: RelayDepthCandidate,
  relay: EventKey,
  recommendations: LastChanceRecommendation[],
): RelayLineupTradeoff {
  const individualRows = athleteIndividualRows(candidate, recommendations);
  const priorityRow = individualRows[0];
  const isSenior = candidate.grade === 12;
  const isFreshman = candidate.grade === 9;
  let cost = Math.max(0, gradeWeight[candidate.grade ?? 0] ?? 1);
  const notes: string[] = [];

  if (priorityRow) {
    const priorityDefinition = getEventDefinition(priorityRow.event);
    const individualPoints = individualScoring[priorityRow.rank - 1] ?? 0;

    if (priorityRow.rank <= 9) {
      cost += 28;
      notes.push(
        `${priorityRow.eventLabel} can score at state (${priorityRow.rankLabel})`,
      );
      if (individualPoints >= 6) {
        cost += 18;
        notes.push(
          `${priorityRow.eventLabel} has top-four individual scoring upside`,
        );
      } else if (
        (priorityDefinition.discipline === "sprint" ||
          priorityDefinition.discipline === "hurdle") &&
        individualPoints >= 4
      ) {
        cost += 10;
        notes.push(
          "sprint/hurdle finalist should stay individual-first unless relay depth gives a clear edge",
        );
      }
    } else if (priorityRow.status === "Must race") {
      cost += 30;
      notes.push(
        `${priorityRow.eventLabel} needs a last-chance PR (${priorityRow.stateProbabilityLabel} state odds)`,
      );
    } else if (priorityRow.status === "At risk") {
      cost += 22;
      notes.push(
        `${priorityRow.eventLabel} is seeded but at risk (${priorityRow.stateProbabilityLabel} state odds)`,
      );
    } else if (priorityRow.rank <= 18 && priorityRow.stateProbability < 90) {
      cost += 14;
      notes.push(
        `${priorityRow.eventLabel} is not fully safe (${priorityRow.stateProbabilityLabel} state odds)`,
      );
    } else if (priorityRow.rank > 18 && priorityRow.improveProbability >= 45) {
      cost += 16;
      notes.push(
        `${priorityRow.eventLabel} has a real individual chase (${priorityRow.improveProbabilityLabel} improve odds)`,
      );
    }
  }

  if (
    relay === "4x800m Relay" &&
    priorityRow &&
    ["800m", "1600m", "3200m"].includes(priorityRow.event)
  ) {
    cost += priorityRow.status === "Must race" ? 10 : 5;
    notes.push("same distance engine needed for both relay and individual race");
  }

  if (isSenior && priorityRow && priorityRow.stateProbability < 90) {
    cost += 8;
    notes.push("senior with one qualifying weekend left");
  } else if (isFreshman && priorityRow && priorityRow.status !== "Must race") {
    cost = Math.max(0, cost - 4);
    notes.push("freshman has more future state chances");
  }

  const opportunityCost = clamp(Math.round(cost), 0, 100);
  const opportunityLabel =
    opportunityCost >= 54
      ? "High individual cost"
      : opportunityCost >= 36
        ? "Real trade-off"
        : opportunityCost >= 18
          ? "Manageable cost"
          : "Low conflict";

  return {
    athleteName: candidate.athleteName,
    grade: candidate.grade,
    gradeLabel: gradeLabel(candidate.grade),
    sourceEventLabel: candidate.sourceEventLabel,
    sourceMarkRaw: candidate.markRaw,
    relayLegEstimateRaw: formatPerformanceValue(relay, relayLegEstimate(candidate, relay)),
    opportunityCost,
    opportunityLabel,
    opportunityDetail:
      notes.join("; ") || "No major individual state conflict in current data.",
  };
}

function relayRowsForSchool(
  rankings: ReturnType<typeof getAllRankingResults>,
  school: string,
  gender: Gender,
  relay: EventKey,
) {
  const ranking = rankings.find(
    (result) => result.gender === gender && result.event === relay,
  );
  return {
    ranking,
    row: [...(ranking?.top18 ?? []), ...(ranking?.bubble ?? [])].find(
      (candidate) => candidate.school === school,
    ),
  };
}

function projectedOddsFromGap(relay: EventKey, projectedGap?: number) {
  if (projectedGap === undefined) return 8;
  const window = relayMovementWindow[relay] || 3;
  if (projectedGap <= 0) {
    return clamp(66 + Math.abs(projectedGap / window) * 18, 54, 88);
  }
  return clamp(56 - (projectedGap / window) * 44, 2, 58);
}

function relayOpportunityScore(
  relayRecommendation: LastChanceRecommendation | undefined,
  projectedOdds: number,
  row: RankingRow | undefined,
) {
  const currentState = relayRecommendation?.stateProbability ?? (row?.rank && row.rank <= 18 ? 72 : 4);
  const improve = relayRecommendation?.improveProbability ?? (row ? 32 : 18);
  return clamp(currentState * 0.42 + improve * 0.28 + projectedOdds * 0.3, 0, 100);
}

function relayPoints(rank?: number) {
  return rank ? individualScoring[rank - 1] ?? 0 : 0;
}

function projectedRankForRelayMark(
  ranking: ReturnType<typeof getAllRankingResults>[number] | undefined,
  markValue: number | undefined,
) {
  if (!ranking || markValue === undefined) return undefined;
  return (
    ranking.top18.filter((entry) => entry.markValue < markValue).length + 1
  );
}

function alternateLineupEstimate(
  projection: RelayDepthProjection,
  relay: EventKey,
  recommendations: LastChanceRecommendation[],
) {
  const pool = [...projection.candidates, ...projection.alternates];
  if (pool.length < 5) return undefined;

  const withCost = pool.map((candidate) => ({
    candidate,
    tradeoff: lineupTradeoff(candidate, relay, recommendations),
  }));
  const lowConflictPool = withCost.filter(
    (item) => item.tradeoff.opportunityCost < 36,
  );
  const sourcePool = lowConflictPool.length >= 4 ? lowConflictPool : withCost;
  const lineup = sourcePool
    .sort(
      (a, b) =>
        b.candidate.relayScore - a.candidate.relayScore -
        (a.tradeoff.opportunityCost - b.tradeoff.opportunityCost) * 0.35,
    )
    .slice(0, 4)
    .map((item) => item.candidate);
  const estimate = relayLineupEstimate(lineup, relay);

  if (!estimate) return undefined;

  return {
    estimate,
    lineup,
    lowerConflict: lowConflictPool.length >= 4,
  };
}

function chooseCall(
  row: RankingRow | undefined,
  relayScore: number,
  lineupCost: number,
  relayRecommendation?: LastChanceRecommendation,
): RelayChaseDecision["call"] {
  if (row?.rank && row.rank <= 18 && (relayRecommendation?.stateProbability ?? 80) >= 86) {
    return "Already qualified";
  }

  if (lineupCost >= 54 && relayScore < 64) return "Protect individuals";
  if (relayScore >= 62 && lineupCost <= 30) return "Chase relay";
  if (relayScore >= 42 && lineupCost <= 46) return "Conditional chase";
  if (relayScore >= 55) return "Conditional chase";
  if (lineupCost >= 40) return "Protect individuals";
  return "Low ROI";
}

function callTone(call: RelayChaseDecision["call"]): RelayChaseDecision["tone"] {
  if (call === "Chase relay" || call === "Already qualified") return "green";
  if (call === "Conditional chase") return "amber";
  if (call === "Protect individuals") return "rose";
  return "slate";
}

function decisionSummary(
  call: RelayChaseDecision["call"],
  relayLabel: string,
  relayRecommendation: LastChanceRecommendation | undefined,
  lineup: RelayLineupTradeoff[],
) {
  const highCost = lineup.find((candidate) => candidate.opportunityCost >= 36);
  const relayOdds = relayRecommendation?.stateProbabilityLabel ?? "unknown";

  if (call === "Protect individuals" && highCost) {
    return `Do not make ${relayLabel} the first priority if it costs ${highCost.athleteName}'s individual race. Relay state odds are ${relayOdds}; individual upside is the cleaner path.`;
  }

  if (call === "Conditional chase") {
    return `Chase ${relayLabel} only with a clear lineup and a target split plan. It is not an automatic priority over individual bubble races.`;
  }

  if (call === "Chase relay") {
    return `${relayLabel} has enough modeled upside to be worth a focused last-chance attempt.`;
  }

  if (call === "Already qualified") {
    return `${relayLabel} is currently in the state field; protect the lineup and avoid unnecessary fatigue.`;
  }

  return `${relayLabel} is a low-return chase unless new marks show a meaningfully faster relay pool.`;
}

function alternateSummary(
  projection: RelayDepthProjection,
  relay: EventKey,
  recommendations: LastChanceRecommendation[],
) {
  const alternate = alternateLineupEstimate(projection, relay, recommendations);
  if (!alternate) return undefined;

  const label =
    alternate.lowerConflict ? "Lower-conflict option" : "Alternate option";

  return `${label}: ${alternate.lineup
    .map((candidate) => candidate.athleteName)
    .join(", ")} projects around ${formatPerformanceValue(relay, alternate.estimate)}.`;
}

function relayRepeatability(
  relay: EventKey,
  ranking: ReturnType<typeof getAllRankingResults>[number] | undefined,
  row: RankingRow | undefined,
  lineupEstimate: number | undefined,
  alternateEstimate: number | undefined,
  lineupCost: number,
) {
  const window = relayMovementWindow[relay] || 3;
  const alternateLoss =
    lineupEstimate !== undefined && alternateEstimate !== undefined
      ? Math.max(0, alternateEstimate - lineupEstimate)
      : undefined;
  const adjustedEstimate =
    lineupCost >= 54 && alternateEstimate !== undefined
      ? alternateEstimate
      : lineupCost >= 36 &&
          lineupEstimate !== undefined &&
          alternateEstimate !== undefined
        ? (lineupEstimate + alternateEstimate) / 2
        : lineupEstimate ?? row?.markValue;
  const adjustedRank = projectedRankForRelayMark(ranking, adjustedEstimate);
  const seedPoints = relayPoints(row?.rank);
  const adjustedPoints = relayPoints(adjustedRank);
  const pointsSwing = adjustedPoints - seedPoints;
  const label: RelayChaseDecision["repeatabilityLabel"] =
    row?.rank &&
    row.rank <= 18 &&
    lineupCost < 30 &&
    alternateLoss !== undefined &&
    alternateLoss <= window * 0.25
      ? "Alternate-safe"
      : lineupCost >= 54
        ? "Lineup risk"
        : lineupCost >= 36 || (alternateLoss ?? 0) > window * 0.5
          ? "Loaded qualifier"
          : "Repeatable";
  const summary =
    label === "Alternate-safe"
      ? "Relay has enough depth to protect one loaded athlete without a major points drop."
      : label === "Lineup risk"
        ? "Seed mark may require athletes with meaningful individual scoring or qualifying cost."
        : label === "Loaded qualifier"
          ? "Seed mark looks partly lineup-dependent; repeat it only if the loaded legs are available."
          : "Projected lineup and alternates suggest the seed is reasonably repeatable.";

  return {
    adjustedProjectedMarkRaw:
      adjustedEstimate !== undefined
        ? formatPerformanceValue(relay, adjustedEstimate)
        : undefined,
    repeatabilityLabel: label,
    repeatabilitySummary: summary,
    alternateLossRaw:
      alternateLoss !== undefined
        ? formatPerformanceValue(relay, alternateLoss)
        : undefined,
    projectedPointsSwingLabel:
      pointsSwing === 0
        ? "No projected point swing"
        : `${pointsSwing > 0 ? "+" : ""}${pointsSwing} projected relay points`,
  };
}

export function buildRelayChaseDecisions(
  performances: Performance[],
  classification: Classification,
  school: string,
  context: RelayChaseContext = {},
): RelayChaseDecision[] {
  const depthChart =
    context.depthChart ?? buildTeamDepthChart(performances, classification, school);
  const lastChance =
    context.lastChance ??
    buildLastChanceDashboard(performances, classification, school);
  const rankings =
    context.rankings ??
    getAllRankingResults(performances, classification, { bubbleLimit: 32 });
  const focusRecommendations = lastChance.recommendations.filter(
    (row) => row.school === school,
  );
  const decisions: RelayChaseDecision[] = [];

  for (const projection of depthChart.relayProjections) {
    if (!relayEvents.includes(projection.relay)) continue;

    const relayRecommendation = focusRecommendations.find(
      (row) => row.gender === projection.gender && row.event === projection.relay,
    );
    const { ranking, row } = relayRowsForSchool(
      rankings,
      school,
      projection.gender,
      projection.relay,
    );
    const cutoff =
      ranking?.top18[17] ?? ranking?.top18.at(-1) ?? ranking?.bubble[0];
    const lineup = projection.candidates
      .slice(0, 4)
      .map((candidate) =>
        lineupTradeoff(candidate, projection.relay, focusRecommendations),
      );
    const lineupEstimate = relayLineupEstimate(
      projection.candidates,
      projection.relay,
    );
    const projectedGap =
      lineupEstimate !== undefined && cutoff
        ? lineupEstimate - cutoff.markValue
        : undefined;
    const projectedOdds = Math.round(
      projectedOddsFromGap(projection.relay, projectedGap),
    );
    const relayScore = relayOpportunityScore(
      relayRecommendation,
      projectedOdds,
      row,
    );
    const lineupCost = Math.max(
      0,
      ...lineup.map((candidate) => candidate.opportunityCost),
    );
    const call = chooseCall(row, relayScore, lineupCost, relayRecommendation);
    const intervalWidth = call === "Conditional chase" ? 14 : 10;
    const alternate = alternateLineupEstimate(
      projection,
      projection.relay,
      focusRecommendations,
    );
    const repeatability = relayRepeatability(
      projection.relay,
      ranking,
      row,
      lineupEstimate,
      alternate?.estimate,
      lineupCost,
    );

    decisions.push({
      id: `${projection.gender}-${projection.relay}`,
      gender: projection.gender,
      relay: projection.relay,
      relayLabel: `${projection.gender} ${projection.relayLabel}`,
      currentRankLabel: row
        ? row.rank <= 18
          ? `#${row.rank}`
          : `B${row.rank - 18}`
        : "No top-50 mark",
      currentMarkRaw: row?.markRaw,
      relayStateOddsLabel: relayRecommendation?.stateProbabilityLabel ?? "0%",
      relayStateIntervalLabel:
        relayRecommendation?.stateConfidenceIntervalLabel ?? "0-12%",
      relayImproveOddsLabel: relayRecommendation?.improveProbabilityLabel ?? "Unknown",
      projectedLineupRaw:
        lineupEstimate !== undefined
          ? formatPerformanceValue(projection.relay, lineupEstimate)
          : undefined,
      projectedGapLabel:
        projectedGap !== undefined
          ? projectedGap <= 0
            ? `${formatPerformanceGap(projection.relay, projectedGap)} inside current 18th`
            : `Needs ${formatPerformanceGap(projection.relay, projectedGap)} vs current 18th`
          : undefined,
      adjustedProjectedMarkRaw: repeatability.adjustedProjectedMarkRaw,
      repeatabilityLabel: repeatability.repeatabilityLabel,
      repeatabilitySummary: repeatability.repeatabilitySummary,
      alternateLossRaw: repeatability.alternateLossRaw,
      projectedPointsSwingLabel: repeatability.projectedPointsSwingLabel,
      projectedQualifyOdds: projectedOdds,
      projectedQualifyOddsLabel: `${projectedOdds}%`,
      confidenceIntervalLabel: `${Math.round(
        clamp(projectedOdds - intervalWidth, 1, 99),
      )}-${Math.round(clamp(projectedOdds + intervalWidth, 1, 99))}%`,
      lineupCost,
      call,
      tone: callTone(call),
      summary: decisionSummary(
        call,
        `${projection.gender} ${projection.relayLabel}`,
        relayRecommendation,
        lineup,
      ),
      tradeoffSummary:
        lineup
          .filter((candidate) => candidate.opportunityCost >= 36)
          .map(
            (candidate) =>
              `${candidate.athleteName} (${candidate.gradeLabel}): ${candidate.opportunityDetail}`,
          )
          .join(" ") ||
        "No major individual conflict for the projected top-four relay pool.",
      lineup,
      alternateSummary: alternateSummary(
        projection,
        projection.relay,
        focusRecommendations,
      ),
    });
  }

  return decisions.sort((a, b) => {
    const callOrder: Record<RelayChaseDecision["call"], number> = {
      "Protect individuals": 0,
      "Conditional chase": 1,
      "Chase relay": 2,
      "Low ROI": 3,
      "Already qualified": 4,
    };
    const aUnqualified = a.currentRankLabel.startsWith("B") || a.currentRankLabel.startsWith("No");
    const bUnqualified = b.currentRankLabel.startsWith("B") || b.currentRankLabel.startsWith("No");

    return (
      Number(bUnqualified) - Number(aUnqualified) ||
      callOrder[a.call] - callOrder[b.call] ||
      b.lineupCost - a.lineupCost ||
      a.gender.localeCompare(b.gender) ||
      a.relayLabel.localeCompare(b.relayLabel)
    );
  });
}
