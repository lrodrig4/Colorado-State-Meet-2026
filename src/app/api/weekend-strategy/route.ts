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
import { apiError } from "@/lib/server/api";
import { resolveClassification } from "@/lib/utils/classificationScope";
import { DEFAULT_FOCUS_TEAM, resolveFocusTeam } from "@/lib/utils/focusTeam";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const classification = resolveClassification(searchParams.get("class") ?? undefined);
  const rawTeam = searchParams.get("team");

  if (rawTeam && rawTeam.length > 160) {
    return apiError("team query parameter is too long.");
  }

  const schoolOptions = await getSchoolOptionsForClassification(classification);
  const focusTeam = resolveFocusTeam(
    rawTeam?.trim() || DEFAULT_FOCUS_TEAM,
    schoolOptions,
    DEFAULT_FOCUS_TEAM,
  );

  const dashboard = await getLastChanceDashboardForTeam(classification, focusTeam);
  const baseStrategy = await getWeekendStrategyForTeam(classification, focusTeam);
  const stVrainHeatEstimates = await getStVrainHeatEstimates({
    focusTeam,
    forecasts: baseStrategy.hokaEventForecasts,
    recommendations: dashboard.recommendations,
    predictions: dashboard.predictions,
  });
  const finalizedHokaEntries =
    finalizedHokaEntriesFromEstimates(stVrainHeatEstimates);
  const strategy = finalizedHokaEntries.length
    ? await getWeekendStrategyForTeam(classification, focusTeam, {
        finalizedHokaEntries,
      })
    : baseStrategy;

  return NextResponse.json(strategy);
}
