import { NextRequest, NextResponse } from "next/server";
import { parseManualResults } from "@/lib/services/manualParser";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body?.text || !body?.meetName || !body?.meetDate) {
    return NextResponse.json(
      { error: "text, meetName, and meetDate are required." },
      { status: 400 },
    );
  }

  const performances = parseManualResults(body.text, {
    meetName: body.meetName,
    meetDate: body.meetDate,
    gender: body.gender,
    event: body.event,
  });

  return NextResponse.json({
    performances,
    count: performances.length,
    note: "Manual imports are parsed as candidates and require review before rankings inclusion.",
  });
}
