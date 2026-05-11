# State Virtual Meet Score Ladder Command Board Design

## Goal

Improve the State Virtual Meet page for coaches by making it feel like a meet-week command board first and a score calculator second. The first screen should answer:

- Where is my selected team in the current state team race?
- Which teams directly affect our next reachable outcome?
- What score rungs are reachable from here?
- Which few events unlock the next rung, podium/trophy path, or ceiling?

The approved direction is a Score Ladder Command Board: selected team plus top rivals, team path first, with realistic defaults and editable scenario support.

## Current Context

The app already has a dedicated `/virtual-state-meet` route and a large `VirtualMeetView` client component. The existing page supports:

- Boys/Girls switching.
- Seed-order scoring and Coach choices scoring.
- Manual place, best, and worst edits.
- Team projections and point ranges.
- Focus-team opportunity buckets.
- A simple score-plan narrative.
- Expandable team score tables.
- State meet schedule details.

The new work should reuse the current scoring model instead of introducing a second one. It should also avoid adding substantial new logic directly to `VirtualMeetView.tsx`, which is already large.

## First-Screen Experience

Add a new top command-board section above the existing editable tables.

The board should show:

- Selected team rank and points for the active gender.
- Current point range.
- The selected team's scoring entries count.
- Score ladder rungs:
  - Current score.
  - Next team to catch.
  - Podium line when the team is outside the top 3.
  - Protect-podium state when the team is already top 3.
  - Realistic ceiling.
- Best moves that can unlock the next rung.
- Rival watch for teams whose high range can affect the selected team's next rung, podium outcome, or rank.
- Clear controls/status for realistic model versus edited scenario.

The board should preserve the existing editable what-if table below it. Coaches can still open teams and edit places, but they get an immediate briefing before touching the table.

## Ladder Logic

The ladder should be derived from the same projected entries and team projections the page already computes.

Definitions:

- Current rung: the selected team's active projection under the current mode and scenario.
- Next-team rung: the closest team ahead that the selected team can realistically catch based on high-range upside.
- Podium rung: the point threshold for top 3 when the selected team is outside the top 3.
- Protect-podium rung: the point risk and rival upside when the selected team is already top 3.
- Ceiling rung: the selected team's high-range score from plausible scoring moves in the current projection.
- Best moves: selected-team entries sorted by likely point gain, then closeness to scoring, then current projected points.
- Rival watch: rival teams near the selected team's score/rank whose high range can change the target outcome.

Manual edits should update the board live. The default state should use Coach choices mode because the command board is meant to answer what coaches should expect, not only what seed order says.

## Component And Module Design

Create a focused pure-logic module:

- `src/lib/services/virtualMeetCommandBoard.ts`

This module should expose functions that accept projected entries and team projections and return a command-board model. It should not depend on React.

Create a focused UI component:

- `src/components/VirtualMeetCommandBoard.tsx`

This component should render:

- Team path summary.
- Score ladder rungs.
- Best moves list.
- Rival watch list.
- Scenario/projection status and relevant controls.

Keep `VirtualMeetView.tsx` responsible for owning the existing state:

- Active gender.
- Projection mode.
- Manual scenario edits.
- Existing expanded team rows.

`VirtualMeetView.tsx` should pass the computed projections and callbacks into `VirtualMeetCommandBoard` rather than absorbing all new logic itself.

## UI Behavior

Default behavior:

- Load the page in Coach choices mode.
- Show selected team plus relevant rivals, not the whole classification scoreboard.
- Use Score Ladder hierarchy instead of tabs.

Edited scenario behavior:

- If any manual scenario edits are active, show an edited-scenario indicator.
- Keep reset behavior available.
- Recalculate ladder rungs, best moves, and rival watch immediately from edited data.

No-points behavior:

- If the selected team has no projected points, replace rank-gap math with closest scoring opportunities.
- Still show rival/team context only when it is meaningful.

Top-3 behavior:

- If the selected team is already top 3, replace podium-gap copy with protect-podium copy.
- Show rival moves that could threaten the selected team's podium position.

Mobile behavior:

- Stack summary first, then ladder rungs, then best moves, then rival watch.
- Keep the editable team score table below the board.
- Avoid horizontal scrolling in the command board.

## Testing

Add targeted tests for `virtualMeetCommandBoard.ts`.

Tests should cover:

- Next-team selection when a catch is reachable.
- No reachable next-team state.
- Podium threshold when outside the top 3.
- Protect-podium state when inside the top 3.
- Ceiling calculation from high ranges.
- Best-move ordering.
- Rival watch inclusion and exclusion.
- Empty selected-team scoring state.

UI validation can start with lint plus a browser pass after implementation.

## Out Of Scope For First Version

- Saved named scenarios.
- Export/share links.
- Full page redesign.
- New data import behavior.
- AI-generated coach explanations.
- A separate whole-classification scoreboard workflow.

These can be added later after the command-board model proves useful.
