export type CommandBoardProjectionMode = "seed" | "realistic";

export type CommandBoardEntry = {
  id: string;
  eventTitle: string;
  athleteName: string;
  seed: number;
  markRaw: string;
  scenarioPlace: number;
  scenarioPoints: number;
  lowPoints: number;
  highPoints: number;
};

export type CommandBoardTeam = {
  school: string;
  rank: number;
  points: number;
  lowPoints: number;
  highPoints: number;
  scoringEntries: number;
  entries: CommandBoardEntry[];
};

export type CommandBoardStatus = "scoring" | "opportunity-only" | "empty";

export type CommandBoardSummary = {
  school: string;
  rank?: number;
  points: number;
  lowPoints: number;
  highPoints: number;
  scoringEntries: number;
};

export type CommandBoardLadderKind =
  | "current"
  | "next-team"
  | "podium"
  | "protect-podium"
  | "ceiling";

export type CommandBoardLadderRung = {
  id: string;
  kind: CommandBoardLadderKind;
  label: string;
  detail: string;
  points: number;
  pointsNeeded: number;
  reachable: boolean;
  targetSchool?: string;
};

export type CommandBoardMoveKind = "upgrade" | "breakthrough";

export type CommandBoardBestMove = {
  entryId: string;
  kind: CommandBoardMoveKind;
  eventTitle: string;
  athleteName: string;
  seed: number;
  markRaw: string;
  scenarioPlace: number;
  currentPoints: number;
  highPoints: number;
  pointGain: number;
  detail: string;
};

export type CommandBoardRival = {
  school: string;
  rank: number;
  points: number;
  highPoints: number;
  pointSwing: number;
  relation: "catchable" | "threat";
  detail: string;
};

export type VirtualMeetCommandBoardModel = {
  focusTeam: string;
  projectionMode: CommandBoardProjectionMode;
  editedCount: number;
  hasEdits: boolean;
  status: CommandBoardStatus;
  summary: CommandBoardSummary;
  ladder: CommandBoardLadderRung[];
  bestMoves: CommandBoardBestMove[];
  rivalWatch: CommandBoardRival[];
};

export type BuildVirtualMeetCommandBoardOptions = {
  focusTeam: string;
  teams: CommandBoardTeam[];
  editedCount: number;
  projectionMode: CommandBoardProjectionMode;
};

function sortedTeams(teams: CommandBoardTeam[]) {
  return [...teams].sort(
    (a, b) =>
      a.rank - b.rank ||
      b.points - a.points ||
      a.school.localeCompare(b.school),
  );
}

function pointsNeeded(targetPoints: number, currentPoints: number) {
  return Math.max(0, targetPoints - currentPoints);
}

function buildEmptyFocusTeam(school: string): CommandBoardTeam {
  return {
    school,
    rank: 0,
    points: 0,
    lowPoints: 0,
    highPoints: 0,
    scoringEntries: 0,
    entries: [],
  };
}

function moveDetail(move: CommandBoardBestMove) {
  if (move.kind === "breakthrough") {
    return `Can add up to ${move.pointGain} pts by reaching the scoring range.`;
  }

  return `Can add up to ${move.pointGain} pts by moving up from current projection.`;
}

function buildBestMoves(entries: CommandBoardEntry[]): CommandBoardBestMove[] {
  return entries
    .map((entry) => {
      const pointGain = Math.max(0, entry.highPoints - entry.scenarioPoints);
      if (pointGain <= 0) return undefined;

      const move: CommandBoardBestMove = {
        entryId: entry.id,
        kind: entry.scenarioPoints > 0 ? "upgrade" : "breakthrough",
        eventTitle: entry.eventTitle,
        athleteName: entry.athleteName,
        seed: entry.seed,
        markRaw: entry.markRaw,
        scenarioPlace: entry.scenarioPlace,
        currentPoints: entry.scenarioPoints,
        highPoints: entry.highPoints,
        pointGain,
        detail: "",
      };

      return {
        ...move,
        detail: moveDetail(move),
      };
    })
    .filter((move): move is CommandBoardBestMove => Boolean(move))
    .sort(
      (a, b) =>
        b.pointGain - a.pointGain ||
        b.highPoints - a.highPoints ||
        a.scenarioPlace - b.scenarioPlace ||
        a.seed - b.seed ||
        a.eventTitle.localeCompare(b.eventTitle),
    )
    .slice(0, 6);
}

function buildCurrentRung(focusTeam: CommandBoardTeam): CommandBoardLadderRung {
  return {
    id: "current",
    kind: "current",
    label: "Current",
    detail: focusTeam.points
      ? `Projected #${focusTeam.rank} with ${focusTeam.scoringEntries} scorers.`
      : "No projected team points in this view yet.",
    points: focusTeam.points,
    pointsNeeded: 0,
    reachable: true,
  };
}

function buildNextTeamRung(
  focusTeam: CommandBoardTeam,
  nextAhead?: CommandBoardTeam,
): CommandBoardLadderRung | undefined {
  if (!nextAhead) return undefined;
  const needed = pointsNeeded(nextAhead.points, focusTeam.points);

  return {
    id: "next-team",
    kind: "next-team",
    label: `Catch ${nextAhead.school}`,
    detail: needed
      ? `${needed} pts to match the next team ahead.`
      : "Already level with the next team ahead.",
    points: nextAhead.points,
    pointsNeeded: needed,
    reachable: focusTeam.highPoints >= nextAhead.points,
    targetSchool: nextAhead.school,
  };
}

function buildPodiumRung(
  focusTeam: CommandBoardTeam,
  teams: CommandBoardTeam[],
): CommandBoardLadderRung | undefined {
  if (!focusTeam.rank) return undefined;

  if (focusTeam.rank <= 3) {
    const podiumLine =
      focusTeam.rank < 3 ? teams[2]?.points : teams[3]?.points ?? 0;
    const cushion = Math.max(0, focusTeam.points - podiumLine);

    return {
      id: "protect-podium",
      kind: "protect-podium",
      label: "Protect podium",
      detail: cushion
        ? `${cushion} pts above the podium danger line.`
        : "Podium position depends on holding current points.",
      points: podiumLine,
      pointsNeeded: cushion,
      reachable: true,
      targetSchool: teams[2]?.school,
    };
  }

  const podiumTeam = teams[2];
  if (!podiumTeam) return undefined;
  const needed = pointsNeeded(podiumTeam.points, focusTeam.points);

  return {
    id: "podium",
    kind: "podium",
    label: "Podium line",
    detail: `${needed} pts to reach the current third-place score.`,
    points: podiumTeam.points,
    pointsNeeded: needed,
    reachable: focusTeam.highPoints >= podiumTeam.points,
    targetSchool: podiumTeam.school,
  };
}

function buildCeilingRung(focusTeam: CommandBoardTeam): CommandBoardLadderRung {
  const gain = Math.max(0, focusTeam.highPoints - focusTeam.points);

  return {
    id: "ceiling",
    kind: "ceiling",
    label: "Ceiling",
    detail: gain
      ? `${gain} pts above the current projection in best-case ranges.`
      : "No additional point upside in the current ranges.",
    points: focusTeam.highPoints,
    pointsNeeded: gain,
    reachable: gain > 0,
  };
}

function buildRivalWatch(
  focusTeam: CommandBoardTeam,
  teams: CommandBoardTeam[],
): CommandBoardRival[] {
  if (!focusTeam.rank) return [];

  return teams
    .filter((team) => team.school !== focusTeam.school)
    .map((team): CommandBoardRival | undefined => {
      if (team.rank < focusTeam.rank && focusTeam.highPoints >= team.points) {
        return {
          school: team.school,
          rank: team.rank,
          points: team.points,
          highPoints: team.highPoints,
          pointSwing: Math.max(0, team.points - focusTeam.points),
          relation: "catchable",
          detail: `${team.points - focusTeam.points} pts ahead and inside the selected team's ceiling.`,
        };
      }

      if (team.rank > focusTeam.rank && team.highPoints >= focusTeam.points) {
        return {
          school: team.school,
          rank: team.rank,
          points: team.points,
          highPoints: team.highPoints,
          pointSwing: Math.max(0, team.highPoints - focusTeam.points),
          relation: "threat",
          detail: `High range can reach ${team.highPoints}, which threatens the selected team's current score.`,
        };
      }

      return undefined;
    })
    .filter((rival): rival is CommandBoardRival => Boolean(rival))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        Math.abs(a.points - focusTeam.points) -
          Math.abs(b.points - focusTeam.points) ||
        b.highPoints - a.highPoints,
    )
    .slice(0, 5);
}

export function buildVirtualMeetCommandBoard({
  focusTeam,
  teams,
  editedCount,
  projectionMode,
}: BuildVirtualMeetCommandBoardOptions): VirtualMeetCommandBoardModel {
  const orderedTeams = sortedTeams(teams);
  const focus =
    orderedTeams.find((team) => team.school === focusTeam) ??
    buildEmptyFocusTeam(focusTeam);
  const focusIndex = orderedTeams.findIndex((team) => team.school === focusTeam);
  const nextAhead = focusIndex > 0 ? orderedTeams[focusIndex - 1] : undefined;
  const bestMoves = buildBestMoves(focus.entries);
  const status: CommandBoardStatus = focus.points
    ? "scoring"
    : bestMoves.length
      ? "opportunity-only"
      : "empty";
  const ladder = [
    buildCurrentRung(focus),
    buildNextTeamRung(focus, nextAhead),
    buildPodiumRung(focus, orderedTeams),
    buildCeilingRung(focus),
  ].filter((rung): rung is CommandBoardLadderRung => Boolean(rung));

  return {
    focusTeam,
    projectionMode,
    editedCount,
    hasEdits: editedCount > 0,
    status,
    summary: {
      school: focus.school,
      rank: focus.points > 0 && focus.rank > 0 ? focus.rank : undefined,
      points: focus.points,
      lowPoints: focus.lowPoints,
      highPoints: focus.highPoints,
      scoringEntries: focus.scoringEntries,
    },
    ladder,
    bestMoves,
    rivalWatch: buildRivalWatch(focus, orderedTeams),
  };
}
