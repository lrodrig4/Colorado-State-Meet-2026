import test from "node:test";
import assert from "node:assert/strict";
import { current5ABrowserRankingPerformances } from "@/lib/data/current5ABrowserRankings.generated";
import { parseMileSplitApiResults } from "@/lib/services/milesplitApiResults";
import {
  buildMileSplitRankingUrl,
  parseMileSplitRankingPage,
} from "@/lib/services/milesplitRankings";
import { parseMileSplitRawResults } from "@/lib/services/milesplitRawResults";

test("builds class-specific MileSplit ranking urls", () => {
  const fourA = buildMileSplitRankingUrl("4A", "Boys", "3200m", 1);
  const fiveA = buildMileSplitRankingUrl("5A", "Boys", "3200m", 1);

  assert.match(fourA, /league=9124/);
  assert.match(fiveA, /league=9125/);
  assert.doesNotMatch(fiveA, /league=9124/);
});

test("detects locked MileSplit ranking pages", () => {
  const parsed = parseMileSplitRankingPage(
    `
    <section id="eventRankings">
      <p>To see these rankings, join MileSplit PRO.</p>
      <table><tbody><tr><td class="time">XXXXXX</td><td class="name"><div class="athlete">Rick James Astley</div></td></tr></tbody></table>
    </section>
    `,
    {
      gender: "Boys",
      event: "1600m",
      sourceUrl:
        "https://co.milesplit.com/rankings/events/high-school-boys/outdoor-track-and-field/1600m?year=2026&accuracy=legal&league=9124",
    },
  );

  assert.equal(parsed.locked, true);
  assert.equal(parsed.performances.length, 0);
});

test("loads trusted-browser 5A top-50 rows for every event and gender", () => {
  const eventGenderKeys = new Set(
    current5ABrowserRankingPerformances.map(
      (performance) => `${performance.gender}|${performance.event}`,
    ),
  );
  const castleView3200 = current5ABrowserRankingPerformances.filter(
    (performance) =>
      performance.gender === "Boys" &&
      performance.event === "3200m" &&
      performance.school === "Castle View High School",
  );

  assert.equal(current5ABrowserRankingPerformances.length, 1800);
  assert.equal(eventGenderKeys.size, 36);
  assert.equal(
    current5ABrowserRankingPerformances.every(
      (performance) =>
        performance.classification === "5A" &&
        performance.classificationVerified &&
        performance.source === "milesplit",
    ),
    true,
  );
  assert.equal(castleView3200.length, 6);
  assert.deepEqual(
    ["Wyatt Dann", "Evan Dann", "Nathaniel Bartunek"].every((athleteName) =>
      castleView3200.some((performance) => performance.athleteName === athleteName),
    ),
    true,
  );
});

test("parses MileSplit raw 4A individual and relay rows", () => {
  const parsed = parseMileSplitRawResults(
    `
    <div id="meetResultsBody"><pre>
Boys 1600 meter Run 4A
Finals
=========================================================================================================
      NAME                          YR   TEAM                               MARK           H#    WIND
=======================================================================================================
1     Jonas Fontaine                11   Littleton High School              4:21.53        1

Boys 4x800 Meter Relay 4A
Finals
=========================================================================================================
      NAME                          YR   TEAM                               MARK           H#    WIND
=======================================================================================================
1                                        Evergreen High School              8:16.86        1
    </pre></div>
    `,
    {
      meetName: "Jeffco 4A/5A League Championships",
      meetDate: "2026-05-02",
      sourceUrl:
        "https://co.milesplit.com/meets/724541-jeffco-4a5a-league-championships-2026/results/1294955/raw",
      supplementalWindow: "2026-04-27 through 2026-05-02",
    },
  );

  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].athleteName, "Jonas Fontaine");
  assert.equal(parsed[0].school, "Littleton High School");
  assert.equal(parsed[0].classification, "4A");
  assert.equal(parsed[0].classificationVerified, true);
  assert.equal(parsed[1].athleteName, "Evergreen High School Relay");
  assert.equal(parsed[1].event, "4x800m Relay");
});

test("parses MileSplit formatted API rows and flags missing wind review", () => {
  const parsed = parseMileSplitApiResults(
    [
      {
        id: 1,
        firstName: "Tavion",
        lastName: "Cross",
        genderName: "Male",
        gradYear: 2027,
        eventName: "100 Meter Dash",
        roundName: "Finals",
        teamName: "Mesa Ridge High School",
        mark: "10.84",
        windReading: "+1.80",
        statusCode: "OK",
      },
      {
        id: 2,
        firstName: "Alyssa",
        lastName: "Martin",
        genderName: "Female",
        gradYear: 2028,
        eventName: "100 Meter Dash",
        roundName: "Finals",
        teamName: "Pueblo Centennial High School",
        mark: "12.64",
        windReading: "",
        statusCode: "OK",
      },
      {
        id: 3,
        genderName: "Boys",
        eventName: "4x100 Meter Relay",
        roundName: "Finals",
        teamName: "Pueblo South High School",
        mark: "43.00",
        statusCode: "OK",
      },
      {
        id: 4,
        firstName: "Windy",
        lastName: "Jumper",
        genderName: "Female",
        gradYear: 2027,
        eventName: "Long Jump",
        roundName: "Finals",
        teamName: "Pueblo Central High School",
        mark: "18-1",
        windReading: "+2.1",
        statusCode: "OK",
      },
    ],
    {
      meetName: "The Pueblo Twilight",
      meetDate: "2026-05-01",
      sourceUrl:
        "https://co.milesplit.com/meets/712759-the-pueblo-twilight-2026/results/1294520/formatted",
      supplementalWindow: "2026-04-27 through 2026-05-02",
    },
  );

  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].athleteName, "Tavion Cross");
  assert.equal(parsed[0].event, "100m");
  assert.equal(parsed[0].grade, 11);
  assert.equal(parsed[0].verificationStatus, "verified");
  assert.equal(parsed[1].verificationStatus, "needs_review");
  assert.equal(parsed[2].athleteName, "Pueblo South High School Relay");
  assert.equal(parsed[2].event, "4x100m Relay");
  assert.equal(parsed.some((performance) => performance.athleteName === "Windy Jumper"), false);
});
