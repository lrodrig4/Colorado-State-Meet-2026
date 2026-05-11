"use client";

import {
  BarChart3,
  Flag,
  RotateCcw,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import type {
  CommandBoardLadderKind,
  CommandBoardProjectionMode,
  VirtualMeetCommandBoardModel,
} from "@/lib/services/virtualMeetCommandBoard";

type VirtualMeetCommandBoardProps = {
  board: VirtualMeetCommandBoardModel;
  projectionMode: CommandBoardProjectionMode;
  onProjectionModeChange: (mode: CommandBoardProjectionMode) => void;
  onResetScenario: () => void;
};

const rungClasses: Record<CommandBoardLadderKind, string> = {
  current: "border-[#b8c7d6] bg-[#f8fbfd]",
  "next-team": "border-sky-200 bg-sky-50",
  podium: "border-amber-200 bg-amber-50",
  "protect-podium": "border-emerald-200 bg-emerald-50",
  ceiling: "border-violet-200 bg-violet-50",
};

function projectionModeLabel(mode: CommandBoardProjectionMode) {
  return mode === "realistic" ? "Coach choices" : "Seed order";
}

function rankLabel(rank?: number) {
  return rank ? `#${rank}` : "Unscored";
}

function pointRange(board: VirtualMeetCommandBoardModel) {
  const { lowPoints, highPoints, points } = board.summary;
  if (lowPoints === highPoints) return `${points} pts`;
  return `${lowPoints}-${highPoints} pts`;
}

function statusCopy(board: VirtualMeetCommandBoardModel) {
  if (board.status === "empty") {
    return "No projected team points or scoring-range opportunities are loaded for this view.";
  }

  if (board.status === "opportunity-only") {
    return "No current points yet. The board is showing the closest ways to break into scoring.";
  }

  return "Current team path from the active scoring model.";
}

export function VirtualMeetCommandBoard({
  board,
  projectionMode,
  onProjectionModeChange,
  onResetScenario,
}: VirtualMeetCommandBoardProps) {
  const topMoves = board.bestMoves.slice(0, 4);
  const rivals = board.rivalWatch.slice(0, 4);

  return (
    <section className="coach-surface overflow-hidden rounded-lg">
      <div className="border-b border-slate-200 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Flag size={18} className="text-[#16324f]" />
              <h2 className="text-base font-semibold text-slate-950">
                Team path command board
              </h2>
            </div>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
              {statusCopy(board)} Rungs show the current score, next team,
              podium path, and ceiling for the selected team.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 items-center rounded-md bg-slate-100 px-3 text-xs font-semibold text-slate-700">
              {projectionModeLabel(board.projectionMode)}
              {board.hasEdits ? ` + ${board.editedCount} edits` : ""}
            </span>
            <button
              type="button"
              onClick={() => onProjectionModeChange("realistic")}
              aria-pressed={projectionMode === "realistic"}
              className={`coach-action inline-flex h-9 items-center gap-2 border px-3 text-xs font-semibold ${
                projectionMode === "realistic"
                  ? "border-amber-700 bg-amber-600 text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <ShieldCheck size={14} />
              Coach
            </button>
            <button
              type="button"
              onClick={() => onProjectionModeChange("seed")}
              aria-pressed={projectionMode === "seed"}
              className={`coach-action inline-flex h-9 items-center gap-2 border px-3 text-xs font-semibold ${
                projectionMode === "seed"
                  ? "border-[#0f2a47] bg-[#0f2a47] text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <BarChart3 size={14} />
              Seed
            </button>
            <button
              type="button"
              onClick={onResetScenario}
              className="coach-action inline-flex h-9 items-center gap-2 border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-0 border-b border-slate-200 md:grid-cols-4">
        <div className="border-b border-slate-200 p-4 md:border-b-0 md:border-r">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Selected team
          </div>
          <div className="mt-1 truncate text-lg font-semibold text-slate-950">
            {board.summary.school}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {rankLabel(board.summary.rank)}
          </div>
        </div>
        <div className="border-b border-slate-200 p-4 md:border-b-0 md:border-r">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Points now
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
            {board.summary.points}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Range {pointRange(board)}
          </div>
        </div>
        <div className="border-b border-slate-200 p-4 md:border-b-0 md:border-r">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Scorers
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
            {board.summary.scoringEntries}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Current scoring entries
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Best move
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
            {topMoves[0] ? `+${topMoves[0].pointGain}` : "0"}
          </div>
          <div className="mt-1 truncate text-sm text-slate-600">
            {topMoves[0]?.eventTitle ?? "No point upside loaded"}
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {board.ladder.map((rung) => (
            <article
              key={rung.id}
              className={`rounded-lg border p-3 ${rungClasses[rung.kind]}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-950">
                  {rung.label}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    rung.reachable
                      ? "bg-white/80 text-emerald-800"
                      : "bg-white/80 text-slate-500"
                  }`}
                >
                  {rung.reachable ? "Reachable" : "Stretch"}
                </span>
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
                {rung.points}
              </div>
              <div className="mt-1 text-sm font-semibold tabular-nums text-slate-700">
                {rung.pointsNeeded ? `+${rung.pointsNeeded}` : "Current"}
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                {rung.detail}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Target size={17} className="text-[#16324f]" />
              <h3 className="text-sm font-semibold text-slate-950">
                Best moves to unlock the next rung
              </h3>
            </div>
            <div className="mt-3 space-y-2">
              {topMoves.map((move, index) => (
                <div
                  key={move.entryId}
                  className="grid gap-3 rounded-md bg-slate-50 p-3 sm:grid-cols-[2rem_minmax(0,1fr)_4rem]"
                >
                  <div className="text-lg font-semibold tabular-nums text-slate-950">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="break-words text-sm font-semibold text-slate-950">
                      {move.eventTitle} - {move.athleteName}
                    </div>
                    <div className="mt-1 break-words text-xs leading-5 text-slate-600">
                      Seed {move.seed}, projected place {move.scenarioPlace}.{" "}
                      {move.detail}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-sm font-semibold tabular-nums text-emerald-700">
                      +{move.pointGain}
                    </div>
                    <div className="text-xs text-slate-500">
                      {move.markRaw}
                    </div>
                  </div>
                </div>
              ))}
              {!topMoves.length ? (
                <div className="rounded-md bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  No selected-team point moves are available in the current
                  range.
                </div>
              ) : null}
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Users size={17} className="text-[#16324f]" />
              <h3 className="text-sm font-semibold text-slate-950">
                Rival watch
              </h3>
            </div>
            <div className="mt-3 space-y-2">
              {rivals.map((rival) => (
                <div
                  key={rival.school}
                  className="rounded-md bg-slate-50 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 truncate font-semibold text-slate-950">
                      #{rival.rank} {rival.school}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        rival.relation === "catchable"
                          ? "bg-sky-100 text-sky-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {rival.relation === "catchable" ? "Catch" : "Threat"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span>{rival.points} pts</span>
                    <span>high {rival.highPoints}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {rival.detail}
                  </p>
                </div>
              ))}
              {!rivals.length ? (
                <div className="rounded-md bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  No nearby rival swing affects this team path right now.
                </div>
              ) : null}
            </div>
          </article>
        </div>

        <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 md:grid-cols-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-amber-700" />
            Default view uses Coach choices.
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-700" />
            Manual edits update this board live.
          </div>
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-[#16324f]" />
            Podium math switches to protect mode inside top 3.
          </div>
        </div>
      </div>
    </section>
  );
}
