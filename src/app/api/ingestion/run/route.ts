import { NextRequest, NextResponse } from "next/server";
import { runIngestion } from "@/lib/services/ingestion";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const run = await runIngestion({
    providerIds: body.providerIds,
    dryRun: body.dryRun ?? true,
  });

  return NextResponse.json(run);
}
