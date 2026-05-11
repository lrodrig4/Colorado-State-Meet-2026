import assert from "node:assert/strict";
import test from "node:test";
import type {
  CutoffPrediction,
  LastChanceRecommendation,
} from "@/lib/services/lastChance";
import { __testing } from "@/lib/services/stVrainHeatEstimator";

function recommendation(
  overrides: Partial<LastChanceRecommendation>,
): LastChanceRecommendation {
  return {
    id: "row",
    event: "3200m",
    gender: "Girls",
    grade: 11,
    eventLabel: "Girls 3200m Run",
    athleteName: "Addison Michalak",
    school: "Palmer Ridge High School",
    rank: 38,
    rankLabel: "B20",
    markRaw: "11:38.00",
    meetName: "Test Meet",
    meetDate: "2026-05-01",
    predictedCutoffRaw: "11:22.00",
    predictedCutoffValue: 682,
    holdProbability: 8,
    holdProbabilityLabel: "8%",
    holdConfidenceIntervalLabel: "4-12%",
    holdExplanation: "",
    stateProbability: 28,
    stateProbabilityLabel: "28%",
    stateConfidenceIntervalLabel: "22-34%",
    makeProbability: 28,
    probabilityLabel: "28%",
    confidenceIntervalLabel: "22-34%",
    improveProbability: 64,
    improveProbabilityLabel: "64%",
    improveConfidenceIntervalLabel: "56-72%",
    improveExplanation: "",
    scratchProbability: 0,
    scratchProbabilityLabel: "0%",
    scratchConfidenceIntervalLabel: "0-8%",
    scratchRiskLabel: "Very low",
    scratchExplanation: "",
    expectedScratchOpenings: 0,
    keepValue: 0,
    keepValueLabel: "0 pts",
    scratchValue: 0,
    scratchValueLabel: "0 pts",
    netScratchCall: "Keep",
    scratchTradeoffExplanation: "",
    oddsBandLabel: "Must improve",
    oddsExplanation: "",
    nearbyLabel: "",
    gapRaw: "Needs 16.00s",
    gapValue: 16,
    status: "Must race",
    recommendation: "",
    priorityScore: 400,
    isFocusTeam: true,
    ...overrides,
  };
}

function prediction(overrides = {}): CutoffPrediction {
  return {
    event: "3200m",
    gender: "Girls",
    eventLabel: "Girls 3200m Run",
    currentCutoffRaw: "11:24.00",
    currentCutoffRank: 18,
    predictedCutoffRaw: "11:22.00",
    predictedCutoffValue: 682,
    historicalYearCount: 4,
    movementRaw: "2.00s",
    lateWaveRaw: "22%",
    lateWaveSummary: "",
    confidence: "High",
    confidenceScore: 96,
    confidenceScoreLabel: "96/100",
    confidenceSummary: "",
    sourceCoverageLabel: "",
    method: "",
    ...overrides,
  } as CutoffPrediction;
}

function entries(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index + 1),
    athleteOrRelay:
      index === 43 ? "Addison Michalak" : `Runner ${index + 1}`,
    school:
      index === 43 ? "Palmer Ridge High School" : `School ${index + 1}`,
    seedMarkRaw:
      index === 43 ? "11:38.00" : `11:${String(index + 1).padStart(2, "0")}.00`,
    seedRank: index + 1,
    relayMembers: [],
  }));
}

test("Girls 3200 with 66 live entries estimates three equal heats", () => {
  assert.deepEqual(__testing.heatSizesSlowToFast(66, 3), [22, 22, 22]);
});

test("distance profile raises the heat-adjusted 3200 state-mark chance", () => {
  const liveEntries = entries(66);
  const heats = __testing.buildEstimatedHeats({
    category: "Individual",
    entries: liveEntries,
    gender: "Girls",
    event: "3200m",
    heatSizes: [22, 22, 22],
    fastSections: 1,
  });
  const baseRecommendation = recommendation({});
  const withProfile = [
    baseRecommendation,
    recommendation({
      id: "row-1600",
      event: "1600m",
      eventLabel: "Girls 1600m Run",
      rank: 24,
      rankLabel: "B6",
      markRaw: "5:11.00",
      stateProbability: 48,
      stateProbabilityLabel: "48%",
      improveProbability: 66,
      improveProbabilityLabel: "66%",
    }),
  ];
  const withoutProfile = [baseRecommendation];

  const base = __testing.buildStateMarkOpportunities({
    category: "Individual",
    entries: liveEntries,
    estimatedHeats: heats,
    focusTeam: "Palmer Ridge High School",
    recommendationMap: __testing.recommendationSignals(withoutProfile),
    profileMap: __testing.athleteProfiles(withoutProfile),
    prediction: prediction(),
    gender: "Girls",
    event: "3200m",
  });
  const profiled = __testing.buildStateMarkOpportunities({
    category: "Individual",
    entries: liveEntries,
    estimatedHeats: heats,
    focusTeam: "Palmer Ridge High School",
    recommendationMap: __testing.recommendationSignals(withProfile),
    profileMap: __testing.athleteProfiles(withProfile),
    prediction: prediction(),
    gender: "Girls",
    event: "3200m",
  });

  const baseChance = base.find(
    (row) => row.athleteOrRelay === "Addison Michalak",
  )?.heatAdjustedChance;
  const profileChance = profiled.find(
    (row) => row.athleteOrRelay === "Addison Michalak",
  )?.heatAdjustedChance;

  assert.ok(baseChance);
  assert.ok(profileChance);
  assert.ok(profileChance > baseChance);
});

test("relay opportunities are repeatability reads, not scratch openings", () => {
  const relayEntries = [
    {
      id: "1",
      athleteOrRelay: "Palmer Ridge High School",
      school: "Palmer Ridge High School",
      seedMarkRaw: "8:09.00",
      seedRank: 1,
      relayMembers: ["A", "B", "C", "D"],
    },
  ];
  const heats = __testing.buildEstimatedHeats({
    category: "Relay",
    entries: relayEntries,
    gender: "Boys",
    event: "4x800m Relay",
    heatSizes: [1],
    fastSections: 1,
  });
  const relayRecommendation = recommendation({
    event: "4x800m Relay",
    gender: "Boys",
    eventLabel: "Boys 4x800m Relay",
    athleteName: "Palmer Ridge High School Relay",
    school: "Palmer Ridge High School",
    markRaw: "8:09.00",
    rank: 8,
    rankLabel: "#8",
    holdProbability: 80,
    stateProbability: 88,
    improveProbability: 44,
  });
  const opportunities = __testing.buildStateMarkOpportunities({
    category: "Relay",
    entries: relayEntries,
    estimatedHeats: heats,
    focusTeam: "Palmer Ridge High School",
    recommendationMap: __testing.recommendationSignals([relayRecommendation]),
    profileMap: __testing.athleteProfiles([relayRecommendation]),
    prediction: prediction({
      event: "4x800m Relay",
      gender: "Boys",
      eventLabel: "Boys 4x800m Relay",
      predictedCutoffRaw: "8:18.00",
      predictedCutoffValue: 498,
    }),
    gender: "Boys",
    event: "4x800m Relay",
  });

  assert.equal(opportunities[0]?.isRelay, true);
  assert.match(opportunities[0]?.reason ?? "", /repeatability/i);
});
