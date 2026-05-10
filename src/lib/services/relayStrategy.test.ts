import assert from "node:assert/strict";
import test from "node:test";
import { performances } from "@/lib/data/performances";
import { applyClassifications } from "@/lib/services/classification";
import { buildRelayChaseDecisions } from "@/lib/services/relayStrategy";

test("flags unqualified relays when a senior individual bubble runner is the trade-off", () => {
  const decisions = buildRelayChaseDecisions(
    applyClassifications(performances),
    "4A",
    "Lewis-Palmer High School",
  );
  const boysFourByEight = decisions.find(
    (decision) =>
      decision.gender === "Boys" && decision.relay === "4x800m Relay",
  );

  assert.ok(boysFourByEight);
  assert.equal(boysFourByEight.currentRankLabel, "B3");
  assert.equal(boysFourByEight.call, "Protect individuals");
  assert.equal(
    boysFourByEight.lineup.some(
      (candidate) =>
        candidate.athleteName === "Noah Thompson" &&
        candidate.gradeLabel === "Senior" &&
        candidate.opportunityCost >= 50,
    ),
    true,
  );
  assert.match(boysFourByEight.summary, /Noah Thompson/);
  assert.match(boysFourByEight.tradeoffSummary, /senior with one qualifying weekend left/i);
  assert.match(
    boysFourByEight.repeatabilityLabel,
    /Loaded qualifier|Lineup risk|Repeatable|Alternate-safe/,
  );
  assert.match(boysFourByEight.repeatabilitySummary, /Relay|Seed|Projected|lineup/i);
  assert.match(boysFourByEight.projectedPointsSwingLabel, /point/i);
  assert.match(boysFourByEight.alternateSummary ?? "", /Lower-conflict option/);
  assert.doesNotMatch(boysFourByEight.alternateSummary ?? "", /Noah Thompson/);
});
