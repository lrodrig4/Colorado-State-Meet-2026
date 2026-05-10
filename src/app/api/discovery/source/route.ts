import { NextRequest, NextResponse } from "next/server";
import { discoverSourcesFromHtml, discoverSourcesFromUrl } from "@/lib/services/sourceDiscovery";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body?.url && !body?.html) {
    return NextResponse.json(
      { error: "Provide a meet page url or raw html." },
      { status: 400 },
    );
  }

  const result = body.html
    ? discoverSourcesFromHtml(body.html, body.url ?? "https://co.milesplit.com/")
    : await discoverSourcesFromUrl(body.url);

  return NextResponse.json(result);
}
