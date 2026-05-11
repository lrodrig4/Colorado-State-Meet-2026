import { NextRequest, NextResponse } from "next/server";
import { parseManualResults } from "@/lib/services/manualParser";
import {
  handleApiError,
  optionalEvent,
  optionalGender,
  readJsonObject,
  requiredIsoDate,
  requiredString,
} from "@/lib/server/api";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request, { maxBytes: 250_000 });
    const text = requiredString(body, "text", { maxLength: 200_000 });
    const meetName = requiredString(body, "meetName", { maxLength: 160 });
    const meetDate = requiredIsoDate(body, "meetDate");
    const gender = optionalGender(body);
    const event = optionalEvent(body);

    const performances = parseManualResults(text, {
      meetName,
      meetDate,
      gender,
      event,
    });

    return NextResponse.json({
      performances,
      count: performances.length,
      note: "Manual imports are parsed as candidates and require review before rankings inclusion.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
