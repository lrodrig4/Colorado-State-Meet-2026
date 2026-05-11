import { NextRequest, NextResponse } from "next/server";
import { dataProviders } from "@/lib/data/providers";
import { runIngestion } from "@/lib/services/ingestion";
import {
  handleApiError,
  optionalBoolean,
  optionalStringArray,
  readJsonObject,
  requireAdminRequest,
} from "@/lib/server/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await readJsonObject(request, { maxBytes: 32_000 });
    const run = await runIngestion({
      providerIds: optionalStringArray(body, "providerIds", {
        allowedValues: dataProviders.map((provider) => provider.id),
        maxItems: dataProviders.length,
      }),
      dryRun: optionalBoolean(body, "dryRun", true),
    });

    return NextResponse.json(run);
  } catch (error) {
    return handleApiError(error);
  }
}
