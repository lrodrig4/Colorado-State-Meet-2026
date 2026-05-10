import assert from "node:assert/strict";
import test from "node:test";
import type { EventKey, Gender, Performance } from "@/types/domain";
import { buildTeamDepthChart } from "@/lib/services/depthChart";
import { getSeasonBestRankings } from "@/lib/services/ranking";

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
    meetDate: "2026-05-04",
    source: "milesplit",
    verificationStatus: "verified",
    ...overrides,
  };
}

test("JV and depth-only marks feed depth charts but not CHSAA qualifying rankings", () => {
  const rows = [
    performance("LP JV Runner", "Boys", "400m", "51.00", 51, {
      meetName: "LP JV Championship",
      verificationStatus: "needs_review",
    }),
    performance("Explicit Depth Runner", "Boys", "400m", "52.00", 52, {
      verificationStatus: "depth_only",
    }),
    performance("Qualifying Runner", "Boys", "400m", "53.00", 53),
  ];

  const ranking = getSeasonBestRankings(rows, {
    classification: "4A",
    gender: "Boys",
    event: "400m",
  });
  const depth = buildTeamDepthChart(
    rows,
    "4A",
    "Lewis-Palmer High School",
  );
  const boys400 = depth.eventCharts.find(
    (chart) => chart.gender === "Boys" && chart.event === "400m",
  );

  assert.deepEqual(
    ranking.top18.map((row) => row.athleteName),
    ["Qualifying Runner"],
  );
  assert.ok(boys400);
  assert.deepEqual(
    boys400.entries.map((row) => `${row.athleteName}:${row.fitLabel}`),
    [
      "LP JV Runner:Depth-only mark",
      "Explicit Depth Runner:Depth-only mark",
      "Qualifying Runner:Verified mark",
    ],
  );
});
