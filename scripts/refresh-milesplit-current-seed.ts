import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Classification, Performance } from "@/types/domain";
import { eventDefinitions } from "@/lib/data/events";
import { milesplitGapMeetSources } from "@/lib/data/milesplitGapMeetSources";
import {
  buildMileSplitRankingUrl,
  parseMileSplitRankingPage,
} from "@/lib/services/milesplitRankings";
import {
  parseMileSplitApiResults,
  type MileSplitApiPerformanceRow,
} from "@/lib/services/milesplitApiResults";
import { parseMileSplitRawResults } from "@/lib/services/milesplitRawResults";

const OUTPUT_PATH = path.join(
  process.cwd(),
  "src/lib/data/currentPerformances.generated.ts",
);
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MAX_RANKING_PAGES = Number(process.env.MILESPLIT_MAX_RANKING_PAGES ?? 20);
const SUPPLEMENTAL_ONLY = process.env.MILESPLIT_SUPPLEMENTAL_ONLY === "1";
const IMPORT_CLASSIFICATION = normalizeClassification(
  process.env.MILESPLIT_CLASSIFICATION,
);
const SUPPLEMENTAL_WINDOW_START =
  process.env.MILESPLIT_SUPPLEMENTAL_WINDOW_START ?? "2026-04-27";
const SUPPLEMENTAL_WINDOW_END =
  process.env.MILESPLIT_SUPPLEMENTAL_WINDOW_END ?? "2026-05-05";
const SUPPLEMENTAL_WINDOW_LABEL = `${SUPPLEMENTAL_WINDOW_START} through ${SUPPLEMENTAL_WINDOW_END}`;
const SUPPLEMENTAL_WINDOW_SLUG = `${SUPPLEMENTAL_WINDOW_START}_to_${SUPPLEMENTAL_WINDOW_END}`.replace(
  /-/g,
  "_",
);
const SOURCE_MIN_DATE = process.env.MILESPLIT_SOURCE_MIN_DATE;
const MILESPLIT_PERFORMANCE_FIELDS = [
  "id",
  "meetId",
  "meetName",
  "teamId",
  "videoId",
  "teamName",
  "athleteId",
  "firstName",
  "lastName",
  "gender",
  "genderName",
  "divisionId",
  "divisionName",
  "meetResultsDivisionId",
  "resultsDivisionId",
  "ageGroupName",
  "gradYear",
  "eventName",
  "eventCode",
  "eventDistance",
  "eventGenreOrder",
  "round",
  "roundName",
  "heat",
  "units",
  "mark",
  "place",
  "windReading",
  "profileUrl",
  "teamProfileUrl",
  "performanceVideoId",
  "teamLogo",
  "statusCode",
].join(",");
const FETCH_TIMEOUT_MS = Number(process.env.MILESPLIT_FETCH_TIMEOUT_MS ?? 15_000);

class CookieJar {
  private cookies = new Map<string, string>();

  constructor(seedCookie?: string) {
    if (!seedCookie) return;

    seedCookie.split(";").forEach((piece) => {
      const [rawName, ...rawValue] = piece.trim().split("=");
      if (!rawName || rawValue.length === 0) return;
      this.cookies.set(rawName, rawValue.join("="));
    });
  }

  add(headers: Headers) {
    const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] })
      .getSetCookie;
    const setCookies = getSetCookie ? getSetCookie.call(headers) : [];

    for (const setCookie of setCookies) {
      const first = setCookie.split(";")[0];
      const index = first.indexOf("=");
      if (index <= 0) continue;
      this.cookies.set(first.slice(0, index), first.slice(index + 1));
    }
  }

  header() {
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  hasAuthCookie() {
    return this.cookies.has("jwt_token") || this.cookies.has("identity");
  }
}

const jar = new CookieJar(process.env.MILESPLIT_COOKIE);

function normalizeClassification(value: string | undefined): Classification {
  const normalized = value?.toUpperCase();

  if (
    normalized === "1A" ||
    normalized === "2A" ||
    normalized === "3A" ||
    normalized === "4A" ||
    normalized === "5A"
  ) {
    return normalized;
  }

  return "4A";
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response | undefined;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "user-agent": USER_AGENT,
        cookie: jar.header(),
        ...(init?.headers ?? {}),
      },
      redirect: "manual",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response) {
    throw new Error(`No response returned for ${url}`);
  }

  jar.add(response.headers);

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (location) {
      const nextUrl = new URL(location, url).toString();
      return fetchText(nextUrl, init);
    }
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} ${url}`);
  }

  return response.text();
}

async function loginToMileSplit(targetUrl: string) {
  if (!targetUrl || !jar.hasAuthCookie()) {
    return false;
  }

  await fetchText(targetUrl);
  return jar.hasAuthCookie();
}

function dedupePerformances(performances: Performance[]): Performance[] {
  const byId = new Map<string, Performance>();
  for (const performance of performances) {
    byId.set(performance.id, performance);
  }

  return [...byId.values()].sort((a, b) =>
    [
      a.gender.localeCompare(b.gender),
      a.event.localeCompare(b.event),
      a.school.localeCompare(b.school),
      a.athleteName.localeCompare(b.athleteName),
      a.meetDate.localeCompare(b.meetDate),
      a.markRaw.localeCompare(b.markRaw),
    ].find((comparison) => comparison !== 0) ?? 0,
  );
}

function serialize(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/"([^"]+)":/g, "$1:");
}

async function loadCurrentSeed() {
  const file = await readFile(OUTPUT_PATH, "utf8");
  const metadataMarker = "export const currentMileSplitSeedMetadata = ";
  const performancesMarker =
    "export const currentMileSplitPerformances: Performance[] = ";
  const metadataStart = file.indexOf(metadataMarker);
  const performancesStart = file.indexOf(performancesMarker);

  if (metadataStart < 0 || performancesStart < 0) {
    throw new Error(`Unable to parse existing seed file at ${OUTPUT_PATH}`);
  }

  const metadataLiteral = file
    .slice(metadataStart + metadataMarker.length, performancesStart)
    .replace(/;\s*$/, "")
    .trim();
  const performancesLiteral = file
    .slice(performancesStart + performancesMarker.length)
    .replace(/;\s*$/, "")
    .trim();
  const parseLiteral = <T>(literal: string): T =>
    Function(`"use strict"; return (${literal});`)() as T;
  const metadata = parseLiteral<{
    rankingRows?: number;
    supplementalRows?: number;
    lockedRankingPages?: string[];
    sourceErrors?: string[];
  }>(metadataLiteral);
  const performances = parseLiteral<Performance[]>(performancesLiteral);

  return {
    performances,
    metadata,
  };
}

function parseMileSplitAppInit(html: string) {
  return {
    appName: html.match(/appName:\s*'([^']+)'/)?.[1] ?? "MileSplit",
    appHash: html.match(/appHash:\s*'([^']+)'/)?.[1],
  };
}

function mileSplitResultsApiContext(rawResultsUrl: string) {
  const match = rawResultsUrl.match(/\/meets\/(\d+)[^/]*\/results\/(\d+)/);
  if (!match) return undefined;

  return {
    meetId: match[1],
    resultsId: match[2],
    formattedUrl: rawResultsUrl
      .replace(/\/raw\/?$/, "/formatted")
      .replace(/\?type=raw$/, "?type=formatted"),
  };
}

async function fetchMileSplitApiPerformances(
  source: (typeof milesplitGapMeetSources)[number],
  rawResultsUrl: string,
) {
  const context = mileSplitResultsApiContext(rawResultsUrl);
  if (!context) return [];

  const formattedHtml = await fetchText(context.formattedUrl);
  const { appName, appHash } = parseMileSplitAppInit(formattedHtml);
  if (!appHash) {
    throw new Error("Missing MileSplit formatted results API token");
  }

  const apiUrl = `https://co.milesplit.com/api/v1/meets/${context.meetId}/performances?${new URLSearchParams(
    {
      isMeetPro: "false",
      resultsId: context.resultsId,
      fields: MILESPLIT_PERFORMANCE_FIELDS,
    },
  )}`;
  const responseText = await fetchText(apiUrl, {
    headers: {
      appName,
      appToken: appHash,
      userId: "",
      userToken: "",
      referer: context.formattedUrl,
      "x-requested-with": "XMLHttpRequest",
    },
  });
  const json = JSON.parse(responseText) as {
    data?: MileSplitApiPerformanceRow[];
    lastErrorText?: string;
  };
  if (!Array.isArray(json.data)) {
    throw new Error(
      json.lastErrorText ?? "MileSplit formatted results API returned no data",
    );
  }

  return parseMileSplitApiResults(json.data, {
    meetName: source.meetName,
    meetDate: source.meetDate,
    sourceUrl: context.formattedUrl,
    supplementalWindow: SUPPLEMENTAL_WINDOW_LABEL,
  }).filter(
    (performance) =>
      performance.classificationVerified && Boolean(performance.classification),
  );
}

async function fetchRankingPerformances() {
  const performances: Performance[] = [];
  const lockedRankingPages: string[] = [];
  const sourceErrors: string[] = [];

  for (const definition of eventDefinitions) {
    for (const gender of definition.genders) {
      let page = 1;
      let url = buildMileSplitRankingUrl(
        IMPORT_CLASSIFICATION,
        gender,
        definition.event,
        page,
      );
      const seen = new Set<string>();

      while (url && page <= MAX_RANKING_PAGES && !seen.has(url)) {
        seen.add(url);

        try {
          const html = await fetchText(url);
          const parsed = parseMileSplitRankingPage(html, {
            gender,
            event: definition.event,
            sourceUrl: url,
            classification: IMPORT_CLASSIFICATION,
          });

          if (parsed.locked) {
            lockedRankingPages.push(url);
            break;
          }

          performances.push(...parsed.performances);
          url = parsed.nextUrl ?? "";
          page += 1;
        } catch (error) {
          sourceErrors.push(
            `${gender} ${definition.event} page ${page}: ${(error as Error).message}`,
          );
          break;
        }
      }
    }
  }

  return { performances, lockedRankingPages, sourceErrors };
}

async function fetchSupplementalPerformances() {
  const performances: Performance[] = [];
  const sourceErrors: string[] = [];

  for (const source of milesplitGapMeetSources) {
    if (SOURCE_MIN_DATE && source.meetDate < SOURCE_MIN_DATE) {
      continue;
    }

    console.log(`Fetching supplemental source: ${source.meetName}`);

    for (const rawResultsUrl of source.rawResultsUrls) {
      try {
        const html = await fetchText(rawResultsUrl);
        const parsedRaw = parseMileSplitRawResults(html, {
          meetName: source.meetName,
          meetDate: source.meetDate,
          sourceUrl: rawResultsUrl,
          supplementalWindow: SUPPLEMENTAL_WINDOW_LABEL,
        });

        if (parsedRaw.length) {
          performances.push(...parsedRaw);
          continue;
        }

        performances.push(
          ...(await fetchMileSplitApiPerformances(source, rawResultsUrl)),
        );
      } catch (error) {
        sourceErrors.push(`${source.meetName}: ${(error as Error).message}`);
      }
    }
  }

  return { performances, sourceErrors };
}

async function main() {
  const currentSeed = SUPPLEMENTAL_ONLY ? await loadCurrentSeed() : undefined;
  let rankings:
    | Awaited<ReturnType<typeof fetchRankingPerformances>>
    | {
        performances: Performance[];
        lockedRankingPages: string[];
        sourceErrors: string[];
      };

  if (SUPPLEMENTAL_ONLY && currentSeed) {
    rankings = {
      performances: currentSeed.performances,
      lockedRankingPages: currentSeed.metadata.lockedRankingPages ?? [],
      sourceErrors: currentSeed.metadata.sourceErrors ?? [],
    };
  } else {
    const initialTarget = buildMileSplitRankingUrl(
      IMPORT_CLASSIFICATION,
      "Boys",
      "100m",
      1,
    );
    const loggedIn = await loginToMileSplit(initialTarget);

    if (!loggedIn) {
      console.warn(
        "MileSplit cookie was not provided. Ranking pages may be locked; supplemental raw results will still be imported. Do not provide passwords to this script.",
      );
    }

    rankings = await fetchRankingPerformances();
  }

  const supplemental = await fetchSupplementalPerformances();
  const performances = dedupePerformances([
    ...rankings.performances,
    ...supplemental.performances,
  ]);
  const rankingRows =
    SUPPLEMENTAL_ONLY && currentSeed
      ? (currentSeed.metadata.rankingRows ?? 0)
      : rankings.performances.length;
  const metadata = {
    generatedAt: new Date().toISOString(),
    source:
      IMPORT_CLASSIFICATION === "5A"
        ? "colorado_5a_rankings_cross_checked_maxpreps_milesplit"
        : `colorado_milesplit_${IMPORT_CLASSIFICATION.toLowerCase()}_rankings_plus_${SUPPLEMENTAL_WINDOW_SLUG}_raw_results`,
    classification: IMPORT_CLASSIFICATION,
    rankingRows,
    supplementalRows: supplemental.performances.length,
    totalRows: performances.length,
    lockedRankingPages: rankings.lockedRankingPages,
    sourceErrors: [...rankings.sourceErrors, ...supplemental.sourceErrors],
  };
  const file = `/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// This file is generated by npm run seed:milesplit.
import type { Performance } from "@/types/domain";

export const currentMileSplitSeedMetadata = ${serialize(metadata)};

export const currentMileSplitPerformances: Performance[] = ${serialize(performances)};
`;

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, file);

  console.log(
    `Wrote ${performances.length} performances (${metadata.rankingRows} ranking rows, ${metadata.supplementalRows} supplemental rows) to ${OUTPUT_PATH}`,
  );
  if (metadata.lockedRankingPages.length) {
    console.warn(`Locked ranking pages: ${metadata.lockedRankingPages.length}`);
  }
  if (metadata.sourceErrors.length) {
    console.warn(`Source errors: ${metadata.sourceErrors.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
