import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, GitBranch, UsersRound } from "lucide-react";
import { SimpleSteps } from "@/components/AppPrimitives";
import { ClassificationSelector } from "@/components/ClassificationSelector";
import { DeferredWeekendStrategyTools } from "@/components/DeferredWeekendStrategyTools";
import { FocusTeamSelector } from "@/components/FocusTeamSelector";
import { PageHeader } from "@/components/PageHeader";
import { StVrainHeatEstimatorPanel } from "@/components/StVrainHeatEstimatorPanel";
import { WeekendEntryMeetPanel } from "@/components/WeekendEntryMeetPanel";
import { WeekendWeatherPanel } from "@/components/WeekendWeatherPanel";
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
  const schoolOptions = await getSchoolOptionsForClassification(classification);
  const focusTeam = resolveFocusTeam(
    resolvedSearchParams.team ?? savedFocusTeam,
    schoolOptions,
    DEFAULT_FOCUS_TEAM,
  );
  const dashboard = await getLastChanceDashboardForTeam(classification, focusTeam);
  const baseWeekendStrategy = await getWeekendStrategyForTeam(
    classification,
    focusTeam,
  );
  const stVrainHeatEstimates = await getStVrainHeatEstimates({
    focusTeam,
    forecasts: baseWeekendStrategy.hokaEventForecasts,
    recommendations: dashboard.recommendations,
    predictions: dashboard.predictions,
  });
  const finalizedHokaEntries =
    finalizedHokaEntriesFromEstimates(stVrainHeatEstimates);
  const weekendStrategy = finalizedHokaEntries.length
    ? await getWeekendStrategyForTeam(classification, focusTeam, {
        finalizedHokaEntries,
      })
    : baseWeekendStrategy;
  const stVrainPreviewEstimates = previewStVrainHeatEstimates(stVrainHeatEstimates);
  const athletePlanCount = new Set(
    weekendStrategy.athletePlans.map((plan) => plan.athleteName),
  ).size;

  return (
    <div>
      <PageHeader
        title="Weekend Plan"
        description={`See who is entered this weekend and which choices help ${focusTeam}.`}
        actions={
          <>
            <ClassificationSelector currentClassification={classification} />
            <FocusTeamSelector
              schools={schoolOptions}
              currentTeam={focusTeam}
              classification={classification}
              label="Team"
            />
            <Link
              href={focusTeamHref("/", focusTeam, classification)}
              className="coach-action app-button-secondary inline-flex items-center gap-2 px-4 text-sm"
            >
              Back home
            </Link>
          </>
        }
      />

      <SimpleSteps
        steps={[
          {
            title: "Review entries",
            detail: "Open the event boxes to see who is in.",
          },
          {
            title: "Watch state marks",
            detail: "Look for green or amber chance labels.",
          },
          {
            title: "Open decisions",
            detail: "Use the bottom panel for detailed choices.",
          },
        ]}
      />

      <section className="mb-5 grid gap-3 md:grid-cols-2">
        <div className="coach-panel rounded-lg p-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
            <GitBranch size={15} />
            Plans
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
            {weekendStrategy.scenarioPlans.length}
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Different choices for the weekend.
          </p>
        </div>
        <div className="coach-panel rounded-lg p-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
            <UsersRound size={15} />
            Athletes / relays
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
            {weekendStrategy.athletePlans.length} / {weekendStrategy.relayPlans.length}
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            People and relays with a weekend decision.
          </p>
        </div>
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
        <WeekendWeatherPanel />
        <DeferredWeekendStrategyTools
          school={focusTeam}
          classification={classification}
          athleteCount={athletePlanCount}
          relayCount={weekendStrategy.relayPlans.length}
          scenarioCount={weekendStrategy.scenarioPlans.length}
        />
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
        Need the state ranking list?{" "}
        <Link
          href={focusTeamHref("/rankings", focusTeam, classification)}
          className="inline-flex items-center gap-1 font-semibold text-[#2f6f5e]"
        >
          Open lists <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
