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
import { parsePerformanceMark } from "@/lib/utils/time";
import { cleanCell, stableId, titleCase } from "@/lib/utils/text";

const MILESPLIT_LEAGUE_IDS: Partial<Record<Classification, string>> = {
  "1A": "9121",
  "2A": "9122",
  "3A": "9123",
  "4A": "9124",
  "5A": "9125",
};
const SEASON_YEAR = 2026;

const mileSplitEventCodes: Record<EventKey, string> = {
  "100m": "100m",
  "200m": "200m",
  "400m": "400m",
  "800m": "800m",
  "1600m": "1600m",
  "3200m": "3200m",
  "100m Hurdles": "100H",
  "110m Hurdles": "110H",
  "300m Hurdles": "300H",
  "4x100m Relay": "4x100m",
  "4x200m Relay": "4x200m",
  "4x400m Relay": "4x400m",
  "4x800m Relay": "4x800m",
  "High Jump": "HJ",
  "Pole Vault": "PV",
  "Long Jump": "LJ",
  "Triple Jump": "TJ",
  "Shot Put": "S",
  Discus: "D",
};

export interface MileSplitRankingParseResult {
  performances: Performance[];
  locked: boolean;
  nextUrl?: string;
}

function genderPath(gender: Gender): string {
  return gender === "Boys" ? "high-school-boys" : "high-school-girls";
}

export function mileSplitEventCode(event: EventKey): string {
  return mileSplitEventCodes[event];
}

export function buildMileSplitRankingUrl(
  classification: Classification,
  gender: Gender,
  event: EventKey,
  page = 1,
): string {
  const code = mileSplitEventCode(event);
  const leagueId = MILESPLIT_LEAGUE_IDS[classification];

  if (!leagueId) {
    throw new Error(`Missing MileSplit league id for ${classification}`);
  }

  return [
    `https://co.milesplit.com/rankings/events/${genderPath(gender)}/outdoor-track-and-field/${code}`,
    `?year=${SEASON_YEAR}`,
    "&accuracy=legal",
    "&grade=all",
    `&league=${leagueId}`,
    "&conversion=n",
    `&page=${page}`,
  ].join("");
}

export function buildMileSplit4ARankingUrl(
  gender: Gender,
  event: EventKey,
  page = 1,
): string {
  return buildMileSplitRankingUrl("4A", gender, event, page);
}

function graduationYearToGrade(rawYear: string): number | undefined {
  const graduationYear = Number(rawYear);
  if (!Number.isFinite(graduationYear) || graduationYear < SEASON_YEAR) {
    return undefined;
  }

  const grade = 12 - (graduationYear - SEASON_YEAR);
  return grade >= 9 && grade <= 12 ? grade : undefined;
}

function parseMileSplitDate(rawDate: string): string {
  const clean = cleanCell(rawDate).split(/\s+-\s+/)[0];
  const parsed = new Date(`${clean} 00:00:00 MST`);

  if (Number.isNaN(parsed.getTime())) {
    return `${SEASON_YEAR}-01-01`;
  }

  return parsed.toISOString().slice(0, 10);
}

function absoluteMileSplitUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `https://co.milesplit.com${url.startsWith("/") ? "" : "/"}${url}`;
}

function isLockedRankingPage($: cheerio.CheerioAPI): boolean {
  const pageText = $("body").text();

  return (
    pageText.includes("XXXXXX") ||
    pageText.includes("Rick James Astley") ||
    pageText.includes("To see these rankings")
  );
}

function markIsUsable(markRaw: string): boolean {
  return (
    Boolean(markRaw) &&
    markRaw !== "XXXXXX" &&
    !/^(NT|NH|ND|DNS|DQ|SCR)$/i.test(markRaw)
  );
}

export function parseMileSplitRankingPage(
  html: string,
  context: {
    gender: Gender;
    event: EventKey;
    sourceUrl: string;
    classification?: Classification;
  },
): MileSplitRankingParseResult {
  const $ = cheerio.load(html);
  const locked = isLockedRankingPage($);
  const performances: Performance[] = [];
  const definition = getEventDefinition(context.event);
  const timingType: TimingType =
    definition.markType === "distance" ? "Field" : "FAT";

  if (!locked) {
    $("#eventRankings table tbody tr").each((rowIndex, row) => {
      const $row = $(row);
      const markRaw = cleanCell($row.find("td.time").first().text());
      const school = cleanCell($row.find("td.name .team a").first().text());
      const athleteCell = cleanCell($row.find("td.name .athlete").first().text());
      const meetName = cleanCell($row.find("td.meet .meet a").first().text());
      const meetDate = parseMileSplitDate(
        cleanCell($row.find("td.meet time.start").first().text()),
      );
      const grade = graduationYearToGrade(cleanCell($row.find("td.year").first().text()));
      const sourceUrl =
        absoluteMileSplitUrl($row.find("td.meet .meet a").first().attr("href")) ??
        context.sourceUrl;

      if (!markIsUsable(markRaw) || !school) {
        return;
      }

      const markValue = parsePerformanceMark(context.event, markRaw);
      if (markValue === undefined) {
        return;
      }

      const athleteName = definition.relay
        ? `${titleCase(school)} Relay`
        : titleCase(athleteCell);

      performances.push(
        applyClassification({
          id: stableId([
            "milesplit-ranking",
            context.gender,
            context.event,
            athleteName,
            school,
            markRaw,
            meetDate,
          ]),
          athleteName,
          gender: context.gender,
          grade,
          school: titleCase(school.replace(/\s+\(CO\)\s+/i, " ")),
          event: context.event,
          markRaw,
          markValue,
          timingType,
          isFAT: timingType === "FAT",
          meetName:
            meetName ||
            `Colorado MileSplit ${context.classification ?? "CO"} Ranking`,
          meetDate,
          source: "milesplit",
          sourceUrl,
          verificationStatus: "verified",
          classificationVerified: false,
          notes:
            `Imported from Colorado MileSplit ${context.classification ?? "CO"} legal rankings for the 2026 outdoor season.`,
        }),
      );
    });
  }

  return {
    performances,
    locked,
    nextUrl: absoluteMileSplitUrl(
      $("nav.pagination a.next[rel='next'], a.next[rel='next']").first().attr("href"),
    ),
  };
}
