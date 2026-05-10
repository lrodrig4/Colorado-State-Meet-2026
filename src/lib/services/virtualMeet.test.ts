import assert from "node:assert/strict";
import test from "node:test";
import type { Performance } from "@/types/domain";
import { buildVirtualStateMeet } from "@/lib/services/virtualMeet";

function performance(seed: {
  id: string;
  athleteName: string;
  gender: "Boys" | "Girls";
  markRaw: string;
  markValue: number;
  school?: string;
}): Performance {
  return {
    id: seed.id,
    athleteName: seed.athleteName,
    gender: seed.gender,
    grade: 12,
    school: seed.school ?? "Niwot High School",
    classification: "4A",
    classificationVerified: true,
    event: "100m",
    markRaw: seed.markRaw,
    markValue: seed.markValue,
    timingType: "FAT",
    isFAT: true,
    meetName: "Test Meet",
    meetDate: "2026-05-01",
    source: "milesplit",
    verificationStatus: "verified",
  };
}

test("keeps boys and girls virtual state team scores separate", () => {
  const meet = buildVirtualStateMeet(
    [
      performance({
        id: "boys-100",
        athleteName: "Boys Runner",
        gender: "Boys",
        markRaw: "10.90",
        markValue: 10.9,
      }),
      performance({
        id: "girls-100",
        athleteName: "Girls Runner",
        gender: "Girls",
        markRaw: "12.20",
        markValue: 12.2,
      }),
    ],
    "4A",
  );

  assert.equal(
    meet.teamScores.some((score) => score.gender === "Combined"),
    false,
  );
  assert.equal(
    meet.teamScores.find(
      (score) => score.gender === "Boys" && score.school === "Niwot High School",
    )?.points,
    10,
  );
  assert.equal(
    meet.teamScores.find(
      (score) => score.gender === "Girls" && score.school === "Niwot High School",
    )?.points,
    10,
  );
});

test("scores CHSAA state places through ninth", () => {
  const meet = buildVirtualStateMeet(
    Array.from({ length: 10 }, (_, index) =>
      performance({
        id: `boys-100-${index + 1}`,
        athleteName: `Boys Runner ${index + 1}`,
        gender: "Boys",
        markRaw: (10.8 + index / 100).toFixed(2),
        markValue: 10.8 + index / 100,
        school: "Test Scoring High School",
      }),
    ),
    "4A",
  );

  const boys100 = meet.events.find(
    (event) => event.gender === "Boys" && event.event === "100m",
  );

  assert.equal(meet.scoringPlaces, 9);
  assert.deepEqual(
    boys100?.entries.slice(0, 10).map((entry) => entry.projectedPoints),
    [10, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  );
  assert.equal(
    meet.teamScores.find(
      (score) =>
        score.gender === "Boys" && score.school === "Test Scoring High School",
    )?.points,
    46,
  );
});
