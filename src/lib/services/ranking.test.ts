import assert from "node:assert/strict";
import test from "node:test";
import type {
  EventKey,
  Gender,
  Performance,
  SourceKind,
  VerificationStatus,
} from "@/types/domain";
import { getSeasonBestRankings } from "@/lib/services/ranking";

function performance(seed: {
  id: string;
  athleteName: string;
  gender?: Gender;
  event?: EventKey;
  markRaw: string;
  markValue: number;
  school?: string;
  source?: SourceKind;
  meetName?: string;
  verificationStatus?: VerificationStatus;
}): Performance {
  const event = seed.event ?? "1600m";

  return {
    id: seed.id,
    athleteName: seed.athleteName,
    gender: seed.gender ?? "Boys",
    grade: 12,
    school: seed.school ?? "Castle View High School",
    classification: "5A",
    classificationVerified: true,
    event,
    markRaw: seed.markRaw,
    markValue: seed.markValue,
    timingType: event.includes("Relay") ? "FAT" : "FAT",
    isFAT: true,
    meetName: seed.meetName ?? "Source Repair Meet",
    meetDate: "2026-05-02",
    source: seed.source ?? "milesplit",
    verificationStatus: seed.verificationStatus ?? "verified",
  };
}

test("ranking reconciliation keeps the best source mark per 5A athlete", () => {
  const ranking = getSeasonBestRankings(
    [
      performance({
        id: "milesplit-same-athlete",
        athleteName: "Same Athlete",
        markRaw: "4:20.00",
        markValue: 260,
        source: "milesplit",
      }),
      performance({
        id: "maxpreps-same-athlete",
        athleteName: "Same Athlete",
        markRaw: "4:18.00",
        markValue: 258,
        source: "maxpreps",
      }),
      performance({
        id: "maxpreps-only",
        athleteName: "MaxPreps Only",
        markRaw: "4:19.00",
        markValue: 259,
        source: "maxpreps",
      }),
      performance({
        id: "milesplit-only",
        athleteName: "MileSplit Only",
        markRaw: "4:21.00",
        markValue: 261,
        source: "milesplit",
      }),
    ],
    {
      classification: "5A",
      gender: "Boys",
      event: "1600m",
    },
  );

  assert.deepEqual(
    ranking.top18.map((row) => `${row.athleteName}:${row.markRaw}:${row.source}`),
    [
      "Same Athlete:4:18.00:maxpreps",
      "MaxPreps Only:4:19.00:maxpreps",
      "MileSplit Only:4:21.00:milesplit",
    ],
  );
});

test("ranking reconciliation dedupes 5A relay teams by school and event", () => {
  const ranking = getSeasonBestRankings(
    [
      performance({
        id: "castle-view-relay-slow",
        athleteName: "Castle View High School Relay",
        event: "4x800m Relay",
        markRaw: "8:10.00",
        markValue: 490,
      }),
      performance({
        id: "castle-view-relay-fast",
        athleteName: "Castle View High School Relay",
        event: "4x800m Relay",
        markRaw: "8:05.00",
        markValue: 485,
        source: "maxpreps",
      }),
    ],
    {
      classification: "5A",
      gender: "Boys",
      event: "4x800m Relay",
    },
  );

  assert.equal(ranking.top18.length, 1);
  assert.equal(ranking.top18[0]?.markRaw, "8:05.00");
  assert.equal(ranking.excluded[0]?.markRaw, "8:10.00");
});

test("ranking reconciliation collapses same-mark last-name-only aliases", () => {
  const ranking = getSeasonBestRankings(
    [
      performance({
        id: "last-name-only",
        athleteName: "Schimmelpfennig",
        markRaw: "5:01.81",
        markValue: 301.81,
      }),
      performance({
        id: "full-name",
        athleteName: "Izzy Schimmelpfennig",
        markRaw: "5:01.81",
        markValue: 301.81,
        source: "official_timing",
      }),
    ],
    {
      classification: "5A",
      gender: "Boys",
      event: "1600m",
    },
  );

  assert.equal(ranking.top18.length, 1);
  assert.equal(ranking.top18[0]?.athleteName, "Izzy Schimmelpfennig");
  assert.equal(ranking.excluded[0]?.athleteName, "Schimmelpfennig");
});

test("ranking reconciliation collapses one-character first-name typos", () => {
  const ranking = getSeasonBestRankings(
    [
      performance({
        id: "slow-typo",
        athleteName: "Elizabet Roberts",
        school: "Roosevelt High School",
        markRaw: "5:11.68",
        markValue: 311.68,
      }),
      performance({
        id: "fast-canonical",
        athleteName: "Elizabeth Roberts",
        school: "Roosevelt High School",
        markRaw: "5:01.71",
        markValue: 301.71,
        source: "maxpreps",
      }),
    ],
    {
      classification: "5A",
      gender: "Boys",
      event: "1600m",
    },
  );

  assert.equal(ranking.top18.length, 1);
  assert.equal(ranking.top18[0]?.athleteName, "Elizabeth Roberts");
  assert.equal(ranking.excluded[0]?.athleteName, "Elizabet Roberts");
});

test("ranking excludes JV and depth-only marks from CHSAA qualifying lists", () => {
  const ranking = getSeasonBestRankings(
    [
      performance({
        id: "lp-jv-fast",
        athleteName: "Depth Runner",
        markRaw: "4:10.00",
        markValue: 250,
        meetName: "LP JV Championship",
      }),
      performance({
        id: "depth-only-fast",
        athleteName: "Depth Only Runner",
        markRaw: "4:11.00",
        markValue: 251,
        verificationStatus: "depth_only",
      }),
      performance({
        id: "qualifying-mark",
        athleteName: "Qualifying Runner",
        markRaw: "4:20.00",
        markValue: 260,
      }),
    ],
    {
      classification: "5A",
      gender: "Boys",
      event: "1600m",
    },
  );

  assert.deepEqual(
    ranking.top18.map((row) => row.athleteName),
    ["Qualifying Runner"],
  );
  assert.deepEqual(
    ranking.excluded.map((row) => row.athleteName).sort(),
    ["Depth Only Runner", "Depth Runner"],
  );
});
