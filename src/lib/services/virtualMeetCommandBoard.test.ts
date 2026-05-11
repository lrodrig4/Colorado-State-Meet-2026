import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVirtualMeetCommandBoard,
  type CommandBoardEntry,
  type CommandBoardTeam,
} from "@/lib/services/virtualMeetCommandBoard";

function entry(seed: Partial<CommandBoardEntry> = {}): CommandBoardEntry {
  return {
    id: seed.id ?? "entry-1",
    eventTitle: seed.eventTitle ?? "Boys 800m",
    athleteName: seed.athleteName ?? "Runner One",
    seed: seed.seed ?? 8,
    markRaw: seed.markRaw ?? "1:55.00",
    scenarioPlace: seed.scenarioPlace ?? 8,
    scenarioPoints: seed.scenarioPoints ?? 2,
    lowPoints: seed.lowPoints ?? 0,
    highPoints: seed.highPoints ?? 5,
  };
}

function team(seed: Partial<CommandBoardTeam> = {}): CommandBoardTeam {
  return {
    school: seed.school ?? "Palmer Ridge High School",
    rank: seed.rank ?? 4,
    points: seed.points ?? 48,
    lowPoints: seed.lowPoints ?? 42,
    highPoints: seed.highPoints ?? 62,
    scoringEntries: seed.scoringEntries ?? 7,
    entries: seed.entries ?? [entry()],
  };
}

test("builds current, next-team, podium, and ceiling ladder rungs", () => {
  const board = buildVirtualMeetCommandBoard({
    focusTeam: "Palmer Ridge High School",
    teams: [
      team({ school: "Niwot High School", rank: 1, points: 70, highPoints: 78 }),
      team({
        school: "Thompson Valley High School",
        rank: 2,
        points: 58,
        highPoints: 66,
      }),
      team({
        school: "Roosevelt High School",
        rank: 3,
        points: 55,
        highPoints: 60,
      }),
      team(),
    ],
    editedCount: 0,
    projectionMode: "realistic",
  });

  assert.equal(board.status, "scoring");
  assert.equal(board.summary.rank, 4);
  assert.equal(board.summary.points, 48);
  assert.deepEqual(
    board.ladder.map((rung) => [rung.kind, rung.points, rung.pointsNeeded]),
    [
      ["current", 48, 0],
      ["next-team", 55, 7],
      ["podium", 55, 7],
      ["ceiling", 62, 14],
    ],
  );
});

test("uses protect-podium rung when focus team is already top three", () => {
  const board = buildVirtualMeetCommandBoard({
    focusTeam: "Palmer Ridge High School",
    teams: [
      team({ school: "Niwot High School", rank: 1, points: 70, highPoints: 78 }),
      team({
        school: "Palmer Ridge High School",
        rank: 2,
        points: 58,
        lowPoints: 50,
        highPoints: 68,
      }),
      team({
        school: "Roosevelt High School",
        rank: 3,
        points: 55,
        highPoints: 64,
      }),
    ],
    editedCount: 2,
    projectionMode: "realistic",
  });

  const podium = board.ladder.find((rung) => rung.kind === "protect-podium");
  assert.equal(board.hasEdits, true);
  assert.equal(podium?.points, 55);
  assert.equal(podium?.pointsNeeded, 3);
});

test("orders best moves by available point gain", () => {
  const board = buildVirtualMeetCommandBoard({
    focusTeam: "Palmer Ridge High School",
    teams: [
      team({
        entries: [
          entry({
            id: "small",
            eventTitle: "Boys 400m",
            athleteName: "Small Gain",
            scenarioPoints: 4,
            highPoints: 5,
            scenarioPlace: 6,
            seed: 6,
          }),
          entry({
            id: "big",
            eventTitle: "Boys 4x800m Relay",
            athleteName: "Relay",
            scenarioPoints: 1,
            highPoints: 6,
            scenarioPlace: 9,
            seed: 9,
          }),
          entry({
            id: "breakthrough",
            eventTitle: "Boys High Jump",
            athleteName: "Jumper",
            scenarioPoints: 0,
            highPoints: 2,
            scenarioPlace: 11,
            seed: 11,
          }),
        ],
      }),
    ],
    editedCount: 0,
    projectionMode: "realistic",
  });

  assert.deepEqual(
    board.bestMoves.map((move) => [move.entryId, move.pointGain, move.kind]),
    [
      ["big", 5, "upgrade"],
      ["breakthrough", 2, "breakthrough"],
      ["small", 1, "upgrade"],
    ],
  );
});

test("returns scoring-opportunity state when selected team has no points", () => {
  const board = buildVirtualMeetCommandBoard({
    focusTeam: "Palmer Ridge High School",
    teams: [
      team({
        points: 0,
        lowPoints: 0,
        highPoints: 3,
        scoringEntries: 0,
        entries: [
          entry({
            id: "near",
            scenarioPoints: 0,
            highPoints: 3,
            scenarioPlace: 10,
            seed: 10,
          }),
        ],
      }),
    ],
    editedCount: 0,
    projectionMode: "seed",
  });

  assert.equal(board.status, "opportunity-only");
  assert.equal(board.summary.rank, undefined);
  assert.equal(board.bestMoves[0]?.entryId, "near");
});

test("includes only rivals that can affect the focus team path", () => {
  const board = buildVirtualMeetCommandBoard({
    focusTeam: "Palmer Ridge High School",
    teams: [
      team({
        school: "Leader High School",
        rank: 1,
        points: 70,
        highPoints: 75,
      }),
      team({
        school: "Catchable High School",
        rank: 2,
        points: 55,
        highPoints: 61,
      }),
      team({
        school: "Palmer Ridge High School",
        rank: 3,
        points: 50,
        highPoints: 60,
      }),
      team({
        school: "Threat High School",
        rank: 4,
        points: 46,
        highPoints: 53,
      }),
      team({
        school: "Distant High School",
        rank: 5,
        points: 18,
        highPoints: 24,
      }),
    ],
    editedCount: 0,
    projectionMode: "realistic",
  });

  assert.deepEqual(
    board.rivalWatch.map((rival) => rival.school),
    ["Catchable High School", "Threat High School"],
  );
});
