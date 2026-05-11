import assert from "node:assert/strict";
import test from "node:test";
import type { Performance, RankingResult, RankingRow } from "@/types/domain";
import {
  buildCutoffPrediction,
  buildLastChanceDashboard,
  buildRecommendation,
} from "@/lib/services/lastChance";

function markRaw(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = value - minutes * 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
}

function row(rank: number, markValue: number): RankingRow {
  return {
    id: `row-${rank}`,
    athleteName: `Runner ${rank}`,
    gender: "Boys",
    grade: 12,
    school: rank === 19 ? "Palmer Ridge High School" : "Niwot High School",
    classification: "4A",
    classificationVerified: true,
    event: "800m",
    markRaw: markRaw(markValue),
    markValue,
    timingType: "FAT",
    isFAT: true,
    meetName: "Test Meet",
    meetDate: "2026-05-01",
    source: "milesplit",
    verificationStatus: "verified",
    rank,
    isBubble: rank > 18,
  };
}

function ranking(): RankingResult {
  const rows = Array.from({ length: 24 }, (_, index) => {
    const rank = index + 1;
    return row(rank, 115.93 + rank * 0.05);
  });

  return {
    classification: "4A",
    event: "800m",
    gender: "Boys",
    top18: rows.slice(0, 18),
    bubble: rows.slice(18),
    excluded: [],
  };
}

function performanceFromRow(source: RankingRow): Performance {
  return {
    id: source.id,
    athleteName: source.athleteName,
    gender: source.gender,
    grade: source.grade,
    school: source.school,
    classification: source.classification,
    classificationVerified: source.classificationVerified,
    event: source.event,
    markRaw: source.markRaw,
    markValue: source.markValue,
    timingType: source.timingType,
    isFAT: source.isFAT,
    meetName: source.meetName,
    meetDate: source.meetDate,
    source: source.source,
    sourceUrl: source.sourceUrl,
    verificationStatus: source.verificationStatus,
    notes: source.notes,
  };
}

const known4ASchools = [
  "Adams City High School",
  "Littleton High School",
  "Pueblo East High School",
  "Air Academy High School",
  "Longmont High School",
  "Aurora Central High School",
  "Lutheran High School",
  "Battle Mountain High School",
  "Mead High School",
  "Rifle High School",
  "Canon City High School",
  "Mesa Ridge High School",
  "Roosevelt High School",
  "Cheyenne Mountain High School",
  "Mitchell High School",
  "Sand Creek High School",
  "Conifer Senior High School",
  "Severance High School",
  "Lewis-Palmer High School",
  "Coronado High School",
  "Silver Creek High School",
  "Discovery Canyon Campus High School",
  "Niwot (CO) High School",
  "Palmer Ridge High School",
  "Pueblo West High School",
  "Summit High School",
  "Thompson Valley High School",
  "Widefield High School",
];

function syntheticPerformance(
  event: Performance["event"],
  rank: number,
  markValue: number,
  overrides: Partial<Performance> = {},
): Performance {
  const athleteName = overrides.athleteName ?? `${event} Athlete ${rank}`;
  const school =
    overrides.school ?? known4ASchools[(rank - 1) % known4ASchools.length];

  return {
    id: `${event}-${rank}-${athleteName}`.replaceAll(/\s+/g, "-"),
    athleteName,
    gender: overrides.gender ?? "Boys",
    grade: overrides.grade ?? 12,
    school,
    classification: overrides.classification ?? "4A",
    classificationVerified: overrides.classificationVerified ?? true,
    event,
    markRaw: overrides.markRaw ?? markRaw(markValue),
    markValue,
    timingType: overrides.timingType ?? "FAT",
    isFAT: overrides.isFAT ?? true,
    meetName: overrides.meetName ?? "Synthetic State Model Meet",
    meetDate: overrides.meetDate ?? "2026-05-01",
    source: overrides.source ?? "milesplit",
    sourceUrl: overrides.sourceUrl,
    verificationStatus: overrides.verificationStatus ?? "verified",
    notes: overrides.notes,
  };
}

function syntheticEventRows(
  event: Performance["event"],
  baseMark: number,
  overridesByRank: Record<number, Partial<Performance>> = {},
  count = 18,
) {
  return Array.from({ length: count }, (_, index) => {
    const rank = index + 1;
    return syntheticPerformance(event, rank, baseMark + rank, overridesByRank[rank]);
  });
}

function syntheticFieldRows(
  event: Performance["event"],
  baseMark: number,
  overridesByRank: Record<number, Partial<Performance>> = {},
  count = 18,
) {
  return Array.from({ length: count }, (_, index) => {
    const rank = index + 1;
    const markValue = baseMark - rank;
    return syntheticPerformance(event, rank, markValue, {
      markRaw: `${markValue}`,
      ...overridesByRank[rank],
    });
  });
}

function calibrationRanking(
  event: Performance["event"],
  gender: Performance["gender"],
): RankingResult {
  const rows = syntheticEventRows(
    event,
    250,
    Object.fromEntries(
      Array.from({ length: 24 }, (_, index) => [
        index + 1,
        {
          gender,
          classification: "2A" as const,
        },
      ]),
    ),
    24,
  ).map((performance, index) => ({
    ...performance,
    rank: index + 1,
    isBubble: index >= 18,
  }));

  return {
    classification: "2A",
    event,
    gender,
    top18: rows.slice(0, 18),
    bubble: rows.slice(18),
    excluded: [],
  };
}

test("predicts a faster time-event cutoff from rank spread", () => {
  const prediction = buildCutoffPrediction(ranking());

  assert.ok(prediction);
  assert.equal(prediction.currentCutoffRaw, "1:56.83");
  assert.ok(prediction.predictedCutoffValue < 116.83);
  assert.equal(prediction.confidence, "High");
  assert.ok(prediction.confidenceScore >= 80);
  assert.match(prediction.confidenceScoreLabel, /\/100$/);
  assert.equal(prediction.historicalYearCount, 8);
  assert.match(prediction.sourceCoverageLabel, /8 CHSAA seed-cut years/);
  assert.ok((prediction.historicalAverageSourceConfidence ?? 0) < 95);
  assert.match(prediction.historicalCaveatLabel ?? "", /2025/);
});

test("applies Top 18 backtest calibration to volatile gender-event cutoffs", () => {
  const boysRanking = calibrationRanking("1600m", "Boys");
  const girlsRanking = calibrationRanking("1600m", "Girls");
  const boysPrediction = buildCutoffPrediction(boysRanking);
  const girlsPrediction = buildCutoffPrediction(girlsRanking);

  assert.ok(boysPrediction);
  assert.ok(girlsPrediction);
  assert.equal(boysPrediction.historicalYearCount, 0);
  assert.equal(girlsPrediction.historicalYearCount, 0);
  assert.equal(girlsPrediction.predictedCutoffValue < boysPrediction.predictedCutoffValue, true);
  assert.match(girlsPrediction.lateWaveSummary, /retained 44\/54/);
});

test("lowers hold odds and raises chase odds for volatile Top 18 boards", () => {
  const boysRanking = calibrationRanking("1600m", "Boys");
  const girlsRanking = calibrationRanking("1600m", "Girls");
  const boysPrediction = buildCutoffPrediction(boysRanking);
  const girlsPrediction = buildCutoffPrediction(girlsRanking);

  assert.ok(boysPrediction);
  assert.ok(girlsPrediction);

  const boysRecommendation = buildRecommendation(
    boysRanking.top18[17],
    boysPrediction,
  );
  const girlsRecommendation = buildRecommendation(
    girlsRanking.top18[17],
    girlsPrediction,
  );

  assert.equal(
    girlsRecommendation.holdProbability < boysRecommendation.holdProbability,
    true,
  );
  assert.equal(
    girlsRecommendation.improveProbability > boysRecommendation.improveProbability,
    true,
  );
  assert.match(girlsRecommendation.improveExplanation, /Backtest volatility/);
});

test("uses supplied 5A qualifier PDFs for historical cutoffs", () => {
  const rows = Array.from({ length: 26 }, (_, index) => {
    const rank = index + 1;
    return {
      ...syntheticPerformance("3200m", rank, 535 + rank * 2, {
        athleteName: `5A Runner ${rank}`,
        classification: "5A",
        school: rank === 3 ? "Castle View High School" : "Mountain Vista High School",
      }),
      rank,
      isBubble: rank > 18,
    };
  });
  const prediction = buildCutoffPrediction({
    classification: "5A",
    event: "3200m",
    gender: "Boys",
    top18: rows.slice(0, 18),
    bubble: rows.slice(18),
    excluded: [],
  });

  assert.ok(prediction);
  assert.equal(prediction.historicalYearCount, 7);
  assert.equal(prediction.historicalBestCutoffRaw, "9:24.80");
  assert.equal(prediction.historicalBestCutoffYear, 2024);
  assert.equal(prediction.confidence, "High");
  assert.match(prediction.sourceCoverageLabel, /7 CHSAA seed-cut years/);
});

test("marks first bubble as a last-chance priority when close enough", () => {
  const result = ranking();
  const prediction = buildCutoffPrediction(result);

  assert.ok(prediction);
  const recommendation = buildRecommendation(
    result.bubble[0],
    prediction,
    "Palmer Ridge High School",
  );

  assert.equal(recommendation.isFocusTeam, true);
  assert.equal(recommendation.status, "Must race");
  assert.match(recommendation.probabilityLabel, /%$/);
  assert.match(recommendation.confidenceIntervalLabel, /%$/);
  assert.equal(recommendation.holdProbability, recommendation.stateProbability);
  assert.match(recommendation.holdProbabilityLabel, /%$/);
  assert.match(recommendation.stateProbabilityLabel, /%$/);
  assert.match(recommendation.gapRaw, /^Needs/);
});

test("predicts scratch risk for weaker multi-event state positions", () => {
  const base = Array.from({ length: 19 }, (_, index) => row(index + 1, 115 + index));
  const performances = [
    ...base,
    {
      ...base[16],
      id: "multi-1600",
      athleteName: "Runner 17",
      event: "1600m" as const,
      markRaw: "4:14.00",
      markValue: 254,
    },
  ].map(performanceFromRow);
  const dashboard = buildLastChanceDashboard(
    performances,
    "4A",
    "Palmer Ridge High School",
  );

  assert.ok(
    dashboard.scratchPredictions.some(
      (scratch) =>
        scratch.athleteName === "Runner 17" && scratch.event === "800m",
    ),
  );
  const adjusted = dashboard.recommendations.find(
    (recommendation) =>
      recommendation.athleteName === "Runner 17" &&
      recommendation.event === "800m",
  );

  assert.ok(adjusted);
  assert.equal(adjusted.holdProbability > adjusted.stateProbability, true);
  assert.match(adjusted.scratchRiskLabel, /Low|Medium|High/);
  assert.equal(adjusted.netScratchCall, "Maybe scratch");
  assert.equal(adjusted.keepValueLabel.endsWith("pts"), true);
  assert.match(adjusted.scratchTradeoffExplanation, /keep/i);
});

test("does not auto-scratch scoring-quality distance triples with relay load", () => {
  const athlete = "Scoring Distance Triple";
  const school = "Lewis-Palmer High School";
  const performances = [
    ...syntheticEventRows("800m", 110, {
      1: { athleteName: athlete, school },
    }),
    ...syntheticEventRows("1600m", 250, {
      8: { athleteName: athlete, school },
    }),
    ...syntheticEventRows("3200m", 560, {
      3: { athleteName: athlete, school },
    }),
    ...syntheticEventRows("4x800m Relay", 500, {
      2: { athleteName: school, school },
    }),
    ...syntheticEventRows("4x400m Relay", 205, {
      2: { athleteName: school, school },
    }),
  ];

  const dashboard = buildLastChanceDashboard(performances, "4A", school);
  const eight = dashboard.recommendations.find(
    (recommendation) =>
      recommendation.athleteName === athlete &&
      recommendation.event === "800m",
  );
  const thirtyTwo = dashboard.recommendations.find(
    (recommendation) =>
      recommendation.athleteName === athlete &&
      recommendation.event === "3200m",
  );

  assert.ok(eight);
  assert.ok(thirtyTwo);
  assert.equal(eight.scratchProbability, 0);
  assert.equal(thirtyTwo.scratchRiskLabel, "Very low");
  assert.equal(thirtyTwo.scratchProbability <= 34, true);
  assert.match(
    thirtyTwo.scratchExplanation,
    /No strong scratch signal|can still contest/,
  );
});

test("protects top distance entries from scratch watch even with stronger event load", () => {
  const athlete = "Top Distance Seed";
  const school = "Coronado High School";
  const performances = [
    ...syntheticEventRows("800m", 110, {
      9: { athleteName: athlete, school },
    }),
    ...syntheticEventRows("1600m", 250, {
      2: { athleteName: athlete, school },
    }),
    ...syntheticEventRows("3200m", 560, {
      12: { athleteName: athlete, school },
    }),
    ...syntheticEventRows("4x800m Relay", 500, {
      1: { athleteName: school, school },
    }),
    ...syntheticEventRows("4x400m Relay", 205, {
      2: { athleteName: school, school },
    }),
  ];

  const dashboard = buildLastChanceDashboard(performances, "4A", school);
  const athleteRows = dashboard.recommendations.filter(
    (recommendation) => recommendation.athleteName === athlete,
  );

  assert.equal(athleteRows.length, 3);
  assert.equal(
    athleteRows.every((recommendation) => recommendation.scratchProbability === 0),
    true,
  );
  assert.equal(
    dashboard.scratchPredictions.some(
      (scratch) => scratch.athleteName === athlete,
    ),
    false,
  );
});

test("keeps clearly weaker 3200 scratch risk high when 800 and 1600 are much stronger", () => {
  const athlete = "Mid Distance Priority";
  const school = "Coronado High School";
  const performances = [
    ...syntheticEventRows("800m", 110, {
      2: { athleteName: athlete, school },
    }),
    ...syntheticEventRows("1600m", 250, {
      5: { athleteName: athlete, school },
    }),
    ...syntheticEventRows("3200m", 560, {
      17: { athleteName: athlete, school },
    }),
    ...syntheticEventRows("4x800m Relay", 500, {
      1: { athleteName: school, school },
    }),
  ];

  const dashboard = buildLastChanceDashboard(performances, "4A", school);
  const thirtyTwo = dashboard.recommendations.find(
    (recommendation) =>
      recommendation.athleteName === athlete &&
      recommendation.event === "3200m",
  );

  assert.ok(thirtyTwo);
  assert.equal(thirtyTwo.scratchRiskLabel, "High");
  assert.equal(thirtyTwo.scratchProbability >= 65, true);
  assert.match(thirtyTwo.scratchExplanation, /800\/1600 profile likely takes priority/);
});

test("protects balanced 1600 and 3200 distance profiles from scratch watch", () => {
  const athlete = "Balanced Distance Runner";
  const school = "Timnath High School";
  const performances = [
    ...syntheticEventRows("800m", 130, {
      7: { athleteName: athlete, school },
    }),
    ...syntheticEventRows("1600m", 300, {
      10: { athleteName: athlete, school },
    }),
    ...syntheticEventRows("3200m", 660, {
      11: { athleteName: athlete, school },
    }),
    ...syntheticEventRows("4x800m Relay", 600, {
      1: { athleteName: school, school },
    }),
  ];

  const dashboard = buildLastChanceDashboard(performances, "4A", school);
  const sixteen = dashboard.recommendations.find(
    (recommendation) =>
      recommendation.athleteName === athlete &&
      recommendation.event === "1600m",
  );
  const thirtyTwo = dashboard.recommendations.find(
    (recommendation) =>
      recommendation.athleteName === athlete &&
      recommendation.event === "3200m",
  );

  assert.ok(sixteen);
  assert.ok(thirtyTwo);
  assert.equal(sixteen.scratchProbability, 0);
  assert.equal(thirtyTwo.scratchProbability, 0);
  assert.equal(
    dashboard.scratchPredictions.some(
      (scratch) =>
        scratch.athleteName === athlete &&
        (scratch.event === "1600m" || scratch.event === "3200m"),
    ),
    false,
  );
});

test("protects sprint scoring seeds from relay-driven scratch watch", () => {
  const athlete = "Sprint Medalist";
  const school = "Palmer Ridge High School";
  const performances = [
    ...syntheticEventRows("100m", 10.6, {
      10: { athleteName: athlete, school },
    }),
    ...syntheticEventRows("200m", 21.6, {
      5: { athleteName: athlete, school },
    }),
    ...syntheticEventRows("4x100m Relay", 42.2, {
      1: { athleteName: school, school },
    }),
    ...syntheticEventRows("4x200m Relay", 88.9, {
      1: { athleteName: school, school },
    }),
    ...syntheticEventRows("4x400m Relay", 204, {
      1: { athleteName: school, school },
    }),
  ];

  const dashboard = buildLastChanceDashboard(performances, "4A", school);
  const two = dashboard.recommendations.find(
    (recommendation) =>
      recommendation.athleteName === athlete &&
      recommendation.event === "200m",
  );

  assert.ok(two);
  assert.equal(two.scratchProbability, 0);
  assert.equal(
    dashboard.scratchPredictions.some(
      (scratch) => scratch.athleteName === athlete && scratch.event === "200m",
    ),
    false,
  );
});

test("keeps normal throws off scratch watch", () => {
  const athlete = "Two Throw Scorer";
  const school = "Palmer Ridge High School";
  const performances = [
    ...syntheticFieldRows("Shot Put", 600, {
      3: { athleteName: athlete, school, markRaw: "49-9" },
    }),
    ...syntheticFieldRows("Discus", 1700, {
      15: { athleteName: athlete, school, markRaw: "140-5" },
    }),
  ];

  const dashboard = buildLastChanceDashboard(performances, "4A", school);
  const discus = dashboard.recommendations.find(
    (recommendation) =>
      recommendation.athleteName === athlete &&
      recommendation.event === "Discus",
  );

  assert.ok(discus);
  assert.equal(discus.scratchProbability, 0);
  assert.equal(discus.scratchRiskLabel, "Very low");
  assert.equal(
    dashboard.scratchPredictions.some(
      (scratch) => scratch.athleteName === athlete,
    ),
    false,
  );
});

test("does not project relay scratches or scratch pull-ins for relay events", () => {
  const school = "Palmer Ridge High School";
  const performances = [
    ...syntheticEventRows("4x400m Relay", 204, {
      3: { athleteName: school, school },
    }),
  ];

  const dashboard = buildLastChanceDashboard(performances, "4A", school);
  const relay = dashboard.recommendations.find(
    (recommendation) =>
      recommendation.school === school &&
      recommendation.event === "4x400m Relay",
  );

  assert.ok(relay);
  assert.equal(relay.scratchProbability, 0);
  assert.equal(relay.scratchConfidenceIntervalLabel, "0-2%");
  assert.equal(relay.expectedScratchOpenings, 0);
  assert.equal(relay.netScratchCall, "Keep");
  assert.equal(relay.scratchValue, 0);
  assert.match(relay.scratchExplanation, /Relays are treated as declared/);
  assert.equal(
    dashboard.scratchPredictions.some((scratch) => scratch.event === "4x400m Relay"),
    false,
  );
});

test("uses adjacent distance marks to raise breakthrough odds", () => {
  const athlete = "Range Profile Runner";
  const school = "Lewis-Palmer High School";
  const targetRows = syntheticEventRows(
    "3200m",
    560,
    {
      20: {
        athleteName: athlete,
        school,
        markRaw: "9:40.00",
        markValue: 580,
      },
    },
    24,
  );
  const sourceRows = syntheticEventRows("1600m", 250, {
    1: {
      athleteName: athlete,
      school,
      markRaw: "4:00.00",
      markValue: 240,
    },
  });
  const withoutProfile = buildLastChanceDashboard(targetRows, "4A", school);
  const withProfile = buildLastChanceDashboard(
    [...targetRows, ...sourceRows],
    "4A",
    school,
  );
  const before = withoutProfile.recommendations.find(
    (recommendation) =>
      recommendation.athleteName === athlete &&
      recommendation.event === "3200m",
  );
  const after = withProfile.recommendations.find(
    (recommendation) =>
      recommendation.athleteName === athlete &&
      recommendation.event === "3200m",
  );

  assert.ok(before);
  assert.ok(after);
  assert.equal(after.improveProbability > before.improveProbability, true);
  assert.equal(after.stateProbability > before.stateProbability, true);
  assert.match(after.oddsExplanation, /Range profile/);
  assert.match(after.recommendation, /real upside/);
});
