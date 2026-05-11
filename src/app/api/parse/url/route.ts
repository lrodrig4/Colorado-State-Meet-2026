import { NextRequest, NextResponse } from "next/server";
import { parseResultHtml } from "@/lib/services/htmlParsers";
import {
  handleApiError,
  readJsonObject,
  requiredIsoDate,
  requiredString,
} from "@/lib/server/api";
import { fetchSafeText, SafeFetchError } from "@/lib/server/safeFetch";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request, { maxBytes: 16_000 });
    const url = requiredString(body, "url", { maxLength: 2_048 });
    const meetName = requiredString(body, "meetName", { maxLength: 160 });
    const meetDate = requiredIsoDate(body, "meetDate");
    const result = await fetchSafeText(url, {
      maxBytes: 1_500_000,
      timeoutMs: 12_000,
    });

    const performances = parseResultHtml(result.text, {
      meetName,
      meetDate,
      sourceUrl: result.finalUrl,
    });

    return NextResponse.json({
      performances,
      count: performances.length,
      note: "Parsed URL results are candidate performances and require review before rankings inclusion.",
    });
  } catch (error) {
    if (error instanceof SafeFetchError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleApiError(error);
  }
}
