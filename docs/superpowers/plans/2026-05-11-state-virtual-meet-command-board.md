# State Virtual Meet Command Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Score Ladder Command Board to State Virtual Meet so coaches see the selected team's path, reachable score rungs, best point moves, and relevant rivals before using the detailed what-if table.

**Architecture:** Add a pure `virtualMeetCommandBoard` service that derives a command-board model from existing team projections. Add a focused `VirtualMeetCommandBoard` client component to render the ladder. Keep `VirtualMeetView` as the state owner and pass projections/callbacks into the new component.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Tailwind utility classes, `tsx --test` Node tests.

---

### Task 1: Build The Pure Command-Board Model

**Files:**
- Create: `src/lib/services/virtualMeetCommandBoard.ts`
- Create: `src/lib/services/virtualMeetCommandBoard.test.ts`

- [ ] **Step 1: Write failing tests for ladder, moves, and rival watch**

Create `src/lib/services/virtualMeetCommandBoard.test.ts`:

```ts
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
      team({ school: "Thompson Valley High School", rank: 2, points: 58, highPoints: 66 }),
      team({ school: "Roosevelt High School", rank: 3, points: 55, highPoints: 60 }),
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
      team({ school: "Palmer Ridge High School", rank: 2, points: 58, lowPoints: 50, highPoints: 68 }),
      team({ school: "Roosevelt High School", rank: 3, points: 55, highPoints: 64 }),
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
          entry({ id: "small", eventTitle: "Boys 400m", athleteName: "Small Gain", scenarioPoints: 4, highPoints: 5, scenarioPlace: 6, seed: 6 }),
          entry({ id: "big", eventTitle: "Boys 4x800m Relay", athleteName: "Relay", scenarioPoints: 1, highPoints: 6, scenarioPlace: 9, seed: 9 }),
          entry({ id: "breakthrough", eventTitle: "Boys High Jump", athleteName: "Jumper", scenarioPoints: 0, highPoints: 2, scenarioPlace: 11, seed: 11 }),
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
          entry({ id: "near", scenarioPoints: 0, highPoints: 3, scenarioPlace: 10, seed: 10 }),
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
      team({ school: "Leader High School", rank: 1, points: 70, highPoints: 75 }),
      team({ school: "Catchable High School", rank: 2, points: 55, highPoints: 61 }),
      team({ school: "Palmer Ridge High School", rank: 3, points: 50, highPoints: 60 }),
      team({ school: "Threat High School", rank: 4, points: 46, highPoints: 53 }),
      team({ school: "Distant High School", rank: 5, points: 18, highPoints: 24 }),
    ],
    editedCount: 0,
    projectionMode: "realistic",
  });

  assert.deepEqual(
    board.rivalWatch.map((rival) => rival.school),
    ["Catchable High School", "Threat High School"],
  );
});
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run: `npx tsx --test src/lib/services/virtualMeetCommandBoard.test.ts`

Expected: FAIL because `@/lib/services/virtualMeetCommandBoard` does not exist.

- [ ] **Step 3: Implement the pure command-board service**

Create `src/lib/services/virtualMeetCommandBoard.ts` with exported input types and `buildVirtualMeetCommandBoard`. Use current points, high points, rank, and selected team entries to derive summary, ladder rungs, best moves, and rival watches. Do not import React.

- [ ] **Step 4: Run the targeted test and verify GREEN**

Run: `npx tsx --test src/lib/services/virtualMeetCommandBoard.test.ts`

Expected: PASS.

### Task 2: Render The Command Board Component

**Files:**
- Create: `src/components/VirtualMeetCommandBoard.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/VirtualMeetCommandBoard.tsx`. It should accept:

```ts
type VirtualMeetCommandBoardProps = {
  board: VirtualMeetCommandBoardModel;
  projectionMode: "seed" | "realistic";
  onProjectionModeChange: (mode: "seed" | "realistic") => void;
  onResetScenario: () => void;
};
```

Render:

- Team path summary.
- Score ladder cards.
- Best moves.
- Rival watch.
- Buttons for Coach choices, Seed order, and Reset changes.

- [ ] **Step 2: Run lint for type/style feedback**

Run: `npm run lint`

Expected: PASS or only pre-existing unrelated warnings. Fix new lint errors before continuing.

### Task 3: Integrate Into `VirtualMeetView`

**Files:**
- Modify: `src/components/VirtualMeetView.tsx`

- [ ] **Step 1: Import the service and component**

Add imports for `buildVirtualMeetCommandBoard` and `VirtualMeetCommandBoard`.

- [ ] **Step 2: Default projection mode to Coach choices**

Change `useState<ProjectionMode>("seed")` to `useState<ProjectionMode>("realistic")`.

- [ ] **Step 3: Build the command-board model**

Use `useMemo` after `teamProjections` is computed:

```ts
const commandBoard = useMemo(
  () =>
    buildVirtualMeetCommandBoard({
      focusTeam,
      teams: teamProjections,
      editedCount,
      projectionMode,
    }),
  [editedCount, focusTeam, projectionMode, teamProjections],
);
```

- [ ] **Step 4: Render the command board above existing score analysis**

Place `VirtualMeetCommandBoard` after the top control panel and before `RealisticScoreDeltaPanel`.

- [ ] **Step 5: Run the focused service test**

Run: `npx tsx --test src/lib/services/virtualMeetCommandBoard.test.ts`

Expected: PASS.

- [ ] **Step 6: Run lint**

Run: `npm run lint`

Expected: PASS.

### Task 4: Browser Validation

**Files:**
- No source files expected.

- [ ] **Step 1: Start or reuse the dev server**

Run: `npm run dev`

Expected: Next dev server starts successfully.

- [ ] **Step 2: Open the app in the browser**

Open: `http://localhost:3000/virtual-state-meet`

Expected: The page loads with the command board visible before detailed tables.

- [ ] **Step 3: Validate core interactions**

Check:

- Coach choices is selected by default.
- Seed order button changes the ladder.
- Reset changes clears edited scenario count.
- Boys/Girls switching keeps the board coherent.
- Mobile-width layout does not require horizontal scrolling in the command board.

### Task 5: Final Verification

**Files:**
- No source files expected.

- [ ] **Step 1: Run the targeted test**

Run: `npx tsx --test src/lib/services/virtualMeetCommandBoard.test.ts`

Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: PASS.

---

## Self-Review

Spec coverage:

- First-screen Score Ladder Command Board: Task 2 and Task 3.
- Reuse existing scoring model: Task 1 consumes `teamProjections`; Task 3 passes existing projections from `VirtualMeetView`.
- Selected team plus top rivals: Task 1 rival watch and Task 2 render.
- Realistic default with editable scenarios: Task 3 default mode and edited count; Task 2 controls/status.
- No-points and top-3 states: Task 1 tests and implementation.
- Test coverage: Task 1 and Task 5.

Placeholder scan: no placeholder/TBD/TODO steps remain.

Type consistency: `ProjectionMode`, `CommandBoardTeam`, `CommandBoardEntry`, and `VirtualMeetCommandBoardModel` are defined in Task 1 and consumed by Tasks 2 and 3.
