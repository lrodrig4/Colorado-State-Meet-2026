import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  ChevronDown,
  CheckCircle2,
  Gauge,
  GitBranch,
  Medal,
  Target,
  Trophy,
} from "lucide-react";
import { AutoUpdatePanel } from "@/components/AutoUpdatePanel";
import { ClassificationSelector } from "@/components/ClassificationSelector";
import { FocusTeamSelector } from "@/components/FocusTeamSelector";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { autoUpdatePolicy } from "@/lib/data/providers";
import { getEventDefinition } from "@/lib/data/events";
import { meets } from "@/lib/data/meets";
import type { LastChanceRecommendation } from "@/lib/services/lastChance";
import {
  getLastChanceDashboardForTeam,
  getPerformancesForClassification,
  getRankingsForClassification,
  getReviewQueue,
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
import { coachCall, coachCallClass } from "@/lib/utils/coachCall";
import { rankingPath } from "@/lib/utils/rankingRoutes";
import type { Classification, Gender, VirtualStateMeet } from "@/types/domain";

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
  const palmerIndex = scores.findIndex((score) => score.school === focusTeam);
  const palmer = scores[palmerIndex] ?? {
    school: focusTeam,
    gender,
    points: 0,
    scoringEntries: 0,
  };
  const leader = scores[0] ?? palmer;
  const nextAhead = palmerIndex > 0 ? scores[palmerIndex - 1] : undefined;

  return {
    palmer,
    leader,
    nextAhead,
    rank: palmerIndex >= 0 ? palmerIndex + 1 : undefined,
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
    ? Math.min(100, Math.round((context.palmer.points / context.leader.points) * 100))
    : 0;

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-950">
            {label} team
          </div>
          <div className="text-xs text-slate-500">
            {context.rank ? `Projected rank ${context.rank}` : "No projected points"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums text-slate-950">
            {context.palmer.points}
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
          : "Projected leader right now."}
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

function priorityHref(
  row: LastChanceRecommendation,
  focusTeam: string,
  classification: Classification,
) {
  return focusTeamHref(
    rankingPath(row.gender, getEventDefinition(row.event).slug),
    focusTeam,
    classification,
  );
}

function isDefendCandidate(row: LastChanceRecommendation) {
  if (row.rank > 18) return false;

  const nearCutLine = row.rank >= 14;
  const modeledToMoveOut = row.gapValue > 0;
  const shakyHold = row.holdProbability < 84 || row.stateProbability < 84;

  return (
    row.status === "At risk" ||
    (nearCutLine && shakyHold) ||
    (nearCutLine && modeledToMoveOut)
  );
}

function isChaseCandidate(row: LastChanceRecommendation) {
  if (row.rank <= 18) return false;

  const closeEnoughRank = row.rank <= 40 && row.improveProbability >= 28;
  const realisticLongBubble = row.rank <= 36 && row.stateProbability >= 8;
  const distanceUpside =
    row.event === "3200m" &&
    row.rank <= 42 &&
    (row.improveProbability >= 20 || row.gapValue <= 20);

  return (
    row.status === "Must race" ||
    row.stateProbability >= 20 ||
    row.improveProbability >= 48 ||
    closeEnoughRank ||
    realisticLongBubble ||
    distanceUpside ||
    (row.grade === 12 && row.improveProbability >= 60)
  );
}

function dashboardPriorityScore(row: LastChanceRecommendation) {
  const action = coachCall(row);
  const defendCandidate = isDefendCandidate(row);
  const chaseCandidate = isChaseCandidate(row);
  const nearCutLineSeed = row.rank <= 18 ? Math.max(0, row.rank - 10) : 0;
  const defensePressure = row.rank <= 18
    ? nearCutLineSeed * 16 +
      Math.max(0, 100 - row.stateProbability) * 4 +
      Math.max(0, 100 - row.holdProbability) * 2
    : 0;
  const chasePressure = row.rank > 18
    ? row.stateProbability * 4 +
      row.improveProbability * 2 +
      (row.grade === 12 ? 60 : 0)
    : 0;
  const longShotPenalty = row.status === "Long shot" && row.rank > 18 ? 220 : 0;

  return (
    (defendCandidate ? 1_800 : 0) +
    (chaseCandidate ? 1_400 : 0) +
    (action.urgent ? 240 : 0) +
    defensePressure +
    chasePressure +
    row.priorityScore / 40 -
    longShotPenalty
  );
}

function selectPriorityRows(rows: LastChanceRecommendation[]) {
  return rows
    .filter((row) => {
      const action = coachCall(row);

      return (
        isDefendCandidate(row) ||
        isChaseCandidate(row) ||
        (action.urgent && row.status !== "Likely safe")
      );
    })
    .sort((a, b) => {
      const score = dashboardPriorityScore(b) - dashboardPriorityScore(a);
      if (score !== 0) return score;
      return a.eventLabel.localeCompare(b.eventLabel);
    })
    .slice(0, 10);
}

function DecisionBucket({
  title,
  count,
  detail,
  rows,
  tone,
  focusTeam,
  classification,
}: {
  title: string;
  count: number;
  detail: string;
  rows: LastChanceRecommendation[];
  tone: "green" | "amber" | "rose" | "navy";
  focusTeam: string;
  classification: Classification;
}) {
  const toneClass = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    navy: "border-[#c9d8e6] bg-[#f4f8fb] text-[#0f2a47]",
  }[tone];
  const previewRows = rows.slice(0, 3);
  const hiddenCount = rows.length - previewRows.length;

  return (
    <details
      className={`group overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}
    >
      <summary className="tap-row cursor-pointer list-none p-4 outline-none focus-visible:ring-2 focus-visible:ring-[#16324f] focus-visible:ring-offset-2 sm:p-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold uppercase tracking-[0.05em]">{title}</div>
            <div className="mt-2 text-4xl font-semibold tabular-nums">
              {count}
            </div>
          </div>
          <span className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full bg-white/75 px-3 text-xs font-semibold ring-1 ring-black/5">
            View
            <ChevronDown
              size={16}
              className="transition group-open:rotate-180"
            />
          </span>
        </div>
        <p className="mt-2 text-sm leading-5 opacity-80">{detail}</p>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.08em] opacity-70">
          <span>{count} in this team view</span>
          <span>Tap for names</span>
        </div>
        {rows.length > 0 ? (
          <div className="mt-3 space-y-1.5">
            {previewRows.map((row) => (
              <div
                key={row.id}
                className="break-words rounded-lg bg-white/78 px-2.5 py-2 text-xs font-semibold leading-4 ring-1 ring-black/5"
              >
                {row.athleteName} ·{" "}
                {row.eventLabel.replace(`${row.gender} `, "")} ·{" "}
                {row.rankLabel}
              </div>
            ))}
            {hiddenCount > 0 ? (
              <div className="rounded-lg bg-white/55 px-2.5 py-2 text-xs font-semibold leading-4 ring-1 ring-black/5">
                + {hiddenCount} more. Tap to open the full team list.
              </div>
            ) : null}
          </div>
        ) : null}
      </summary>
      <div className="border-t border-current/10 bg-white/52 px-4 pb-4 pt-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] opacity-70">
          {title} for {focusTeam}
        </div>
        {rows.length > 0 ? (
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={priorityHref(row, focusTeam, classification)}
                prefetch={false}
                className="tap-row grid min-h-14 gap-1 rounded-xl bg-white/85 px-3 py-3 text-sm font-semibold leading-5 ring-1 ring-black/5 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="min-w-0 break-words">
                  {row.athleteName} ·{" "}
                  {row.eventLabel.replace(`${row.gender} `, "")}
                </span>
                <span className="text-xs opacity-70 sm:text-right">
                  {row.rankLabel} · {row.stateProbability}%
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold ring-1 ring-black/5">
            No athletes or relays in this bucket for the selected team.
          </div>
        )}
      </div>
    </details>
  );
}

function CoachDecisionSummary({
  rows,
  focusTeam,
  classification,
}: {
  rows: LastChanceRecommendation[];
  focusTeam: string;
  classification: Classification;
}) {
  const safeRows = rows
    .filter(
      (row) =>
        row.rank <= 18 &&
        row.stateProbability >= 88 &&
        !getEventDefinition(row.event).relay,
    )
    .sort((a, b) => a.rank - b.rank);
  const defendRows = rows
    .filter((row) => isDefendCandidate(row))
    .sort((a, b) => a.stateProbability - b.stateProbability || b.rank - a.rank);
  const chaseRows = rows
    .filter((row) => isChaseCandidate(row))
    .sort((a, b) => {
      const score = dashboardPriorityScore(b) - dashboardPriorityScore(a);
      if (score !== 0) return score;
      return b.stateProbability - a.stateProbability;
    });
  const relayRows = rows
    .filter((row) => getEventDefinition(row.event).relay)
    .sort((a, b) => a.rank - b.rank);

  return (
    <section className="mb-5">
      <div className="coach-surface mb-3 rounded-2xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Start here: {shortSchoolName(focusTeam)} decisions
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Four coach-readable buckets. Open one only when you need the full list.
            </p>
          </div>
          <Link
            href={focusTeamHref("/rankings", focusTeam, classification)}
            prefetch={false}
            className="coach-action inline-flex w-full items-center justify-center gap-2 border border-[#16324f] bg-white px-4 text-sm text-[#16324f] transition hover:bg-[#f4f8fb] sm:w-auto"
          >
            Full cutoff board
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DecisionBucket
          title="Defend"
          count={defendRows.length}
          detail="Inside the Top 18, but close enough to protect."
          rows={defendRows}
          tone="amber"
          focusTeam={focusTeam}
          classification={classification}
        />
        <DecisionBucket
          title="Must chase"
          count={chaseRows.length}
          detail="Outside the Top 18 with a realistic state path."
          rows={chaseRows}
          tone="rose"
          focusTeam={focusTeam}
          classification={classification}
        />
        <DecisionBucket
          title="Safe"
          count={safeRows.length}
          detail="Likely in if nothing changes."
          rows={safeRows}
          tone="green"
          focusTeam={focusTeam}
          classification={classification}
        />
        <DecisionBucket
          title="Relay decisions"
          count={relayRows.length}
          detail="Relay entries to check before racing again."
          rows={relayRows}
          tone="navy"
          focusTeam={focusTeam}
          classification={classification}
        />
      </div>
    </section>
  );
}

function CoachStartHere({
  focusTeam,
  classification,
}: {
  focusTeam: string;
  classification: Classification;
}) {
  return (
    <section className="coach-surface mb-5 overflow-hidden rounded-2xl">
      <div className="grid gap-0 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="bg-[#102b47] p-5 text-white xl:border-r xl:border-[#d8e2ea]">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#bdd7ea]">
            <Target size={18} />
            Selected team
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-normal">
            {focusTeam}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#d9e6ef]">
            CHSAA {classification}. The app should answer one thing first:
            who needs action before state declarations?
          </p>
        </div>
        <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              icon: Medal,
              step: "1",
              title: "Check the Top 18",
              copy:
                "See who is in, who is on the bubble, and where the cutoff sits.",
              href: focusTeamHref("/rankings", focusTeam, classification),
            },
            {
              icon: GitBranch,
              step: "2",
              title: "St. Vrain entries",
              copy:
                "Live entries, heat estimates, and state-mark chances.",
              href: focusTeamHref("/weekend-plan", focusTeam, classification),
            },
            {
              icon: BarChart3,
              step: "3",
              title: "Check the depth chart",
              copy:
                "Find verified athletes by event for relay and backup decisions.",
              href: `${focusTeamHref(
                "/weekend-plan",
                focusTeam,
                classification,
              )}#depth-chart`,
            },
            {
              icon: Trophy,
              step: "4",
              title: "Test team points",
              copy:
                "See projected points and edit finishes for what-if scenarios.",
              href: focusTeamHref("/virtual-state-meet", focusTeam, classification),
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                prefetch={false}
                className="tap-row group min-h-28 border-b border-[#edf2f6] p-4 transition hover:bg-[#f6faf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f] focus-visible:ring-inset sm:[&:nth-child(odd)]:border-r xl:[&:not(:last-child)]:border-r"
              >
                <div className="flex items-start gap-3">
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#d8e2ea] bg-white text-[#16324f] shadow-sm">
                    <Icon size={18} />
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#2f6f5e] text-[11px] font-semibold text-white">
                      {item.step}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-950 group-hover:text-[#2f6f5e]">
                      {item.title}
                    </div>
                    <p className="mt-1 text-sm leading-5 text-slate-600">
                      {item.copy}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      <details className="group border-t border-[#d8e2ea] bg-[#f8fbfc]">
        <summary className="tap-row flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-[#16324f] focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
          <span>What do the odds mean?</span>
          <ChevronDown size={16} className="transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 px-4 pb-4 text-sm leading-6 text-slate-700 lg:grid-cols-3">
          <div>
            <span className="font-semibold text-slate-950">State odds</span>:
            chance this entry makes state after cutoff movement and scratches.
          </div>
          <div>
            <span className="font-semibold text-slate-950">Hold odds</span>:
            chance the current mark survives if they do not improve.
          </div>
          <div>
            <span className="font-semibold text-slate-950">Improve odds</span>:
            chance they improve enough this weekend to change the decision.
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
  const schoolOptions = getSchoolOptionsForClassification(classification);
  const focusTeam = resolveFocusTeam(
    resolvedSearchParams.team ?? savedFocusTeam,
    schoolOptions,
    DEFAULT_FOCUS_TEAM,
  );
  const shortFocusTeam = shortSchoolName(focusTeam);
  const rankings = getRankingsForClassification(classification);
  const reviewQueue = getReviewQueue();
  const virtualMeet = getVirtualMeetForClassification(classification);
  const lastChance = getLastChanceDashboardForTeam(classification, focusTeam);
  const verifiedCount = getPerformancesForClassification(classification).filter(
    (performance) =>
      performance.verificationStatus === "verified",
  ).length;

  const boysContext = scoreContext(virtualMeet, "Boys", focusTeam);
  const girlsContext = scoreContext(virtualMeet, "Girls", focusTeam);
  const mix = pointMix(virtualMeet, focusTeam);
  const focusRows = lastChance.recommendations.filter((row) => row.isFocusTeam);
  const priorityRows = selectPriorityRows(focusRows);
  const mustRaceRows = priorityRows.filter(
    (row) => coachCall(row).urgent,
  );
  const topScoringRows = mix.entries.slice(0, 6);
  const teamTotal = boysContext.palmer.points + girlsContext.palmer.points;
  const cutoffConfidenceAverage = lastChance.predictions.length
    ? Math.round(
        lastChance.predictions.reduce(
          (sum, prediction) => sum + prediction.confidenceScore,
          0,
        ) / lastChance.predictions.length,
      )
    : 0;
  const lowestConfidenceCutoff = [...lastChance.predictions].sort(
    (a, b) => a.confidenceScore - b.confidenceScore,
  )[0];

  return (
    <div>
      <PageHeader
        title={`Coach dashboard: ${shortFocusTeam}`}
        description={`You are viewing ${focusTeam} in CHSAA ${classification}. Start with the decision cards, then open details only when needed.`}
        actions={
          <>
            <ClassificationSelector currentClassification={classification} />
            <FocusTeamSelector
              schools={schoolOptions}
              currentTeam={focusTeam}
              classification={classification}
              label={`${classification} team`}
            />
            <Link
              href={focusTeamHref("/rankings", focusTeam, classification)}
              prefetch={false}
              className="coach-action inline-flex w-full items-center justify-center gap-2 bg-[#102b47] px-4 text-sm text-white sm:w-auto"
            >
              <Medal size={16} />
              Top 18 board
            </Link>
            <Link
              href={focusTeamHref("/weekend-plan", focusTeam, classification)}
              prefetch={false}
              className="coach-action inline-flex w-full items-center justify-center gap-2 border border-slate-300 bg-white px-4 text-sm text-slate-700 sm:w-auto"
            >
              <GitBranch size={16} />
              St. Vrain entries
            </Link>
          </>
        }
      />

      <CoachDecisionSummary
        rows={focusRows}
        focusTeam={focusTeam}
        classification={classification}
      />
      <CoachStartHere focusTeam={focusTeam} classification={classification} />

      <details className="coach-surface group mt-5 overflow-hidden rounded-2xl">
        <summary className="tap-row flex min-h-16 cursor-pointer list-none items-start justify-between gap-4 p-4 text-base font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-[#16324f] focus-visible:ring-inset sm:p-5 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            More team context
            <span className="mt-1 block text-sm font-normal leading-6 text-slate-600">
              Scoring, weekend decisions, and quick checks for {focusTeam}.
            </span>
          </span>
          <span className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
            Open
            <ChevronDown
              size={16}
              className="transition group-open:rotate-180"
            />
          </span>
        </summary>
        <div className="border-t border-slate-200 p-3 sm:p-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <Target size={18} className="text-[#2f6f5e]" />
                  What matters first
                </div>
                <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-normal text-slate-950">
                  First protect likely points, then chase the bubble marks that can
                  still change state entries.
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">
                      Team points
                    </div>
                    <div className="mt-1 text-3xl font-semibold tabular-nums">
                      {teamTotal}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Boys {boysContext.palmer.points}, girls{" "}
                      {girlsContext.palmer.points}
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="text-xs font-semibold uppercase text-amber-800">
                      Urgent calls
                    </div>
                    <div className="mt-1 text-3xl font-semibold tabular-nums">
                      {mustRaceRows.length}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      Must race or at-risk state entries
                    </p>
                  </div>
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                    <div className="text-xs font-semibold uppercase text-sky-800">
                      Cutoff confidence
                    </div>
                    <div className="mt-1 text-3xl font-semibold tabular-nums">
                      {cutoffConfidenceAverage}/100
                    </div>
                    <p className="mt-1 text-xs leading-5 text-sky-800">
                      Lowest:{" "}
                      {lowestConfidenceCutoff
                        ? `${lowestConfidenceCutoff.eventLabel} ${lowestConfidenceCutoff.confidenceScoreLabel}`
                        : "No cutoff model loaded"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-xs font-semibold uppercase text-emerald-800">
                      State scorers
                    </div>
                    <div className="mt-1 text-3xl font-semibold tabular-nums">
                      {mix.entries.length}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-emerald-800">
                      {shortFocusTeam} projected scoring entries
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <GitBranch size={18} className="text-[#16324f]" />
                  Weekend planning moved
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-normal text-slate-950">
                  The branches, athlete flowcharts, relay trade-offs, depth chart,
                  and weather calls now live in one dedicated tab.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  This keeps the dashboard fast and lets coaches open the heavier
                  planning tools only when they are ready to make Friday/Saturday
                  decisions.
                </p>
                <div className="mt-4 grid gap-2">
                  <Link
                    href={focusTeamHref("/weekend-plan", focusTeam, classification)}
                    prefetch={false}
                  className="coach-action inline-flex items-center justify-center gap-2 bg-[#102b47] px-4 text-sm text-white"
                >
                    Open St. Vrain entries
                    <ArrowRight size={15} />
                  </Link>
                  <Link
                    href={`${focusTeamHref(
                      "/weekend-plan",
                      focusTeam,
                      classification,
                    )}#depth-chart`}
                    prefetch={false}
                    className="coach-action inline-flex items-center justify-center gap-2 border border-[#16324f] bg-white px-4 text-sm text-[#16324f]"
                  >
                    Open depth chart
                    <ArrowRight size={15} />
                  </Link>
                  <Link
                    href={focusTeamHref("/rankings", focusTeam, classification)}
                    prefetch={false}
                    className="coach-action inline-flex items-center justify-center gap-2 border border-slate-300 bg-white px-4 text-sm text-slate-700"
                  >
                    Open Top 18 cutoff board
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            </div>
          </section>

      <div className="mt-5 grid gap-5 [contain-intrinsic-size:820px] [content-visibility:auto] xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                {shortFocusTeam} score picture
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Boys and girls are scored separately in the virtual state meet.
              </p>
            </div>
            <BarChart3 className="text-[#16324f]" size={22} />
          </div>
          <div className="space-y-5">
            <ScoreBar label="Boys" context={boysContext} focusTeam={focusTeam} />
            <ScoreBar label="Girls" context={girlsContext} focusTeam={focusTeam} />
          </div>
          <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
            <div className="font-semibold text-slate-950">Point mix</div>
            <div>Relays: {mix.relayPoints} points</div>
            <div>Individuals: {mix.individualPoints} points</div>
            <Link
              href={focusTeamHref("/virtual-state-meet", focusTeam, classification)}
              prefetch={false}
              className="mt-2 inline-flex items-center gap-2 font-semibold text-[#2f6f5e]"
            >
              Edit projected finishes
              <ArrowRight size={15} />
            </Link>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-base font-semibold text-slate-950">
              Who needs a decision
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Start here for athletes who should chase a mark, defend a top-18
              seed, or protect a scoring chance. Click any row to open that
              event.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {priorityRows.map((row) => {
              const action = coachCall(row);

              return (
                <Link
                  key={row.id}
                  href={priorityHref(row, focusTeam, classification)}
                  prefetch={false}
                  className="grid min-h-24 gap-3 px-4 py-4 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f] focus-visible:ring-inset md:grid-cols-[128px_minmax(0,1fr)_220px] md:items-center"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${coachCallClass(
                        action,
                      )}`}
                    >
                      {action.label}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">
                      {row.stateProbabilityLabel} state
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <div className="break-words font-semibold text-slate-950">
                        {row.athleteName}
                      </div>
                      {row.grade ? (
                        <div className="text-xs font-medium text-slate-500">
                          Grade {row.grade}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-1 break-words text-sm text-slate-600">
                      {row.eventLabel} · {row.rankLabel} · {row.markRaw}
                    </div>
                    <div className="mt-1 break-words text-xs leading-4 text-slate-500">
                      {row.gapRaw}. Scratch: {row.scratchRiskLabel}
                      {row.scratchProbability
                        ? ` ${row.scratchProbabilityLabel}`
                        : ""}
                      . {row.recommendation}
                    </div>
                  </div>
                  <div className="grid min-w-0 grid-cols-3 gap-1.5 rounded-md bg-slate-50 p-2 text-center">
                    <div>
                      <div className="text-lg font-semibold leading-none tabular-nums text-slate-950">
                        {row.stateProbabilityLabel}
                      </div>
                      <div className="mt-1 text-[11px] font-medium text-slate-500">
                        state
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold leading-none tabular-nums text-slate-700">
                        {row.holdProbabilityLabel}
                      </div>
                      <div className="mt-1 text-[11px] font-medium text-slate-500">
                        hold
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold leading-none tabular-nums text-[#2f6f5e]">
                        {row.improveProbabilityLabel}
                      </div>
                      <div className="mt-1 text-[11px] font-medium text-slate-500">
                        improve
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
            {!priorityRows.length ? (
              <div className="p-5 text-sm text-slate-600">
                No {shortFocusTeam} bubble priorities in the current model.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 [contain-intrinsic-size:760px] [content-visibility:auto] xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-base font-semibold text-slate-950">
              Projected scoring events
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Where {focusTeam} is currently modeled to score at state.
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
                  prefetch={false}
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
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
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
            <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-sm">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[30%]" />
                <col className="w-[17%]" />
                <col className="w-[10%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
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
                        prefetch={false}
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
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Gauge size={18} className="text-[#16324f]" />
            Quick checks
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Link
              href={focusTeamHref("/weekend-plan", focusTeam, classification)}
              prefetch={false}
              className="min-h-24 rounded-md border border-slate-200 p-4 transition hover:border-[#2f6f5e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f]"
            >
              <div className="font-semibold text-slate-950">
                Open weekend plan
              </div>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Branches, athlete flowcharts, relay decisions, depth charts,
                and weather calls are kept off the dashboard for speed.
              </p>
            </Link>
            <Link
              href={focusTeamHref("/rankings/boys-400", focusTeam, classification)}
              prefetch={false}
              className="min-h-24 rounded-md border border-slate-200 p-4 transition hover:border-[#2f6f5e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f]"
            >
              <div className="font-semibold text-slate-950">
                Open event switcher
              </div>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Move quickly from one event page to another without returning to
                the dashboard.
              </p>
            </Link>
            <Link
              href={focusTeamHref("/virtual-state-meet", focusTeam, classification)}
              prefetch={false}
              className="min-h-24 rounded-md border border-slate-200 p-4 transition hover:border-[#2f6f5e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f]"
            >
              <div className="font-semibold text-slate-950">
                Expand team scores
              </div>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Open each team to see exactly who scores where, then edit
                finishes to test scenarios.
              </p>
            </Link>
            <Link
              href={focusTeamHref("/meets/import", focusTeam, classification)}
              prefetch={false}
              className="min-h-24 rounded-md border border-slate-200 p-4 transition hover:border-[#2f6f5e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f]"
            >
              <div className="font-semibold text-slate-950">
                Import missing marks
              </div>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Add source-backed marks before trusting close hold odds.
              </p>
            </Link>
          </div>
        </section>
      </div>
        </div>
      </details>

      <details className="group mt-5 rounded-lg border border-slate-200 bg-white [contain-intrinsic-size:320px] [content-visibility:auto]">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 p-4 text-base font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-[#16324f] focus-visible:ring-inset sm:p-5 [&::-webkit-details-marker]:hidden">
          <span>Data health and guardrails</span>
          <span className="inline-flex h-10 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
            Open
            <ChevronDown
              size={16}
              className="transition group-open:rotate-180"
            />
          </span>
        </summary>
        <div className="border-t border-slate-200 p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Verified marks"
              value={verifiedCount}
              detail="FAT candidates passing current rules"
              tone="green"
            />
            <MetricCard
              label="Data flags"
              value={reviewQueue.length}
              detail="Manual, timing, source, or classification flags"
              tone={reviewQueue.length ? "red" : "default"}
            />
            <MetricCard
              label="Tracked meets"
              value={meets.length}
              detail="Seed calendar and manually added meets"
            />
            <MetricCard
              label="Events"
              value={rankings.length}
              detail={`Boys/girls ${classification} ranking tables`}
              tone="navy"
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.8fr]">
            <AutoUpdatePanel policy={autoUpdatePolicy} />
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-4">
                <h2 className="text-base font-semibold">
                  Qualification guardrails
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Scraped results never go directly into rankings.
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  "Classification belongs to the school, not the meet.",
                  "Mile and 2 mile marks are held out until manually confirmed.",
                  "Hand times, unknown timing, wind-sensitive context, and manual paste rows are flagged.",
                  "Duplicate athlete-event records keep only the best verified mark.",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex gap-3 p-4 text-sm text-slate-700"
                  >
                    <CheckCircle2
                      className="mt-0.5 shrink-0 text-[#2f6f5e]"
                      size={17}
                    />
                    {item}
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 p-4">
                <Link
                  href={focusTeamHref("/meets", focusTeam, classification)}
                  prefetch={false}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#2f6f5e]"
                >
                  <CalendarClock size={16} />
                  Check meet discovery
                </Link>
              </div>
            </section>
          </div>
        </div>
      </details>
    </div>
  );
}
