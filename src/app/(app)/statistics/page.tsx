import Link from "next/link";
import { cookies } from "next/headers";
import { BarChart3, Medal, Trophy, Users } from "lucide-react";
import { ClassificationSelector } from "@/components/ClassificationSelector";
import { FocusTeamSelector } from "@/components/FocusTeamSelector";
import { AppPanel, AppPanelHeader, SimpleSteps } from "@/components/AppPrimitives";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { getEventDefinition } from "@/lib/data/events";
import {
  getPerformancesForClassification,
  getRankingsForClassification,
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
  EventDiscipline,
  Gender,
  RankingResult,
  TeamScore,
  VirtualStateMeet,
} from "@/types/domain";

type CombinedTeamScore = {
  school: string;
  boysPoints: number;
  girlsPoints: number;
  points: number;
  scoringEntries: number;
};

type FocusEntry = {
  id: string;
  athleteName: string;
  school: string;
  gender: Gender;
  event: string;
  eventSlug: string;
  eventTitle: string;
  discipline: EventDiscipline;
  relay: boolean;
  seed: number;
  markRaw: string;
  projectedPlace?: number;
  projectedPoints: number;
};

type DisciplineRow = {
  discipline: EventDiscipline;
  eventFields: number;
  top18Entries: number;
  focusScoringEntries: number;
  focusPoints: number;
};

const disciplineLabels: Record<EventDiscipline, string> = {
  sprint: "Sprints",
  hurdle: "Hurdles",
  distance: "Distance",
  relay: "Relays",
  jump: "Jumps",
  throw: "Throws",
};

function formatDenverDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPoints(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function rankLabel(index: number | undefined) {
  return index === undefined ? "Unranked" : `#${index + 1}`;
}

function genderScores(virtualMeet: VirtualStateMeet, gender: Gender) {
  return virtualMeet.teamScores
    .filter((score) => score.gender === gender)
    .sort((a, b) => b.points - a.points || a.school.localeCompare(b.school));
}

function scoreForGender(
  virtualMeet: VirtualStateMeet,
  focusTeam: string,
  gender: Gender,
) {
  const scores = genderScores(virtualMeet, gender);
  const index = scores.findIndex((score) => score.school === focusTeam);
  const score: TeamScore = scores[index] ?? {
    school: focusTeam,
    gender,
    points: 0,
    scoringEntries: 0,
  };

  return {
    score,
    rank: index >= 0 ? index : undefined,
    leader: scores[0],
  };
}

function combinedTeamScores(virtualMeet: VirtualStateMeet) {
  const bySchool = new Map<string, CombinedTeamScore>();

  for (const score of virtualMeet.teamScores) {
    const existing = bySchool.get(score.school) ?? {
      school: score.school,
      boysPoints: 0,
      girlsPoints: 0,
      points: 0,
      scoringEntries: 0,
    };

    if (score.gender === "Boys") {
      existing.boysPoints += score.points;
    } else if (score.gender === "Girls") {
      existing.girlsPoints += score.points;
    }

    existing.points += score.points;
    existing.scoringEntries += score.scoringEntries;
    bySchool.set(score.school, existing);
  }

  return [...bySchool.values()].sort(
    (a, b) => b.points - a.points || a.school.localeCompare(b.school),
  );
}

function focusEntries(virtualMeet: VirtualStateMeet, focusTeam: string) {
  return virtualMeet.events
    .flatMap((event) => {
      const definition = getEventDefinition(event.event);

      return event.entries
        .filter((entry) => entry.school === focusTeam)
        .map(
          (entry): FocusEntry => ({
            id: entry.id,
            athleteName: entry.athleteName,
            school: entry.school,
            gender: event.gender,
            event: event.event,
            eventSlug: definition.slug,
            eventTitle: definition.displayName,
            discipline: definition.discipline,
            relay: definition.relay,
            seed: entry.seed,
            markRaw: entry.markRaw,
            projectedPlace: entry.projectedPlace,
            projectedPoints: entry.projectedPoints,
          }),
        );
    })
    .sort(
      (a, b) =>
        b.projectedPoints - a.projectedPoints ||
        a.seed - b.seed ||
        a.gender.localeCompare(b.gender) ||
        a.eventTitle.localeCompare(b.eventTitle),
    );
}

function disciplineRows(
  rankings: RankingResult[],
  scoringEntries: FocusEntry[],
): DisciplineRow[] {
  const byDiscipline = new Map<EventDiscipline, DisciplineRow>();

  function getRow(discipline: EventDiscipline) {
    const existing = byDiscipline.get(discipline);
    if (existing) return existing;

    const row = {
      discipline,
      eventFields: 0,
      top18Entries: 0,
      focusScoringEntries: 0,
      focusPoints: 0,
    };
    byDiscipline.set(discipline, row);
    return row;
  }

  for (const ranking of rankings) {
    const row = getRow(getEventDefinition(ranking.event).discipline);
    row.eventFields += 1;
    row.top18Entries += ranking.top18.length;
  }

  for (const entry of scoringEntries) {
    const row = getRow(entry.discipline);
    row.focusScoringEntries += 1;
    row.focusPoints += entry.projectedPoints;
  }

  return [...byDiscipline.values()].sort(
    (a, b) =>
      b.focusPoints - a.focusPoints ||
      b.focusScoringEntries - a.focusScoringEntries ||
      disciplineLabels[a.discipline].localeCompare(disciplineLabels[b.discipline]),
  );
}

function latestMeetDate(values: string[]) {
  return values.reduce<string | undefined>(
    (latest, value) => (!latest || value > latest ? value : latest),
    undefined,
  );
}

export default async function StatisticsPage({
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
  const [schoolOptions, virtualMeet, rankings, performances] = await Promise.all([
    getSchoolOptionsForClassification(classification),
    getVirtualMeetForClassification(classification),
    getRankingsForClassification(classification),
    getPerformancesForClassification(classification),
  ]);
  const focusTeam = resolveFocusTeam(
    resolvedSearchParams.team ?? savedFocusTeam,
    schoolOptions,
    DEFAULT_FOCUS_TEAM,
  );
  const shortFocusTeam = shortSchoolName(focusTeam);
  const entries = focusEntries(virtualMeet, focusTeam);
  const scoringEntries = entries.filter((entry) => entry.projectedPoints > 0);
  const boys = scoreForGender(virtualMeet, focusTeam, "Boys");
  const girls = scoreForGender(virtualMeet, focusTeam, "Girls");
  const combinedScores = combinedTeamScores(virtualMeet);
  const combinedRank = combinedScores.findIndex(
    (score) => score.school === focusTeam,
  );
  const focusCombined = combinedScores[combinedRank] ?? {
    school: focusTeam,
    boysPoints: boys.score.points,
    girlsPoints: girls.score.points,
    points: boys.score.points + girls.score.points,
    scoringEntries: boys.score.scoringEntries + girls.score.scoringEntries,
  };
  const verifiedMarks = performances.filter((performance) =>
    ["verified", "manual_approved"].includes(performance.verificationStatus),
  );
  const latestMeet = latestMeetDate(performances.map((performance) => performance.meetDate));
  const top18Spots = rankings.reduce(
    (sum, ranking) => sum + ranking.top18.length,
    0,
  );
  const bubbleRows = rankings.reduce((sum, ranking) => sum + ranking.bubble.length, 0);
  const relayPoints = scoringEntries
    .filter((entry) => entry.relay)
    .reduce((sum, entry) => sum + entry.projectedPoints, 0);
  const individualPoints = focusCombined.points - relayPoints;
  const mixRows = disciplineRows(rankings, scoringEntries);
  const leaderRows = combinedScores.slice(0, 10);
  const top18Rows = entries.slice(0, 12);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Statistics"
        description={`Team and classification statistics for ${shortFocusTeam} in CHSAA ${classification}.`}
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

      <SimpleSteps
        title="Use this for"
        steps={[
          {
            title: "Team score",
            detail: "See points by boys, girls, relay, and individual events.",
          },
          {
            title: "State lists",
            detail: "See how many state-list spots and marks are loaded.",
          },
          {
            title: "Event mix",
            detail: "Find which event groups drive the scoring model.",
          },
        ]}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Team points"
          value={formatPoints(focusCombined.points)}
          detail={`${rankLabel(combinedRank)} combined, boys ${formatPoints(
            boys.score.points,
          )}, girls ${formatPoints(girls.score.points)}.`}
          tone="navy"
        />
        <MetricCard
          label="Scoring entries"
          value={scoringEntries.length}
          detail={`${formatPoints(individualPoints)} individual points and ${formatPoints(
            relayPoints,
          )} relay points.`}
          tone="green"
        />
        <MetricCard
          label="State-list entries"
          value={entries.length}
          detail={`${shortFocusTeam} entries currently inside a state field.`}
        />
        <MetricCard
          label="Loaded marks"
          value={formatNumber(verifiedMarks.length)}
          detail={`${formatNumber(performances.length)} total ${classification} marks. Latest meet ${
            latestMeet ?? "unknown"
          }.`}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <AppPanel>
          <AppPanelHeader
            label="Team"
            title={`${shortFocusTeam} scoring profile`}
            description={`Made ${formatDenverDateTime(
              virtualMeet.generatedAt,
            )} MT from the current state list.`}
          />
          <div className="grid gap-3 p-3 md:grid-cols-2">
            {[
              {
                label: "Boys",
                icon: Trophy,
                summary: boys,
                leader: boys.leader,
              },
              {
                label: "Girls",
                icon: Medal,
                summary: girls,
                leader: girls.leader,
              },
            ].map((item) => {
              const Icon = item.icon;
              const leaderPoints = item.leader?.points ?? 0;
              const pct = leaderPoints
                ? Math.min(100, Math.round((item.summary.score.points / leaderPoints) * 100))
                : 0;

              return (
                <article
                  key={item.label}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <Icon size={18} className="text-[#16324f]" />
                    {item.label}
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-3xl font-semibold tabular-nums text-slate-950">
                        {formatPoints(item.summary.score.points)}
                      </div>
                      <div className="mt-1 text-xs font-semibold uppercase tracking-normal text-slate-500">
                        {rankLabel(item.summary.rank)} team rank
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold text-slate-600">
                      {item.summary.score.scoringEntries} scoring entries
                    </div>
                  </div>
                  <div className="mt-4 h-3 rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full bg-[#2f6f5e]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Leader: {item.leader?.school ?? "No scored team"} (
                    {formatPoints(item.leader?.points ?? 0)}).
                  </p>
                </article>
              );
            })}
          </div>
        </AppPanel>

        <AppPanel>
          <AppPanelHeader
            label="Classification"
            title={`${classification} data coverage`}
            description={`${rankings.length} event fields, ${formatNumber(
              top18Spots,
            )} state-list rows, and ${formatNumber(bubbleRows)} just-outside rows are available.`}
          />
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">
                Schools
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {schoolOptions.length}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">
                Event fields
              </div>
              <div className="mt-1 text-2xl font-semibold">{rankings.length}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">
                State-list rows
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {formatNumber(top18Spots)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">
                Just outside
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {formatNumber(bubbleRows)}
              </div>
            </div>
          </div>
        </AppPanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <AppPanel>
          <AppPanelHeader
            label="Events"
            title="Scoring by event group"
            description={`Where ${shortFocusTeam}'s points come from, compared with available state-list depth.`}
          />
          <div className="app-table-wrap">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Points</th>
                  <th>Scorers</th>
                  <th>State-list rows</th>
                </tr>
              </thead>
              <tbody>
                {mixRows.map((row) => (
                  <tr key={row.discipline}>
                    <td className="font-semibold text-slate-950">
                      {disciplineLabels[row.discipline]}
                    </td>
                    <td className="tabular-nums">
                      {formatPoints(row.focusPoints)}
                    </td>
                    <td className="tabular-nums">{row.focusScoringEntries}</td>
                    <td className="tabular-nums">
                      {formatNumber(row.top18Entries)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppPanel>

        <AppPanel>
          <AppPanelHeader
            label="Leaders"
            title="Team totals"
            description="Boys and girls points are added together here."
          />
          <div className="app-table-wrap">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>School</th>
                  <th>Boys</th>
                  <th>Girls</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {leaderRows.map((score, index) => {
                  const focused = score.school === focusTeam;

                  return (
                    <tr
                      key={score.school}
                      className={focused ? "bg-emerald-50/60" : undefined}
                    >
                      <td className="font-semibold tabular-nums">#{index + 1}</td>
                      <td className="font-semibold text-slate-950">
                        {score.school}
                      </td>
                      <td className="tabular-nums">
                        {formatPoints(score.boysPoints)}
                      </td>
                      <td className="tabular-nums">
                        {formatPoints(score.girlsPoints)}
                      </td>
                      <td className="font-semibold tabular-nums">
                        {formatPoints(score.points)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AppPanel>
      </section>

      <AppPanel>
        <AppPanelHeader
          label="State list"
          title={`${shortFocusTeam} state-field entries`}
          description="Scoring entries show first, followed by other state-list entries."
          actions={
            <Link
              href={focusTeamHref("/rankings", focusTeam, classification)}
              className="coach-action app-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm"
            >
              <BarChart3 size={16} />
              Open lists
            </Link>
          }
        />
        <div className="app-table-wrap">
          <table className="app-data-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Athlete</th>
                <th>Seed</th>
                <th>Place</th>
                <th>Points</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {top18Rows.map((entry) => (
                <tr key={entry.id}>
                  <td className="font-semibold text-slate-950">
                    {entry.gender} {entry.eventTitle}
                  </td>
                  <td>{entry.athleteName}</td>
                  <td className="tabular-nums">#{entry.seed}</td>
                  <td className="tabular-nums">
                    {entry.projectedPlace ? `#${entry.projectedPlace}` : "-"}
                  </td>
                  <td className="font-semibold tabular-nums">
                    {formatPoints(entry.projectedPoints)}
                  </td>
                  <td>
                    <Link
                      href={focusTeamHref(
                        rankingPath(entry.gender, entry.eventSlug),
                        focusTeam,
                        classification,
                      )}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-[#2f6f5e]"
                    >
                      Ranking <Medal size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!top18Rows.length ? (
            <div className="p-5 text-sm leading-6 text-slate-600">
              No {shortFocusTeam} entries are inside the current state lists.
            </div>
          ) : null}
        </div>
      </AppPanel>

      <section className="grid gap-3 md:grid-cols-3">
        <Link
          href={focusTeamHref("/virtual-state-meet", focusTeam, classification)}
          className="tap-row rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#2f6f5e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f]"
        >
          <Trophy size={19} className="text-[#16324f]" />
          <div className="mt-3 font-semibold text-slate-950">
            Change scores
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Edit finishes and see how the statistics change.
          </p>
        </Link>
        <Link
          href={focusTeamHref("/event-squads", focusTeam, classification)}
          className="tap-row rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#2f6f5e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f]"
        >
          <Users size={19} className="text-[#16324f]" />
          <div className="mt-3 font-semibold text-slate-950">
            Make picture
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Turn event depth into a Top 4 graphic.
          </p>
        </Link>
        <Link
          href={focusTeamHref("/", focusTeam, classification)}
          className="tap-row rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#2f6f5e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f]"
        >
          <Medal size={19} className="text-[#16324f]" />
          <div className="mt-3 font-semibold text-slate-950">
            Back to start
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Return to the start page.
          </p>
        </Link>
      </section>
    </div>
  );
}
