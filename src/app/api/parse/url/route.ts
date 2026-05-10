import { NextRequest, NextResponse } from "next/server";
import { parseResultHtml } from "@/lib/services/htmlParsers";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body?.url || !body?.meetName || !body?.meetDate) {
    return NextResponse.json(
      { error: "url, meetName, and meetDate are required." },
      { status: 400 },
    );
  }

  const response = await fetch(body.url, {
    headers: {
      "user-agent":
        "ColoradoDistanceQualifierTracker/0.1 (+https://vercel.app)",
    },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: `Fetch failed with ${response.status} ${response.statusText}` },
      { status: 502 },
    );
  }

  const html = await response.text();
  const performances = parseResultHtml(html, {
    meetName: body.meetName,
    meetDate: body.meetDate,
    sourceUrl: body.url,
  });

  return NextResponse.json({
    performances,
    count: performances.length,
    note: "Parsed URL results are candidate performances and require review before rankings inclusion.",
  });
}
