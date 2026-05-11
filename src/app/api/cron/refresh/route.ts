import { NextRequest, NextResponse } from "next/server";
import { getDueProviders, runIngestion } from "@/lib/services/ingestion";
import { requireCronRequest } from "@/lib/server/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const unauthorized = requireCronRequest(request);
  if (unauthorized) return unauthorized;

  const dueProviders = getDueProviders();
  const run = await runIngestion({
    providerIds: dueProviders.map((provider) => provider.id),
  });

  return NextResponse.json({
    ...run,
    dueProviderNames: dueProviders.map((provider) => provider.name),
  });
}
