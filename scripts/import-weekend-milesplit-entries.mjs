import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const outputPath =
  process.env.WEEKEND_ENTRIES_OUTPUT ??
  "src/lib/data/weekendMeetEntries.generated.ts";

const eventDefinitions = [
  ["100m", "100m Dash", "time", "asc", false, ["Boys", "Girls"]],
  ["200m", "200m Dash", "time", "asc", false, ["Boys", "Girls"]],
  ["400m", "400m Dash", "time", "asc", false, ["Boys", "Girls"]],
  ["800m", "800m Run", "time", "asc", false, ["Boys", "Girls"]],
  ["1600m", "1600m Run", "time", "asc", false, ["Boys", "Girls"]],
  ["3200m", "3200m Run", "time", "asc", false, ["Boys", "Girls"]],
  ["100m Hurdles", "100m Hurdles", "time", "asc", false, ["Girls"]],
  ["110m Hurdles", "110m Hurdles", "time", "asc", false, ["Boys"]],
  ["300m Hurdles", "300m Hurdles", "time", "asc", false, ["Boys", "Girls"]],
  ["4x100m Relay", "4x100m Relay", "time", "asc", true, ["Boys", "Girls"]],
  ["4x200m Relay", "4x200m Relay", "time", "asc", true, ["Boys", "Girls"]],
  ["4x400m Relay", "4x400m Relay", "time", "asc", true, ["Boys", "Girls"]],
  ["4x800m Relay", "4x800m Relay", "time", "asc", true, ["Boys", "Girls"]],
  ["High Jump", "High Jump", "distance", "desc", false, ["Boys", "Girls"]],
  ["Pole Vault", "Pole Vault", "distance", "desc", false, ["Boys", "Girls"]],
  ["Long Jump", "Long Jump", "distance", "desc", false, ["Boys", "Girls"]],
  ["Triple Jump", "Triple Jump", "distance", "desc", false, ["Boys", "Girls"]],
  ["Shot Put", "Shot Put", "distance", "desc", false, ["Boys", "Girls"]],
  ["Discus", "Discus", "distance", "desc", false, ["Boys", "Girls"]],
].map(([event, displayName, markType, sortDirection, relay, genders]) => ({
  event,
  displayName,
  markType,
  sortDirection,
  relay,
  genders,
}));

const definitionsByEvent = new Map(
  eventDefinitions.map((definition) => [definition.event, definition]),
);

const meets = [
  {
    meetName: "Windjammer Track Classic",
    meetDate: "2026-05-08",
    sourceUrl:
      "https://co.milesplit.com/meets/723871-windjammer-track-classic-2026/entries",
  },
  {
    meetName: "Friday Night Lights",
    meetDate: "2026-05-08",
    sourceUrl:
      "https://co.milesplit.com/meets/714824-friday-night-lights-2026/entries",
  },
  {
    meetName: "Teddy's Last Chance Qualifier",
    meetDate: "2026-05-09",
    sourceUrl:
      "https://co.milesplit.com/meets/703541-teddys-last-chance-qualifier-2026/entries",
  },
];

function cleanCell(value) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function textFromHtml(value) {
  return cleanCell(decodeHtml(value.replace(/<[^>]*>/g, " ")));
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeEvent(raw) {
  const key = raw
    .toLowerCase()
    .replace(/\bfinals?\b/g, "")
    .replace(/\bthrow\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (key.includes("100 meter hurdles")) return "100m Hurdles";
  if (key.includes("110 meter hurdles")) return "110m Hurdles";
  if (key.includes("300 meter hurdles")) return "300m Hurdles";
  if (key.includes("4x100 meter relay")) return "4x100m Relay";
  if (key.includes("4x200 meter relay")) return "4x200m Relay";
  if (key.includes("4x400 meter relay")) return "4x400m Relay";
  if (key.includes("4x800 meter relay")) return "4x800m Relay";
  if (key.includes("100 meter dash")) return "100m";
  if (key.includes("200 meter dash")) return "200m";
  if (key.includes("400 meter dash")) return "400m";
  if (key.includes("800 meter run")) return "800m";
  if (key.includes("1600 meter run")) return "1600m";
  if (key.includes("3200 meter run")) return "3200m";
  if (key.includes("high jump")) return "High Jump";
  if (key.includes("pole vault")) return "Pole Vault";
  if (key.includes("long jump")) return "Long Jump";
  if (key.includes("triple jump")) return "Triple Jump";
  if (key.includes("shot put")) return "Shot Put";
  if (key.includes("discus")) return "Discus";

  return undefined;
}

function parseMarkToSeconds(mark) {
  const clean = mark.trim();
  if (!clean) return undefined;
  const parts = clean.split(":");
  const secondsPart = parts.pop();
  if (!secondsPart || Number.isNaN(Number(secondsPart))) return undefined;
  const seconds = Number(secondsPart);
  const minutes = parts.length ? Number(parts.pop()) : 0;
  if (Number.isNaN(minutes)) return undefined;
  return minutes * 60 + seconds;
}

function parseDistanceMarkToInches(mark) {
  const clean = mark.trim();
  const feetInches =
    clean.match(/^(\d{1,3})\s*[-']\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:"|in)?$/) ??
    clean.match(/^(\d{1,3})\s+(\d{1,2}(?:\.\d{1,2})?)$/);
  if (feetInches) return Number(feetInches[1]) * 12 + Number(feetInches[2]);
  return undefined;
}

function parsePerformanceMark(event, raw) {
  const definition = definitionsByEvent.get(event);
  if (!definition) return undefined;
  return definition.markType === "distance"
    ? parseDistanceMarkToInches(raw)
    : parseMarkToSeconds(raw);
}

function normalizeAthleteName(raw, relay, school) {
  if (relay) return school;
  const clean = cleanCell(raw);
  const [last, first] = clean.split(",").map((part) => cleanCell(part));
  return first && last ? `${first} ${last}` : clean;
}

function parseGenderAndEvent(rawEvent) {
  const label = cleanCell(rawEvent.replace(/^HS\s+/i, ""));
  const genderMatch = label.match(/\b(Boys|Girls)\b/i);
  if (!genderMatch) return undefined;
  const gender = genderMatch[1].toLowerCase() === "boys" ? "Boys" : "Girls";
  const event = normalizeEvent(label.replace(/\b(Boys|Girls)\b/i, ""));
  const definition = event ? definitionsByEvent.get(event) : undefined;
  if (!definition || !definition.genders.includes(gender)) return undefined;
  return { gender, event };
}

function serialize(value) {
  return JSON.stringify(value, null, 2).replace(/"([^"]+)":/g, "$1:");
}

async function fetchHtml(url) {
  return execFileSync(
    "curl",
    [
      "-L",
      "-s",
      "--max-time",
      "30",
      "-A",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      url,
    ],
    { encoding: "utf8", maxBuffer: 24 * 1024 * 1024 },
  );
}

function parseMeetEntries(config, html) {
  const entries = [];
  const seen = new Set();
  const tablePattern =
    /<table[^>]+data-event="([^"]+)"[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>[\s\S]*?<\/table>/g;

  for (const tableMatch of html.matchAll(tablePattern)) {
    const parsed = parseGenderAndEvent(decodeHtml(tableMatch[1] ?? ""));
    if (!parsed) continue;
    const relay = definitionsByEvent.get(parsed.event)?.relay;
    const tableBody = tableMatch[2] ?? "";
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/g;

    for (const rowMatch of tableBody.matchAll(rowPattern)) {
      const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/g;
      const cells = [...(rowMatch[1] ?? "").matchAll(cellPattern)].map((cell) =>
        textFromHtml(cell[1] ?? ""),
      );
      const rawAthlete = cells[0] ?? "";
      const seedMarkRaw = cells[1] ?? "";
      const school = cells[2] ?? "";
      if (!rawAthlete || !school) continue;

      const athleteOrRelay = normalizeAthleteName(rawAthlete, relay, school);
      const key = [
        config.meetName,
        parsed.gender,
        parsed.event,
        athleteOrRelay,
        school,
      ]
        .map(slugify)
        .join("|");
      if (seen.has(key)) continue;
      seen.add(key);

      const seedMarkValue = seedMarkRaw
        ? parsePerformanceMark(parsed.event, seedMarkRaw)
        : undefined;
      entries.push({
        meetName: config.meetName,
        meetDate: config.meetDate,
        sourceUrl: config.sourceUrl,
        gender: parsed.gender,
        event: parsed.event,
        athleteOrRelay,
        school,
        ...(seedMarkRaw ? { seedMarkRaw } : {}),
        ...(seedMarkValue !== undefined ? { seedMarkValue } : {}),
      });
    }
  }

  return entries;
}

const allEntries = [];
const errors = [];

for (const meet of meets) {
  try {
    const html = await fetchHtml(meet.sourceUrl);
    const entries = parseMeetEntries(meet, html);
    allEntries.push(...entries);
    console.log(`${meet.meetName}: ${entries.length} entries`);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
}

allEntries.sort(
  (a, b) =>
    a.meetDate.localeCompare(b.meetDate) ||
    a.meetName.localeCompare(b.meetName) ||
    a.gender.localeCompare(b.gender) ||
    a.event.localeCompare(b.event) ||
    a.school.localeCompare(b.school) ||
    a.athleteOrRelay.localeCompare(b.athleteOrRelay),
);

const meetSummary = meets.map((meet) => ({
  ...meet,
  entryCount: allEntries.filter((entry) => entry.meetName === meet.meetName)
    .length,
}));
const eventSummary = eventDefinitions.flatMap((definition) =>
  definition.genders.map((gender) => ({
    gender,
    event: definition.event,
    entryCount: allEntries.filter(
      (entry) => entry.gender === gender && entry.event === definition.event,
    ).length,
  })),
);

const output = `// Generated by scripts/import-weekend-milesplit-entries.mjs
// Source: public MileSplit entries pages for Windjammer, Friday Night Lights, and Teddy's.

import type { EventKey, Gender } from "@/types/domain";

export interface WeekendMeetEntry {
  meetName: string;
  meetDate: string;
  sourceUrl: string;
  gender: Gender;
  event: EventKey;
  athleteOrRelay: string;
  school: string;
  seedMarkRaw?: string;
  seedMarkValue?: number;
}

export const weekendMeetEntryMetadata = ${serialize({
  generatedAt: new Date().toISOString(),
  source: "public_milesplit_entries",
  errors,
  meetSummary,
  eventSummary,
  rowCount: allEntries.length,
})} as const;

export const weekendMeetEntries: WeekendMeetEntry[] = ${serialize(allEntries)};
`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, output);
console.log(`Wrote ${allEntries.length} weekend entries to ${outputPath}.`);
