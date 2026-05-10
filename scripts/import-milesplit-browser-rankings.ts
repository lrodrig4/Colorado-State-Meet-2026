import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Classification, EventKey, Gender, Performance } from "@/types/domain";
import { eventDefinitions, getEventDefinition } from "@/lib/data/events";
import { meets } from "@/lib/data/meets";
import { parsePerformanceMark } from "@/lib/utils/time";
import { slugify } from "@/lib/utils/text";

type BrowserRankingRow = {
  classification: Classification;
  gender: Gender;
  event: EventKey;
  rank: number;
  markRaw: string;
  athleteName: string;
  school: string;
  gradYear?: string;
  meetName?: string;
  meetDateRaw?: string;
  place?: string;
  sourceUrl: string;
  meetUrl?: string;
};

type BrowserRankingFile = {
  scrapedAt: string;
  source: string;
  rowCount: number;
  errors: string[];
  rows: BrowserRankingRow[];
};

const INPUT_PATH =
  process.env.BROWSER_RANKINGS_JSON ?? "milesplit-5a-browser-rankings.json";
const TARGET_CLASSIFICATION = process.env.BROWSER_RANKINGS_CLASSIFICATION ?? "5A";
const EXPORT_CLASSIFICATION = TARGET_CLASSIFICATION.replace(/[^A-Za-z0-9]/g, "");
const OUTPUT_PATH =
  process.env.BROWSER_RANKINGS_OUTPUT ??
  `src/lib/data/current${EXPORT_CLASSIFICATION}BrowserRankings.generated.ts`;
const REPORT_PATH =
  process.env.BROWSER_RANKINGS_REPORT ??
  `reports/${TARGET_CLASSIFICATION.toLowerCase()}-current-data-gap-report.json`;

function serialize(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/"([^"]+)":/g, "$1:");
}

function parseMeetDate(rawDate: string | undefined): string {
  const match = rawDate?.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})/);
  const months: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };

  if (!match || !months[match[1]]) return "2026-01-01";

  return `${match[3]}-${months[match[1]]}-${match[2].padStart(2, "0")}`;
}

function gradeFromGradYear(rawYear: string | undefined): number | undefined {
  const year = Number(rawYear);
  if (!Number.isFinite(year)) return undefined;

  const grade = 12 - (year - 2026);
  return grade >= 9 && grade <= 12 ? grade : undefined;
}

function toPerformance(row: BrowserRankingRow): Performance {
  const definition = getEventDefinition(row.event);
  const markValue = parsePerformanceMark(row.event, row.markRaw);
  const meetDate = parseMeetDate(row.meetDateRaw);

  if (markValue === undefined) {
    throw new Error(`Invalid browser ranking mark: ${row.event} ${row.markRaw}`);
  }

  const athleteName = definition.relay
    ? `${row.school} Relay`
    : row.athleteName;
  const notes = [
    `Imported from the trusted local browser session reading Colorado MileSplit ${row.classification} legal rankings page 1.`,
    `Browser ranking row #${row.rank}.`,
    row.place ? `MileSplit place ${row.place}.` : undefined,
    row.meetUrl ? `Meet URL ${row.meetUrl}.` : undefined,
    implausibleFieldMark(row.event, row.gender, markValue)
      ? "Queued for review because this field-event mark is outside a plausible Colorado high-school range."
      : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const needsReview = implausibleFieldMark(row.event, row.gender, markValue);

  return {
    id: slugify(
      [
        `milesplit-browser-${row.classification.toLowerCase()}`,
        row.gender,
        row.event,
        athleteName,
        row.school,
        row.markRaw,
        meetDate,
      ].join("-"),
    ),
    athleteName,
    gender: row.gender,
    grade: gradeFromGradYear(row.gradYear),
    school: row.school,
    classification: row.classification,
    classificationVerified: true,
    event: row.event,
    markRaw: row.markRaw,
    markValue,
    timingType: definition.markType === "distance" ? "Field" : "FAT",
    isFAT: definition.markType !== "distance",
    meetName: row.meetName || `Colorado MileSplit ${row.classification} Ranking`,
    meetDate,
    source: "milesplit",
    sourceUrl: row.sourceUrl,
    verificationStatus: needsReview ? "needs_review" : "verified",
    notes,
  };
}

function implausibleFieldMark(event: EventKey, gender: Gender, markValue: number) {
  const maximums: Partial<Record<EventKey, Partial<Record<Gender, number>>>> = {
    "High Jump": { Boys: 90, Girls: 78 },
    "Pole Vault": { Boys: 228, Girls: 192 },
    "Long Jump": { Boys: 330, Girls: 276 },
    "Triple Jump": { Boys: 660, Girls: 540 },
    "Shot Put": { Boys: 900, Girls: 660 },
    Discus: { Boys: 2640, Girls: 2160 },
  };
  const max = maximums[event]?.[gender];
  return max !== undefined && markValue > max;
}

function buildGapReport(input: BrowserRankingFile, performances: Performance[]) {
  const byCombo = new Map<string, Performance[]>();
  for (const performance of performances) {
    const key = `${performance.gender}|${performance.event}`;
    byCombo.set(key, [...(byCombo.get(key) ?? []), performance]);
  }

  const coverage = eventDefinitions.flatMap((definition) =>
    definition.genders.map((gender) => {
      const rows = byCombo.get(`${gender}|${definition.event}`) ?? [];
      return {
        gender,
        event: definition.event,
        rows: rows.length,
        current18th: rows[17]?.markRaw ?? null,
        row50: rows[49]?.markRaw ?? null,
        sourceUrl: rows[0]?.sourceUrl ?? null,
      };
    }),
  );
  const parsedMeetNames = new Set(
    performances.map((performance) => performance.meetName.toLowerCase()),
  );
  const skip =
    /\b(JV|Frosh|Freshman|Sophomore|Middle School|JH|Cancelled|Canceled|Do Not Use|Do Not Enter|RMAC|Penn Relays)\b/i;
  const gapWindowStart = "2026-04-20";
  const gapWindowEnd = "2026-05-12";
  const manualUploadCandidates = meets
    .filter((meet) => !meet.statusLabel)
    .filter(
      (meet) =>
        meet.endDate >= gapWindowStart &&
        meet.startDate <= gapWindowEnd,
    )
    .filter((meet) => !skip.test(meet.name))
    .filter((meet) => !parsedMeetNames.has(meet.name.toLowerCase()))
    .map((meet) => ({
      date: meet.rawDate,
      name: meet.name,
      location: meet.location,
      reason:
        `No top-50 ${TARGET_CLASSIFICATION} MileSplit ranking row references this meet name; upload only if it had ${TARGET_CLASSIFICATION} state-bubble marks.`,
    }));

  return {
    generatedAt: new Date().toISOString(),
    sourceMetadata: {
      scrapedAt: input.scrapedAt,
      source: input.source,
      rowCount: input.rowCount,
      errors: input.errors,
    },
    coverage,
    manualUploadCandidates,
  };
}

async function main() {
  const input = JSON.parse(
    await readFile(INPUT_PATH, "utf8"),
  ) as BrowserRankingFile;
  const performances = input.rows.map(toPerformance);
  const classification = performances[0]?.classification ?? TARGET_CLASSIFICATION;
  const exportClassification = classification.replace(/[^A-Za-z0-9]/g, "");
  const metadata = {
    generatedAt: input.scrapedAt,
    source: `trusted_browser_visible_milesplit_${classification.toLowerCase()}_rankings`,
    classification,
    rankingRows: performances.length,
    eventGenderCombinations: new Set(
      performances.map((performance) => `${performance.gender}|${performance.event}`),
    ).size,
    sourceErrors: input.errors,
  };
  const file = `/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Generated from ${INPUT_PATH}.
// Source contained no credentials: only visible ranking table rows from a trusted local browser session.
import type { Performance } from "@/types/domain";

export const current${exportClassification}BrowserRankingMetadata = ${serialize(metadata)};

export const current${exportClassification}BrowserRankingPerformances: Performance[] = ${serialize(performances)};
`;

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, file);
  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await writeFile(
    REPORT_PATH,
    JSON.stringify(buildGapReport(input, performances), null, 2),
  );

  console.log(
    `Imported ${performances.length} trusted-browser MileSplit ${classification} rows into ${OUTPUT_PATH}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
