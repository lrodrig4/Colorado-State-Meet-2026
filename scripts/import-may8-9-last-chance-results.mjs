import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SEASON_YEAR = 2026;
const CURRENT_MILESPLIT_PATH =
  "src/lib/data/currentPerformances.generated.ts";
const ATHLETICLIVE_OUTPUT_PATH =
  "src/lib/data/currentAthleticLiveLastChanceResults.generated.ts";
const REPORT_OUTPUT_PATH = "reports/may8-9-last-chance-import-report.json";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const FETCH_TIMEOUT_MS = 20_000;

const eventDefinitions = {
  "100m": { markType: "time", relay: false, genders: ["Boys", "Girls"] },
  "200m": { markType: "time", relay: false, genders: ["Boys", "Girls"] },
  "400m": { markType: "time", relay: false, genders: ["Boys", "Girls"] },
  "800m": { markType: "time", relay: false, genders: ["Boys", "Girls"] },
  "1600m": { markType: "time", relay: false, genders: ["Boys", "Girls"] },
  "3200m": { markType: "time", relay: false, genders: ["Boys", "Girls"] },
  "100m Hurdles": { markType: "time", relay: false, genders: ["Girls"] },
  "110m Hurdles": { markType: "time", relay: false, genders: ["Boys"] },
  "300m Hurdles": { markType: "time", relay: false, genders: ["Boys", "Girls"] },
  "4x100m Relay": { markType: "time", relay: true, genders: ["Boys", "Girls"] },
  "4x200m Relay": { markType: "time", relay: true, genders: ["Boys", "Girls"] },
  "4x400m Relay": { markType: "time", relay: true, genders: ["Boys", "Girls"] },
  "4x800m Relay": { markType: "time", relay: true, genders: ["Boys", "Girls"] },
  "High Jump": { markType: "distance", relay: false, genders: ["Boys", "Girls"] },
  "Pole Vault": { markType: "distance", relay: false, genders: ["Boys", "Girls"] },
  "Long Jump": { markType: "distance", relay: false, genders: ["Boys", "Girls"] },
  "Triple Jump": { markType: "distance", relay: false, genders: ["Boys", "Girls"] },
  "Shot Put": { markType: "distance", relay: false, genders: ["Boys", "Girls"] },
  Discus: { markType: "distance", relay: false, genders: ["Boys", "Girls"] },
};

const eventByAthleticLiveAbbreviation = {
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

const windSensitiveEvents = new Set([
  "100m",
  "200m",
  "100m Hurdles",
  "110m Hurdles",
  "Long Jump",
  "Triple Jump",
]);

const milesplitPerformanceFields = [
  "id",
  "meetId",
  "meetName",
  "teamName",
  "firstName",
  "lastName",
  "gender",
  "genderName",
  "gradYear",
  "eventName",
  "roundName",
  "heat",
  "mark",
  "place",
  "windReading",
  "statusCode",
  "ageGroupName",
  "divisionName",
].join(",");

const milesplitMeets = [
  {
    meetName: "Centennial League Championships",
    meetDate: "2026-05-09",
    meetId: "755966",
    slug: "centennial-league-championships-2026",
    resultIds: ["1300293"],
  },
  {
    meetName: "Monte Vista Last Chance Invitational",
    meetDate: "2026-05-08",
    meetId: "741569",
    slug: "2026-monte-vista-last-chance-invitational-2026",
    resultIds: ["1299245"],
  },
  {
    meetName: "Friday Night Lights",
    meetDate: "2026-05-08",
    meetId: "714824",
    slug: "friday-night-lights-2026",
    resultIds: ["1299542"],
  },
  {
    meetName: "HOKA St. Vrain Invitational",
    meetDate: "2026-05-08",
    meetId: "720470",
    slug: "hoka-st-vrain-invitational-2026",
    resultIds: ["1299631"],
  },
  {
    meetName: "Joe Shields Invitational",
    meetDate: "2026-05-08",
    meetId: "727135",
    slug: "joe-shields-invitational-2026",
    resultIds: ["1299261"],
  },
  {
    meetName: "Low Elevation Last Chance",
    meetDate: "2026-05-08",
    meetId: "727192",
    slug: "low-elevation-last-chance-2026",
    resultIds: ["1299263"],
  },
  {
    meetName: "Union Pacific League Meet",
    meetDate: "2026-05-08",
    meetId: "722974",
    slug: "union-pacific-league-meet-2026",
    resultIds: ["1299275", "1299276", "1299277"],
  },
  {
    meetName: "Windjammer Track Classic",
    meetDate: "2026-05-09",
    meetId: "723871",
    slug: "windjammer-track-classic-2026",
    resultIds: ["1300283"],
  },
  {
    meetName: "Cardinal Invitational",
    meetDate: "2026-05-09",
    meetId: "688840",
    slug: "cardinal-invitational-2026",
    resultIds: ["1300251"],
  },
  {
    meetName: "CCAL Championship",
    meetDate: "2026-05-09",
    meetId: "725684",
    slug: "ccal-championship-2026",
    resultIds: ["1300241"],
  },
  {
    meetName: "Husky Mountain Classic",
    meetDate: "2026-05-09",
    meetId: "725755",
    slug: "husky-mountain-classic-2026",
    resultIds: ["1300159", "1300163"],
  },
  {
    meetName: "Maxine Ehrmann Thornton Invite",
    meetDate: "2026-05-09",
    meetId: "718187",
    slug: "maxine-ehrmann-thornton-invite-2026",
    resultIds: ["1300079"],
  },
  {
    meetName: "Montrose Invitational",
    meetDate: "2026-05-09",
    meetId: "717803",
    slug: "montrose-invitational-2026",
    resultIds: ["1300078"],
  },
  {
    meetName: "NCIL Championship",
    meetDate: "2026-05-09",
    meetId: "735515",
    slug: "ncil-championship-2026",
    resultIds: [],
  },
  {
    meetName: "Teddy's Last Chance Qualifier",
    meetDate: "2026-05-09",
    meetId: "703541",
    slug: "teddys-last-chance-qualifier-2026",
    resultIds: ["1300306"],
  },
  {
    meetName: "Trojan Horse Invitational (Sneak into the State Meet)",
    meetDate: "2026-05-09",
    meetId: "718838",
    slug: "trojan-horse-invitational-sneak-into-the-state-meet-2026",
    resultIds: ["1300098"],
  },
];

const athleticLiveMeets = [
  {
    meetId: 71453,
    name: "Windjammer Track Classic",
    fallbackDate: "2026-05-09",
    sourceRoot: "https://cetiming.anet.live",
    timingLabel: "Colorado Elite Timing",
    athleticNetUrl: "https://www.athletic.net/TrackAndField/meet/663393",
  },
  {
    meetId: 71967,
    name: "Centennial League Championships",
    fallbackDate: "2026-05-09",
    sourceRoot: "https://cetiming.anet.live",
    timingLabel: "Colorado Elite Timing",
    athleticNetUrl: "https://www.athletic.net/TrackAndField/meet/665173",
  },
  {
    meetId: 71954,
    name: "HOKA St. Vrain Invitational",
    fallbackDate: "2026-05-08",
    sourceRoot: "https://live.rapidresultstiming.com",
    timingLabel: "Rapid Results Timing",
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

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  add(headers) {
    let setCookies = [];
    if (typeof headers.getSetCookie === "function") {
      setCookies = headers.getSetCookie();
    }
    const fallback = headers.get("set-cookie");
    if (!setCookies.length && fallback) {
      setCookies = [fallback];
    }

    for (const setCookie of setCookies) {
      const first = setCookie.split(";")[0];
      const index = first.indexOf("=");
      if (index > 0) {
        this.cookies.set(first.slice(0, index), first.slice(index + 1));
      }
    }
  }

  header() {
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
}

const mileSplitCookieJar = new CookieJar();

function serialize(value) {
  return JSON.stringify(value, null, 2).replace(/"([^"]+)":/g, "$1:");
}

function cleanCell(value) {
  return `${value ?? ""}`.replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return cleanCell(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function slugify(value) {
  return normalizeKey(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function fetchText(url, options = {}, jar) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "user-agent": USER_AGENT,
        cookie: jar?.header() ?? "",
        ...(options.headers ?? {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (jar) {
    jar.add(response.headers);
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} (${url})`);
  }

  return response.text();
}

async function fetchJson(url, options = {}, jar) {
  return JSON.parse(await fetchText(url, options, jar));
}

function formattedUrlFor(meet, resultId) {
  return `https://co.milesplit.com/meets/${meet.meetId}-${meet.slug}/results/${resultId}/formatted`;
}

function rawUrlFor(meet, resultId) {
  return `https://co.milesplit.com/meets/${meet.meetId}-${meet.slug}/results/${resultId}/raw`;
}

function resultIndexUrlFor(meet) {
  return `https://co.milesplit.com/meets/${meet.meetId}-${meet.slug}/results`;
}

function parseExportLiteral(file, marker, nextMarker) {
  const start = file.indexOf(marker);
  if (start < 0) {
    throw new Error(`Could not find ${marker}`);
  }
  const end = nextMarker ? file.indexOf(nextMarker, start + marker.length) : file.length;
  if (end < 0) {
    throw new Error(`Could not find ${nextMarker}`);
  }
  const literal = file
    .slice(start + marker.length, end)
    .replace(/;\s*$/, "")
    .trim();

  return Function(`"use strict"; return (${literal});`)();
}

function normalizeEvent(raw) {
  const key = cleanCell(raw)
    .replace(/\bmeter(s)?\b/gi, "m")
    .replace(/\b(Boys|Girls|High School|HS|Varsity|Finals?|Prelims?|Semi-Finals?|Semifinals?|Timed Finals?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const relay = key.match(/\b4\s*x\s*(100|200|400|800)\s*m?\s*(relay)?\b/);
  if (relay) return `4x${relay[1]}m Relay`;
  if (/\b100\s*m?\b/.test(key) && /hurdles?/.test(key)) return "100m Hurdles";
  if (/\b110\s*m?\b/.test(key) && /hurdles?/.test(key)) return "110m Hurdles";
  if (/\b300\s*m?\b/.test(key) && /hurdles?/.test(key)) return "300m Hurdles";

  for (const distance of ["100", "200", "400", "800", "1600", "3200"]) {
    if (new RegExp(`\\b${distance}\\s*m?\\b`).test(key)) {
      return `${distance}m`;
    }
  }

  if (key.includes("high jump")) return "High Jump";
  if (key.includes("pole vault")) return "Pole Vault";
  if (key.includes("long jump")) return "Long Jump";
  if (key.includes("triple jump")) return "Triple Jump";
  if (key.includes("shot put")) return "Shot Put";
  if (key.includes("discus")) return "Discus";
  return undefined;
}

function parseGender(row) {
  const raw = cleanCell(row.genderName ?? row.gender ?? "");
  if (/^(boys|m|male)$/i.test(raw)) return "Boys";
  if (/^(girls|f|female)$/i.test(raw)) return "Girls";
  return undefined;
}

function gradeFromGradYear(rawYear) {
  const year = Number(rawYear);
  if (!Number.isFinite(year) || year < SEASON_YEAR) return undefined;
  const grade = 12 - (year - SEASON_YEAR);
  return grade >= 9 && grade <= 12 ? grade : undefined;
}

function parseTimeToSeconds(mark) {
  const clean = cleanCell(mark).replace(/[†*#]/g, "");
  if (!clean) return undefined;
  const parts = clean.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return undefined;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return undefined;
}

function parseDistanceToInches(mark) {
  const clean = cleanCell(mark)
    .replace(/[†*#]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'");
  const feetInches =
    clean.match(/^(\d{1,3})\s*[-']\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:"|in)?$/) ??
    clean.match(/^(\d{1,3})\s+(\d{1,2}(?:\.\d{1,2})?)$/);
  if (feetInches) return Number(feetInches[1]) * 12 + Number(feetInches[2]);
  return undefined;
}

function parsePerformanceMark(event, mark) {
  const definition = eventDefinitions[event];
  return definition?.markType === "distance"
    ? parseDistanceToInches(mark)
    : parseTimeToSeconds(mark);
}

function numericWind(value) {
  const raw = cleanCell(value).replace(/^\+/, "");
  if (!raw || /^nwi$/i.test(raw)) return undefined;
  const wind = Number(raw);
  return Number.isFinite(wind) ? wind : undefined;
}

function verificationForWind(event, wind) {
  if (!windSensitiveEvents.has(event)) return "verified";
  if (wind === undefined || wind > 2) return "needs_review";
  return "verified";
}

function markIsUsable(markRaw, statusCode) {
  const status = cleanCell(statusCode);
  return (
    Boolean(markRaw) &&
    !/^(NT|NH|ND|NM|DNS|DNF|DQ|SCR|FOUL)$/i.test(markRaw) &&
    !/^(NT|NH|ND|NM|DNS|DNF|DQ|SCR|FOUL)$/i.test(status)
  );
}

function isMiddleSchoolRow(row) {
  const scope = cleanCell(
    `${row.eventName ?? ""} ${row.ageGroupName ?? ""} ${row.divisionName ?? ""}`,
  ).toLowerCase();
  return /\b(middle school|junior high|jh|ms)\b/.test(scope) &&
    !/\b(high school|hs)\b/.test(scope);
}

async function fetchMileSplitResult(meet, resultId) {
  const formattedUrl = formattedUrlFor(meet, resultId);
  const html = await fetchText(formattedUrl, {}, mileSplitCookieJar);
  const appName = html.match(/appName:\s*'([^']+)'/)?.[1] ?? "MileSplit";
  const appToken = html.match(/appHash:\s*'([^']+)'/)?.[1];
  if (!appToken) {
    throw new Error(`Missing MileSplit app token for ${formattedUrl}`);
  }

  const apiUrl = `https://co.milesplit.com/api/v1/meets/${meet.meetId}/performances?${new URLSearchParams(
    {
      isMeetPro: "false",
      resultsId: resultId,
      fields: milesplitPerformanceFields,
    },
  )}`;
  const json = await fetchJson(
    apiUrl,
    {
      headers: {
        appName,
        appToken,
        userId: "",
        userToken: "",
        referer: formattedUrl,
        "x-requested-with": "XMLHttpRequest",
      },
    },
    mileSplitCookieJar,
  );

  if (!Array.isArray(json.data)) {
    throw new Error(json.lastErrorText ?? `No MileSplit data for ${formattedUrl}`);
  }

  return parseMileSplitRows(json.data, {
    meet,
    resultId,
    formattedUrl,
    rawUrl: rawUrlFor(meet, resultId),
  });
}

function parseMileSplitRows(rows, context) {
  const performances = [];

  rows.forEach((row, rowIndex) => {
    if (isMiddleSchoolRow(row)) return;
    const event = normalizeEvent(row.eventName);
    const gender = parseGender(row);
    const definition = event ? eventDefinitions[event] : undefined;
    const school = cleanCell(row.teamName);
    const markRaw = cleanCell(row.mark).replace(/[†*#]/g, "");

    if (
      !event ||
      !gender ||
      !definition ||
      !definition.genders.includes(gender) ||
      !school ||
      !markIsUsable(markRaw, row.statusCode)
    ) {
      return;
    }

    const markValue = parsePerformanceMark(event, markRaw);
    if (markValue === undefined) return;
    const wind = numericWind(row.windReading);
    const verificationStatus = verificationForWind(event, wind);
    const firstName = cleanCell(row.firstName);
    const lastName = cleanCell(row.lastName);
    const athleteName = definition.relay
      ? `${school} Relay`
      : cleanCell(`${firstName} ${lastName}`);
    if (!athleteName) return;

    const round = cleanCell(row.roundName) || "Finals";
    const windNote =
      wind !== undefined && windSensitiveEvents.has(event)
        ? ` Wind ${wind > 0 ? "+" : ""}${wind}.`
        : "";
    const reviewNote =
      verificationStatus === "needs_review"
        ? " Wind reading missing or above the legal qualifying limit; excluded from rankings until reviewed."
        : "";

    performances.push({
      id: slugify(
        [
          "milesplit-last-chance",
          context.meet.meetId,
          context.resultId,
          row.id ?? rowIndex,
          gender,
          event,
          athleteName,
          school,
          markRaw,
        ].join(" "),
      ),
      athleteName,
      gender,
      ...(gradeFromGradYear(row.gradYear) ? { grade: gradeFromGradYear(row.gradYear) } : {}),
      school,
      event,
      markRaw,
      markValue,
      timingType: definition.markType === "distance" ? "Field" : "FAT",
      isFAT: definition.markType === "time",
      meetName: context.meet.meetName,
      meetDate: context.meet.meetDate,
      source: "official_timing",
      sourceUrl: context.formattedUrl,
      verificationStatus,
      classificationVerified: false,
      notes: [
        `Parsed from public Colorado MileSplit May 8-9 last-chance results (${round}).`,
        `Raw source ${context.rawUrl}.`,
        windNote.trim() || undefined,
        reviewNote.trim() || undefined,
      ]
        .filter(Boolean)
        .join(" "),
    });
  });

  return performances;
}

function eventIdFromKey(key, summary) {
  const fromSummary = Number(summary.i);
  if (Number.isFinite(fromSummary) && fromSummary > 0) return fromSummary;
  const match = key.match(/-(\d+)$/);
  return match ? Number(match[1]) : undefined;
}

function eventKindFromKey(key, summary) {
  if (summary.ec === "Individual") return "individual";
  if (summary.ec === "Relay") return "relay";
  if (key.startsWith("Individual-")) return "individual";
  if (key.startsWith("Relay-")) return "relay";
  return undefined;
}

function genderFromSummary(summary) {
  return summary.gl === "Boys" || summary.gl === "Girls" ? summary.gl : undefined;
}

function eventFromSummary(summary) {
  return summary.ab
    ? eventByAthleticLiveAbbreviation[summary.ab]
    : normalizeEvent(summary.n);
}

function denverDateFromIso(value) {
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

function athleticLiveEventDate(meet, summary) {
  const sourceDate = summary.sd ?? summary.resd ?? summary.ua;
  return sourceDate ? denverDateFromIso(sourceDate) : meet.fallbackDate;
}

function athleticLiveSourceUrl(meet, kind, eventId) {
  return `${meet.sourceRoot}/meets/${meet.meetId}/events/${kind}/${eventId}`;
}

function athleticLiveDocumentUrl(kind, eventId) {
  return `https://athleticlive.blob.core.windows.net/$web/${
    kind === "individual" ? "ind_res_list" : "rel_res_list"
  }/_doc/${eventId}`;
}

function normalizeMark(raw) {
  return cleanCell(raw).replace(/[†*#]/g, "");
}

function athleticLiveCommonPerformance(input) {
  const markRaw = normalizeMark(input.row.m);
  if (!markRaw || !markIsUsable(markRaw, input.row.s)) return undefined;
  const markValue = parsePerformanceMark(input.event, markRaw);
  if (markValue === undefined) return undefined;

  const definition = eventDefinitions[input.event];
  const wind = numericWind(input.row.w);
  const verificationStatus = verificationForWind(input.event, wind);
  const windNote =
    wind !== undefined && windSensitiveEvents.has(input.event)
      ? ` Wind ${wind > 0 ? "+" : ""}${wind}.`
      : "";
  const reviewNote =
    verificationStatus === "needs_review"
      ? " Wind reading missing or above the legal qualifying limit; excluded from rankings until reviewed."
      : "";

  return {
    id: slugify(
      [
        "athleticlive-last-chance",
        input.meet.meetId,
        input.eventId,
        input.gender,
        input.event,
        input.athleteName,
        input.school,
        markRaw,
      ].join(" "),
    ),
    athleteName: input.athleteName,
    gender: input.gender,
    ...(input.grade ? { grade: input.grade } : {}),
    school: input.school,
    event: input.event,
    markRaw,
    markValue,
    timingType: definition.markType === "distance" ? "Field" : "FAT",
    isFAT: definition.markType === "time",
    meetName: input.meet.name,
    meetDate: athleticLiveEventDate(input.meet, input.summary),
    source: "official_timing",
    sourceUrl: athleticLiveSourceUrl(input.meet, input.kind, input.eventId),
    verificationStatus,
    classificationVerified: false,
    notes: [
      `Official AthleticLIVE/${input.meet.timingLabel} result.`,
      input.row.p ? `Overall place ${input.row.p}.` : undefined,
      input.row.hn ? `Heat/flight ${input.row.hn}.` : undefined,
      input.summary.runm ? `Round ${input.summary.runm}.` : undefined,
      windNote.trim() || undefined,
      reviewNote.trim() || undefined,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function toAthleticLiveIndividual(input) {
  const athleteName = cleanCell(input.row.a?.n);
  const school = cleanCell(input.row.a?.t?.n ?? input.row.a?.t?.f);
  if (!athleteName || !school) return undefined;
  const grade = Number(input.row.a?.y);

  return athleticLiveCommonPerformance({
    ...input,
    athleteName,
    school,
    grade: Number.isFinite(grade) ? grade : undefined,
  });
}

function toAthleticLiveRelay(input) {
  const school = cleanCell(input.row.t?.n ?? input.row.t?.f);
  if (!school) return undefined;
  const relaySuffix = input.row.rd ? ` ${input.row.rd}` : "";

  return athleticLiveCommonPerformance({
    ...input,
    athleteName: `${school} Relay${relaySuffix}`,
    school,
  });
}

async function importAthleticLiveMeet(meet) {
  const eventSummaryUrl = `https://trackmeet-io.firebaseio.com/meet_${meet.meetId}/event_summary.json`;
  const eventSummaries = await fetchJson(eventSummaryUrl);
  const performances = [];
  const coverage = [];
  const errors = [];

  for (const [eventKey, summary] of Object.entries(eventSummaries ?? {})) {
    if (!summary || summary.es !== "r") continue;

    const eventId = eventIdFromKey(eventKey, summary);
    const kind = eventKindFromKey(eventKey, summary);
    const gender = genderFromSummary(summary);
    const event = eventFromSummary(summary);
    const definition = event ? eventDefinitions[event] : undefined;
    if (!eventId || !kind || !gender || !event || !definition?.genders.includes(gender)) {
      continue;
    }

    try {
      const document = await fetchJson(athleticLiveDocumentUrl(kind, eventId));
      const source = document._source;
      const rows = kind === "individual" ? source?.r ?? [] : source?.rts ?? [];
      const before = performances.length;
      let skippedRows = 0;

      for (const row of rows) {
        const performance =
          kind === "individual"
            ? toAthleticLiveIndividual({
                event,
                eventId,
                gender,
                kind,
                meet,
                row,
                summary,
              })
            : toAthleticLiveRelay({
                event,
                eventId,
                gender,
                kind,
                meet,
                row,
                summary,
              });

        if (performance) {
          performances.push(performance);
        } else {
          skippedRows += 1;
        }
      }

      const eventRows = performances.slice(before);
      coverage.push({
        meetName: meet.name,
        event,
        gender,
        rows: eventRows.length,
        verifiedRows: eventRows.filter((row) => row.verificationStatus === "verified").length,
        reviewRows: eventRows.filter((row) => row.verificationStatus !== "verified").length,
        skippedRows,
      });
    } catch (error) {
      errors.push(`${meet.name} ${gender} ${event}: ${error.message}`);
    }
  }

  return { meet, performances, coverage, errors };
}

async function importMileSplitMeets() {
  const performances = [];
  const coverage = [];
  const errors = [];

  for (const meet of milesplitMeets) {
    const beforeMeet = performances.length;

    if (!meet.resultIds.length) {
      errors.push(`${meet.meetName}: no public MileSplit result rows found at ${resultIndexUrlFor(meet)}`);
      coverage.push({
        meetName: meet.meetName,
        rows: 0,
        verifiedRows: 0,
        reviewRows: 0,
        resultIds: [],
      });
      continue;
    }

    for (const resultId of meet.resultIds) {
      try {
        const rows = await fetchMileSplitResult(meet, resultId);
        performances.push(...rows);
      } catch (error) {
        errors.push(`${meet.meetName} result ${resultId}: ${error.message}`);
      }
    }

    const meetRows = performances.slice(beforeMeet);
    coverage.push({
      meetName: meet.meetName,
      rows: meetRows.length,
      verifiedRows: meetRows.filter((row) => row.verificationStatus === "verified").length,
      reviewRows: meetRows.filter((row) => row.verificationStatus !== "verified").length,
      resultIds: meet.resultIds,
    });
  }

  return { performances, coverage, errors };
}

function dedupeById(performances) {
  const byId = new Map();
  for (const performance of performances) {
    byId.set(performance.id, performance);
  }
  return [...byId.values()];
}

async function writeMileSplitSeed(newPerformances, reportErrors, generatedAt) {
  const file = await readFile(CURRENT_MILESPLIT_PATH, "utf8");
  const metadataMarker = "export const currentMileSplitSeedMetadata = ";
  const performancesMarker =
    "export const currentMileSplitPerformances: Performance[] = ";
  const currentMetadata = parseExportLiteral(file, metadataMarker, performancesMarker);
  const currentPerformances = parseExportLiteral(file, performancesMarker);
  const currentIds = new Set(currentPerformances.map((performance) => performance.id));
  const uniqueNewRows = newPerformances.filter((performance) => !currentIds.has(performance.id));
  const performances = dedupeById([...currentPerformances, ...newPerformances]);
  const metadata = {
    ...currentMetadata,
    generatedAt,
    source: `${currentMetadata.source}_plus_may_8_9_last_chance_results`,
    supplementalRows: (currentMetadata.supplementalRows ?? 0) + uniqueNewRows.length,
    totalRows: performances.length,
    sourceErrors: [...(currentMetadata.sourceErrors ?? []), ...reportErrors],
    lastChanceImport: {
      generatedAt,
      window: "2026-05-08 through 2026-05-09",
      source: "public_colorado_milesplit_results",
      importedRows: newPerformances.length,
      uniqueNewRows: uniqueNewRows.length,
      meetCount: milesplitMeets.length,
    },
  };
  const output = `/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// This file is generated by npm run seed:milesplit and extended by scripts/import-may8-9-last-chance-results.mjs.
import type { Performance } from "@/types/domain";

export const currentMileSplitSeedMetadata = ${serialize(metadata)};

export const currentMileSplitPerformances: Performance[] = ${serialize(performances)};
`;

  await writeFile(CURRENT_MILESPLIT_PATH, output);
  return {
    totalRows: performances.length,
    uniqueNewRows: uniqueNewRows.length,
  };
}

async function writeAthleticLiveSeed(imports, generatedAt) {
  const performances = dedupeById(imports.flatMap((entry) => entry.performances));
  const errors = imports.flatMap((entry) => entry.errors);
  const metadata = {
    generatedAt,
    source: "athleticlive_public_may_8_9_last_chance_result_feeds",
    meetCount: athleticLiveMeets.length,
    performanceRows: performances.length,
    verifiedRows: performances.filter((row) => row.verificationStatus === "verified").length,
    reviewRows: performances.filter((row) => row.verificationStatus !== "verified").length,
    sourceErrors: errors,
    meets: athleticLiveMeets.map((meet) => ({
      meetId: meet.meetId,
      name: meet.name,
      fallbackDate: meet.fallbackDate,
      sourceRoot: meet.sourceRoot,
      timingLabel: meet.timingLabel,
      athleticNetUrl: meet.athleticNetUrl,
    })),
  };
  const output = `/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Generated from public AthleticLIVE May 8-9 last-chance result feeds.
// No credentials, cookies, passwords, or private session data are used.
import type { Performance } from "@/types/domain";

export const currentAthleticLiveLastChanceMetadata = ${serialize(metadata)};

export const currentAthleticLiveLastChancePerformances: Performance[] = ${serialize(performances)};
`;

  await mkdir(path.dirname(ATHLETICLIVE_OUTPUT_PATH), { recursive: true });
  await writeFile(ATHLETICLIVE_OUTPUT_PATH, output);
  return metadata;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const mileSplit = await importMileSplitMeets();
  const athleticLiveImports = await Promise.all(
    athleticLiveMeets.map(importAthleticLiveMeet),
  );
  const athleticLiveMetadata = await writeAthleticLiveSeed(
    athleticLiveImports,
    generatedAt,
  );
  const mileSplitWrite = await writeMileSplitSeed(
    mileSplit.performances,
    mileSplit.errors,
    generatedAt,
  );
  const report = {
    generatedAt,
    mileSplit: {
      importedRows: mileSplit.performances.length,
      uniqueNewRows: mileSplitWrite.uniqueNewRows,
      totalSeedRows: mileSplitWrite.totalRows,
      coverage: mileSplit.coverage,
      errors: mileSplit.errors,
    },
    athleticLive: {
      importedRows: athleticLiveMetadata.performanceRows,
      verifiedRows: athleticLiveMetadata.verifiedRows,
      reviewRows: athleticLiveMetadata.reviewRows,
      coverage: athleticLiveImports.flatMap((entry) => entry.coverage),
      errors: athleticLiveImports.flatMap((entry) => entry.errors),
    },
  };

  await mkdir(path.dirname(REPORT_OUTPUT_PATH), { recursive: true });
  await writeFile(REPORT_OUTPUT_PATH, JSON.stringify(report, null, 2));
  console.log(
    `MileSplit May 8-9 rows: ${mileSplit.performances.length} (${mileSplitWrite.uniqueNewRows} new)`,
  );
  console.log(`AthleticLIVE May 8-9 rows: ${athleticLiveMetadata.performanceRows}`);
  console.log(`Wrote ${CURRENT_MILESPLIT_PATH}`);
  console.log(`Wrote ${ATHLETICLIVE_OUTPUT_PATH}`);
  console.log(`Wrote ${REPORT_OUTPUT_PATH}`);
  if (mileSplit.errors.length || athleticLiveMetadata.sourceErrors.length) {
    console.warn(
      `Import completed with ${mileSplit.errors.length + athleticLiveMetadata.sourceErrors.length} source notices/errors.`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
