import assert from "node:assert/strict";
import test from "node:test";
import { buildAthleteEventOutlook } from "@/lib/services/athleteOutlook";
import type { LastChanceRecommendation } from "@/lib/services/lastChance";

function recommendation(
  overrides: Partial<LastChanceRecommendation> = {},
): LastChanceRecommendation {
  const event = overrides.event ?? "1600m";
  const gender = overrides.gender ?? "Girls";
  const eventLabel = overrides.eventLabel ?? `${gender} ${event}`;
  const rank = overrides.rank ?? 12;

  return {
    id: overrides.id ?? `${event}-${rank}`,
    event,
    gender,
    grade: overrides.grade ?? 11,
    eventLabel,
    athleteName: overrides.athleteName ?? "Test Runner",
    school: overrides.school ?? "Test High School",
    rank,
    rankLabel: overrides.rankLabel ?? `#${rank}`,
    markRaw: overrides.markRaw ?? "5:00.00",
    meetName: overrides.meetName ?? "Test Meet",
    meetDate: overrides.meetDate ?? "2026-05-01",
    predictedCutoffRaw: overrides.predictedCutoffRaw ?? "5:05.00",
    predictedCutoffValue: overrides.predictedCutoffValue ?? 305,
    holdProbability: overrides.holdProbability ?? 78,
    holdProbabilityLabel: overrides.holdProbabilityLabel ?? "78%",
    holdConfidenceIntervalLabel: overrides.holdConfidenceIntervalLabel ?? "70-84%",
    holdExplanation: overrides.holdExplanation ?? "Test hold explanation.",
    stateProbability: overrides.stateProbability ?? 86,
    stateProbabilityLabel: overrides.stateProbabilityLabel ?? "86%",
    stateConfidenceIntervalLabel: overrides.stateConfidenceIntervalLabel ?? "80-90%",
    makeProbability: overrides.makeProbability ?? 86,
    probabilityLabel: overrides.probabilityLabel ?? "86%",
    confidenceIntervalLabel: overrides.confidenceIntervalLabel ?? "80-90%",
    improveProbability: overrides.improveProbability ?? 52,
    improveProbabilityLabel: overrides.improveProbabilityLabel ?? "52%",
    improveConfidenceIntervalLabel: overrides.improveConfidenceIntervalLabel ?? "44-60%",
    improveExplanation: overrides.improveExplanation ?? "Test improve explanation.",
    scratchProbability: overrides.scratchProbability ?? 4,
    scratchProbabilityLabel: overrides.scratchProbabilityLabel ?? "4%",
    scratchConfidenceIntervalLabel: overrides.scratchConfidenceIntervalLabel ?? "0-8%",
    scratchRiskLabel: overrides.scratchRiskLabel ?? "Very low",
    scratchExplanation: overrides.scratchExplanation ?? "No scratch signal.",
    expectedScratchOpenings: overrides.expectedScratchOpenings ?? 0,
    keepValue: overrides.keepValue ?? 0,
    keepValueLabel: overrides.keepValueLabel ?? "0 pts",
    scratchValue: overrides.scratchValue ?? 0,
    scratchValueLabel: overrides.scratchValueLabel ?? "0 pts",
    netScratchCall: overrides.netScratchCall ?? "Keep",
    scratchTradeoffExplanation:
      overrides.scratchTradeoffExplanation ?? "Keep by default.",
    oddsBandLabel: overrides.oddsBandLabel ?? "Likely",
    oddsExplanation: overrides.oddsExplanation ?? "Test odds explanation.",
    nearbyLabel: overrides.nearbyLabel ?? "Nearby test.",
    gapRaw: overrides.gapRaw ?? "0.10 cushion",
    gapValue: overrides.gapValue ?? -0.1,
    status: overrides.status ?? "Monitor",
    recommendation: overrides.recommendation ?? "Test recommendation.",
    priorityScore: overrides.priorityScore ?? 10,
    isFocusTeam: overrides.isFocusTeam ?? false,
  };
}

test("builds an athlete outlook from same athlete, school, and gender only", () => {
  const selected = recommendation({
    id: "selected-1600",
    event: "1600m",
    eventLabel: "Girls 1600m Run",
    rank: 12,
  });
  const rows = [
    selected,
    recommendation({
      id: "same-athlete-3200",
      event: "3200m",
      eventLabel: "Girls 3200m Run",
      rank: 19,
      rankLabel: "B1",
      stateProbability: 48,
      stateProbabilityLabel: "48%",
    }),
    recommendation({
      id: "other-school",
      school: "Other High School",
      event: "800m",
      eventLabel: "Girls 800m Run",
      rank: 8,
    }),
    recommendation({
      id: "boys-same-name",
      gender: "Boys",
      eventLabel: "Boys 1600m Run",
      rank: 7,
    }),
  ];

  const outlook = buildAthleteEventOutlook(rows, selected);

  assert.ok(outlook);
  assert.equal(outlook.events.length, 2);
  assert.equal(outlook.qualifyingSummary, "1 state-qualified event · 1 bubble chase");
  assert.deepEqual(
    outlook.events.map((event) => event.eventLabel).sort(),
    ["Girls 1600m Run", "Girls 3200m Run"],
  );
});

test("protects scoring events in the likely plan", () => {
  const selected = recommendation({
    id: "selected-800",
    event: "800m",
    eventLabel: "Boys 800m Run",
    gender: "Boys",
    rank: 4,
    rankLabel: "#4",
    stateProbability: 98,
    stateProbabilityLabel: "98%",
  });
  const rows = [
    selected,
    recommendation({
      id: "bubble-1600",
      event: "1600m",
      eventLabel: "Boys 1600m Run",
      gender: "Boys",
      rank: 21,
      rankLabel: "B3",
      stateProbability: 34,
      stateProbabilityLabel: "34%",
    }),
  ];

  const outlook = buildAthleteEventOutlook(rows, selected);

  assert.ok(outlook);
  assert.match(outlook.likelyPlan, /Prioritize Boys 800m Run/);
  assert.match(outlook.likelyPlan, /Scoring entries beat speculative volume/);
});

test("marks a fast relay as most likely to run when the athlete is in the top relay pool", () => {
  const selected = recommendation({
    id: "oliver-1600",
    athleteName: "Oliver Horton",
    school: "Coronado High School",
    gender: "Boys",
    event: "1600m",
    eventLabel: "Boys 1600m Run",
    rank: 1,
    rankLabel: "#1",
    markRaw: "4:09.00",
    stateProbability: 99,
    stateProbabilityLabel: "99%",
  });
  const rows = [
    selected,
    recommendation({
      id: "oliver-800",
      athleteName: "Oliver Horton",
      school: "Coronado High School",
      gender: "Boys",
      event: "800m",
      eventLabel: "Boys 800m Run",
      rank: 8,
      markRaw: "1:56.44",
    }),
    recommendation({
      id: "teammate-a-800",
      athleteName: "Coronado Teammate A",
      school: "Coronado High School",
      gender: "Boys",
      event: "800m",
      eventLabel: "Boys 800m Run",
      rank: 14,
      markRaw: "1:58.00",
    }),
    recommendation({
      id: "teammate-b-1600",
      athleteName: "Coronado Teammate B",
      school: "Coronado High School",
      gender: "Boys",
      event: "1600m",
      eventLabel: "Boys 1600m Run",
      rank: 18,
      markRaw: "4:20.00",
    }),
    recommendation({
      id: "teammate-c-800",
      athleteName: "Coronado Teammate C",
      school: "Coronado High School",
      gender: "Boys",
      event: "800m",
      eventLabel: "Boys 800m Run",
      rank: 24,
      markRaw: "2:00.00",
    }),
    recommendation({
      id: "coronado-4x800",
      athleteName: "Coronado High School Relay",
      school: "Coronado High School",
      gender: "Boys",
      event: "4x800m Relay",
      eventLabel: "Boys 4x800m Relay",
      rank: 5,
      rankLabel: "#5",
      markRaw: "8:03.00",
      stateProbability: 96,
      stateProbabilityLabel: "96%",
    }),
  ];

  const outlook = buildAthleteEventOutlook(rows, selected);

  assert.ok(outlook);
  assert.equal(outlook.relayOutlooks.length, 1);
  assert.equal(outlook.relayOutlooks[0].relayLabel, "Boys 4x800m Relay");
  assert.equal(outlook.relayOutlooks[0].callLabel, "Most likely to run");
  assert.match(outlook.relayOutlooks[0].reason, /Treat it as part of the state plan/);
  assert.match(outlook.likelyPlan, /plan around 4x800m Relay/);
});

test("marks relay alternates separately from primary relay legs", () => {
  const selected = recommendation({
    id: "fifth-runner-1600",
    athleteName: "Fifth Runner",
    school: "Depth High School",
    gender: "Girls",
    event: "1600m",
    eventLabel: "Girls 1600m Run",
    rank: 43,
    rankLabel: "B25",
    markRaw: "5:35.00",
    stateProbability: 8,
    stateProbabilityLabel: "8%",
  });
  const rows = [
    selected,
    ...[1, 2, 3, 4].map((rank) =>
      recommendation({
        id: `teammate-${rank}`,
        athleteName: `Depth Teammate ${rank}`,
        school: "Depth High School",
        gender: "Girls",
        event: "800m",
        eventLabel: "Girls 800m Run",
        rank,
        rankLabel: `#${rank}`,
        markRaw: `2:1${rank}.00`,
      }),
    ),
    recommendation({
      id: "depth-4x800",
      athleteName: "Depth High School Relay",
      school: "Depth High School",
      gender: "Girls",
      event: "4x800m Relay",
      eventLabel: "Girls 4x800m Relay",
      rank: 12,
      rankLabel: "#12",
      markRaw: "9:58.00",
    }),
  ];

  const outlook = buildAthleteEventOutlook(rows, selected);

  assert.ok(outlook);
  assert.equal(outlook.relayOutlooks[0].poolRank, 5);
  assert.equal(outlook.relayOutlooks[0].callLabel, "Alternate / possible leg");
});

test("does not build an individual outlook for relay rows", () => {
  const relay = recommendation({
    id: "relay",
    event: "4x800m Relay",
    eventLabel: "Boys 4x800m Relay",
    gender: "Boys",
    athleteName: "Test High School Relay",
  });

  assert.equal(buildAthleteEventOutlook([relay], relay), undefined);
});
