import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as cheerio from "cheerio";
import type { Classification, EventKey, Gender, Performance, VerificationStatus } from "@/types/domain";
import { current3ABrowserRankingPerformances } from "@/lib/data/current3ABrowserRankings.generated";
import { current5ABrowserRankingPerformances } from "@/lib/data/current5ABrowserRankings.generated";
import { eventDefinitions, getEventDefinition } from "@/lib/data/events";
import { applyClassification } from "@/lib/services/classification";
import { comparePerformanceMarks, parsePerformanceMark } from "@/lib/utils/time";
import { cleanCell, slugify } from "@/lib/utils/text";

type MaxPrepsGenderConfig = {
  gender: Gender;
  seedUrl: string;
};

type MaxPrepsRankingRow = {
  source: "maxpreps";
  classification: Classification;
  gender: Gender;
  event: EventKey;
  rank: number;
  markRaw: string;
  athleteName: string;
  school: string;
  meetName: string;
  meetDate: string;
  wind?: number;
  sourceUrl: string;
  verificationStatus: VerificationStatus;
  notes?: string;
};

type MaxPrepsRawFile = {
  scrapedAt: string;
  source: string;
  rowCount: number;
  errors: string[];
  rows: MaxPrepsRankingRow[];
};

const BOYS_SEED_URL =
  "https://www.maxpreps.com/list/leaderboard_list.aspx?eventid=36d72b62-c349-4023-be42-325acc3ba1bb&leagueid=Select&sectionid=Select&ssid=e12c57e1-ae3f-494f-b10c-3efa7f343106&state=CO&statedivisionid=a7c79d05-5f3a-4b49-a13f-e9ae47dee4da";
const GIRLS_SEED_URL =
  "https://www.maxpreps.com/list/leaderboard_list.aspx?eventid=b222bbee-15dd-40ef-b996-a089d9298d75&leagueid=Select&sectionid=Select&ssid=36af9836-510a-4b86-8a42-07067ea0f95a&state=CO&statedivisionid=b7633d13-d5a5-4d89-9f81-72cdf90c475f";
const CLASS_3A_BOYS_SEED_URL =
  "https://www.maxpreps.com/list/leaderboard_list.aspx?eventid=36d72b62-c349-4023-be42-325acc3ba1bb&leagueid=Select&sectionid=Select&ssid=e12c57e1-ae3f-494f-b10c-3efa7f343106&state=CO&statedivisionid=e11ea5db-a577-4512-8402-1a6df28aaef9";
const CLASS_3A_GIRLS_SEED_URL =
  "https://www.maxpreps.com/list/leaderboard_list.aspx?eventid=b222bbee-15dd-40ef-b996-a089d9298d75&leagueid=Select&sectionid=Select&ssid=36af9836-510a-4b86-8a42-07067ea0f95a&state=CO&statedivisionid=263efadb-3870-44a5-b107-09d50d16cdf4";
const CLASS_4A_BOYS_SEED_URL =
  "https://www.maxpreps.com/list/leaderboard_list.aspx?eventid=36d72b62-c349-4023-be42-325acc3ba1bb&leagueid=Select&sectionid=Select&ssid=e12c57e1-ae3f-494f-b10c-3efa7f343106&state=CO&statedivisionid=08380c35-4709-49c5-9bf4-a4f983d98bca";
const CLASS_4A_GIRLS_SEED_URL =
  "https://www.maxpreps.com/list/leaderboard_list.aspx?eventid=b222bbee-15dd-40ef-b996-a089d9298d75&leagueid=Select&sectionid=Select&ssid=36af9836-510a-4b86-8a42-07067ea0f95a&state=CO&statedivisionid=2f0fb647-05f9-4a39-a3b5-5cf33a22e644";

const CLASSIFICATION = (process.env.MAXPREPS_CLASSIFICATION ?? "5A") as Classification;
const EXPORT_CLASSIFICATION = CLASSIFICATION.replace(/[^A-Za-z0-9]/g, "");

const RAW_OUTPUT_PATH =
  process.env.MAXPREPS_RAW_OUTPUT ??
  process.env.MAXPREPS_5A_RAW_OUTPUT ??
  `maxpreps-${CLASSIFICATION.toLowerCase()}-rankings.json`;
const GENERATED_OUTPUT_PATH =
  process.env.MAXPREPS_GENERATED_OUTPUT ??
  process.env.MAXPREPS_5A_GENERATED_OUTPUT ??
  `src/lib/data/current${EXPORT_CLASSIFICATION}MaxPrepsRankings.generated.ts`;
const REPORT_OUTPUT_PATH =
  process.env.MAXPREPS_REPORT_OUTPUT ??
  process.env.MAXPREPS_5A_REPORT_OUTPUT ??
  `reports/${CLASSIFICATION.toLowerCase()}-maxpreps-cross-check-report.json`;

const seedUrlsByClassification: Record<string, { boys: string; girls: string }> = {
  "3A": {
    boys: CLASS_3A_BOYS_SEED_URL,
    girls: CLASS_3A_GIRLS_SEED_URL,
  },
  "4A": {
    boys: CLASS_4A_BOYS_SEED_URL,
    girls: CLASS_4A_GIRLS_SEED_URL,
  },
  "5A": {
    boys: BOYS_SEED_URL,
    girls: GIRLS_SEED_URL,
  },
};

const browserRowsByClassification: Record<string, Performance[]> = {
  "3A": current3ABrowserRankingPerformances,
  "5A": current5ABrowserRankingPerformances,
};

const seedUrls = seedUrlsByClassification[CLASSIFICATION];
if (!seedUrls) {
  throw new Error(`Missing MaxPreps seed URLs for ${CLASSIFICATION}`);
}

const configs: MaxPrepsGenderConfig[] = [
  { gender: "Boys", seedUrl: seedUrls.boys },
  { gender: "Girls", seedUrl: seedUrls.girls },
];

const maxPrepsEventNames: Record<string, EventKey | undefined> = {
  "100 Meter": "100m",
  "200 Meter": "200m",
  "400 Meter": "400m",
  "800 Meter": "800m",
  "1600 Meter": "1600m",
  "3200 Meter": "3200m",
  "100 Meter Hurdles": "100m Hurdles",
  "110 Meter Hurdles": "110m Hurdles",
  "300 Meter Hurdles": "300m Hurdles",
  "4 x 100 Meter": "4x100m Relay",
  "4 x 200 Meter": "4x200m Relay",
  "4 x 400 Meter": "4x400m Relay",
  "4 x 800 Meter": "4x800m Relay",
  "Long Jump": "Long Jump",
  "Triple Jump": "Triple Jump",
  "High Jump": "High Jump",
  "Pole Vault": "Pole Vault",
  "Shot Put": "Shot Put",
  Discus: "Discus",
};

const windSensitiveEvents = new Set<EventKey>([
  "100m",
  "200m",
  "100m Hurdles",
  "110m Hurdles",
  "Long Jump",
  "Triple Jump",
]);

const MAX_RANK = Number(process.env.MAXPREPS_MAX_RANK ?? 18);
const MAX_PAGES = Number(process.env.MAXPREPS_MAX_PAGES ?? 1);
const MAX_CONCURRENCY = Number(process.env.MAXPREPS_CONCURRENCY ?? 6);
const FETCH_TIMEOUT_MS = Number(process.env.MAXPREPS_FETCH_TIMEOUT_MS ?? 20_000);
const execFileAsync = promisify(execFile);

function serialize(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/"([^"]+)":/g, "$1:");
}

function makeUrl(seedUrl: string, eventId: string, page = 1): string {
  const url = new URL(seedUrl);
  url.searchParams.set("eventid", eventId);
  if (page > 1) {
    url.searchParams.set("page", String(page));
  } else {
    url.searchParams.delete("page");
  }
  return url.toString();
}

async function fetchHtml(url: string): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(
      "curl",
      [
        "-sS",
        "-L",
        "--max-time",
        String(Math.ceil(FETCH_TIMEOUT_MS / 1000)),
        "-H",
        "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "-H",
        "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        url,
      ],
      { maxBuffer: 12 * 1024 * 1024 },
    );

    if (stderr?.trim()) {
      // curl sometimes logs SSL negotiation warnings to stderr even on success.
      // Only treat as fatal if stdout is empty.
      if (!stdout?.trim()) {
        throw new Error(stderr.trim());
      }
    }

    return stdout;
  } catch (error) {
    throw new Error(
      `MaxPreps request failed: ${error instanceof Error ? error.message : String(error)} (${url})`,
    );
  }
}

function eventIdOptions(html: string, gender: Gender) {
  const $ = cheerio.load(html);
  const options: Array<{ event: EventKey; eventId: string; label: string }> = [];

  $("#ctl00_ContentBottom_ctl00_cmbEventType option").each((_, option) => {
    const label = cleanCell($(option).text());
    const event = maxPrepsEventNames[label];
    const eventId = $(option).attr("value");

    if (!event || !eventId) return;
    if (gender === "Boys" && event === "100m Hurdles") return;
    if (gender === "Girls" && event === "110m Hurdles") return;
    if (!getEventDefinition(event).genders.includes(gender)) return;

    options.push({ event, eventId, label });
  });

  return options;
}

function normalizeTimeMark(raw: string): string {
  const clean = raw.trim().replace(/^0+(?=\d:)/, "");
  const parts = clean.split(":");

  if (parts.length === 1) {
    return clean;
  }

  const minutes = Number(parts[0]);
  const seconds = parts.slice(1).join(":");
  if (minutes === 0) {
    return seconds.replace(/^0+(?=\d)/, "");
  }

  return `${minutes}:${seconds.padStart(5, "0")}`;
}

function normalizeFieldMark(raw: string): string {
  const clean = raw.trim().replace(/\s+/g, " ");
  const feetInches = clean.match(/^(\d+)'\s*(\d+(?:\.\d+)?)\"?$/);
  if (feetInches) {
    return `${feetInches[1]}-${feetInches[2]}`;
  }
  return clean.replace(/'/g, "-").replace(/"/g, "");
}

function normalizeMark(event: EventKey, raw: string): string {
  const definition = getEventDefinition(event);
  return definition.markType === "time"
    ? normalizeTimeMark(raw)
    : normalizeFieldMark(raw);
}

function parseDate(raw: string): string {
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "2026-01-01";
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function stripLocation(raw: string): string {
  return raw.replace(/\s*\([^)]*\)\s*$/g, "").replace(/\s+/g, " ").trim();
}

function relaySchoolFromName(rawName: string): string {
  return rawName
    .replace(/\bRelay\s+Team\b/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function maxPrepsRowKey(row: Performance) {
  const definition = getEventDefinition(row.event);
  return definition.relay
    ? `${row.gender}|${row.event}|${row.school}`.toLowerCase()
    : `${row.gender}|${row.event}|${row.athleteName}|${row.school}`.toLowerCase();
}

function windStatus(
  event: EventKey,
  wind: number | undefined,
): { status: VerificationStatus; note?: string } {
  if (!windSensitiveEvents.has(event) || wind === undefined) {
    return { status: "verified" };
  }

  if (wind > 2) {
    return {
      status: "needs_review",
      note: `Wind ${wind.toFixed(2)} is above legal qualifying limit.`,
    };
  }

  return { status: "verified" };
}

function toPerformance(row: MaxPrepsRankingRow): Performance | undefined {
  const definition = getEventDefinition(row.event);
  const markValue = parsePerformanceMark(row.event, row.markRaw);
  if (markValue === undefined) return undefined;

  const performance = applyClassification({
    id: slugify(
      [
        `maxpreps-${CLASSIFICATION.toLowerCase()}`,
        CLASSIFICATION,
        row.gender,
        row.event,
        row.athleteName,
        row.school,
        row.markRaw,
        row.meetDate,
      ].join("-"),
    ),
    athleteName: definition.relay ? `${row.school} Relay` : row.athleteName,
    gender: row.gender,
    school: row.school,
    classification: CLASSIFICATION,
    classificationVerified: true,
    event: row.event,
    markRaw: row.markRaw,
    markValue,
    timingType: definition.markType === "distance" ? "Field" : "FAT",
    isFAT: definition.markType === "time",
    meetName: row.meetName,
    meetDate: row.meetDate,
    source: "maxpreps",
    sourceUrl: row.sourceUrl,
    verificationStatus: row.verificationStatus,
    notes: [
      `MaxPreps public ${CLASSIFICATION} leaderboard rank #${row.rank}.`,
      row.wind !== undefined ? `Wind ${row.wind}.` : undefined,
      row.notes,
    ]
      .filter(Boolean)
      .join(" "),
  });

  if (performance.classification !== CLASSIFICATION) {
    return {
      ...performance,
      classification: CLASSIFICATION,
      classificationVerified: false,
      verificationStatus: "needs_review",
      notes: `${performance.notes} MaxPreps listed this row under ${CLASSIFICATION}, but CHSAA school lookup did not verify it as ${CLASSIFICATION}.`,
    };
  }

  return performance;
}

function parseLeaderboardPage(
  html: string,
  context: {
    gender: Gender;
    event: EventKey;
    sourceUrl: string;
  },
): MaxPrepsRankingRow[] {
  const $ = cheerio.load(html);
  const rows: MaxPrepsRankingRow[] = [];

  $("#leaders tbody tr").each((_, tr) => {
    const $row = $(tr);
    const rank = Number(cleanCell($row.find("td.rank").first().text()));
    const rawName = cleanCell($row.find("td.name a").first().text());
    const teamText = cleanCell($row.find("td.name a.team").first().text());
    const meetName = cleanCell($row.find("td.event a").first().text());
    const dateText = cleanCell($row.find("td.event .event-date").first().text());
    const rawMark = cleanCell($row.find("td.result").first().text());
    const windRaw = cleanCell($row.find("td.wind").first().text());
    const wind = windRaw ? Number(windRaw) : undefined;

    if (!rank || !rawName || !rawMark) return;

    const school = getEventDefinition(context.event).relay
      ? relaySchoolFromName(rawName)
      : stripLocation(teamText);
    const athleteName = getEventDefinition(context.event).relay
      ? `${school} Relay`
      : rawName;
    const markRaw = normalizeMark(context.event, rawMark);
    const markValue = parsePerformanceMark(context.event, markRaw);
    const windAudit = windStatus(context.event, wind);

    if (!school || markValue === undefined) return;

    rows.push({
      source: "maxpreps",
      classification: CLASSIFICATION,
      gender: context.gender,
      event: context.event,
      rank,
      markRaw,
      athleteName,
      school,
      meetName: meetName || `MaxPreps ${CLASSIFICATION} Leaderboard`,
      meetDate: parseDate(dateText),
      wind: Number.isFinite(wind) ? wind : undefined,
      sourceUrl: context.sourceUrl,
      verificationStatus: windAudit.status,
      notes: windAudit.note,
    });
  });

  return rows;
}

async function scrapeMaxPreps() {
  const errors: string[] = [];
  const rows: MaxPrepsRankingRow[] = [];

  for (const config of configs) {
    const seedHtml = await fetchHtml(config.seedUrl);
    const options = eventIdOptions(seedHtml, config.gender);

    const pending = [...options];
    const workers = Array.from(
      { length: Math.min(MAX_CONCURRENCY, pending.length || 1) },
      async () => {
        while (pending.length) {
          const option = pending.shift();
          if (!option) return;

          try {
            const eventRows: MaxPrepsRankingRow[] = [];
            for (
              let page = 1;
              page <= MAX_PAGES && eventRows.length < MAX_RANK;
              page += 1
            ) {
              const sourceUrl = makeUrl(config.seedUrl, option.eventId, page);
              const html =
                page === 1 && option.event === "100m"
                  ? seedHtml
                  : await fetchHtml(sourceUrl);
              eventRows.push(
                ...parseLeaderboardPage(html, {
                  gender: config.gender,
                  event: option.event,
                  sourceUrl,
                }),
              );
            }

            const byRank = new Map<number, MaxPrepsRankingRow>();
            for (const row of eventRows) {
              if (row.rank <= MAX_RANK && !byRank.has(row.rank)) {
                byRank.set(row.rank, row);
              }
            }

            rows.push(...[...byRank.values()].sort((a, b) => a.rank - b.rank));
          } catch (error) {
            errors.push(
              `${config.gender} ${option.event}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
      },
    );

    await Promise.all(workers);
  }

  return {
    scrapedAt: new Date().toISOString(),
    source: `maxpreps_public_${CLASSIFICATION.toLowerCase()}_leaderboards`,
    rowCount: rows.length,
    errors,
    rows,
  };
}

function buildReconciliationReport(input: MaxPrepsRawFile, performances: Performance[]) {
  const maxPrepsEligible = performances.filter(
    (performance) => performance.verificationStatus === "verified",
  );
  const maxPrepsNeedsReview = performances.filter(
    (performance) => performance.verificationStatus !== "verified",
  );
  const mileSplitByKey = new Map(
    (browserRowsByClassification[CLASSIFICATION] ?? []).map((performance) => [
      maxPrepsRowKey(performance),
      performance,
    ]),
  );
  const maxPrepsByKey = new Map(
    maxPrepsEligible.map((performance) => [maxPrepsRowKey(performance), performance]),
  );
  const maxPrepsOnly = [...maxPrepsByKey.entries()]
    .filter(([key]) => !mileSplitByKey.has(key))
    .map(([, performance]) => performance);
  const mileSplitOnly = [...mileSplitByKey.entries()]
    .filter(([key]) => !maxPrepsByKey.has(key))
    .map(([, performance]) => performance);
  const conflicts = [...maxPrepsByKey.entries()]
    .flatMap(([key, maxPreps]) => {
      const mileSplit = mileSplitByKey.get(key);
      if (!mileSplit || mileSplit.markValue === maxPreps.markValue) return [];
      const comparison = comparePerformanceMarks(
        maxPreps.event,
        maxPreps.markValue,
        mileSplit.markValue,
      );
      return [
        {
          gender: maxPreps.gender,
          event: maxPreps.event,
          athleteName: maxPreps.athleteName,
          school: maxPreps.school,
          mileSplitMark: mileSplit.markRaw,
          mileSplitMeet: mileSplit.meetName,
          maxPrepsMark: maxPreps.markRaw,
          maxPrepsMeet: maxPreps.meetName,
          keptByRanking: comparison < 0 ? "maxpreps" : "milesplit",
        },
      ];
    })
    .sort((a, b) => a.event.localeCompare(b.event) || a.school.localeCompare(b.school));

  const coverage = eventDefinitions.flatMap((definition) =>
    definition.genders.map((gender) => {
      const rows = performances
        .filter(
          (performance) =>
            performance.gender === gender && performance.event === definition.event,
        )
        .sort((a, b) =>
          comparePerformanceMarks(definition.event, a.markValue, b.markValue),
        );
      return {
        gender,
        event: definition.event,
        maxPrepsRows: rows.length,
        verifiedRows: rows.filter((row) => row.verificationStatus === "verified").length,
        current18th: rows[17]?.markRaw ?? null,
        row50: rows[49]?.markRaw ?? null,
      };
    }),
  );

  return {
    generatedAt: new Date().toISOString(),
    sourceMetadata: {
      scrapedAt: input.scrapedAt,
      source: input.source,
      rowCount: input.rowCount,
      errors: input.errors,
    },
    coverage,
    summary: {
      maxPrepsPerformances: performances.length,
      maxPrepsEligible: maxPrepsEligible.length,
      maxPrepsNeedsReview: maxPrepsNeedsReview.length,
      maxPrepsOnly: maxPrepsOnly.length,
      mileSplitOnly: mileSplitOnly.length,
      conflicts: conflicts.length,
    },
    maxPrepsOnly: maxPrepsOnly.slice(0, 120).map(reportPerformance),
    mileSplitOnly: mileSplitOnly.slice(0, 120).map(reportPerformance),
    conflicts: conflicts.slice(0, 160),
    needsReview: maxPrepsNeedsReview.slice(0, 160).map(reportPerformance),
  };
}

function reportPerformance(performance: Performance) {
  return {
    gender: performance.gender,
    event: performance.event,
    athleteName: performance.athleteName,
    school: performance.school,
    markRaw: performance.markRaw,
    meetName: performance.meetName,
    meetDate: performance.meetDate,
    verificationStatus: performance.verificationStatus,
    notes: performance.notes,
    sourceUrl: performance.sourceUrl,
  };
}

async function main() {
  const input = await scrapeMaxPreps();
  const performances = input.rows
    .map(toPerformance)
    .filter((performance): performance is Performance => Boolean(performance));
  const metadata = {
    generatedAt: input.scrapedAt,
    source: input.source,
    classification: CLASSIFICATION,
    rankingRows: performances.length,
    eventGenderCombinations: new Set(
      performances.map((performance) => `${performance.gender}|${performance.event}`),
    ).size,
    eligibleRows: performances.filter(
      (performance) => performance.verificationStatus === "verified",
    ).length,
    reviewRows: performances.filter(
      (performance) => performance.verificationStatus !== "verified",
    ).length,
    sourceErrors: input.errors,
  };
  const generated = `/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Generated from public MaxPreps Colorado ${CLASSIFICATION} leaderboards.
// No credentials, cookies, passwords, or private session data are used.
import type { Performance } from "@/types/domain";

export const current${EXPORT_CLASSIFICATION}MaxPrepsRankingMetadata = ${serialize(metadata)};

export const current${EXPORT_CLASSIFICATION}MaxPrepsRankingPerformances: Performance[] = ${serialize(performances)};
`;

  await writeFile(RAW_OUTPUT_PATH, JSON.stringify(input, null, 2));
  await mkdir(path.dirname(GENERATED_OUTPUT_PATH), { recursive: true });
  await writeFile(GENERATED_OUTPUT_PATH, generated);
  await mkdir(path.dirname(REPORT_OUTPUT_PATH), { recursive: true });
  await writeFile(
    REPORT_OUTPUT_PATH,
    JSON.stringify(buildReconciliationReport(input, performances), null, 2),
  );

  console.log(
    `Imported ${performances.length} MaxPreps ${CLASSIFICATION} rows into ${GENERATED_OUTPUT_PATH}`,
  );
  console.log(`Wrote ${RAW_OUTPUT_PATH}`);
  console.log(`Wrote ${REPORT_OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
