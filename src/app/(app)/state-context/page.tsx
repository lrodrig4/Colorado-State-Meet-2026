import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  Gauge,
  Target,
} from "lucide-react";
import { ClassificationSelector } from "@/components/ClassificationSelector";
import { FocusTeamSelector } from "@/components/FocusTeamSelector";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { getEventDefinition } from "@/lib/data/events";
import {
  getLatestVerifiedMeetDateForClassification,
  getSchoolOptionsForClassification,
  getVirtualMeetForClassification,
} from "@/lib/services/appData";
import {
  DEFAULT_FOCUS_TEAM,
  decodeFocusTeamCookie,
  focusTeamCookieName,
  focusTeamHref,
  resolveFocusTeam,
  shortSchoolName,
} from "@/lib/utils/focusTeam";
import { resolveClassification } from "@/lib/utils/classificationScope";
import { rankingPath } from "@/lib/utils/rankingRoutes";
import type {
  Classification,
  Gender,
  TeamScore,
  VirtualMeetEntry,
  VirtualStateMeet,
  VirtualStateMeetEvent,
} from "@/types/domain";

const SCORING = [10, 8, 7, 6, 5, 4, 3, 2, 1];

function pointsForPlace(place: number | undefined) {
  if (!place) return 0;
  return SCORING[place - 1] ?? 0;
}

function ordinal(value: number) {
  const suffix =
    value % 100 >= 11 && value % 100 <= 13
      ? "th"
      : value % 10 === 1
        ? "st"
        : value % 10 === 2
          ? "nd"
          : value % 10 === 3
            ? "rd"
            : "th";

  return `${value}${suffix}`;
}

function placeText(place: number | undefined) {
  return place ? ordinal(place) : "outside scoring";
}

function rankText(rank: number | undefined) {
  return rank ? ordinal(rank) : "Unscored";
}

function formatMeetDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00-06:00`));
}

function genderScores(virtualMeet: VirtualStateMeet, gender: Gender) {
  return virtualMeet.teamScores
    .filter((score) => score.gender === gender)
    .sort((a, b) => b.points - a.points || a.school.localeCompare(b.school));
}

function scoreContext(
  virtualMeet: VirtualStateMeet,
  gender: Gender,
  focusTeam: string,
) {
  const scores = genderScores(virtualMeet, gender);
  const teamIndex = scores.findIndex((score) => score.school === focusTeam);
  const team = scores[teamIndex] ?? {
    school: focusTeam,
    gender,
    points: 0,
    scoringEntries: 0,
  };
  const leader = scores[0] ?? team;
  const nextAhead = teamIndex > 0 ? scores[teamIndex - 1] : undefined;

  return {
    team,
    leader,
    nextAhead,
    rank: teamIndex >= 0 ? teamIndex + 1 : undefined,
  };
}

function ScoreBar({
  label,
  context,
  focusTeam,
}: {
  label: Gender;
  context: ReturnType<typeof scoreContext>;
  focusTeam: string;
}) {
  const pct = context.leader.points
    ? Math.min(100, Math.round((context.team.points / context.leader.points) * 100))
    : 0;

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-950">
            {label} team
          </div>
          <div className="text-xs text-slate-500">
            {context.rank ? `Now ${rankText(context.rank)}` : "No points yet"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums text-slate-950">
            {context.team.points}
          </div>
          <div className="text-xs text-slate-500">{shortSchoolName(focusTeam)} pts</div>
        </div>
      </div>
      <div className="h-3 rounded-full bg-slate-100">
        <div
          className="h-3 rounded-full bg-[#2f6f5e]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-600">
        Leader: {context.leader.school} ({context.leader.points}).{" "}
        {context.nextAhead
          ? `Next team ahead: ${context.nextAhead.school}, ${context.nextAhead.points}.`
          : context.rank === 1
            ? "Leading right now."
            : "No team ahead in the current scoring table."}
      </div>
    </div>
  );
}

function pointMix(virtualMeet: VirtualStateMeet, focusTeam: string) {
  const entries = virtualMeet.events.flatMap((event) =>
    event.entries
      .filter((entry) => entry.school === focusTeam && entry.projectedPoints > 0)
      .map((entry) => ({
        ...entry,
        eventName: getEventDefinition(event.event).displayName,
        eventGender: event.gender,
        relay: getEventDefinition(event.event).relay,
      })),
  );
  const relayPoints = entries
    .filter((entry) => entry.relay)
    .reduce((sum, entry) => sum + entry.projectedPoints, 0);
  const individualPoints = entries.reduce(
    (sum, entry) => sum + entry.projectedPoints,
    0,
  ) - relayPoints;

  return {
    entries: entries.sort(
      (a, b) =>
        b.projectedPoints - a.projectedPoints ||
        a.eventGender.localeCompare(b.eventGender) ||
        a.eventName.localeCompare(b.eventName),
    ),
    relayPoints,
    individualPoints,
  };
}

function rangeWidth(place: number) {
  return place <= 3 ? 1 : place <= 9 ? 2 : place <= 13 ? 4 : 5;
}

function targetPlaceForEntry(entry: VirtualMeetEntry) {
  const place = entry.projectedPlace ?? entry.seed;
  const highPlace = Math.max(1, place - rangeWidth(place));

  if (place <= 9) return highPlace;
  if (highPlace <= 9) return highPlace;

  return place <= 13 ? 9 : highPlace;
}

function scenarioSortPlace(entry: VirtualMeetEntry, targetPlace?: number) {
  if (targetPlace === undefined) return entry.projectedPlace ?? entry.seed;
  return targetPlace - 0.35;
}

type StateTargetRow = {
  id: string;
  eventTitle: string;
  athleteName: string;
  seed: number;
  markRaw: string;
  currentPlace: number;
  currentPoints: number;
  targetPlace: number;
  targetPoints: number;
  pointGain: number;
  actionLabel: string;
  targetLabel: string;
  competitorLabel: string;
  href: string;
  priorityScore: number;
};

type TeamCatchRow = {
  school: string;
  points: number;
  pointsNeeded: number;
};

type StateWeekOutlook = {
  gender: Gender;
  currentRank?: number;
  currentPoints: number;
  currentScoringEntries: number;
  highRank?: number;
  highPoints: number;
  highScoringEntries: number;
  pointGain: number;
  leader: TeamScore;
  nextAhead?: TeamScore;
  targetRows: StateTargetRow[];
  holdRows: StateTargetRow[];
  reachableTeams: TeamCatchRow[];
};

type NextAction = {
  id: string;
  label: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  tone: "green" | "amber" | "navy" | "slate";
};

type StateContextData = {
  boysContext: ReturnType<typeof scoreContext>;
  girlsContext: ReturnType<typeof scoreContext>;
  mix: ReturnType<typeof pointMix>;
  topScoringRows: ReturnType<typeof pointMix>["entries"];
  teamTotal: number;
  boysOutlook: StateWeekOutlook;
  girlsOutlook: StateWeekOutlook;
  nextActions: NextAction[];
  latestVerifiedMeetDate: string;
  latestMeetLabel: string;
};

const stateContextByTeam = new Map<string, StateContextData>();

function stateContextCacheKey(classification: Classification, focusTeam: string) {
  return `${classification}|${focusTeam}`;
}

function targetCompetitorLabel(
  event: VirtualStateMeetEvent,
  entry: VirtualMeetEntry,
  targetPlace: number,
) {
  const target = event.entries[targetPlace - 1];
  const scorer = event.entries[8];
  const nextAhead = event.entries[entry.seed - 2];

  if (entry.seed > 9 && scorer) {
    return `Scoring line: ${scorer.athleteName} (${scorer.school}), seed #${scorer.seed}`;
  }

  if (target && target.id !== entry.id) {
    return `Target: ${target.athleteName} (${target.school}), seed #${target.seed}`;
  }

  if (nextAhead) {
    return `Next up: ${nextAhead.athleteName} (${nextAhead.school}), seed #${nextAhead.seed}`;
  }

  return "Already at the front of the seed list";
}

function buildStateTargetRows(
  virtualMeet: VirtualStateMeet,
  gender: Gender,
  focusTeam: string,
  classification: Classification,
) {
  return virtualMeet.events
    .filter((event) => event.gender === gender)
    .flatMap((event) => {
      const definition = getEventDefinition(event.event);
      const eventTitle = `${gender} ${definition.displayName}`;

      return event.entries
        .filter((entry) => entry.school === focusTeam)
        .map((entry): StateTargetRow | undefined => {
          const currentPlace = entry.projectedPlace ?? entry.seed;
          const currentPoints = pointsForPlace(currentPlace);
          const targetPlace = targetPlaceForEntry(entry);
          const targetPoints = pointsForPlace(targetPlace);
          const pointGain = Math.max(0, targetPoints - currentPoints);

          if (currentPoints === 0 && targetPoints === 0) {
            return undefined;
          }

          const actionLabel =
            currentPoints > 0
              ? pointGain > 0
                ? "Move up"
                : "Hold points"
              : "Score chance";
          const targetLabel =
            currentPoints > 0
              ? pointGain > 0
                ? `Needs ${placeText(targetPlace)} or better`
                : `Hold ${placeText(currentPlace)}`
              : `Needs top ${targetPlace} to score`;

          return {
            id: entry.id,
            eventTitle,
            athleteName: entry.athleteName,
            seed: entry.seed,
            markRaw: entry.markRaw,
            currentPlace,
            currentPoints,
            targetPlace,
            targetPoints,
            pointGain,
            actionLabel,
            targetLabel,
            competitorLabel: targetCompetitorLabel(event, entry, targetPlace),
            href: focusTeamHref(
              rankingPath(gender, definition.slug),
              focusTeam,
              classification,
            ),
            priorityScore:
              pointGain * 20 +
              targetPoints * 6 +
              currentPoints * 4 +
              Math.max(0, 18 - entry.seed),
          };
        })
        .filter((row): row is StateTargetRow => Boolean(row));
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

function buildScenarioScores(
  virtualMeet: VirtualStateMeet,
  gender: Gender,
  targetRows: StateTargetRow[],
) {
  const targetById = new Map(
    targetRows
      .filter((row) => row.pointGain > 0)
      .map((row) => [row.id, row.targetPlace]),
  );
  const bySchool = new Map<string, TeamScore>();

  for (const event of virtualMeet.events) {
    if (event.gender !== gender) continue;

    const ordered = [...event.entries].sort((a, b) => {
      const placeDelta =
        scenarioSortPlace(a, targetById.get(a.id)) -
        scenarioSortPlace(b, targetById.get(b.id));

      return placeDelta || a.seed - b.seed || a.athleteName.localeCompare(b.athleteName);
    });

    ordered.forEach((entry, index) => {
      const points = pointsForPlace(index + 1);
      if (points <= 0) return;

      const existing = bySchool.get(entry.school) ?? {
        school: entry.school,
        gender,
        points: 0,
        scoringEntries: 0,
      };

      existing.points += points;
      existing.scoringEntries += 1;
      bySchool.set(entry.school, existing);
    });
  }

  return [...bySchool.values()].sort(
    (a, b) => b.points - a.points || a.school.localeCompare(b.school),
  );
}

function buildStateWeekOutlook(
  virtualMeet: VirtualStateMeet,
  gender: Gender,
  focusTeam: string,
  classification: Classification,
): StateWeekOutlook {
  const currentScores = genderScores(virtualMeet, gender);
  const currentIndex = currentScores.findIndex((score) => score.school === focusTeam);
  const current = currentScores[currentIndex] ?? {
    school: focusTeam,
    gender,
    points: 0,
    scoringEntries: 0,
  };
  const targetRows = buildStateTargetRows(
    virtualMeet,
    gender,
    focusTeam,
    classification,
  );
  const highScores = buildScenarioScores(virtualMeet, gender, targetRows);
  const highIndex = highScores.findIndex((score) => score.school === focusTeam);
  const high = highScores[highIndex] ?? current;
  const aheadTeams =
    currentIndex >= 0
      ? currentScores.slice(0, currentIndex).reverse()
      : [...currentScores].reverse();
  const reachableTeams = aheadTeams
    .map((team) => ({
      school: team.school,
      points: team.points,
      pointsNeeded: Math.max(1, team.points - current.points + 1),
    }))
    .filter((team) => high.points >= current.points + team.pointsNeeded)
    .slice(0, 4);

  return {
    gender,
    currentRank: currentIndex >= 0 ? currentIndex + 1 : undefined,
    currentPoints: current.points,
    currentScoringEntries: current.scoringEntries,
    highRank: highIndex >= 0 ? highIndex + 1 : undefined,
    highPoints: high.points,
    highScoringEntries: high.scoringEntries,
    pointGain: Math.max(0, high.points - current.points),
    leader: currentScores[0] ?? current,
    nextAhead: currentIndex > 0 ? currentScores[currentIndex - 1] : undefined,
    targetRows: targetRows.filter((row) => row.pointGain > 0).slice(0, 8),
    holdRows: targetRows
      .filter((row) => row.currentPoints > 0)
      .sort(
        (a, b) =>
          b.currentPoints - a.currentPoints ||
          a.currentPlace - b.currentPlace ||
          a.eventTitle.localeCompare(b.eventTitle),
      )
      .slice(0, 4),
    reachableTeams,
  };
}

function buildNextActions({
  boysOutlook,
  girlsOutlook,
  focusTeam,
  classification,
}: {
  boysOutlook: StateWeekOutlook;
  girlsOutlook: StateWeekOutlook;
  focusTeam: string;
  classification: Classification;
}): NextAction[] {
  const outlooks = [boysOutlook, girlsOutlook];
  const gainRows = outlooks
    .flatMap((outlook) => outlook.targetRows)
    .sort(
      (a, b) =>
        b.pointGain - a.pointGain ||
        b.priorityScore - a.priorityScore ||
        a.eventTitle.localeCompare(b.eventTitle),
    );
  const topGain = gainRows[0];
  const holdRows = outlooks
    .flatMap((outlook) => outlook.holdRows)
    .sort(
      (a, b) =>
        b.currentPoints - a.currentPoints ||
        a.currentPlace - b.currentPlace ||
        a.eventTitle.localeCompare(b.eventTitle),
    );
  const topHold =
    holdRows.find((row) => row.id !== topGain?.id) ?? holdRows[0];
  const actions: NextAction[] = [];

  if (topGain) {
    actions.push({
      id: `gain-${topGain.id}`,
      label: `Chase +${topGain.pointGain}`,
      title: topGain.athleteName,
      detail: `${topGain.eventTitle}: ${topGain.targetLabel}. ${topGain.competitorLabel}`,
      href: topGain.href,
      cta: "Open event",
      tone: "green",
    });
  }

  if (topHold) {
    actions.push({
      id: `hold-${topHold.id}`,
      label: `Protect ${topHold.currentPoints}`,
      title: topHold.athleteName,
      detail: `${topHold.eventTitle}: ${topHold.targetLabel} from seed #${topHold.seed}, ${topHold.markRaw}.`,
      href: topHold.href,
      cta: "Open event",
      tone: "amber",
    });
  }

  actions.push(
    {
      id: "rankings",
      label: "Lists",
      title: "See who is in",
      detail: "Check every state list and just-outside mark.",
      href: focusTeamHref("/rankings", focusTeam, classification),
      cta: "Open lists",
      tone: "navy",
    },
    {
      id: "scenarios",
      label: "Scores",
      title: "Change scores",
      detail: "Edit finish places and see the team points path event by event.",
      href: focusTeamHref("/virtual-state-meet", focusTeam, classification),
      cta: "Open scenarios",
      tone: "slate",
    },
  );

  return actions.slice(0, 4);
}

async function getStateContextData(
  classification: Classification,
  focusTeam: string,
): Promise<StateContextData> {
  const cacheKey = stateContextCacheKey(classification, focusTeam);
  const cached = stateContextByTeam.get(cacheKey);
  if (cached) return cached;

  const [virtualMeet, latestVerifiedMeetDate] = await Promise.all([
    getVirtualMeetForClassification(classification),
    getLatestVerifiedMeetDateForClassification(classification),
  ]);
  const boysContext = scoreContext(virtualMeet, "Boys", focusTeam);
  const girlsContext = scoreContext(virtualMeet, "Girls", focusTeam);
  const mix = pointMix(virtualMeet, focusTeam);
  const boysOutlook = buildStateWeekOutlook(
    virtualMeet,
    "Boys",
    focusTeam,
    classification,
  );
  const girlsOutlook = buildStateWeekOutlook(
    virtualMeet,
    "Girls",
    focusTeam,
    classification,
  );
  const data = {
    boysContext,
    girlsContext,
    mix,
    topScoringRows: mix.entries.slice(0, 8),
    teamTotal: boysContext.team.points + girlsContext.team.points,
    boysOutlook,
    girlsOutlook,
    nextActions: buildNextActions({
      boysOutlook,
      girlsOutlook,
      focusTeam,
      classification,
    }),
    latestVerifiedMeetDate,
    latestMeetLabel: latestVerifiedMeetDate
      ? formatMeetDate(latestVerifiedMeetDate)
      : "No marks",
  };

  stateContextByTeam.set(cacheKey, data);
  return data;
}

function StateProjectionCard({ outlook }: { outlook: StateWeekOutlook }) {
  const leaderPct = outlook.leader.points
    ? Math.min(
        100,
        Math.round((outlook.currentPoints / outlook.leader.points) * 100),
      )
    : 0;
  const highPct = outlook.leader.points
    ? Math.min(
        100,
        Math.round((outlook.highPoints / outlook.leader.points) * 100),
      )
    : 0;
  const accent =
    outlook.gender === "Girls"
      ? {
          border: "border-rose-200",
          wash: "bg-rose-50/35",
          rank: "text-rose-600",
        }
      : {
          border: "border-blue-200",
          wash: "bg-blue-50/35",
          rank: "text-blue-700",
        };

  return (
    <section
      className={`rounded-lg border ${accent.border} ${accent.wash} bg-white p-4`}
    >
      <div className="grid gap-4 md:grid-cols-[9rem_repeat(3,minmax(0,1fr))] md:items-center">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
            {outlook.gender} place now
          </div>
          <div
            className={`mt-1 text-4xl font-semibold leading-none ${accent.rank}`}
          >
            {rankText(outlook.currentRank)}
          </div>
          <div className="mt-1 text-xs font-medium text-slate-500">
            among teams with points
          </div>
        </div>
        <div className="border-t border-slate-200 pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
          <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
            Points now
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
            {outlook.currentPoints}
          </div>
          <div className="mt-1 text-xs text-emerald-700">
            +{outlook.pointGain} possible
          </div>
        </div>
        <div className="border-t border-slate-200 pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
          <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
            Best case
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
            {outlook.highPoints}
          </div>
          <div className="mt-1 text-xs text-slate-600">
            {rankText(outlook.highRank)}
          </div>
        </div>
        <div className="border-t border-slate-200 pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
          <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
            Events scoring
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
            {outlook.currentScoringEntries}
          </div>
          <div className="mt-1 text-xs text-slate-600">
            of {outlook.highScoringEntries} possible
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        <div className="h-2 rounded-full bg-slate-200/80">
          <div
            className="h-2 rounded-full bg-[#9bb7c8]"
            style={{ width: `${leaderPct}%` }}
          />
        </div>
        <div className="h-2 rounded-full bg-slate-200/80">
          <div
            className="h-2 rounded-full bg-[#2f6f5e]"
            style={{ width: `${highPct}%` }}
          />
        </div>
      </div>
    </section>
  );
}

function StateTargetList({ outlook }: { outlook: StateWeekOutlook }) {
  const rows = outlook.targetRows.length ? outlook.targetRows : outlook.holdRows;

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              {outlook.gender} ways to move up
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Current place is {rankText(outlook.currentRank)}. Best case is{" "}
              {rankText(outlook.highRank)} if these finishes happen.
            </p>
          </div>
          <div className="rounded-lg bg-[#eef4f2] px-3 py-2 text-right">
            <div className="text-lg font-semibold tabular-nums text-[#2f6f5e]">
              +{outlook.pointGain}
            </div>
            <div className="text-[11px] font-semibold uppercase text-[#2f6f5e]">
              pts
            </div>
          </div>
        </div>
        {outlook.reachableTeams.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {outlook.reachableTeams.map((team) => (
              <span
                key={`${outlook.gender}-${team.school}`}
                className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                +{team.pointsNeeded} catches {team.school} ({team.points})
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
            No nearby team can be caught with the simple best-case math here.
          </div>
        )}
      </div>

      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={row.href}
            className="grid gap-3 p-4 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f] focus-visible:ring-inset md:grid-cols-[minmax(0,1fr)_190px] md:items-center"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-[#f4f8fb] px-2.5 py-1 text-xs font-semibold text-[#16324f] ring-1 ring-[#d8e2ea]">
                  {row.actionLabel}
                </span>
                <span className="text-xs font-semibold uppercase tracking-normal text-slate-400">
                  seed #{row.seed}
                </span>
              </div>
              <div className="mt-2 break-words font-semibold text-slate-950">
                {row.athleteName}
              </div>
              <div className="mt-1 break-words text-sm text-slate-600">
                {row.eventTitle} - {row.markRaw}
              </div>
              <div className="mt-1 break-words text-xs leading-5 text-slate-500">
                {row.competitorLabel}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm leading-5">
              <div className="font-semibold text-slate-950">{row.targetLabel}</div>
              <div className="mt-1 text-xs text-slate-600">
                  {row.currentPoints} pts now -&gt; {row.targetPoints} pts if it works
              </div>
              <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#2f6f5e]">
                Open event <ArrowRight size={13} />
              </div>
            </div>
          </Link>
        ))}
        {!rows.length ? (
          <div className="p-4 text-sm leading-6 text-slate-600">
            No clear scoring chances for this side of the team yet.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function NextActionQueue({ actions }: { actions: NextAction[] }) {
  const toneClasses = {
    green: "border-emerald-200 bg-[#f2fbf7] text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    navy: "border-[#08233f] bg-[#08233f] text-white",
    slate: "border-slate-200 bg-white text-slate-950",
  };
  const labelClasses = {
    green: "text-emerald-700",
    amber: "text-amber-800",
    navy: "text-white/70",
    slate: "text-slate-500",
  };
  const detailClasses = {
    green: "text-emerald-950/70",
    amber: "text-amber-950/70",
    navy: "text-white/75",
    slate: "text-slate-600",
  };

  return (
    <section className="mb-5 overflow-hidden rounded-lg border border-[#cbd8e3] bg-white shadow-sm">
      <div className="border-b border-[#d8e2ea] p-3 sm:p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <Gauge size={18} className="text-[#16324f]" />
          Next actions
        </div>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-4">
        {actions.map((action) => (
          <Link
            key={action.id}
            href={action.href}
            className={`tap-row group flex min-h-40 flex-col rounded-lg border p-3 transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f] ${toneClasses[action.tone]}`}
          >
            <div
              className={`text-[11px] font-semibold uppercase tracking-normal ${labelClasses[action.tone]}`}
            >
              {action.label}
            </div>
            <div className="mt-2 break-words text-base font-semibold leading-5">
              {action.title}
            </div>
            <p
              className={`mt-2 flex-1 break-words text-sm leading-5 ${detailClasses[action.tone]}`}
            >
              {action.detail}
            </p>
            <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold">
              {action.cta}
              <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function StateWeekCommandCenter({
  boysOutlook,
  girlsOutlook,
  focusTeam,
  classification,
}: {
  boysOutlook: StateWeekOutlook;
  girlsOutlook: StateWeekOutlook;
  focusTeam: string;
  classification: Classification;
}) {
  return (
    <section className="mb-5 overflow-hidden rounded-lg border border-[#cbd8e3] bg-white shadow-sm">
      <div className="border-b border-[#d8e2ea] p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#16324f]">
              <Target size={18} />
              Team score
            </div>
            <h2 className="mt-2 max-w-3xl text-[1.55rem] font-semibold leading-tight tracking-normal text-slate-950 sm:text-3xl">
              Where {shortSchoolName(focusTeam)} stands right now
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Points now, possible points, and who can help.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href={focusTeamHref("/rankings", focusTeam, classification)}
              className="coach-action app-button-navy inline-flex items-center justify-center gap-2 px-4 text-sm"
            >
              Open lists
              <ArrowRight size={15} />
            </Link>
            <Link
              href={focusTeamHref("/virtual-state-meet", focusTeam, classification)}
              className="coach-action app-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm"
            >
              Change scores
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-b border-[#d8e2ea] bg-[#f8fafc] p-3 sm:p-4">
        <StateProjectionCard outlook={boysOutlook} />
        <StateProjectionCard outlook={girlsOutlook} />
      </div>

      <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-2">
        <StateTargetList outlook={boysOutlook} />
        <StateTargetList outlook={girlsOutlook} />
      </div>

      <details className="group border-t border-[#d8e2ea] bg-[#f8fbfc]">
        <summary className="tap-row flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-[#16324f] focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
          <span>How this math works</span>
          <ChevronDown size={16} className="transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 px-4 pb-4 text-sm leading-6 text-slate-700 lg:grid-cols-3">
          <div>
            <span className="font-semibold text-slate-950">Now</span>: entries
            are scored in current ranked order, 10-8-7-6-5-4-3-2-1.
          </div>
          <div>
            <span className="font-semibold text-slate-950">Best case</span>:
            your team&apos;s entries move up a reasonable amount. Everyone else
            stays in order.
          </div>
          <div>
            <span className="font-semibold text-slate-950">Targets</span>:
            rows show who must hold, move up, or reach the top nine.
          </div>
        </div>
      </details>
    </section>
  );
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const cookieStore = await cookies();
  const classification = resolveClassification(resolvedSearchParams.class);
  const savedFocusTeam = decodeFocusTeamCookie(
    cookieStore.get(focusTeamCookieName(classification))?.value,
  );
  const schoolOptions = await getSchoolOptionsForClassification(classification);
  const focusTeam = resolveFocusTeam(
    resolvedSearchParams.team ?? savedFocusTeam,
    schoolOptions,
    DEFAULT_FOCUS_TEAM,
  );
  const shortFocusTeam = shortSchoolName(focusTeam);
  const {
    boysContext,
    girlsContext,
    mix,
    topScoringRows,
    teamTotal,
    boysOutlook,
    girlsOutlook,
    nextActions,
    latestVerifiedMeetDate,
    latestMeetLabel,
  } = await getStateContextData(classification, focusTeam);

  return (
    <div>
      <PageHeader
        title={`${shortFocusTeam} Team Details`}
        description={`Points, next checks, and score paths for ${focusTeam}.`}
        actions={
          <>
            <ClassificationSelector currentClassification={classification} />
            <FocusTeamSelector
              schools={schoolOptions}
              currentTeam={focusTeam}
              classification={classification}
              label="Team"
            />
          </>
        }
      />

      <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Team points"
          value={teamTotal}
          detail={`Boys ${boysContext.team.points}, girls ${girlsContext.team.points}`}
          tone="navy"
        />
        <MetricCard
          label="Scoring entries"
          value={mix.entries.length}
          detail="Currently predicted to score."
        />
        <MetricCard
          label="Relay points"
          value={mix.relayPoints}
          detail={`${mix.individualPoints} individual points.`}
          tone="green"
        />
        <MetricCard
          label="Latest verified"
          value={latestMeetLabel}
          detail={
            latestVerifiedMeetDate
              ? "Newest verified meet in this class."
              : "No verified marks loaded."
          }
        />
      </section>

      <NextActionQueue actions={nextActions} />

      <StateWeekCommandCenter
        boysOutlook={boysOutlook}
        girlsOutlook={girlsOutlook}
        focusTeam={focusTeam}
        classification={classification}
      />

      <details className="coach-surface group mt-5 overflow-hidden rounded-lg">
        <summary className="tap-row flex min-h-16 cursor-pointer list-none items-start justify-between gap-4 p-4 text-base font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-[#16324f] focus-visible:ring-inset sm:p-5 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            More details
            <span className="mt-1 block text-sm font-normal leading-6 text-slate-600">
              Points, score bars, and event details for {focusTeam}.
            </span>
          </span>
          <span className="inline-flex h-10 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
            Show
            <ChevronDown
              size={16}
              className="transition group-open:rotate-180"
            />
          </span>
        </summary>

        <div className="border-t border-slate-200 p-3 sm:p-5">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <Target size={18} className="text-[#2f6f5e]" />
                  Score picture
                </div>
                <h2 className="mt-3 max-w-3xl text-xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-2xl">
                  {shortFocusTeam} is projected for {teamTotal} total points.
                </h2>
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <ScoreBar label="Boys" context={boysContext} focusTeam={focusTeam} />
                  <ScoreBar label="Girls" context={girlsContext} focusTeam={focusTeam} />
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <BarChart3 size={18} className="text-[#16324f]" />
                  Point mix
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">
                      Team points
                    </div>
                    <div className="mt-1 text-3xl font-semibold tabular-nums">
                      {teamTotal}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Boys {boysContext.team.points}, girls{" "}
                      {girlsContext.team.points}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">
                      Relays
                    </div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">
                      {mix.relayPoints}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">
                      Individuals
                    </div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">
                      {mix.individualPoints}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-5 grid gap-5 [contain-intrinsic-size:760px] [content-visibility:auto] xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-5">
                <h2 className="text-base font-semibold text-slate-950">
                  Events scoring now
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Events where {focusTeam} is currently predicted to score.
                </p>
              </div>
              <div className="overflow-hidden">
                <div className="divide-y divide-slate-100 md:hidden">
                  {topScoringRows.map((entry) => (
                    <Link
                      key={entry.id}
                      href={focusTeamHref(
                        rankingPath(
                          entry.eventGender,
                          getEventDefinition(entry.event).slug,
                        ),
                        focusTeam,
                        classification,
                      )}
                      className="block p-4 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f] focus-visible:ring-inset"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="break-words font-semibold text-slate-950">
                            {entry.eventGender} {entry.eventName}
                          </div>
                          <div className="mt-1 break-words text-sm text-slate-600">
                            {entry.athleteName}
                          </div>
                          <div className="mt-1 text-sm tabular-nums text-slate-500">
                            Seed #{entry.seed}, {entry.markRaw}
                          </div>
                        </div>
                        <div className="shrink-0 rounded-md bg-slate-50 px-3 py-2 text-center">
                          <div className="text-xl font-semibold tabular-nums text-slate-950">
                            {entry.projectedPoints}
                          </div>
                          <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                            pts
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#2f6f5e]">
                        Open ranking <ArrowRight size={14} />
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="app-data-table min-w-[720px] table-fixed">
                    <colgroup>
                      <col className="w-[28%]" />
                      <col className="w-[30%]" />
                      <col className="w-[17%]" />
                      <col className="w-[10%]" />
                      <col className="w-[15%]" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="px-4 py-3 font-semibold">Event</th>
                        <th className="px-4 py-3 font-semibold">Athlete / relay</th>
                        <th className="px-4 py-3 font-semibold">Seed</th>
                        <th className="px-4 py-3 font-semibold">Points</th>
                        <th className="px-4 py-3 font-semibold">Open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topScoringRows.map((entry) => (
                        <tr key={entry.id} className="border-t border-slate-100">
                          <td className="break-words px-4 py-3 font-medium text-slate-950">
                            {entry.eventGender} {entry.eventName}
                          </td>
                          <td className="break-words px-4 py-3">{entry.athleteName}</td>
                          <td className="px-4 py-3 tabular-nums">
                            #{entry.seed}, {entry.markRaw}
                          </td>
                          <td className="px-4 py-3 text-lg font-semibold tabular-nums">
                            {entry.projectedPoints}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={focusTeamHref(
                                rankingPath(
                                  entry.eventGender,
                                  getEventDefinition(entry.event).slug,
                                ),
                                focusTeam,
                                classification,
                              )}
                              className="inline-flex items-center gap-1 text-sm font-semibold text-[#2f6f5e]"
                            >
                              Ranking <ArrowRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!topScoringRows.length ? (
                  <div className="p-5 text-sm leading-6 text-slate-600">
                    No projected state scoring entries for {focusTeam} in the
                    current seed model.
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Gauge size={18} className="text-[#16324f]" />
                Quick checks
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Link
                  href={focusTeamHref("/virtual-state-meet", focusTeam, classification)}
                  className="min-h-24 rounded-md border border-slate-200 p-4 transition hover:border-[#2f6f5e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f]"
                >
                  <div className="font-semibold text-slate-950">
                    Open team scores
                  </div>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Open each team to see exactly who scores where, then edit
                    finishes to test a climb path.
                  </p>
                </Link>
                <Link
                  href={focusTeamHref("/rankings/boys-400", focusTeam, classification)}
                  className="min-h-24 rounded-md border border-slate-200 p-4 transition hover:border-[#2f6f5e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f]"
                >
                  <div className="font-semibold text-slate-950">
                    Open event list
                  </div>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Move quickly from one state event page to another without
                    returning to the dashboard.
                  </p>
                </Link>
                <Link
                  href={focusTeamHref("/event-squads", focusTeam, classification)}
                  className="min-h-24 rounded-md border border-slate-200 p-4 transition hover:border-[#2f6f5e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f]"
                >
                  <div className="font-semibold text-slate-950">
                    Make picture
                  </div>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Create a Top 4 graphic from verified marks.
                  </p>
                </Link>
              </div>
            </section>
          </div>
        </div>
      </details>
    </div>
  );
}
