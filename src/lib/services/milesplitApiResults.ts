import type { EventKey, Gender, Performance, TimingType } from "@/types/domain";
import { getEventDefinition } from "@/lib/data/events";
import { applyClassification } from "@/lib/services/classification";
import { isNonQualifyingMeetName } from "@/lib/services/nonQualifying";
import { normalizeEvent, parsePerformanceMark } from "@/lib/utils/time";
import { cleanCell, stableId, titleCase } from "@/lib/utils/text";

const SEASON_YEAR = 2026;

const WIND_SENSITIVE_EVENTS = new Set<EventKey>([
  "100m",
  "200m",
  "100m Hurdles",
  "110m Hurdles",
  "Long Jump",
  "Triple Jump",
]);

export interface MileSplitApiPerformanceRow {
  id?: string | number | null;
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  genderName?: string | null;
  gradYear?: string | number | null;
  eventName?: string | null;
  roundName?: string | null;
  heat?: string | number | null;
  teamName?: string | null;
  mark?: string | null;
  place?: string | number | null;
  windReading?: string | number | null;
  statusCode?: string | null;
}

function normalizeMileSplitApiEvent(raw: string): EventKey | undefined {
  const clean = raw
    .replace(/\bmeter\b/gi, "m")
    .replace(/\bmeters\b/gi, "m")
    .replace(/\s+/g, " ")
    .trim();

  return normalizeEvent(clean);
}

function parseGender(row: MileSplitApiPerformanceRow): Gender | undefined {
  const raw = cleanCell(`${row.genderName ?? row.gender ?? ""}`);
  if (/^(boys|m|male)$/i.test(raw)) return "Boys";
  if (/^(girls|f|female)$/i.test(raw)) return "Girls";
  return undefined;
}

function graduationYearToGrade(rawYear: string | number | null | undefined) {
  const graduationYear = Number(rawYear);
  if (!Number.isFinite(graduationYear) || graduationYear < SEASON_YEAR) {
    return undefined;
  }

  const grade = 12 - (graduationYear - SEASON_YEAR);
  return grade >= 9 && grade <= 12 ? grade : undefined;
}

function parseWind(raw: string | number | null | undefined): number | undefined {
  const clean = cleanCell(`${raw ?? ""}`).replace(/^\+/, "");
  if (!clean) return undefined;

  const value = Number(clean);
  return Number.isFinite(value) ? value : undefined;
}

function isLegalWind(event: EventKey, wind: number | undefined): boolean {
  return !WIND_SENSITIVE_EVENTS.has(event) || wind === undefined || wind <= 2;
}

function timingTypeForEvent(event: EventKey): TimingType {
  return getEventDefinition(event).markType === "distance" ? "Field" : "FAT";
}

function markIsUsable(markRaw: string, statusCode?: string | null): boolean {
  const status = cleanCell(`${statusCode ?? ""}`);
  return (
    Boolean(markRaw) &&
    !/^(NT|NH|ND|NM|DNS|DNF|DQ|SCR|FOUL)$/i.test(markRaw) &&
    !/^(NT|NH|ND|NM|DNS|DNF|DQ|SCR|FOUL)$/i.test(status)
  );
}

export function parseMileSplitApiResults(
  rows: MileSplitApiPerformanceRow[],
  context: {
    meetName: string;
    meetDate: string;
    sourceUrl: string;
    supplementalWindow?: string;
  },
): Performance[] {
  const performances: Performance[] = [];

  rows.forEach((row, rowIndex) => {
    const event = normalizeMileSplitApiEvent(cleanCell(`${row.eventName ?? ""}`));
    const gender = parseGender(row);
    const school = titleCase(cleanCell(`${row.teamName ?? ""}`));
    const markRaw = cleanCell(`${row.mark ?? ""}`);

    if (!event || !gender || !school || !markIsUsable(markRaw, row.statusCode)) {
      return;
    }

    const wind = parseWind(row.windReading);
    if (!isLegalWind(event, wind)) {
      return;
    }

    const markValue = parsePerformanceMark(event, markRaw);
    if (markValue === undefined) {
      return;
    }

    const definition = getEventDefinition(event);
    const timingType = timingTypeForEvent(event);
    const firstName = cleanCell(`${row.firstName ?? ""}`);
    const lastName = cleanCell(`${row.lastName ?? ""}`);
    const athleteName = definition.relay
      ? `${school} Relay`
      : titleCase(`${firstName} ${lastName}`.trim());
    if (!athleteName) {
      return;
    }

    const round = cleanCell(`${row.roundName ?? ""}`) || "Finals";
    const depthOnly = isNonQualifyingMeetName(context.meetName);
    const missingRequiredWind =
      WIND_SENSITIVE_EVENTS.has(event) && wind === undefined;
    const verificationStatus = depthOnly
      ? "depth_only"
      : missingRequiredWind
        ? "needs_review"
        : "verified";
    const windNote =
      wind !== undefined && WIND_SENSITIVE_EVENTS.has(event)
        ? ` Wind ${wind > 0 ? "+" : ""}${wind}.`
        : "";
    const notes = [
      `Parsed from Colorado MileSplit formatted results API (${round}).`,
      context.supplementalWindow
        ? `Supplemental gap-window import: ${context.supplementalWindow}.`
        : undefined,
      depthOnly
        ? "Depth-only/non-qualifying meet; excluded from CHSAA qualifying rankings and cutoff model."
        : undefined,
      windNote.trim() || undefined,
    ]
      .filter(Boolean)
      .join(" ");

    performances.push(
      applyClassification({
        id: stableId([
          "milesplit-api",
          context.sourceUrl,
          row.id ?? rowIndex,
          gender,
          event,
          athleteName,
          school,
          markRaw,
        ]),
        athleteName,
        gender,
        grade: graduationYearToGrade(row.gradYear),
        school,
        event,
        markRaw,
        markValue,
        timingType,
        isFAT: timingType === "FAT",
        meetName: context.meetName,
        meetDate: context.meetDate,
        source: "milesplit",
        sourceUrl: context.sourceUrl,
        verificationStatus,
        classificationVerified: false,
        notes,
      }),
    );
  });

  return performances;
}
