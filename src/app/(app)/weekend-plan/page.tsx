import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, BarChart3, GitBranch, UsersRound } from "lucide-react";
import { ClassificationSelector } from "@/components/ClassificationSelector";
import { DeferredTeamDepthChart } from "@/components/DeferredTeamDepthChart";
import { DeferredWeekendStrategyTools } from "@/components/DeferredWeekendStrategyTools";
import { FocusTeamSelector } from "@/components/FocusTeamSelector";
import { PageHeader } from "@/components/PageHeader";
import { StVrainHeatEstimatorPanel } from "@/components/StVrainHeatEstimatorPanel";
import { WeekendEntryMeetPanel } from "@/components/WeekendEntryMeetPanel";
import { WeekendWeatherPanel } from "@/components/WeekendWeatherPanel";
import { eventDefinitions } from "@/lib/data/events";
import {
  getLastChanceDashboardForTeam,
  getSchoolOptionsForClassification,
  getWeekendStrategyForTeam,
} from "@/lib/services/appData";
import { getStVrainHeatEstimates } from "@/lib/services/stVrainHeatEstimator";
import {
  finalizedHokaEntriesFromEstimates,
  type StVrainHeatEstimate,
} from "@/lib/services/stVrainHeatEstimator";
import {
  DEFAULT_FOCUS_TEAM,
  decodeFocusTeamCookie,
  focusTeamCookieName,
  focusTeamHref,
  resolveFocusTeam,
  shortSchoolName,
} from "@/lib/utils/focusTeam";
import { resolveClassification } from "@/lib/utils/classificationScope";

function previewStVrainHeatEstimates(
  estimates: StVrainHeatEstimate[],
): StVrainHeatEstimate[] {
  return estimates.map((estimate) => ({
    ...estimate,
    racePlans: estimate.racePlans.slice(0, 4),
    storylines: estimate.storylines.slice(0, 2),
    stateMarkOpportunities: [],
    estimatedHeats: estimate.estimatedHeats.map((heat) => ({
      ...heat,
      entries: [],
    })),
    teamHeatWatches: estimate.teamHeatWatches.slice(0, 2).map((watch) => ({
      ...watch,
      sameHeatAhead: watch.sameHeatAhead.slice(0, 2),
      sameHeatChasers: watch.sameHeatChasers.slice(0, 2),
      fasterHeatTargets: watch.fasterHeatTargets.slice(0, 2),
    })),
  }));
}

export default async function WeekendPlanPage({
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
  const dashboard = getLastChanceDashboardForTeam(classification, focusTeam);
  const baseWeekendStrategy = getWeekendStrategyForTeam(classification, focusTeam);
  const stVrainHeatEstimates = await getStVrainHeatEstimates({
    focusTeam,
    forecasts: baseWeekendStrategy.hokaEventForecasts,
    recommendations: dashboard.recommendations,
    predictions: dashboard.predictions,
  });
  const finalizedHokaEntries =
    finalizedHokaEntriesFromEstimates(stVrainHeatEstimates);
  const weekendStrategy = finalizedHokaEntries.length
    ? getWeekendStrategyForTeam(classification, focusTeam, {
        finalizedHokaEntries,
      })
    : baseWeekendStrategy;
  const stVrainPreviewEstimates = previewStVrainHeatEstimates(stVrainHeatEstimates);
  const depthChartAthleteCount = new Set(
    weekendStrategy.athletePlans.map((plan) => plan.athleteName),
  ).size;
  const eventChartCount = eventDefinitions.reduce(
    (count, definition) =>
      definition.relay ? count : count + definition.genders.length,
    0,
  );

  return (
    <div>
      <PageHeader
        title="St. Vrain Entries and Analysis"
        description={`Live HOKA entries, estimated heats and flights, state-mark chances, relay decisions, depth charts, and weather-adjusted last-chance plans for ${focusTeam}.`}
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
              href={focusTeamHref("/", focusTeam, classification)}
              prefetch={false}
              className="coach-action inline-flex items-center gap-2 border border-slate-300 bg-white px-4 text-sm text-slate-700"
            >
              Back to command
            </Link>
            <Link
              href="#depth-chart"
              prefetch={false}
              className="coach-action inline-flex items-center gap-2 bg-[#102b47] px-4 text-sm text-white"
            >
              Depth chart
            </Link>
          </>
        }
      />

      <section className="mb-5 grid gap-3 md:grid-cols-3">
        <div className="coach-panel rounded-2xl p-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
            <GitBranch size={15} />
            Branches
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
            {weekendStrategy.scenarioPlans.length}
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            St. Vrain, split weekend, Teddy-only, relay-first, and rest paths.
          </p>
        </div>
        <div className="coach-panel rounded-2xl p-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
            <UsersRound size={15} />
            Flowchart pool
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
            {weekendStrategy.athletePlans.length} / {weekendStrategy.relayPlans.length}
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            {shortFocusTeam} top-50 individual rows and every relay plan.
          </p>
        </div>
        <a
          href="#depth-chart"
          className="coach-panel rounded-2xl border-[#16324f] p-4 transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
            <BarChart3 size={15} />
            Depth chart
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
            {depthChartAthleteCount}
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Jump straight to editable relay pools and event depth.
          </p>
        </a>
      </section>

      <div className="space-y-5">
        <StVrainHeatEstimatorPanel
          estimates={stVrainPreviewEstimates}
          focusTeam={focusTeam}
        />
        <WeekendEntryMeetPanel
          summaries={weekendStrategy.weekendMeetSummaries}
          focusTeam={focusTeam}
        />
        <DeferredTeamDepthChart
          school={focusTeam}
          classification={classification}
          athleteCount={depthChartAthleteCount}
          eventCount={eventChartCount}
        />
        <WeekendWeatherPanel />
        <DeferredWeekendStrategyTools
          school={focusTeam}
          classification={classification}
          athleteCount={depthChartAthleteCount}
          relayCount={weekendStrategy.relayPlans.length}
          scenarioCount={weekendStrategy.scenarioPlans.length}
        />
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
        Need the actual cutoff tables while planning?{" "}
        <Link
          href={focusTeamHref("/rankings", focusTeam, classification)}
          prefetch={false}
          className="inline-flex items-center gap-1 font-semibold text-[#2f6f5e]"
        >
          Open Top 18 cutoff board <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
