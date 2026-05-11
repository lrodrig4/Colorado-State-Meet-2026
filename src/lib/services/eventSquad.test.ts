import assert from "node:assert/strict";
import test from "node:test";
import type {
  Classification,
  EventKey,
  Gender,
  Performance,
  SourceKind,
  VerificationStatus,
} from "@/types/domain";
import { buildEventSquadRanking } from "@/lib/services/eventSquad";

function performance(seed: {
  id: string;
  athleteName: string;
  markRaw: string;
  markValue: number;
  school?: string;
  event?: EventKey;
  gender?: Gender;
  classification?: Classification;
  source?: SourceKind;
  verificationStatus?: VerificationStatus;
}): Performance {
  const event = seed.event ?? "1600m";

  return {
    id: seed.id,
    athleteName: seed.athleteName,
    gender: seed.gender ?? "Boys",
    grade: 12,
    school: seed.school ?? "Niwot High School",
    classification: seed.classification ?? "4A",
    classificationVerified: true,
    event,
    markRaw: seed.markRaw,
    markValue: seed.markValue,
    timingType: event === "Long Jump" ? "Field" : "FAT",
    isFAT: event !== "Long Jump",
    meetName: "Test Invite",
    meetDate: "2026-05-01",
    source: seed.source ?? "milesplit",
    verificationStatus: seed.verificationStatus ?? "verified",
  };
}

test("ranks schools by top-four average in a Colorado event squad", () => {
  const ranking = buildEventSquadRanking(
    [
      performance({ id: "a1", athleteName: "A One", markRaw: "4:20.00", markValue: 260 }),
      performance({ id: "a2", athleteName: "A Two", markRaw: "4:21.00", markValue: 261 }),
      performance({ id: "a3", athleteName: "A Three", markRaw: "4:22.00", markValue: 262 }),
      performance({ id: "a4", athleteName: "A Four", markRaw: "4:23.00", markValue: 263 }),
      performance({ id: "b1", athleteName: "B One", school: "Palmer Ridge High School", markRaw: "4:18.00", markValue: 258 }),
      performance({ id: "b2", athleteName: "B Two", school: "Palmer Ridge High School", markRaw: "4:19.00", markValue: 259 }),
      performance({ id: "b3", athleteName: "B Three", school: "Palmer Ridge High School", markRaw: "4:20.00", markValue: 260 }),
      performance({ id: "b4", athleteName: "B Four", school: "Palmer Ridge High School", markRaw: "4:21.00", markValue: 261 }),
      performance({ id: "c1", athleteName: "C One", school: "Incomplete High School", markRaw: "4:17.00", markValue: 257 }),
    ],
    { classification: "4A", event: "1600m", gender: "Boys" },
  );

  assert.deepEqual(
    ranking.squads.map((squad) => `${squad.rank}:${squad.school}:${squad.averageRaw}`),
    [
      "1:Palmer Ridge High School:4:19.50",
      "2:Niwot High School:4:21.50",
    ],
  );
  assert.equal(ranking.incompleteSquads[0]?.school, "Incomplete High School");
});

test("can rank event squads across all Colorado divisions", () => {
  const ranking = buildEventSquadRanking(
    [
      performance({ id: "a1", athleteName: "A One", markRaw: "4:20.00", markValue: 260 }),
      performance({ id: "a2", athleteName: "A Two", markRaw: "4:21.00", markValue: 261 }),
      performance({ id: "a3", athleteName: "A Three", markRaw: "4:22.00", markValue: 262 }),
      performance({ id: "a4", athleteName: "A Four", markRaw: "4:23.00", markValue: 263 }),
      performance({ id: "b1", athleteName: "B One", school: "All Class High School", classification: "5A", markRaw: "4:18.00", markValue: 258 }),
      performance({ id: "b2", athleteName: "B Two", school: "All Class High School", classification: "5A", markRaw: "4:19.00", markValue: 259 }),
      performance({ id: "b3", athleteName: "B Three", school: "All Class High School", classification: "5A", markRaw: "4:20.00", markValue: 260 }),
      performance({ id: "b4", athleteName: "B Four", school: "All Class High School", classification: "5A", markRaw: "4:21.00", markValue: 261 }),
    ],
    { classification: "All", event: "1600m", gender: "Boys" },
  );

  assert.deepEqual(
    ranking.squads.map((squad) => `${squad.rank}:${squad.school}`),
    ["1:All Class High School", "2:Niwot High School"],
  );
});

test("dedupes repeat athlete marks before building the squad", () => {
  const ranking = buildEventSquadRanking(
    [
      performance({ id: "a1-slow", athleteName: "A One", markRaw: "4:25.00", markValue: 265 }),
      performance({ id: "a1-fast", athleteName: "A One", markRaw: "4:20.00", markValue: 260, source: "maxpreps" }),
      performance({ id: "a2", athleteName: "A Two", markRaw: "4:21.00", markValue: 261 }),
      performance({ id: "a3", athleteName: "A Three", markRaw: "4:22.00", markValue: 262 }),
      performance({ id: "a4", athleteName: "A Four", markRaw: "4:23.00", markValue: 263 }),
    ],
    { classification: "4A", event: "1600m", gender: "Boys" },
  );

  assert.equal(ranking.squads.length, 1);
  assert.deepEqual(
    ranking.squads[0]?.athletes.map((athlete) => athlete.markRaw),
    ["4:20.00", "4:21.00", "4:22.00", "4:23.00"],
  );
});

test("dedupes last-name-only aliases before building the squad", () => {
  const ranking = buildEventSquadRanking(
    [
      performance({
        id: "last-name-only",
        athleteName: "Schimmelpfennig",
        school: "Timnath Middle-High School",
        gender: "Girls",
        markRaw: "5:01.81",
        markValue: 301.81,
        source: "official_timing",
      }),
      performance({
        id: "full-name",
        athleteName: "Izzy Schimmelpfennig",
        school: "Timnath Middle-High School",
        gender: "Girls",
        markRaw: "5:01.81",
        markValue: 301.81,
        source: "maxpreps",
      }),
      performance({
        id: "timnath-2",
        athleteName: "Annie Fowler",
        school: "Timnath Middle-High School",
        gender: "Girls",
        markRaw: "5:10.65",
        markValue: 310.65,
      }),
      performance({
        id: "timnath-3",
        athleteName: "Grey Jordan",
        school: "Timnath Middle-High School",
        gender: "Girls",
        markRaw: "5:29.34",
        markValue: 329.34,
      }),
    ],
    { classification: "4A", event: "1600m", gender: "Girls" },
  );

  assert.equal(ranking.squads.length, 0);
  assert.equal(ranking.incompleteSquads[0]?.athleteCount, 3);
  assert.equal(ranking.incompleteSquads[0]?.bestAthlete?.athleteName, "Izzy Schimmelpfennig");
});

test("dedupes last-name-only aliases with different marks when unambiguous", () => {
  const ranking = buildEventSquadRanking(
    [
      performance({
        id: "full-name-fast",
        athleteName: "Izzy Schimmelpfennig",
        school: "Timnath Middle-High School",
        gender: "Girls",
        markRaw: "5:01.81",
        markValue: 301.81,
        source: "maxpreps",
      }),
      performance({
        id: "last-name-only-slower",
        athleteName: "Schimmelpfennig",
        school: "Timnath Middle-High School",
        gender: "Girls",
        markRaw: "5:09.14",
        markValue: 309.14,
        source: "official_timing",
      }),
      performance({
        id: "timnath-2",
        athleteName: "Annie Fowler",
        school: "Timnath Middle-High School",
        gender: "Girls",
        markRaw: "5:10.65",
        markValue: 310.65,
      }),
      performance({
        id: "timnath-3",
        athleteName: "Grey Jordan",
        school: "Timnath Middle-High School",
        gender: "Girls",
        markRaw: "5:29.34",
        markValue: 329.34,
      }),
      performance({
        id: "timnath-4",
        athleteName: "Faith Lee",
        school: "Timnath Middle-High School",
        gender: "Girls",
        markRaw: "5:31.22",
        markValue: 331.22,
      }),
    ],
    { classification: "4A", event: "1600m", gender: "Girls" },
  );

  assert.deepEqual(
    ranking.squads[0]?.athletes.map((athlete) => athlete.athleteName),
    ["Izzy Schimmelpfennig", "Annie Fowler", "Grey Jordan", "Faith Lee"],
  );
});

test("dedupes one-character first-name typos before choosing top four", () => {
  const ranking = buildEventSquadRanking(
    [
      performance({
        id: "roberts-slow-typo",
        athleteName: "Elizabet Roberts",
        school: "Roosevelt High School",
        gender: "Girls",
        markRaw: "5:11.68",
        markValue: 311.68,
      }),
      performance({
        id: "roberts-fast",
        athleteName: "Elizabeth Roberts",
        school: "Roosevelt High School",
        gender: "Girls",
        markRaw: "5:01.71",
        markValue: 301.71,
        source: "maxpreps",
      }),
      performance({
        id: "ludington",
        athleteName: "Sydney Ludington",
        school: "Roosevelt High School",
        gender: "Girls",
        markRaw: "5:02.25",
        markValue: 302.25,
      }),
      performance({
        id: "otaibi",
        athleteName: "Noora Otaibi",
        school: "Roosevelt High School",
        gender: "Girls",
        markRaw: "5:39.12",
        markValue: 339.12,
      }),
      performance({
        id: "leibman",
        athleteName: "Abby Leibman",
        school: "Roosevelt High School",
        gender: "Girls",
        markRaw: "5:40.00",
        markValue: 340,
      }),
    ],
    { classification: "4A", event: "1600m", gender: "Girls" },
  );

  assert.deepEqual(
    ranking.squads[0]?.athletes.map((athlete) => athlete.athleteName),
    ["Elizabeth Roberts", "Sydney Ludington", "Noora Otaibi", "Abby Leibman"],
  );
});

test("dedupes common first-name variants before choosing top four", () => {
  const ranking = buildEventSquadRanking(
    [
      performance({
        id: "charles-fast",
        athleteName: "Charles Booth",
        school: "Chaparral High School",
        gender: "Boys",
        event: "100m",
        markRaw: "10.59",
        markValue: 10.59,
        source: "maxpreps",
      }),
      performance({
        id: "charlie-slower",
        athleteName: "Charlie Booth",
        school: "Chaparral High School",
        gender: "Boys",
        event: "100m",
        markRaw: "10.91",
        markValue: 10.91,
      }),
      performance({
        id: "chaparral-2",
        athleteName: "Zackary Lentell",
        school: "Chaparral High School",
        gender: "Boys",
        event: "100m",
        markRaw: "11.38",
        markValue: 11.38,
      }),
      performance({
        id: "chaparral-3",
        athleteName: "Michael McHenry",
        school: "Chaparral High School",
        gender: "Boys",
        event: "100m",
        markRaw: "11.48",
        markValue: 11.48,
      }),
      performance({
        id: "chaparral-4",
        athleteName: "Luke Booth",
        school: "Chaparral High School",
        gender: "Boys",
        event: "100m",
        markRaw: "11.65",
        markValue: 11.65,
      }),
    ],
    { classification: "4A", event: "100m", gender: "Boys" },
  );

  assert.deepEqual(
    ranking.squads[0]?.athletes.map((athlete) => athlete.athleteName),
    ["Charles Booth", "Zackary Lentell", "Michael McHenry", "Luke Booth"],
  );
});

test("dedupes known uncommon first-name misspellings before choosing top four", () => {
  const ranking = buildEventSquadRanking(
    [
      performance({
        id: "gvozden-typo",
        athleteName: "Gzodven Petrovic",
        school: "Bear Creek High School",
        gender: "Boys",
        classification: "5A",
        event: "110m Hurdles",
        markRaw: "16.22",
        markValue: 16.22,
      }),
      performance({
        id: "gvozden-full",
        athleteName: "Gvozden Petrovic",
        school: "Bear Creek High School",
        gender: "Boys",
        classification: "5A",
        event: "110m Hurdles",
        markRaw: "16.36",
        markValue: 16.36,
        source: "maxpreps",
      }),
      performance({
        id: "bear-creek-2",
        athleteName: "Caelo Sandoval",
        school: "Bear Creek High School",
        gender: "Boys",
        classification: "5A",
        event: "110m Hurdles",
        markRaw: "15.84",
        markValue: 15.84,
      }),
      performance({
        id: "bear-creek-3",
        athleteName: "Dylan Thomas",
        school: "Bear Creek High School",
        gender: "Boys",
        classification: "5A",
        event: "110m Hurdles",
        markRaw: "16.48",
        markValue: 16.48,
      }),
      performance({
        id: "bear-creek-4",
        athleteName: "Fourth Runner",
        school: "Bear Creek High School",
        gender: "Boys",
        classification: "5A",
        event: "110m Hurdles",
        markRaw: "18.01",
        markValue: 18.01,
      }),
    ],
    { classification: "5A", event: "110m Hurdles", gender: "Boys" },
  );

  assert.deepEqual(
    ranking.squads[0]?.athletes.map((athlete) => athlete.athleteName),
    ["Caelo Sandoval", "Gzodven Petrovic", "Dylan Thomas", "Fourth Runner"],
  );
});

test("dedupes short first-name abbreviations before choosing top four", () => {
  const ranking = buildEventSquadRanking(
    [
      performance({
        id: "maya-abbreviated",
        athleteName: "Ma DiGiallonardo",
        school: "Fossil Ridge High School",
        gender: "Girls",
        classification: "5A",
        markRaw: "5:00.45",
        markValue: 300.45,
        source: "official_timing",
      }),
      performance({
        id: "maya-slower",
        athleteName: "Maya DiGiallonardo",
        school: "Fossil Ridge High School",
        gender: "Girls",
        classification: "5A",
        markRaw: "5:05.04",
        markValue: 305.04,
      }),
      performance({
        id: "maya-full",
        athleteName: "Maya Digiallonardo",
        school: "Fossil Ridge High School",
        gender: "Girls",
        classification: "5A",
        markRaw: "5:00.45",
        markValue: 300.45,
        source: "maxpreps",
      }),
      performance({
        id: "fossil-2",
        athleteName: "Avery Breitigam",
        school: "Fossil Ridge High School",
        gender: "Girls",
        classification: "5A",
        markRaw: "5:03.08",
        markValue: 303.08,
      }),
      performance({
        id: "fossil-3",
        athleteName: "Ellie Jensen",
        school: "Fossil Ridge High School",
        gender: "Girls",
        classification: "5A",
        markRaw: "5:09.85",
        markValue: 309.85,
      }),
      performance({
        id: "fossil-4",
        athleteName: "Fourth Runner",
        school: "Fossil Ridge High School",
        gender: "Girls",
        classification: "5A",
        markRaw: "5:12.00",
        markValue: 312,
      }),
    ],
    { classification: "5A", event: "1600m", gender: "Girls" },
  );

  assert.deepEqual(
    ranking.squads[0]?.athletes.map((athlete) => athlete.athleteName),
    ["Maya Digiallonardo", "Avery Breitigam", "Ellie Jensen", "Fourth Runner"],
  );
});

test("keeps same-last-name teammates when first names are distinct", () => {
  const ranking = buildEventSquadRanking(
    [
      performance({
        id: "broly",
        athleteName: "Broly Watts",
        school: "Grand Junction Central",
        gender: "Boys",
        event: "800m",
        markRaw: "1:55.67",
        markValue: 115.67,
      }),
      performance({
        id: "brendyn",
        athleteName: "Brendyn Watts",
        school: "Grand Junction Central",
        gender: "Boys",
        event: "800m",
        markRaw: "1:58.16",
        markValue: 118.16,
      }),
      performance({
        id: "myers",
        athleteName: "Forrest Myers",
        school: "Grand Junction Central",
        gender: "Boys",
        event: "800m",
        markRaw: "1:59.72",
        markValue: 119.72,
      }),
      performance({
        id: "polley",
        athleteName: "Kaynin Polley",
        school: "Grand Junction Central",
        gender: "Boys",
        event: "800m",
        markRaw: "2:03.16",
        markValue: 123.16,
      }),
    ],
    { classification: "4A", event: "800m", gender: "Boys" },
  );

  assert.deepEqual(
    ranking.squads[0]?.athletes.map((athlete) => athlete.athleteName),
    ["Broly Watts", "Brendyn Watts", "Forrest Myers", "Kaynin Polley"],
  );
});

test("ranks field event squads with higher average marks first", () => {
  const ranking = buildEventSquadRanking(
    [
      performance({ id: "a1", athleteName: "A One", event: "Long Jump", markRaw: "20-0", markValue: 240 }),
      performance({ id: "a2", athleteName: "A Two", event: "Long Jump", markRaw: "19-0", markValue: 228 }),
      performance({ id: "a3", athleteName: "A Three", event: "Long Jump", markRaw: "18-0", markValue: 216 }),
      performance({ id: "a4", athleteName: "A Four", event: "Long Jump", markRaw: "17-0", markValue: 204 }),
      performance({ id: "b1", athleteName: "B One", school: "Better Jump High School", event: "Long Jump", markRaw: "21-0", markValue: 252 }),
      performance({ id: "b2", athleteName: "B Two", school: "Better Jump High School", event: "Long Jump", markRaw: "20-0", markValue: 240 }),
      performance({ id: "b3", athleteName: "B Three", school: "Better Jump High School", event: "Long Jump", markRaw: "19-0", markValue: 228 }),
      performance({ id: "b4", athleteName: "B Four", school: "Better Jump High School", event: "Long Jump", markRaw: "18-0", markValue: 216 }),
    ],
    { classification: "4A", event: "Long Jump", gender: "Boys" },
  );

  assert.equal(ranking.squads[0]?.school, "Better Jump High School");
  assert.equal(ranking.squads[0]?.averageRaw, "19-6");
});
