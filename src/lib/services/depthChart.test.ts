import assert from "node:assert/strict";
import test from "node:test";
import type { EventKey, Gender, Performance } from "@/types/domain";
import { buildTeamDepthChart } from "@/lib/services/depthChart";

function performance(
  athleteName: string,
  gender: Gender,
  event: EventKey,
  markRaw: string,
  markValue: number,
  overrides: Partial<Performance> = {},
): Performance {
  return {
    id: `${athleteName}-${event}`.replaceAll(/\s+/g, "-"),
    athleteName,
    gender,
    grade: 11,
    school: "Lewis-Palmer High School",
    classification: "4A",
    classificationVerified: true,
    event,
    markRaw,
    markValue,
    timingType: "FAT",
    isFAT: true,
    meetName: "Depth Test Meet",
    meetDate: "2026-05-02",
    source: "milesplit",
    verificationStatus: "verified",
    ...overrides,
  };
}

test("builds verified team depth charts by event", () => {
  const chart = buildTeamDepthChart(
    [
      performance("Fast Runner", "Boys", "400m", "50.00", 50),
      performance("Next Runner", "Boys", "400m", "51.00", 51),
      performance("Old Mark", "Boys", "400m", "52.00", 52, {
        athleteName: "Fast Runner",
        id: "old-mark",
      }),
      performance("Wrong Class", "Boys", "400m", "49.00", 49, {
        school: "Five A High School",
        classification: "5A",
      }),
    ],
    "4A",
    "Lewis-Palmer High School",
  );
  const boys400 = chart.eventCharts.find(
    (item) => item.gender === "Boys" && item.event === "400m",
  );

  assert.ok(boys400);
  assert.deepEqual(
    boys400.entries.map((entry) => `${entry.rank}:${entry.athleteName}`),
    ["1:Fast Runner", "2:Next Runner"],
  );
});

test("keeps the full team event depth beyond the state-bubble window", () => {
  const discusRows = Array.from({ length: 10 }, (_, index) =>
    performance(
      `Thrower ${index + 1}`,
      "Boys",
      "Discus",
      `${130 - index}-0`,
      (130 - index) * 12,
    ),
  );
  const chart = buildTeamDepthChart(
    discusRows,
    "4A",
    "Lewis-Palmer High School",
  );
  const boysDiscus = chart.eventCharts.find(
    (item) => item.gender === "Boys" && item.event === "Discus",
  );

  assert.ok(boysDiscus);
  assert.equal(boysDiscus.entries.length, 10);
  assert.deepEqual(
    boysDiscus.entries.slice(7).map((entry) => entry.athleteName),
    ["Thrower 8", "Thrower 9", "Thrower 10"],
  );
});

test("projects relay pools from direct and move-down marks", () => {
  const chart = buildTeamDepthChart(
    [
      performance("Open Eight", "Girls", "800m", "2:20.00", 140),
      performance("Miler One", "Girls", "1600m", "5:04.00", 304),
      performance("Miler Two", "Girls", "1600m", "5:10.00", 310),
      performance("Two Mile", "Girls", "3200m", "11:20.00", 680),
      performance("Quarter", "Girls", "400m", "59.00", 59),
    ],
    "4A",
    "Lewis-Palmer High School",
  );
  const girls4x800 = chart.relayProjections.find(
    (item) => item.gender === "Girls" && item.relay === "4x800m Relay",
  );

  assert.ok(girls4x800);
  assert.equal(girls4x800.candidates.length, 4);
  assert.equal(girls4x800.candidates[0].athleteName, "Open Eight");
  assert.ok(
    girls4x800.candidates.some((candidate) =>
      candidate.fitLabel.includes("move down"),
    ),
  );
  assert.match(girls4x800.projectedQualityLabel, /relay pool|lineup choice/i);
});
