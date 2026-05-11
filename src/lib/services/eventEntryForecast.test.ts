import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEventEntryForecast,
  forecastEventEntryRow,
} from "@/lib/services/eventEntryForecast";
import type { LastChanceRecommendation } from "@/lib/services/lastChance";

function recommendation(
  overrides: Partial<LastChanceRecommendation> = {},
): LastChanceRecommendation {
  const event = overrides.event ?? "800m";
  const gender = overrides.gender ?? "Boys";
  const rank = overrides.rank ?? 8;

  return {
    id: overrides.id ?? `${event}-${rank}`,
    event,
    gender,
    grade: overrides.grade ?? 12,
    eventLabel: overrides.eventLabel ?? `${gender} ${event}`,
    athleteName: overrides.athleteName ?? `Athlete ${rank}`,
    school: overrides.school ?? "Test High School",
    rank,
    rankLabel: overrides.rankLabel ?? `#${rank}`,
    markRaw: overrides.markRaw ?? "2:00.00",
    meetName: overrides.meetName ?? "Test Meet",
    meetDate: overrides.meetDate ?? "2026-05-01",
    predictedCutoffRaw: overrides.predictedCutoffRaw ?? "2:01.00",
    predictedCutoffValue: overrides.predictedCutoffValue ?? 121,
    holdProbability: overrides.holdProbability ?? 92,
    holdProbabilityLabel: overrides.holdProbabilityLabel ?? "92%",
    holdConfidenceIntervalLabel: overrides.holdConfidenceIntervalLabel ?? "86-96%",
    holdExplanation: overrides.holdExplanation ?? "Hold test.",
    stateProbability: overrides.stateProbability ?? 96,
    stateProbabilityLabel: overrides.stateProbabilityLabel ?? "96%",
    stateConfidenceIntervalLabel: overrides.stateConfidenceIntervalLabel ?? "90-98%",
    makeProbability: overrides.makeProbability ?? 96,
    probabilityLabel: overrides.probabilityLabel ?? "96%",
    confidenceIntervalLabel: overrides.confidenceIntervalLabel ?? "90-98%",
    improveProbability: overrides.improveProbability ?? 44,
    improveProbabilityLabel: overrides.improveProbabilityLabel ?? "44%",
    improveConfidenceIntervalLabel: overrides.improveConfidenceIntervalLabel ?? "36-52%",
    improveExplanation: overrides.improveExplanation ?? "Improve test.",
    scratchProbability: overrides.scratchProbability ?? 2,
    scratchProbabilityLabel: overrides.scratchProbabilityLabel ?? "2%",
    scratchConfidenceIntervalLabel: overrides.scratchConfidenceIntervalLabel ?? "0-8%",
    scratchRiskLabel: overrides.scratchRiskLabel ?? "Very low",
    scratchExplanation: overrides.scratchExplanation ?? "Scratch test.",
    expectedScratchOpenings: overrides.expectedScratchOpenings ?? 0,
    keepValue: overrides.keepValue ?? 2,
    keepValueLabel: overrides.keepValueLabel ?? "2 pts",
    scratchValue: overrides.scratchValue ?? 0,
    scratchValueLabel: overrides.scratchValueLabel ?? "0 pts",
    netScratchCall: overrides.netScratchCall ?? "Keep",
    scratchTradeoffExplanation:
      overrides.scratchTradeoffExplanation ?? "Keep test.",
    oddsBandLabel: overrides.oddsBandLabel ?? "Lock",
    oddsExplanation: overrides.oddsExplanation ?? "Odds test.",
    nearbyLabel: overrides.nearbyLabel ?? "Nearby test.",
    gapRaw: overrides.gapRaw ?? "0.40 cushion",
    gapValue: overrides.gapValue ?? -0.4,
    status: overrides.status ?? "Likely safe",
    recommendation: overrides.recommendation ?? "Recommendation test.",
    priorityScore: overrides.priorityScore ?? 1,
    isFocusTeam: overrides.isFocusTeam ?? false,
  };
}

test("protects high scoring seeds from weekend race guesses", () => {
  const row = forecastEventEntryRow(
    recommendation({ rank: 4, stateProbability: 98, holdProbability: 96 }),
  );

  assert.equal(row.projectedEntryLabel, "Expected to go");
  assert.equal(row.weekendRaceLabel, "State focus");
  assert.equal(row.likelyRacingThisWeekend, false);
});

test("flags thin top-18 marks as likely update candidates", () => {
  const row = forecastEventEntryRow(
    recommendation({
      rank: 17,
      stateProbability: 66,
      stateProbabilityLabel: "66%",
      holdProbability: 58,
      holdProbabilityLabel: "58%",
    }),
  );

  assert.equal(row.projectedEntryLabel, "At-risk seed");
  assert.equal(row.weekendRaceLabel, "Needs update");
  assert.equal(row.likelyRacingThisWeekend, true);
});

test("keeps relays as expected entries while describing lineup protection", () => {
  const row = forecastEventEntryRow(
    recommendation({
      event: "4x400m Relay",
      eventLabel: "Boys 4x400m Relay",
      athleteName: "Test High School Relay",
      rank: 10,
    }),
  );

  assert.equal(row.projectedEntryLabel, "Relay expected");
  assert.equal(row.weekendRaceLabel, "Protect lineup");
  assert.equal(row.likelyRacingThisWeekend, false);
});

test("summarizes the top 18 event field", () => {
  const forecast = buildEventEntryForecast([
    recommendation({ id: "one", rank: 1 }),
    recommendation({
      id: "thin",
      rank: 18,
      stateProbability: 64,
      holdProbability: 54,
    }),
    recommendation({ id: "bubble", rank: 19 }),
  ]);

  assert.equal(forecast.entries.length, 2);
  assert.equal(forecast.expectedEntries, 1);
  assert.equal(forecast.coachCallEntries, 1);
  assert.equal(forecast.likelyWeekendRacers, 1);
  assert.match(forecast.summary, /1 expected entries/);
});
