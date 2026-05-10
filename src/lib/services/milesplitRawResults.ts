import * as cheerio from "cheerio";
import type {
  Classification,
  EventKey,
  Gender,
  Performance,
  TimingType,
} from "@/types/domain";
import { getEventDefinition } from "@/lib/data/events";
import { applyClassification } from "@/lib/services/classification";
import { isNonQualifyingMeetName } from "@/lib/services/nonQualifying";
import { normalizeEvent, parsePerformanceMark } from "@/lib/utils/time";
import { cleanCell, stableId, titleCase } from "@/lib/utils/text";

interface RawSection {
  gender: Gender;
  classification?: Classification;
  event: EventKey;
}

const WIND_SENSITIVE_EVENTS = new Set<EventKey>([
  "100m",
  "200m",
  "100m Hurdles",
  "110m Hurdles",
  "Long Jump",
  "Triple Jump",
]);

function extractRawText(html: string): string {
  const $ = cheerio.load(html);
  const preText = $("#meetResultsBody pre").first().text() || $("pre").first().text();

  return preText || $("body").text();
}

function normalizeMileSplitEvent(raw: string): EventKey | undefined {
  const clean = raw
    .replace(/\bmeter\b/gi, "m")
    .replace(/\bmeters\b/gi, "m")
    .replace(/\bthrow\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const relay = clean.match(/\b4x(100|200|400|800)\s*m?\s*relay\b/i);
  if (relay) {
    return `4x${relay[1]}m Relay` as EventKey;
  }

  return normalizeEvent(clean);
}

function parseSectionHeading(line: string): RawSection | undefined {
  const match = cleanCell(line).match(
    /^(Boys|Girls)\s+(.+?)(?:\s+(1A|2A|3A|4A|5A))?\s*$/i,
  );
  if (!match) {
    return undefined;
  }

  const event = normalizeMileSplitEvent(match[2]);
  if (!event) {
    return undefined;
  }

  return {
    gender: match[1].toLowerCase() === "boys" ? "Boys" : "Girls",
    event,
    classification: match[3]?.toUpperCase() as Classification | undefined,
  };
}

function parseWind(raw: string): number | undefined {
  const clean = cleanCell(raw).replace(/^\+/, "");
  if (!clean) return undefined;

  const value = Number(clean);
  return Number.isFinite(value) ? value : undefined;
}

function isLegalWind(event: EventKey, wind: number | undefined): boolean {
  return !WIND_SENSITIVE_EVENTS.has(event) || wind === undefined || wind <= 2;
}

function parseRawRow(
  line: string,
  header: string,
): {
  rank: string;
  athleteName: string;
  grade?: number;
  school: string;
  markRaw: string;
  heat?: string;
  wind?: number;
} | undefined {
  const rank = line.slice(0, Math.max(header.indexOf("NAME"), 1)).trim();
  if (!/^\d+[A-Za-z]*$/.test(rank)) {
    return undefined;
  }

  const nameStart = header.indexOf("NAME");
  const yearStart = header.indexOf("YR");
  const teamStart = header.indexOf("TEAM");
  const markStart = header.indexOf("MARK");
  const heatStart = header.indexOf("H#");
  const windStart = header.indexOf("WIND");

  if ([nameStart, teamStart, markStart].some((index) => index < 0)) {
    return undefined;
  }

  const athleteName = cleanCell(line.slice(nameStart, yearStart > 0 ? yearStart : teamStart));
  const gradeRaw =
    yearStart > 0 ? cleanCell(line.slice(yearStart, teamStart)) : "";
  const school = cleanCell(line.slice(teamStart, markStart));
  const markRaw = cleanCell(
    line.slice(markStart, heatStart > 0 ? heatStart : windStart > 0 ? windStart : undefined),
  );
  const heat =
    heatStart > 0
      ? cleanCell(line.slice(heatStart, windStart > 0 ? windStart : undefined))
      : undefined;
  const wind = windStart > 0 ? parseWind(line.slice(windStart)) : undefined;

  if (!school || !markRaw || /^(NT|NH|ND|DNS|DQ|SCR|FOUL)$/i.test(markRaw)) {
    return undefined;
  }

  return {
    rank,
    athleteName,
    grade: /^\d{1,2}$/.test(gradeRaw) ? Number(gradeRaw) : undefined,
    school,
    markRaw,
    heat,
    wind,
  };
}

function timingTypeForEvent(event: EventKey): TimingType {
  return getEventDefinition(event).markType === "distance" ? "Field" : "FAT";
}

export function parseMileSplitRawResults(
  html: string,
  context: {
    meetName: string;
    meetDate: string;
    sourceUrl: string;
    supplementalWindow?: string;
  },
): Performance[] {
  const performances: Performance[] = [];
  const lines = extractRawText(html).split(/\r?\n/);
  let section: RawSection | undefined;
  let round = "";
  let header = "";

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.replace(/\u00a0/g, " ");
    const clean = cleanCell(line);
    const nextSection = parseSectionHeading(clean);

    if (nextSection) {
      section = nextSection;
      round = "";
      header = "";
      return;
    }

    if (!section || !clean) {
      return;
    }

    if (/^(Finals?|Prelims?|Semi-Finals?|Semifinals?|Timed Finals?)$/i.test(clean)) {
      round = clean;
      header = "";
      return;
    }

    if (/\bNAME\b/.test(line) && /\bTEAM\b/.test(line) && /\bMARK\b/.test(line)) {
      header = line;
      return;
    }

    if (!header || /^=+$/.test(clean) || !round) {
      return;
    }

    const row = parseRawRow(line, header);
    if (!row || !isLegalWind(section.event, row.wind)) {
      return;
    }

    const markValue = parsePerformanceMark(section.event, row.markRaw);
    if (markValue === undefined) {
      return;
    }

    const definition = getEventDefinition(section.event);
    const timingType = timingTypeForEvent(section.event);
    const school = titleCase(row.school);
    const athleteName = definition.relay
      ? `${school} Relay`
      : titleCase(row.athleteName);
    const depthOnly = isNonQualifyingMeetName(context.meetName);
    const missingRequiredWind =
      WIND_SENSITIVE_EVENTS.has(section.event) && row.wind === undefined;
    const verificationStatus = depthOnly
      ? "depth_only"
      : missingRequiredWind
        ? "needs_review"
        : "verified";
    const windNote =
      row.wind !== undefined && WIND_SENSITIVE_EVENTS.has(section.event)
        ? ` Wind ${row.wind > 0 ? "+" : ""}${row.wind}.`
        : "";
    const notes = [
      `Parsed from Colorado MileSplit raw meet results (${round}).`,
      context.supplementalWindow
        ? `Supplemental gap-window import: ${context.supplementalWindow}.`
        : undefined,
      depthOnly
        ? "Depth-only/non-qualifying meet; excluded from CHSAA qualifying rankings and cutoff model."
        : undefined,
      section.classification
        ? `Result section listed ${section.classification}; school bulletin classification remains authoritative.`
        : undefined,
      windNote.trim() || undefined,
    ]
      .filter(Boolean)
      .join(" ");

    performances.push(
      applyClassification({
        id: stableId([
          "milesplit-raw",
          context.sourceUrl,
          lineIndex,
          section.gender,
          section.event,
          athleteName,
          school,
          row.markRaw,
        ]),
        athleteName,
        gender: section.gender,
        grade: row.grade,
        school,
        event: section.event,
        markRaw: row.markRaw,
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
