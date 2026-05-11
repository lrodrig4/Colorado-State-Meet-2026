import { NextRequest, NextResponse } from "next/server";
import { discoverSourcesFromHtml, discoverSourcesFromUrl } from "@/lib/services/sourceDiscovery";
import {
  ApiRequestError,
  handleApiError,
  optionalString,
  readJsonObject,
  requiredString,
} from "@/lib/server/api";
import { parseSafeHttpUrl, SafeFetchError } from "@/lib/server/safeFetch";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request, { maxBytes: 650_000 });
    const html = optionalString(body, "html", {
      maxLength: 600_000,
      trim: false,
    });
    const url = html
      ? optionalString(body, "url", { maxLength: 2_048 })
      : requiredString(body, "url", { maxLength: 2_048 });

    if (!url && !html) {
      throw new ApiRequestError("Provide a meet page url or raw html.");
    }

    const baseUrl = parseSafeHttpUrl(url ?? "https://co.milesplit.com/").toString();
    const result = html
      ? discoverSourcesFromHtml(html, baseUrl)
      : await discoverSourcesFromUrl(baseUrl);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SafeFetchError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleApiError(error);
  }
}
