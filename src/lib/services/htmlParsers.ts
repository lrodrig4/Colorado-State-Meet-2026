import * as cheerio from "cheerio";
import type {
  Gender,
  Performance,
  SourceKind,
  TimingType,
} from "@/types/domain";
import { getEventDefinition } from "@/lib/data/events";
import { applyClassification } from "@/lib/services/classification";
import { parseManualResults } from "@/lib/services/manualParser";
import { isNonQualifyingMeetName } from "@/lib/services/nonQualifying";
import {
  isAmbiguousDistanceEvent,
  normalizeEvent,
  parsePerformanceMark,
} from "@/lib/utils/time";
import { cleanCell, stableId, titleCase } from "@/lib/utils/text";

const MARK_PATTERN =
  /\b\d{1,2}:\d{2}(?:\.\d{1,2})?\b|\b\d{1,3}\.\d{1,2}\b|\b\d{1,3}\s*[-']\s*\d{1,2}(?:\.\d{1,2})?\b/;

function detectSource(url: string): SourceKind {
  const lower = url.toLowerCase();
  if (lower.includes("athletic.net")) return "athletic_net";
  if (lower.includes("milesplit")) return "milesplit";
  if (lower.includes("maxpreps")) return "maxpreps";
  if (/tfmeetpro|finishedresults|rapid|vnc|hytek/.test(lower)) {
    return "official_timing";
  }
  return "generic";
}

function normalizeGender(raw: string): Gender | undefined {
  if (/\b(boys?|men)\b/i.test(raw)) return "Boys";
  if (/\b(girls?|women)\b/i.test(raw)) return "Girls";
  return undefined;
}

function inferTiming(raw: string, source: SourceKind): TimingType {
  if (/\b(hand|ht|h\/t)\b/i.test(raw)) return "Hand";
  if (/\b(fat|auto|automatic)\b/i.test(raw)) return "FAT";
  if (source === "official_timing" || source === "milesplit") return "FAT";
  return "Unknown";
}

function findColumn(headers: string[], candidates: string[]) {
  return headers.findIndex((header) =>
    candidates.some((candidate) => header.toLowerCase().includes(candidate)),
  );
}

function parseRowsFromTables(
  html: string,
  context: {
    meetName: string;
    meetDate: string;
    sourceUrl: string;
  },
): Performance[] {
  const $ = cheerio.load(html);
  const source = detectSource(context.sourceUrl);
  const performances: Performance[] = [];
  const depthOnly = isNonQualifyingMeetName(context.meetName);

  $("table").each((tableIndex, table) => {
    const headingText = cleanCell(
      $(table)
        .prevAll("h1,h2,h3,h4,.event-title,.title")
        .first()
        .text(),
    );
    const event = normalizeEvent(headingText);
    const gender = normalizeGender(headingText);
    const ambiguous = isAmbiguousDistanceEvent(headingText);

    $(table)
      .find("tr")
      .each((rowIndex, row) => {
        const cells = $(row)
          .find("th,td")
          .map((_, cell) => cleanCell($(cell).text()))
          .get();

        if (cells.length < 3 || !cells.some((cell) => MARK_PATTERN.test(cell))) {
          return;
        }

        const headers = $(table)
          .find("tr")
          .first()
          .find("th,td")
          .map((_, cell) => cleanCell($(cell).text()))
          .get();

        const athleteIndex = findColumn(headers, ["athlete", "name"]);
        const schoolIndex = findColumn(headers, ["team", "school"]);
        const gradeIndex = findColumn(headers, ["grade", "year", "yr"]);
        const markIndex = cells.findIndex((cell) => MARK_PATTERN.test(cell));
        const eventFromRow = cells.map(normalizeEvent).find(Boolean);
        const genderFromRow = cells.map(normalizeGender).find(Boolean);
        const parsedEvent = eventFromRow ?? event;
        const parsedGender = genderFromRow ?? gender;
        const mark = cells[markIndex]?.match(MARK_PATTERN)?.[0];
        const markValue =
          mark && parsedEvent
            ? parsePerformanceMark(parsedEvent, mark)
            : undefined;

        if (!parsedEvent || !parsedGender || !mark || !markValue) {
          return;
        }
        const definition = getEventDefinition(parsedEvent);

        const athleteCell =
          athleteIndex >= 0 ? cells[athleteIndex] : cells.find((cell) => /[A-Za-z]+ [A-Za-z]+/.test(cell));
        const schoolCell =
          schoolIndex >= 0
            ? cells[schoolIndex]
            : cells.find(
                (cell, index) =>
                  index !== markIndex &&
                  cell !== athleteCell &&
                  /[A-Za-z]/.test(cell),
              );

        const timingType =
          definition.markType === "distance"
            ? "Field"
            : inferTiming(cells.join(" "), source);
        const verificationStatus = depthOnly ? "depth_only" : "needs_review";
        const school = titleCase(schoolCell ?? "Unknown");

        performances.push(
          applyClassification({
            id: stableId([
              context.sourceUrl,
              tableIndex,
              rowIndex,
              athleteCell,
              schoolCell,
              mark,
            ]),
            athleteName: definition.relay
              ? `${school} Relay`
              : titleCase(athleteCell ?? "Unknown Athlete"),
            gender: parsedGender,
            grade: gradeIndex >= 0 ? Number(cells[gradeIndex]) || undefined : undefined,
            school,
            event: parsedEvent,
            markRaw: mark,
            markValue,
            timingType,
            isFAT: timingType === "FAT",
            meetName: context.meetName,
            meetDate: context.meetDate,
            source,
            sourceUrl: context.sourceUrl,
            verificationStatus,
            classificationVerified: false,
            notes: [
              `Parsed from ${source} HTML table.`,
              depthOnly
                ? "Depth-only/non-qualifying meet; excluded from CHSAA qualifying rankings and cutoff model."
                : undefined,
              ambiguous ? "Ambiguous mile/2 mile event heading requires approval." : undefined,
            ]
              .filter(Boolean)
              .join(" "),
          }),
        );
      });
  });

  return performances;
}

export function parseResultHtml(
  html: string,
  context: {
    meetName: string;
    meetDate: string;
    sourceUrl: string;
  },
): Performance[] {
  const tableRows = parseRowsFromTables(html, context);
  if (tableRows.length > 0) {
    return tableRows;
  }

  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\n{3,}/g, "\n\n");

  return parseManualResults(text, {
    meetName: context.meetName,
    meetDate: context.meetDate,
    source: detectSource(context.sourceUrl),
    sourceUrl: context.sourceUrl,
  });
}
