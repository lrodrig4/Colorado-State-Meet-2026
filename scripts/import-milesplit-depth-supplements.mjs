import { readFile, writeFile } from "node:fs/promises";

const DATA_PATH = "src/lib/data/currentPerformances.generated.ts";
const SOURCES_PATH = "src/lib/data/milesplitGapMeetSources.ts";
const BULLETIN_PATH = "src/lib/data/trackBulletinSchools.generated.ts";
const START_DATE = process.env.MILESPLIT_SOURCE_MIN_DATE ?? "2026-05-04";
const END_DATE = process.env.MILESPLIT_SUPPLEMENTAL_WINDOW_END ?? "2026-05-05";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const WIND_SENSITIVE_EVENTS = new Set([
  "100m",
  "200m",
  "100m Hurdles",
  "110m Hurdles",
  "Long Jump",
  "Triple Jump",
]);
const FIELD_EVENTS = new Set([
  "High Jump",
  "Long Jump",
  "Triple Jump",
  "Pole Vault",
  "Discus",
  "Shot Put",
]);
const NON_QUALIFYING_MEET_PATTERN =
  /\b(JV|junior\s+varsity|frosh|freshman|sophomore|middle\s+school|JH)\b/i;

function isNonQualifyingMeetName(meetName) {
  return NON_QUALIFYING_MEET_PATTERN.test(meetName);
}

function parseGeneratedLiteral(file, marker, nextMarker) {
  const start = file.indexOf(marker);
  const end = nextMarker ? file.indexOf(nextMarker, start + marker.length) : file.length;
  if (start < 0 || end < 0) throw new Error(`Could not find ${marker}`);
  return Function(
    `"use strict"; return (${file
      .slice(start + marker.length, end)
      .replace(/;\s*$/, "")
      .replace(/\s+satisfies[\s\S]*$/, "")
      .trim()});`,
  )();
}

function normalizeKey(value) {
  return `${value ?? ""}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/&/g, " and ")
    .replace(/\(([a-z]{2})\)/gi, " ")
    .replace(/\bco\./gi, "colorado")
    .replace(/\bcolo\./gi, "colorado")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function titleCase(value) {
  const small = new Set(["of", "and", "the", "for", "de", "la"]);
  return normalizeKey(value)
    .split(" ")
    .filter(Boolean)
    .map((part, index) =>
      index > 0 && small.has(part)
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

function slugify(value) {
  return normalizeKey(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"');
}

function stripHtml(value) {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " "));
}

function normalizeEvent(raw) {
  const clean = raw
    .replace(/\bmeter(s)?\b/gi, "m")
    .replace(/\s+/g, " ")
    .trim();
  const lower = clean.toLowerCase();
  const relay = lower.match(/\b4x(100|200|400|800)\s*m?\s*relay\b/);
  if (relay) return `4x${relay[1]}m Relay`;
  if (/\b100\s*m\b/.test(lower) && /hurdle/.test(lower)) return "100m Hurdles";
  if (/\b110\s*m\b/.test(lower) && /hurdle/.test(lower)) return "110m Hurdles";
  if (/\b300\s*m\b/.test(lower) && /hurdle/.test(lower)) return "300m Hurdles";
  for (const distance of ["100", "200", "400", "800", "1600", "3200"]) {
    if (new RegExp(`\\b${distance}\\s*m\\b`).test(lower)) return `${distance}m`;
  }
  if (/high jump/.test(lower)) return "High Jump";
  if (/long jump/.test(lower)) return "Long Jump";
  if (/triple jump/.test(lower)) return "Triple Jump";
  if (/pole vault/.test(lower)) return "Pole Vault";
  if (/discus/.test(lower)) return "Discus";
  if (/shot put/.test(lower)) return "Shot Put";
  return undefined;
}

function parseSectionHeading(line) {
  const match = line.match(/^(Boys|Girls)\s+(.+?)(?:\s+(1A|2A|3A|4A|5A))?\s*$/i);
  if (!match) return undefined;
  const event = normalizeEvent(match[2]);
  if (!event) return undefined;
  return {
    gender: /^boys$/i.test(match[1]) ? "Boys" : "Girls",
    event,
    classification: match[3]?.toUpperCase(),
  };
}

function parseMarkValue(event, markRaw) {
  const clean = `${markRaw}`.replace(/"/g, "").trim();
  if (FIELD_EVENTS.has(event)) {
    const match = clean.match(/^(\d+)[-' ](\d+(?:\.\d+)?)$/);
    if (match) return Number(match[1]) * 12 + Number(match[2]);
    const feetOnly = clean.match(/^(\d+)-?$/);
    return feetOnly ? Number(feetOnly[1]) * 12 : undefined;
  }
  const parts = clean.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return undefined;
  return parts.length === 1 ? parts[0] : parts[0] * 60 + parts[1];
}

function parseWind(raw) {
  const value = Number(`${raw ?? ""}`.trim().replace(/^\+/, ""));
  return Number.isFinite(value) ? value : undefined;
}

function parseRow(line, header) {
  const rank = line.slice(0, Math.max(header.indexOf("NAME"), 1)).trim();
  if (!/^\d+[A-Za-z]*$/.test(rank)) return undefined;
  const nameStart = header.indexOf("NAME");
  const yearStart = header.indexOf("YR");
  const teamStart = header.indexOf("TEAM");
  const markStart = header.indexOf("MARK");
  const heatStart = header.indexOf("H#");
  const windStart = header.indexOf("WIND");
  if ([nameStart, teamStart, markStart].some((index) => index < 0)) return undefined;
  const athleteName = line.slice(nameStart, yearStart > 0 ? yearStart : teamStart).trim();
  const gradeRaw = yearStart > 0 ? line.slice(yearStart, teamStart).trim() : "";
  const school = line.slice(teamStart, markStart).trim();
  const markRaw = line
    .slice(markStart, heatStart > 0 ? heatStart : windStart > 0 ? windStart : undefined)
    .trim();
  const wind = windStart > 0 ? parseWind(line.slice(windStart)) : undefined;
  if (!school || !markRaw || /^(NT|NH|ND|NM|DNS|DNF|DQ|SCR|FOUL)$/i.test(markRaw)) {
    return undefined;
  }
  return {
    athleteName,
    grade: /^\d{1,2}$/.test(gradeRaw) ? Number(gradeRaw) : undefined,
    school,
    markRaw,
    wind,
  };
}

function parseRawResults(html, source, schoolLookup) {
  const bodyStart = html.indexOf('id="meetResultsBody"');
  const bodyEndCandidates = ["MileSplit PRO", "© 2026 Copyright", "<footer"];
  let body = bodyStart >= 0 ? html.slice(bodyStart) : html;
  for (const candidate of bodyEndCandidates) {
    const end = body.indexOf(candidate);
    if (end > 0) body = body.slice(0, end);
  }
  const lines = stripHtml(body).split(/\r?\n/);
  const rows = [];
  let section;
  let round = "";
  let header = "";

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.replace(/\u00a0/g, " ");
    const clean = line.replace(/\s+/g, " ").trim();
    const nextSection = parseSectionHeading(clean);
    if (nextSection) {
      section = nextSection;
      round = "";
      header = "";
      return;
    }
    if (!section || !clean) return;
    if (/^(Finals?|Prelims?|Semi-Finals?|Semifinals?|Timed Finals?)$/i.test(clean)) {
      round = clean;
      header = "";
      return;
    }
    if (/\bNAME\b/.test(line) && /\bTEAM\b/.test(line) && /\bMARK\b/.test(line)) {
      header = line;
      return;
    }
    if (!header || !round || /^=+$/.test(clean)) return;
    const row = parseRow(line, header);
    if (!row) return;
    if (WIND_SENSITIVE_EVENTS.has(section.event) && row.wind !== undefined && row.wind > 2) {
      return;
    }
    const markValue = parseMarkValue(section.event, row.markRaw);
    if (markValue === undefined) return;
    const lookup = schoolLookup.get(normalizeKey(row.school));
    if (!lookup?.classification) return;
    const relay = section.event.includes("Relay");
    const school = lookup.schoolName;
    const athleteName = relay ? `${school} Relay` : titleCase(row.athleteName);
    const depthOnly = isNonQualifyingMeetName(source.meetName);
    const missingRequiredWind =
      WIND_SENSITIVE_EVENTS.has(section.event) && row.wind === undefined;
    const verificationStatus = depthOnly
      ? "depth_only"
      : missingRequiredWind
        ? "needs_review"
        : "verified";
    const id = slugify([
      "milesplit-raw",
      source.rawResultsUrl,
      lineIndex,
      section.gender,
      section.event,
      athleteName,
      school,
      row.markRaw,
    ].join(" "));

    rows.push({
      id,
      athleteName,
      gender: section.gender,
      grade: row.grade,
      school,
      event: section.event,
      markRaw: row.markRaw,
      markValue,
      timingType: FIELD_EVENTS.has(section.event) ? "Field" : "FAT",
      isFAT: !FIELD_EVENTS.has(section.event),
      meetName: source.meetName,
      meetDate: source.meetDate,
      source: "milesplit",
      sourceUrl: source.rawResultsUrl,
      verificationStatus,
      classificationVerified: true,
      classification: lookup.classification,
      notes: [
        `Parsed from Colorado MileSplit raw meet results (${round}).`,
        `Supplemental varsity/depth import: ${START_DATE} through ${END_DATE}.`,
        depthOnly
          ? "Depth-only/non-qualifying meet; excluded from CHSAA qualifying rankings and cutoff model."
          : undefined,
        section.classification
          ? `Result section listed ${section.classification}; school bulletin classification remains authoritative.`
          : "School bulletin classification applied to unclassified MileSplit meet section.",
        row.wind !== undefined && WIND_SENSITIVE_EVENTS.has(section.event)
          ? `Wind ${row.wind > 0 ? "+" : ""}${row.wind}.`
          : undefined,
      ]
        .filter(Boolean)
        .join(" "),
    });
  });

  return rows;
}

function serialize(value) {
  return JSON.stringify(value, null, 2).replace(/"([^"]+)":/g, "$1:");
}

async function main() {
  const dataFile = await readFile(DATA_PATH, "utf8");
  const metadata = parseGeneratedLiteral(
    dataFile,
    "export const currentMileSplitSeedMetadata = ",
    "export const currentMileSplitPerformances: Performance[] = ",
  );
  const existingPerformances = parseGeneratedLiteral(
    dataFile,
    "export const currentMileSplitPerformances: Performance[] = ",
  );
  const sourceFile = await readFile(SOURCES_PATH, "utf8");
  const sources = parseGeneratedLiteral(
    sourceFile,
    "export const milesplitGapMeetSources: MileSplitGapMeetSource[] = ",
  ).filter((source) => source.meetDate >= START_DATE);
  const bulletinFile = await readFile(BULLETIN_PATH, "utf8");
  const bulletinRows = parseGeneratedLiteral(
    bulletinFile,
    "export const trackBulletinSchoolRows = ",
    "export const trackBulletinAbbreviationRows = ",
  );
  const schoolLookup = new Map();

  for (const performance of existingPerformances) {
    if (performance.school && performance.classification) {
      schoolLookup.set(normalizeKey(performance.school), {
        schoolName: performance.school,
        classification: performance.classification,
      });
    }
  }
  for (const row of bulletinRows) {
    schoolLookup.set(normalizeKey(row.schoolName), {
      schoolName: row.schoolName,
      classification: row.classification,
    });
  }

  const newRows = [];
  const sourceErrors = [];

  for (const source of sources) {
    for (const rawResultsUrl of source.rawResultsUrls) {
      try {
        const html = await fetch(rawResultsUrl, {
          headers: { "user-agent": USER_AGENT },
        }).then((response) => {
          if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
          return response.text();
        });
        const parsed = parseRawResults(html, { ...source, rawResultsUrl }, schoolLookup);
        console.log(`${source.meetName}: ${parsed.length} rows`);
        newRows.push(...parsed);
      } catch (error) {
        sourceErrors.push(`${source.meetName}: ${error.message}`);
      }
    }
  }

  const byId = new Map(existingPerformances.map((performance) => [performance.id, performance]));
  let inserted = 0;
  for (const row of newRows) {
    if (!byId.has(row.id)) inserted += 1;
    byId.set(row.id, row);
  }
  const performances = [...byId.values()];
  const nextMetadata = {
    ...metadata,
    generatedAt: new Date().toISOString(),
    source: `colorado_milesplit_varsity_and_depth_supplements_${START_DATE.replace(/-/g, "_")}_to_${END_DATE.replace(/-/g, "_")}`,
    supplementalRows: (metadata.supplementalRows ?? 0) + inserted,
    totalRows: performances.length,
    sourceErrors: [...(metadata.sourceErrors ?? []), ...sourceErrors],
  };
  const file = `/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// This file is generated by npm run seed:milesplit.
import type { Performance } from "@/types/domain";

export const currentMileSplitSeedMetadata = ${serialize(nextMetadata)};

export const currentMileSplitPerformances: Performance[] = ${serialize(performances)};
`;

  await writeFile(DATA_PATH, file);
  console.log(`Inserted ${inserted} new May 4+ depth rows. Total rows: ${performances.length}.`);
  if (sourceErrors.length) console.warn(`Source errors: ${sourceErrors.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
