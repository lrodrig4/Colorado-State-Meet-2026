import { NextRequest, NextResponse } from "next/server";
import { getDueProviders, runIngestion } from "@/lib/services/ingestion";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: NextRequest) {
  const configured = process.env.CRON_SECRET;
  if (!configured) {
    return true;
  }

  const auth = request.headers.get("authorization");
  return auth === `Bearer ${configured}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dueProviders = getDueProviders();
  const run = await runIngestion({
    providerIds: dueProviders.map((provider) => provider.id),
  });

  return NextResponse.json({
    ...run,
    dueProviderNames: dueProviders.map((provider) => provider.name),
  });
}
