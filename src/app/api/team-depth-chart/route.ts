import { NextResponse } from "next/server";
import { getTeamDepthChart } from "@/lib/services/appData";
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

  if (!team) {
    return NextResponse.json(
      { error: "Missing team query parameter." },
      { status: 400 },
    );
  }

  const depthChart = getTeamDepthChart(classification, team);

  return NextResponse.json(depthChart, {
    headers: {
      "Cache-Control": "private, max-age=60",
    },
  });
}
