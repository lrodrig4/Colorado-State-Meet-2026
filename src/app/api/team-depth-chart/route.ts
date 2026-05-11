import { NextResponse } from "next/server";
import { getTeamDepthChart } from "@/lib/services/appData";
import { apiError } from "@/lib/server/api";
import {
  CLASSIFICATION_QUERY_PARAM,
  resolveClassification,
} from "@/lib/utils/classificationScope";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const team = searchParams.get("team");
  const classification = resolveClassification(
    searchParams.get(CLASSIFICATION_QUERY_PARAM) ?? undefined,
  );

  if (!team?.trim()) {
    return apiError("Missing team query parameter.");
  }

  if (team.length > 160) {
    return apiError("team query parameter is too long.");
  }

  const depthChart = await getTeamDepthChart(classification, team.trim());

  return NextResponse.json(depthChart, {
    headers: {
      "Cache-Control": "private, max-age=60",
    },
  });
}
