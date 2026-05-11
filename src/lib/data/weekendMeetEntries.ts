import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
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

type WeekendMeetEntriesData = {
  weekendMeetEntryMetadata: {
    generatedAt: string;
    source: string;
    errors: string[];
    meetSummary: Array<{
      meetName: string;
      meetDate: string;
      sourceUrl: string;
      entryCount: number;
    }>;
    eventSummary: Array<{
      gender: Gender;
      event: EventKey;
      entryCount: number;
    }>;
  };
  weekendMeetEntries: WeekendMeetEntry[];
};

const weekendMeetEntriesDataPath = path.join(
  process.cwd(),
  "src/lib/data/weekendMeetEntries.generated.json",
);

const weekendMeetEntriesData = JSON.parse(
  readFileSync(weekendMeetEntriesDataPath, "utf8"),
) as WeekendMeetEntriesData;

export const weekendMeetEntryMetadata =
  weekendMeetEntriesData.weekendMeetEntryMetadata;
export const weekendMeetEntries = weekendMeetEntriesData.weekendMeetEntries;
