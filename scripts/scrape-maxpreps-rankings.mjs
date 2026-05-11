#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";

import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36";

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

const seedUrlsByClassification = {
  "3A": { boys: CLASS_3A_BOYS_SEED_URL, girls: CLASS_3A_GIRLS_SEED_URL },
  "4A": { boys: CLASS_4A_BOYS_SEED_URL, girls: CLASS_4A_GIRLS_SEED_URL },
  "5A": { boys: BOYS_SEED_URL, girls: GIRLS_SEED_URL },
};

const maxPrepsEventNames = {
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

const windSensitiveEvents = new Set([
  "100m",
  "200m",
  "100m Hurdles",
  "110m Hurdles",
  "Long Jump",
  "Triple Jump",
]);

const CLASSIFICATION = String(process.env.MAXPREPS_CLASSIFICATION ?? "5A").toUpperCase();
const MAX_RANK = Number(process.env.MAXPREPS_MAX_RANK ?? 18);
const MAX_PAGES = Number(process.env.MAXPREPS_MAX_PAGES ?? 1);
const CONCURRENCY = Number(process.env.MAXPREPS_CONCURRENCY ?? 10);
const FETCH_TIMEOUT_MS = Number(process.env.MAXPREPS_FETCH_TIMEOUT_MS ?? 15_000);
const RAW_OUTPUT_PATH =
  process.env.MAXPREPS_RAW_OUTPUT ?? `maxpreps-${CLASSIFICATION.toLowerCase()}-rankings.json`;

function cleanCell(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stripLocation(raw) {
  return cleanCell(raw).replace(/\s*\([^)]*\)\s*$/g, "").trim();
}

function relaySchoolFromName(rawName) {
  return cleanCell(rawName)
    .replace(/\bRelay\s+Team\b/i, "")
    .replace(/\bRelay\b/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(raw) {
  const match = cleanCell(raw).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "2026-01-01";
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function makeUrl(seedUrl, eventId, page = 1) {
  const url = new URL(seedUrl);
  url.searchParams.set("eventid", eventId);
  if (page > 1) url.searchParams.set("page", String(page));
  else url.searchParams.delete("page");
  return url.toString();
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (error) {
    throw new Error(
      `MaxPreps request failed: ${error instanceof Error ? error.message : String(error)} (${url})`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function eventIdOptions(html, gender) {
  const $ = cheerio.load(html);
  const options = [];

  $("#ctl00_ContentBottom_ctl00_cmbEventType option").each((_, option) => {
    const label = cleanCell($(option).text());
    const event = maxPrepsEventNames[label];
    const eventId = $(option).attr("value");
    if (!event || !eventId) return;
    if (gender === "Boys" && event === "100m Hurdles") return;
    if (gender === "Girls" && event === "110m Hurdles") return;
    options.push({ event, eventId });
  });

  return options;
}

function windStatus(event, wind) {
  if (!windSensitiveEvents.has(event) || wind === undefined) return { verificationStatus: "verified" };
  if (wind > 2) {
    return {
      verificationStatus: "needs_review",
      notes: `Wind ${wind.toFixed(2)} is above legal qualifying limit.`,
    };
  }
  return { verificationStatus: "verified" };
}

function parseLeaderboardPage(html, context) {
  const $ = cheerio.load(html);
  const rows = [];
  const relay = /Relay/i.test(context.event);

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

    const school = relay ? relaySchoolFromName(rawName) : stripLocation(teamText);
    const athleteName = relay ? `${school} Relay` : stripLocation(rawName);
    const { verificationStatus, notes } = windStatus(context.event, wind);

    rows.push({
      source: "maxpreps",
      classification: CLASSIFICATION,
      gender: context.gender,
      event: context.event,
      rank,
      markRaw: rawMark,
      athleteName,
      school,
      meetName,
      meetDate: parseDate(dateText),
      wind: Number.isFinite(wind) ? wind : undefined,
      sourceUrl: context.sourceUrl,
      verificationStatus,
      notes,
    });
  });

  return rows;
}

async function scrapeGender({ gender, seedUrl }) {
  const errors = [];
  const rows = [];

  const seedHtml = await fetchHtml(seedUrl);
  const options = eventIdOptions(seedHtml, gender);

  const pending = [...options];
  const workerCount = Math.max(1, Math.min(CONCURRENCY, pending.length || 1));

  const workers = Array.from({ length: workerCount }, async () => {
    while (pending.length) {
      const option = pending.shift();
      if (!option) return;
      try {
        const eventRows = [];
        for (let page = 1; page <= MAX_PAGES && eventRows.length < MAX_RANK; page += 1) {
          const sourceUrl = makeUrl(seedUrl, option.eventId, page);
          const html = page === 1 && option.event === "100m" ? seedHtml : await fetchHtml(sourceUrl);
          eventRows.push(
            ...parseLeaderboardPage(html, {
              gender,
              event: option.event,
              sourceUrl,
            }),
          );
        }

        const byRank = new Map();
        for (const row of eventRows) {
          if (row.rank <= MAX_RANK && !byRank.has(row.rank)) byRank.set(row.rank, row);
        }
        rows.push(...[...byRank.values()].sort((a, b) => a.rank - b.rank));
      } catch (error) {
        errors.push(
          `${gender} ${option.event}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  });

  await Promise.all(workers);
  return { rows, errors, eventCount: options.length };
}

async function main() {
  const seed = seedUrlsByClassification[CLASSIFICATION];
  if (!seed) {
    console.error(`Unsupported MAXPREPS_CLASSIFICATION=${CLASSIFICATION} (expected 3A, 4A, 5A)`);
    process.exit(1);
  }

  const scrapedAt = new Date().toISOString();
  const source = `maxpreps_public_${CLASSIFICATION.toLowerCase()}_leaderboards`;
  const errors = [];

  const boys = await scrapeGender({ gender: "Boys", seedUrl: seed.boys });
  const girls = await scrapeGender({ gender: "Girls", seedUrl: seed.girls });
  errors.push(...boys.errors, ...girls.errors);

  const output = {
    scrapedAt,
    source,
    rowCount: boys.rows.length + girls.rows.length,
    errors,
    rows: [...boys.rows, ...girls.rows],
  };

  await mkdir(".", { recursive: true });
  await writeFile(RAW_OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log(
    `Scraped MaxPreps ${CLASSIFICATION}: boysEvents=${boys.eventCount} girlsEvents=${girls.eventCount} rows=${output.rowCount} errors=${errors.length}`,
  );
  console.log(`Wrote ${RAW_OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

