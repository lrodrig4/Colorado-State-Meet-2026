import assert from "node:assert/strict";
import test from "node:test";
import { performances } from "@/lib/data/performances";
import { applyClassifications } from "@/lib/services/classification";
import { buildLastChanceDashboard } from "@/lib/services/lastChance";
import { buildRelayChaseDecisions } from "@/lib/services/relayStrategy";
import { buildWeekendStrategy } from "@/lib/services/weekendStrategy";

function strategyFor(team: string) {
  const classified = applyClassifications(performances);
  const lastChance = buildLastChanceDashboard(classified, "4A", team);
  const relayDecisions = buildRelayChaseDecisions(classified, "4A", team);

  return buildWeekendStrategy({
    focusTeam: team,
    recommendations: lastChance.recommendations,
    relayDecisions,
  });
}

test("builds weekend strategy from the selected focus team", () => {
  const lewisPalmer = strategyFor("Lewis-Palmer High School");
  const palmerRidge = strategyFor("Palmer Ridge High School");

  assert.equal(
    lewisPalmer.basisLabel,
    "Using saved team view: Lewis-Palmer High School",
  );
  assert.equal(
    palmerRidge.basisLabel,
    "Using saved team view: Palmer Ridge High School",
  );
  assert.notDeepEqual(
    lewisPalmer.athletePlans.map((plan) => plan.athleteName).slice(0, 3),
    palmerRidge.athletePlans.map((plan) => plan.athleteName).slice(0, 3),
  );
});

test("feeds the weekend flowchart every selected-team top-50 individual row and every relay", () => {
  const strategy = strategyFor("Lewis-Palmer High School");
  const relayLabels = new Set(strategy.relayPlans.map((plan) => plan.relayLabel));

  assert.equal(strategy.relayPlans.length, 8);
  assert.deepEqual([...relayLabels].sort(), [
    "Boys 4x100m Relay",
    "Boys 4x200m Relay",
    "Boys 4x400m Relay",
    "Boys 4x800m Relay",
    "Girls 4x100m Relay",
    "Girls 4x200m Relay",
    "Girls 4x400m Relay",
    "Girls 4x800m Relay",
  ]);
  assert.equal(
    strategy.athletePlans.some(
      (plan) => plan.rankLabel.startsWith("B") && plan.eventLabel.includes("Boys"),
    ),
    true,
  );
});

test("protects Lewis-Palmer senior individual path before 4x800 or 4x400 chase", () => {
  const strategy = strategyFor("Lewis-Palmer High School");
  const noah1600 = strategy.athletePlans.find(
    (plan) =>
      plan.athleteName === "Noah Thompson" &&
      plan.eventLabel === "Boys 1600m Run",
  );
  const boysFourByEight = strategy.relayPlans.find(
    (plan) => plan.relayLabel === "Boys 4x800m Relay",
  );
  const boysFourByFour = strategy.relayPlans.find(
    (plan) => plan.relayLabel === "Boys 4x400m Relay",
  );

  assert.ok(noah1600);
  assert.equal(noah1600.gradeLabel, "Senior");
  assert.equal(noah1600.primarySlotLabel, "HOKA St. Vrain, Friday 8:35");
  assert.match(noah1600.instruction, /cleanest fresh attempt/);

  assert.ok(boysFourByEight);
  assert.equal(boysFourByEight.call, "Protect individuals");
  assert.match(boysFourByEight.recommendation, /Protect Noah Thompson/);
  assert.equal(
    boysFourByEight.athleteImpacts.some(
      (impact) =>
        impact.athleteName === "Noah Thompson" &&
        impact.opportunityLabel === "High individual cost",
    ),
    true,
  );

  assert.ok(boysFourByFour);
  assert.equal(boysFourByFour.call, "Protect individuals");
  assert.match(boysFourByFour.recommendation, /individual path first/);
});

test("uses Friday as fresh first shot and Saturday as backup in coach notes", () => {
  const strategy = strategyFor("Lewis-Palmer High School");

  assert.equal(
    strategy.scheduleNotes.some((note) => note.includes("St. Vrain is Friday")),
    true,
  );
  assert.equal(
    strategy.scheduleNotes.some((note) => note.includes("Teddy's is Saturday")),
    true,
  );
  assert.equal(
    strategy.defaultAnswerBullets.some((bullet) =>
      bullet.includes("Switching and saving a different focus school"),
    ),
    true,
  );
});

test("uses finalized St. Vrain entries before recommending Friday starts", () => {
  const classified = applyClassifications(performances);
  const lastChance = buildLastChanceDashboard(
    classified,
    "4A",
    "Lewis-Palmer High School",
  );
  const relayDecisions = buildRelayChaseDecisions(
    classified,
    "4A",
    "Lewis-Palmer High School",
  );
  const strategy = buildWeekendStrategy({
    focusTeam: "Lewis-Palmer High School",
    recommendations: lastChance.recommendations,
    relayDecisions,
    finalizedHokaEntries: [
      {
        gender: "Boys",
        event: "800m",
        athleteOrRelay: "Example Entered Athlete",
        school: "Example High School",
      },
    ],
  });
  const noah1600 = strategy.athletePlans.find(
    (plan) =>
      plan.athleteName === "Noah Thompson" &&
      plan.eventLabel === "Boys 1600m Run",
  );

  assert.ok(noah1600);
  assert.equal(noah1600.primarySlotLabel?.includes("St. Vrain"), false);
  assert.equal(noah1600.primarySlotLabel?.includes("Saturday"), true);
  assert.match(noah1600.reason, /Not in the finalized St\. Vrain entries/);
  assert.equal(
    strategy.scenarioPlans
      .find((plan) => plan.id === "st-vrain-first")
      ?.entries.some((entry) => entry.athleteOrRelay === "Noah Thompson"),
    false,
  );
  assert.equal(
    strategy.hokaEventForecasts
      .find(
        (forecast) =>
          forecast.gender === "Boys" && forecast.event === "1600m",
      )
      ?.entries.some((entry) => entry.athleteOrRelay === "Noah Thompson"),
    false,
  );
});

test("creates clickable scenario branches for Friday, split weekend, Teddy only, relay, and rest plans", () => {
  const strategy = strategyFor("Lewis-Palmer High School");
  const scenarioIds = strategy.scenarioPlans.map((plan) => plan.id);

  assert.deepEqual(scenarioIds, [
    "st-vrain-first",
    "split-weekend",
    "teddy-only",
    "relay-first",
    "rest-protect",
  ]);
  assert.equal(strategy.decisionTree.length, 5);
  assert.equal(
    strategy.scenarioPlans
      .find((plan) => plan.id === "st-vrain-first")
      ?.entries.some(
        (entry) =>
          entry.athleteOrRelay === "Noah Thompson" &&
          entry.meetPlan.includes("Friday"),
      ),
    true,
  );
  assert.equal(
    strategy.scenarioPlans
      .find((plan) => plan.id === "teddy-only")
      ?.entries.some((entry) => entry.meetPlan.includes("Saturday")),
    true,
  );
  assert.equal(
    strategy.scenarioPlans
      .find((plan) => plan.id === "relay-first")
      ?.entries.some((entry) => entry.reason.includes("Protect Noah Thompson")),
    true,
  );
});

test("does not recommend back-to-back 3200 attempts and keeps secondary distance events clear", () => {
  const strategy = strategyFor("Palmer Ridge High School");
  const fridayPlan = strategy.scenarioPlans.find(
    (plan) => plan.id === "st-vrain-first",
  );
  const splitPlan = strategy.scenarioPlans.find(
    (plan) => plan.id === "split-weekend",
  );
  const teddyPlan = strategy.scenarioPlans.find(
    (plan) => plan.id === "teddy-only",
  );
  const naomi3200 = strategy.athletePlans.find(
    (plan) =>
      plan.athleteName === "Naomi Hedstrand" &&
      plan.eventLabel === "Girls 3200m Run",
  );

  assert.ok(naomi3200);
  assert.match(naomi3200.instruction, /Do not plan on racing the 3200 on back-to-back days/);
  assert.match(naomi3200.eventChoiceNote ?? "", /Best current event choice|Secondary event/);
  assert.equal(
    fridayPlan?.entries.some(
      (entry) =>
        entry.athleteOrRelay === "Naomi Hedstrand" &&
        entry.eventLabel === "Girls 3200m Run" &&
        entry.meetPlan.includes("do not repeat 3200 Saturday"),
    ),
    true,
  );
  assert.equal(
    splitPlan?.entries.some(
      (entry) =>
        entry.athleteOrRelay === "Naomi Hedstrand" &&
        entry.eventLabel === "Girls 3200m Run" &&
        entry.meetPlan.includes("Teddy 3200 only if no Friday start"),
    ),
    true,
  );
  assert.equal(
    teddyPlan?.entries.some(
      (entry) =>
        entry.athleteOrRelay === "Naomi Hedstrand" &&
        entry.eventLabel === "Girls 3200m Run",
    ),
    true,
  );
});

test("adds a rest/protect branch for safe state qualifiers", () => {
  const strategy = strategyFor("Palmer Ridge High School");
  const restPlan = strategy.scenarioPlans.find(
    (plan) => plan.id === "rest-protect",
  );

  assert.ok(restPlan);
  assert.equal(
    strategy.decisionTree.some((node) => node.scenarioId === "rest-protect"),
    true,
  );
  assert.equal(
    restPlan.entries.some(
      (entry) =>
        entry.meetPlan.includes("Rest") ||
        entry.reason.includes("controlled tune-up") ||
        entry.reason.includes("Rest"),
    ),
    true,
  );
});
