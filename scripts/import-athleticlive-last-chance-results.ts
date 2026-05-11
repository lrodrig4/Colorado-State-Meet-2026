import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type Gender = "Boys" | "Girls";
type EventKey =
  | "100m"
  | "200m"
  | "400m"
  | "800m"
  | "1600m"
  | "3200m"
  | "100m Hurdles"
  | "110m Hurdles"
  | "300m Hurdles"
  | "4x100m Relay"
  | "4x200m Relay"
  | "4x400m Relay"
  | "4x800m Relay"
  | "High Jump"
  | "Pole Vault"
  | "Long Jump"
  | "Triple Jump"
  | "Shot Put"
  | "Discus";
type VerificationStatus =
  | "verified"
  | "needs_review"
  | "rejected"
  | "manual_approved"
  | "depth_only";
type Performance = {
  id: string;
  athleteName: string;
  gender: Gender;
  grade?: number;
  school: string;
  event: EventKey;
  markRaw: string;
  markValue: number;
  timingType: "FAT" | "Field";
  isFAT: boolean;
  meetName: string;
  meetDate: string;
  source: "official_timing";
  sourceUrl: string;
  verificationStatus: VerificationStatus;
  classificationVerified: boolean;
  notes: string;
};

const bothGenders = ["Boys", "Girls"] as const;
const eventDefinitions = new Map<
  EventKey,
  { genders: readonly Gender[]; markType: "time" | "distance" }
>([
  ["100m", { genders: bothGenders, markType: "time" }],
  ["200m", { genders: bothGenders, markType: "time" }],
  ["400m", { genders: bothGenders, markType: "time" }],
  ["800m", { genders: bothGenders, markType: "time" }],
  ["1600m", { genders: bothGenders, markType: "time" }],
  ["3200m", { genders: bothGenders, markType: "time" }],
  ["100m Hurdles", { genders: ["Girls"], markType: "time" }],
  ["110m Hurdles", { genders: ["Boys"], markType: "time" }],
  ["300m Hurdles", { genders: bothGenders, markType: "time" }],
  ["4x100m Relay", { genders: bothGenders, markType: "time" }],
  ["4x200m Relay", { genders: bothGenders, markType: "time" }],
  ["4x400m Relay", { genders: bothGenders, markType: "time" }],
  ["4x800m Relay", { genders: bothGenders, markType: "time" }],
  ["High Jump", { genders: bothGenders, markType: "distance" }],
  ["Pole Vault", { genders: bothGenders, markType: "distance" }],
  ["Long Jump", { genders: bothGenders, markType: "distance" }],
  ["Triple Jump", { genders: bothGenders, markType: "distance" }],
  ["Shot Put", { genders: bothGenders, markType: "distance" }],
  ["Discus", { genders: bothGenders, markType: "distance" }],
]);

const eventAliases: Record<string, EventKey | undefined> = {
  "100": "100m",
  "100m": "100m",
  "100m dash": "100m",
  "200": "200m",
  "200m": "200m",
  "200m dash": "200m",
  "400": "400m",
  "400m": "400m",
  "400m dash": "400m",
  "800": "800m",
  "800m": "800m",
  "800m run": "800m",
  "1600": "1600m",
  "1600m": "1600m",
  "1600m run": "1600m",
  "3200": "3200m",
  "3200m": "3200m",
  "3200m run": "3200m",
  "100m hurdles": "100m Hurdles",
  "110m hurdles": "110m Hurdles",
  "300m hurdles": "300m Hurdles",
  "high jump": "High Jump",
  "pole vault": "Pole Vault",
  "long jump": "Long Jump",
  "triple jump": "Triple Jump",
  "shot put": "Shot Put",
  discus: "Discus",
  "discus throw": "Discus",
};

function getEventDefinition(event: EventKey) {
  const definition = eventDefinitions.get(event);
  if (!definition) throw new Error(`Missing event definition for ${event}`);
  return definition;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeEvent(raw: string): EventKey | undefined {
  const key = raw
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const direct = eventAliases[key];
  if (direct) return direct;

  const normalizedRelay = key.replace(/\s*x\s*/g, "x").replace(/\s+/g, " ");
  const relay = normalizedRelay.match(/\b4x(100|200|400|800)\s*m?\s*relay\b/);
  if (relay) return `4x${relay[1]}m Relay` as EventKey;

  if (/\b100\s*m?\b/.test(key) && /\bhurdles?\b/.test(key)) {
    return "100m Hurdles";
  }
  if (/\b110\s*m?\b/.test(key) && /\bhurdles?\b/.test(key)) {
    return "110m Hurdles";
  }
  if (/\b300\s*m?\b/.test(key) && /\bhurdles?\b/.test(key)) {
    return "300m Hurdles";
  }

  for (const event of ["100", "200", "400", "800", "1600", "3200"]) {
    if (new RegExp(`\\b${event}\\s*m?\\b`).test(key)) {
      return `${event}m` as EventKey;
    }
  }

  for (const fieldEvent of [
    "high jump",
    "pole vault",
    "long jump",
    "triple jump",
    "shot put",
    "discus",
  ]) {
    if (key.includes(fieldEvent)) {
      return eventAliases[fieldEvent];
    }
  }

  return undefined;
}

function parseMarkToSeconds(mark: string): number | undefined {
  const clean = mark
    .trim()
    .replace(/[†*#]/g, "")
    .replace(/\s+(FAT|AUTO|HAND|HT)$/i, "");
  if (!clean) return undefined;

  const parts = clean.split(":");
  const secondsPart = parts.pop();
  if (!secondsPart || Number.isNaN(Number(secondsPart))) return undefined;

  const seconds = Number(secondsPart);
  const minutes = parts.length ? Number(parts.pop()) : 0;
  const hours = parts.length ? Number(parts.pop()) : 0;
  return [seconds, minutes, hours].some((part) => Number.isNaN(part))
    ? undefined
    : hours * 3600 + minutes * 60 + seconds;
}

function parseDistanceMarkToInches(mark: string): number | undefined {
  const clean = mark
    .trim()
    .replace(/[†*#]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'");
  const feetInches =
    clean.match(/^(\d{1,3})\s*[-']\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:"|in)?$/) ??
    clean.match(/^(\d{1,3})\s+(\d{1,2}(?:\.\d{1,2})?)$/);

  if (feetInches) {
    return Number(feetInches[1]) * 12 + Number(feetInches[2]);
  }

  const inchesOnly = clean.match(/^(\d{1,3}(?:\.\d{1,2})?)\s*(?:in|")$/i);
  return inchesOnly ? Number(inchesOnly[1]) : undefined;
}

function parsePerformanceMark(event: EventKey, mark: string): number | undefined {
  return getEventDefinition(event).markType === "distance"
    ? parseDistanceMarkToInches(mark)
    : parseMarkToSeconds(mark);
}

type MeetConfig = {
  meetId: number;
  name: string;
  fallbackDate: string;
  sourceRoot: string;
  timingLabel: string;
  shortUrl?: string;
  athleticNetUrl?: string;
};

type EventSummary = {
  ab?: string;
  ec?: "Individual" | "Relay";
  es?: string;
  gl?: Gender | string;
  i?: number;
  n?: string;
  resd?: string;
  runm?: string;
  sd?: string;
  se?: string;
  ua?: string;
};

type ResultDocument = {
  _source?: {
    gl?: Gender | string;
    n?: string;
    r?: IndividualResultRow[];
    rts?: RelayResultRow[];
  };
};

type TeamRef = {
  f?: string;
  n?: string;
};

type AthleteRef = {
  n?: string;
  y?: string | number;
  t?: TeamRef;
};

type BaseResultRow = {
  hn?: string | number;
  m?: string;
  p?: string;
  s?: string;
  w?: string | number;
};

type IndividualResultRow = BaseResultRow & {
  a?: AthleteRef;
};

type RelayResultRow = BaseResultRow & {
  rd?: string;
  t?: TeamRef;
};

type AthleticLivePerformanceReport = {
  meetName: string;
  event: EventKey;
  gender: Gender;
  rows: number;
  verifiedRows: number;
  reviewRows: number;
  skippedRows: number;
};

const LAST_CHANCE_MEETS: MeetConfig[] = [
  {
    meetId: 71888,
    name: "East Angels Fulton Memorial Invitational",
    fallbackDate: "2026-05-07",
    sourceRoot: "https://cetiming.anet.live",
    timingLabel: "Colorado Elite Timing",
    shortUrl: "http://ce.anet.live/mewq6w",
    athleticNetUrl: "https://www.athletic.net/TrackAndField/meet/664069",
  },
  {
    meetId: 71453,
    name: "Windjammer Track Classic",
    fallbackDate: "2026-05-08",
    sourceRoot: "https://cetiming.anet.live",
    timingLabel: "Colorado Elite Timing",
    shortUrl: "http://ce.anet.live/gkrm46",
    athleticNetUrl: "https://www.athletic.net/TrackAndField/meet/663393",
  },
  {
    meetId: 71967,
    name: "Centennial League Championships",
    fallbackDate: "2026-05-09",
    sourceRoot: "https://cetiming.anet.live",
    timingLabel: "Colorado Elite Timing",
    shortUrl: "http://ce.anet.live/d6z4ex",
    athleticNetUrl: "https://www.athletic.net/TrackAndField/meet/665173",
  },
  {
    meetId: 71954,
    name: "HOKA St. Vrain Invitational",
    fallbackDate: "2026-05-08",
    sourceRoot: "https://live.rapidresultstiming.com",
    timingLabel: "Rapid Results Timing",
    shortUrl: "http://rapidresults.anet.live/8s07lx",
    athleticNetUrl: "https://www.athletic.net/TrackAndField/meet/665167",
  },
  {
    meetId: 71956,
    name: "Teddy's Last Chance Qualifier",
    fallbackDate: "2026-05-09",
    sourceRoot: "https://live.rapidresultstiming.com",
    timingLabel: "Rapid Results Timing",
    athleticNetUrl: "https://www.athletic.net/TrackAndField/meet/665169",
  },
];

const GENERATED_OUTPUT_PATH =
  "src/lib/data/currentAthleticLiveLastChanceResults.generated.ts";
const REPORT_OUTPUT_PATH = "reports/athleticlive-last-chance-report.json";
const FIREBASE_ENDPOINT = "https://trackmeet-io.firebaseio.com";
const BLOB_ENDPOINT = "https://athleticlive.blob.core.windows.net/$web";
const FETCH_TIMEOUT_MS = 20_000;

const eventByAthleticLiveAbbreviation: Record<string, EventKey | undefined> = {
  "100m": "100m",
  "200m": "200m",
  "400m": "400m",
  "800m": "800m",
  "1600m": "1600m",
  "3200m": "3200m",
  "100mH": "100m Hurdles",
  "110mH": "110m Hurdles",
  "300mH": "300m Hurdles",
  "4x100mR": "4x100m Relay",
  "4x200mR": "4x200m Relay",
  "4x400mR": "4x400m Relay",
  "4x800mR": "4x800m Relay",
  HJ: "High Jump",
  PV: "Pole Vault",
  LJ: "Long Jump",
  TJ: "Triple Jump",
  SP: "Shot Put",
  DT: "Discus",
};

const windSensitiveEvents = new Set<EventKey>([
  "100m",
  "200m",
  "100m Hurdles",
  "110m Hurdles",
  "Long Jump",
  "Triple Jump",
]);

function serialize(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/"([^"]+)":/g, "$1:");
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} (${url})`);
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

function eventIdFromKey(key: string, summary: EventSummary): number | undefined {
  const fromSummary = Number(summary.i);
  if (Number.isFinite(fromSummary) && fromSummary > 0) return fromSummary;

  const match = key.match(/-(\d+)$/);
  const fromKey = match ? Number(match[1]) : undefined;
  return fromKey && Number.isFinite(fromKey) ? fromKey : undefined;
}

function eventKindFromKey(key: string, summary: EventSummary): "individual" | "relay" | undefined {
  if (summary.ec === "Individual") return "individual";
  if (summary.ec === "Relay") return "relay";
  if (key.startsWith("Individual-")) return "individual";
  if (key.startsWith("Relay-")) return "relay";
  return undefined;
}

function genderFromSummary(summary: EventSummary): Gender | undefined {
  return summary.gl === "Boys" || summary.gl === "Girls" ? summary.gl : undefined;
}

function eventFromSummary(summary: EventSummary): EventKey | undefined {
  const fromAbbreviation = summary.ab
    ? eventByAthleticLiveAbbreviation[summary.ab]
    : undefined;
  return fromAbbreviation ?? (summary.n ? normalizeEvent(summary.n) : undefined);
}

function denverDateFromIso(value: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : value.slice(0, 10);
}

function eventDate(meet: MeetConfig, summary: EventSummary): string {
  const sourceDate = summary.sd ?? summary.resd ?? summary.ua;
  return sourceDate ? denverDateFromIso(sourceDate) : meet.fallbackDate;
}

function sourceUrl(
  meet: MeetConfig,
  kind: "individual" | "relay",
  eventId: number,
): string {
  return `${meet.sourceRoot}/meets/${meet.meetId}/events/${kind}/${eventId}`;
}

function resultDocumentUrl(kind: "individual" | "relay", eventId: number): string {
  return `${BLOB_ENDPOINT}/${kind === "individual" ? "ind_res_list" : "rel_res_list"}/_doc/${eventId}`;
}

function normalizeMark(raw: string): string {
  return raw.trim().replace(/[†*#]/g, "").replace(/\s+/g, " ");
}

function numericWind(value: string | number | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const wind = Number(value);
  return Number.isFinite(wind) ? wind : undefined;
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

function resultNote(input: {
  meet: MeetConfig;
  summary: EventSummary;
  row: BaseResultRow;
  wind: number | undefined;
  windNote?: string;
}) {
  const notes = [
    `Official AthleticLIVE/${input.meet.timingLabel} result.`,
    input.row.p ? `Overall place ${input.row.p}.` : undefined,
    input.row.hn ? `Heat/flight ${input.row.hn}.` : undefined,
    input.summary.runm ? `Round ${input.summary.runm}.` : undefined,
    input.summary.se ? `Session ${input.summary.se}.` : undefined,
    input.wind !== undefined ? `Wind ${input.wind}.` : undefined,
    input.windNote,
  ];

  return notes.filter(Boolean).join(" ");
}

function commonPerformance(input: {
  athleteName: string;
  event: EventKey;
  eventId: number;
  gender: Gender;
  grade?: number;
  kind: "individual" | "relay";
  meet: MeetConfig;
  row: BaseResultRow;
  school: string;
  summary: EventSummary;
}): Performance | undefined {
  const markRaw = normalizeMark(input.row.m ?? "");
  if (!markRaw) return undefined;

  const markValue = parsePerformanceMark(input.event, markRaw);
  if (markValue === undefined) return undefined;

  const wind = numericWind(input.row.w);
  const windAudit = windStatus(input.event, wind);
  const definition = getEventDefinition(input.event);

  return {
    id: slugify(
      [
        "athleticlive",
        input.meet.meetId,
        input.eventId,
        input.gender,
        input.event,
        input.athleteName,
        input.school,
        markRaw,
      ].join("-"),
    ),
    athleteName: input.athleteName,
    gender: input.gender,
    grade: input.grade,
    school: input.school,
    event: input.event,
    markRaw,
    markValue,
    timingType: definition.markType === "distance" ? "Field" : "FAT",
    isFAT: definition.markType === "time",
    meetName: input.meet.name,
    meetDate: eventDate(input.meet, input.summary),
    source: "official_timing",
    sourceUrl: sourceUrl(input.meet, input.kind, input.eventId),
    verificationStatus: windAudit.status,
    classificationVerified: true,
    notes: resultNote({
      meet: input.meet,
      summary: input.summary,
      row: input.row,
      wind,
      windNote: windAudit.note,
    }),
  };
}

function toIndividualPerformance(input: {
  event: EventKey;
  eventId: number;
  gender: Gender;
  meet: MeetConfig;
  row: IndividualResultRow;
  summary: EventSummary;
}): Performance | undefined {
  const athleteName = input.row.a?.n?.trim();
  const school = (input.row.a?.t?.n ?? input.row.a?.t?.f)?.trim();
  if (!athleteName || !school) return undefined;

  const gradeRaw = input.row.a?.y;
  const grade = gradeRaw === undefined || gradeRaw === "" ? undefined : Number(gradeRaw);

  return commonPerformance({
    athleteName,
    event: input.event,
    eventId: input.eventId,
    gender: input.gender,
    grade: Number.isFinite(grade) ? grade : undefined,
    kind: "individual",
    meet: input.meet,
    row: input.row,
    school,
    summary: input.summary,
  });
}

function toRelayPerformance(input: {
  event: EventKey;
  eventId: number;
  gender: Gender;
  meet: MeetConfig;
  row: RelayResultRow;
  summary: EventSummary;
}): Performance | undefined {
  const school = (input.row.t?.n ?? input.row.t?.f)?.trim();
  if (!school) return undefined;

  const relaySuffix = input.row.rd ? ` ${input.row.rd}` : "";

  return commonPerformance({
    athleteName: `${school} Relay${relaySuffix}`,
    event: input.event,
    eventId: input.eventId,
    gender: input.gender,
    kind: "relay",
    meet: input.meet,
    row: input.row,
    school,
    summary: input.summary,
  });
}

async function importMeet(meet: MeetConfig) {
  console.log(`Reading ${meet.name} (${meet.meetId})`);
  const eventSummaryUrl = `${FIREBASE_ENDPOINT}/meet_${meet.meetId}/event_summary.json`;
  const eventSummaries =
    await fetchJson<Record<string, EventSummary | undefined>>(eventSummaryUrl);
  const performances: Performance[] = [];
  const reports: AthleticLivePerformanceReport[] = [];
  const errors: string[] = [];

  for (const [eventKey, summary] of Object.entries(eventSummaries ?? {})) {
    if (!summary || summary.es !== "r") continue;

    const eventId = eventIdFromKey(eventKey, summary);
    const kind = eventKindFromKey(eventKey, summary);
    const gender = genderFromSummary(summary);
    const event = eventFromSummary(summary);

    if (!eventId || !kind || !gender || !event) continue;
    if (!getEventDefinition(event).genders.includes(gender)) continue;

    try {
      const document = await fetchJson<ResultDocument>(
        resultDocumentUrl(kind, eventId),
      );
      const source = document._source;
      const rows =
        kind === "individual"
          ? source?.r ?? []
          : source?.rts ?? [];
      const before = performances.length;
      let skippedRows = 0;

      for (const row of rows) {
        const performance =
          kind === "individual"
            ? toIndividualPerformance({
                event,
                eventId,
                gender,
                meet,
                row: row as IndividualResultRow,
                summary,
              })
            : toRelayPerformance({
                event,
                eventId,
                gender,
                meet,
                row: row as RelayResultRow,
                summary,
              });

        if (performance) {
          performances.push(performance);
        } else {
          skippedRows += 1;
        }
      }

      const eventRows = performances.slice(before);
      reports.push({
        meetName: meet.name,
        event,
        gender,
        rows: eventRows.length,
        verifiedRows: eventRows.filter(
          (performance) => performance.verificationStatus === "verified",
        ).length,
        reviewRows: eventRows.filter(
          (performance) => performance.verificationStatus !== "verified",
        ).length,
        skippedRows,
      });
    } catch (error) {
      errors.push(
        `${meet.name} ${gender} ${event}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  console.log(
    `Parsed ${performances.length} rows from ${meet.name}; ${errors.length} source errors`,
  );

  return { meet, performances, reports, errors };
}

async function main() {
  console.log("Importing AthleticLIVE last-chance result feeds");
  const imports = await Promise.all(LAST_CHANCE_MEETS.map(importMeet));
  const performances = imports.flatMap((entry) => entry.performances);
  const errors = imports.flatMap((entry) => entry.errors);
  const reports = imports.flatMap((entry) => entry.reports);
  const generatedAt = new Date().toISOString();
  const metadata = {
    generatedAt,
    source: "athleticlive_public_last_chance_result_feeds",
    meetCount: LAST_CHANCE_MEETS.length,
    performanceRows: performances.length,
    verifiedRows: performances.filter(
      (performance) => performance.verificationStatus === "verified",
    ).length,
    reviewRows: performances.filter(
      (performance) => performance.verificationStatus !== "verified",
    ).length,
    sourceErrors: errors,
    meets: LAST_CHANCE_MEETS.map((meet) => ({
      meetId: meet.meetId,
      name: meet.name,
      fallbackDate: meet.fallbackDate,
      sourceRoot: meet.sourceRoot,
      timingLabel: meet.timingLabel,
      shortUrl: meet.shortUrl,
      athleticNetUrl: meet.athleticNetUrl,
    })),
  };
  const generated = `/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Generated from public AthleticLIVE last-chance result feeds.
// No credentials, cookies, passwords, or private session data are used.
import type { Performance } from "@/types/domain";

export const currentAthleticLiveLastChanceMetadata = ${serialize(metadata)};

export const currentAthleticLiveLastChancePerformances: Performance[] = ${serialize(performances)};
`;

  await mkdir(path.dirname(GENERATED_OUTPUT_PATH), { recursive: true });
  await writeFile(GENERATED_OUTPUT_PATH, generated);
  await mkdir(path.dirname(REPORT_OUTPUT_PATH), { recursive: true });
  await writeFile(
    REPORT_OUTPUT_PATH,
    JSON.stringify(
      {
        generatedAt,
        metadata,
        coverage: reports,
        errors,
      },
      null,
      2,
    ),
  );

  console.log(
    `Imported ${performances.length} AthleticLIVE last-chance rows into ${GENERATED_OUTPUT_PATH}`,
  );
  console.log(`Wrote ${REPORT_OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
