import { NextRequest, NextResponse } from "next/server";
import {
  getLastChanceDashboardForTeam,
  getSchoolOptionsForClassification,
  getWeekendStrategyForTeam,
} from "@/lib/services/appData";
import {
  finalizedHokaEntriesFromEstimates,
  getStVrainHeatEstimates,
} from "@/lib/services/stVrainHeatEstimator";
import { resolveClassification } from "@/lib/utils/classificationScope";
import { DEFAULT_FOCUS_TEAM, resolveFocusTeam } from "@/lib/utils/focusTeam";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const classification = resolveClassification(searchParams.get("class") ?? undefined);
  const schoolOptions = getSchoolOptionsForClassification(classification);
  const focusTeam = resolveFocusTeam(
    searchParams.get("team") ?? DEFAULT_FOCUS_TEAM,
    schoolOptions,
    DEFAULT_FOCUS_TEAM,
  );

  const baseStrategy = getWeekendStrategyForTeam(classification, focusTeam);
  const dashboard = getLastChanceDashboardForTeam(classification, focusTeam);
  const stVrainHeatEstimates = await getStVrainHeatEstimates({
    focusTeam,
    forecasts: baseStrategy.hokaEventForecasts,
    recommendations: dashboard.recommendations,
    predictions: dashboard.predictions,
  });
  const finalizedHokaEntries =
    finalizedHokaEntriesFromEstimates(stVrainHeatEstimates);
  const strategy = finalizedHokaEntries.length
    ? getWeekendStrategyForTeam(classification, focusTeam, {
        finalizedHokaEntries,
      })
    : baseStrategy;

  return NextResponse.json(strategy);
}
