import type {
  Classification,
  EventKey,
  Gender,
  Performance,
  RankingResult,
  RankingRow,
} from "@/types/domain";
import { eventDefinitions, getEventDefinition } from "@/lib/data/events";
import { historical3ASeedCutoffs } from "@/lib/data/historical3ACutoffs.generated";
import { historical5ASeedCutoffs } from "@/lib/data/historical5ACutoffs.generated";
import { milesplitGapMeetSources } from "@/lib/data/milesplitGapMeetSources";
import {
  stateMeetSchedule,
  stateMeetScheduleSlots,
  type StateMeetScheduleSlot,
} from "@/lib/data/stateSchedule";
import { applyClassifications } from "@/lib/services/classification";
import { getSeasonBestRankings } from "@/lib/services/ranking";
import { isRankingEligible } from "@/lib/services/review";
import {
  comparePerformanceMarks,
  formatPerformanceGap,
  formatPerformanceValue,
  normalizeEvent,
  parsePerformanceMark,
} from "@/lib/utils/time";

const TOP_LIMIT = 18;
const SCORING = [10, 8, 7, 6, 5, 4, 3, 2, 1];
const TEAM_DEFAULT = "Lewis-Palmer High School";
const PUEBLO_TWILIGHT = "The Pueblo Twilight";
const LATE_WINDOW_START = "2026-04-27";
const PENDING_LAST_CHANCE_MEETS = [
  "HOKA St. Vrain Invitational",
  "Teddy's Last Chance Qualifier",
];
const LAST_CHANCE_SIGNAL_MEETS = [
  "Pueblo Twilight",
  "HOKA St. Vrain",
  "Teddy's Last Chance",
  "Stutler Twilight",
  "late league meets",
];
const OFFICIAL_SOURCE_SPINE =
  "Official CHSAA/CHSAANow heat sheets and qualifier PDFs first, public timing-company pages second, MileSplit only as a convenience fallback.";
const RESULT_ONLY_SOURCE_NOTE =
  "2021 Rapid Results / CHSAA results are useful scratch evidence, but excluded from seed-cut history until a full accepted-entry list is verified.";
const lateWindowMeetNames = new Set([
  ...milesplitGapMeetSources
    .filter((source) => source.priority === "high")
    .map((source) => source.meetName),
  PUEBLO_TWILIGHT,
]);

type MovementConfig = { factor: number; min: number; max: number };

const movementByEvent: Record<EventKey, MovementConfig> = {
  "100m": { factor: 0.45, min: 0.04, max: 0.16 },
  "200m": { factor: 0.45, min: 0.08, max: 0.35 },
  "400m": { factor: 0.4, min: 0.18, max: 0.85 },
  "800m": { factor: 0.35, min: 0.45, max: 1.75 },
  "1600m": { factor: 0.35, min: 1.2, max: 5 },
  "3200m": { factor: 0.35, min: 3, max: 12 },
  "100m Hurdles": { factor: 0.45, min: 0.1, max: 0.5 },
  "110m Hurdles": { factor: 0.45, min: 0.1, max: 0.5 },
  "300m Hurdles": { factor: 0.4, min: 0.3, max: 1.2 },
  "4x100m Relay": { factor: 0.45, min: 0.12, max: 0.45 },
  "4x200m Relay": { factor: 0.45, min: 0.35, max: 1.4 },
  "4x400m Relay": { factor: 0.4, min: 0.8, max: 3 },
  "4x800m Relay": { factor: 0.35, min: 2, max: 8 },
  "High Jump": { factor: 0.3, min: 1, max: 2 },
  "Pole Vault": { factor: 0.3, min: 3, max: 9 },
  "Long Jump": { factor: 0.3, min: 2, max: 7 },
  "Triple Jump": { factor: 0.3, min: 3, max: 10 },
  "Shot Put": { factor: 0.28, min: 6, max: 24 },
  "Discus": { factor: 0.28, min: 18, max: 72 },
};

const expectedTop18MissRate = 0.1;

const top18MembershipBacktest: Partial<
  Record<`${Gender}|${EventKey}`, { right: number; wrong: number }>
> = {
  "Boys|100m": { right: 43, wrong: 11 },
  "Girls|100m": { right: 53, wrong: 1 },
  "Boys|200m": { right: 50, wrong: 4 },
  "Girls|200m": { right: 51, wrong: 3 },
  "Boys|400m": { right: 52, wrong: 2 },
  "Girls|400m": { right: 49, wrong: 5 },
  "Boys|800m": { right: 50, wrong: 4 },
  "Girls|800m": { right: 49, wrong: 5 },
  "Boys|1600m": { right: 47, wrong: 7 },
  "Girls|1600m": { right: 44, wrong: 10 },
  "Boys|3200m": { right: 52, wrong: 2 },
  "Girls|3200m": { right: 50, wrong: 4 },
  "Boys|110m Hurdles": { right: 51, wrong: 3 },
  "Girls|100m Hurdles": { right: 49, wrong: 5 },
  "Boys|300m Hurdles": { right: 49, wrong: 5 },
  "Girls|300m Hurdles": { right: 49, wrong: 5 },
  "Boys|4x100m Relay": { right: 48, wrong: 6 },
  "Girls|4x100m Relay": { right: 47, wrong: 7 },
  "Boys|4x200m Relay": { right: 48, wrong: 6 },
  "Girls|4x200m Relay": { right: 46, wrong: 8 },
  "Boys|4x400m Relay": { right: 48, wrong: 6 },
  "Girls|4x400m Relay": { right: 45, wrong: 9 },
  "Boys|4x800m Relay": { right: 49, wrong: 5 },
  "Girls|4x800m Relay": { right: 49, wrong: 5 },
  "Boys|High Jump": { right: 49, wrong: 5 },
  "Girls|High Jump": { right: 48, wrong: 6 },
  "Boys|Pole Vault": { right: 46, wrong: 8 },
  "Girls|Pole Vault": { right: 50, wrong: 4 },
  "Boys|Long Jump": { right: 51, wrong: 3 },
  "Girls|Long Jump": { right: 51, wrong: 3 },
  "Boys|Triple Jump": { right: 46, wrong: 8 },
  "Girls|Triple Jump": { right: 49, wrong: 5 },
  "Boys|Shot Put": { right: 48, wrong: 6 },
  "Girls|Shot Put": { right: 50, wrong: 4 },
  "Boys|Discus": { right: 50, wrong: 4 },
  "Girls|Discus": { right: 48, wrong: 6 },
};

function top18VolatilityCalibration(gender: Gender, event: EventKey) {
  const result = top18MembershipBacktest[`${gender}|${event}`];

  if (!result) {
    return {
      missRate: expectedTop18MissRate,
      movementMultiplier: 1,
      holdPenalty: 0,
      improveBoost: 0,
      label: undefined,
    };
  }

  const total = result.right + result.wrong;
  const missRate = total ? result.wrong / total : expectedTop18MissRate;
  const extraMissRate = Math.max(0, missRate - expectedTop18MissRate);
  const movementMultiplier = clamp(1 + extraMissRate * 3, 1, 1.38);
  const holdPenalty = Math.round(clamp(extraMissRate * 110, 0, 12));
  const improveBoost = Math.round(clamp(extraMissRate * 85, 0, 9));
  const label =
    movementMultiplier > 1
      ? `May 6-10 backtest retained ${result.right}/${total} Top 18 entries for ${gender} ${event}; widening this event's late-week danger zone.`
      : undefined;

  return {
    missRate,
    movementMultiplier,
    holdPenalty,
    improveBoost,
    label,
  };
}

function movementFor(event: EventKey, gender: Gender): MovementConfig {
  const base = movementByEvent[event];
  const calibration = top18VolatilityCalibration(gender, event);

  return {
    factor: base.factor * calibration.movementMultiplier,
    min: base.min * calibration.movementMultiplier,
    max: base.max * calibration.movementMultiplier,
  };
}

type HistoricalSeedCutoff = {
  year: number;
  markRaw: string;
  confidence?: number;
  sourceName?: string;
  sourceUrl?: string;
  notes?: string;
};

const sourceUrlByYear: Partial<Record<number, string>> = {
  2018: "https://cache.milesplit.com/user_files/18251/4a-state-track-qualifiers-2018.pdf",
  2019: "https://dop3o1hd82eb7.cloudfront.net/user_files/18251/statetrack-qualifiers-2019.pdf",
  2022: "https://s3.amazonaws.com/chsaanow.com/documents/2022/5/17/heatsheets2022_4a.pdf",
  2023: "https://s3.amazonaws.com/chsaanow.com/documents/2023/5/16/heatsheets2023_4a.pdf",
  2024: "https://s3.amazonaws.com/chsaanow.com/documents/2024/5/14/heatsheets2024_4a.pdf",
  2025: "https://s3.amazonaws.com/chsaanow.com/documents/2025/5/13/HeatSheets_2025_4A.pdf",
};

const sourceNameByYear: Partial<Record<number, string>> = {
  2018: "2018 archived 4A qualifiers PDF",
  2019: "2019 archived CHSAA qualifier PDF",
  2022: "2022 CHSAA 4A heat sheet",
  2023: "2023 CHSAA 4A heat sheet",
  2024: "2024 CHSAA 4A heat sheet",
  2025: "2025 CHSAA 4A heat sheet",
};

function seedCutoff(
  year: number,
  markRaw: string,
  options: Omit<HistoricalSeedCutoff, "year" | "markRaw"> = {},
): HistoricalSeedCutoff {
  return {
    year,
    markRaw,
    confidence: options.confidence ?? (year >= 2022 ? 95 : year >= 2018 ? 90 : 86),
    sourceName: options.sourceName ?? sourceNameByYear[year],
    sourceUrl: options.sourceUrl ?? sourceUrlByYear[year],
    notes: options.notes,
  };
}

// 18th-entry seed cutoffs extracted from CHSAA 4A state heat sheets.
const historicalSeedCutoffs: Partial<Record<
  `${Gender}|${EventKey}`,
  HistoricalSeedCutoff[]
>> = {
  "Boys|100m": [
    seedCutoff(2025, "11.09"),
    seedCutoff(2024, "11.11"),
  ],
  "Boys|200m": [
    seedCutoff(2025, "22.41"),
    seedCutoff(2024, "22.57"),
  ],
  "Boys|400m": [
    seedCutoff(2025, "50.37"),
    seedCutoff(2024, "50.42"),
  ],
  "Boys|800m": [
    seedCutoff(2025, "1:56.83", {
      confidence: 80,
      notes: "Official heat sheet; flagged for manual audit because the field looked underfilled in source research.",
    }),
    seedCutoff(2024, "1:56.95"),
  ],
  "Boys|1600m": [
    seedCutoff(2025, "4:20.63", {
      confidence: 80,
      notes: "Official heat sheet; flagged for manual audit because the field looked underfilled in source research.",
    }),
    seedCutoff(2024, "4:22.87"),
  ],
  "Boys|3200m": [
    seedCutoff(2025, "9:42.08", {
      confidence: 80,
      notes: "Official heat sheet; flagged for manual audit because the field looked underfilled in source research.",
    }),
    seedCutoff(2024, "9:37.22"),
  ],
  "Boys|110m Hurdles": [
    seedCutoff(2025, "15.26"),
    seedCutoff(2024, "15.47"),
  ],
  "Boys|300m Hurdles": [
    seedCutoff(2025, "40.80"),
    seedCutoff(2024, "40.92"),
  ],
  "Boys|4x100m Relay": [
    seedCutoff(2025, "43.37"),
    seedCutoff(2024, "43.26"),
  ],
  "Boys|4x200m Relay": [
    seedCutoff(2025, "1:30.18"),
    seedCutoff(2024, "1:30.79"),
  ],
  "Boys|4x400m Relay": [
    seedCutoff(2025, "3:28.85"),
    seedCutoff(2024, "3:27.59"),
  ],
  "Boys|4x800m Relay": [
    seedCutoff(2025, "8:17.85"),
    seedCutoff(2024, "8:21.78"),
  ],
  "Boys|High Jump": [
    seedCutoff(2025, "6-02.00"),
    seedCutoff(2024, "6-01.00"),
  ],
  "Boys|Pole Vault": [
    seedCutoff(2025, "12-03.00"),
    seedCutoff(2024, "12-02.00"),
  ],
  "Boys|Long Jump": [
    seedCutoff(2025, "21-07.50"),
    seedCutoff(2024, "21-07.50"),
  ],
  "Boys|Triple Jump": [
    seedCutoff(2025, "41-10.50"),
    seedCutoff(2024, "43-00.50"),
  ],
  "Boys|Shot Put": [
    seedCutoff(2025, "47-00.00"),
    seedCutoff(2024, "46-11.75"),
  ],
  "Boys|Discus": [
    seedCutoff(2025, "142-02"),
    seedCutoff(2024, "144-07"),
  ],
  "Girls|100m": [
    seedCutoff(2025, "12.60"),
    seedCutoff(2024, "12.66"),
  ],
  "Girls|200m": [
    seedCutoff(2025, "25.76"),
    seedCutoff(2024, "26.33"),
  ],
  "Girls|400m": [
    seedCutoff(2025, "1:00.55"),
    seedCutoff(2024, "59.84"),
  ],
  "Girls|800m": [
    seedCutoff(2025, "2:18.77", {
      confidence: 80,
      notes: "Official heat sheet; flagged for manual audit because the field looked underfilled in source research.",
    }),
    seedCutoff(2024, "2:19.31"),
  ],
  "Girls|1600m": [
    seedCutoff(2025, "5:08.20"),
    seedCutoff(2024, "5:11.73"),
  ],
  "Girls|3200m": [
    seedCutoff(2025, "11:39.70"),
    seedCutoff(2024, "11:33.64"),
  ],
  "Girls|100m Hurdles": [
    seedCutoff(2025, "16.29"),
    seedCutoff(2024, "16.54"),
  ],
  "Girls|300m Hurdles": [
    seedCutoff(2025, "47.65"),
    seedCutoff(2024, "48.26"),
  ],
  "Girls|4x100m Relay": [
    seedCutoff(2025, "50.49"),
    seedCutoff(2024, "50.67", {
      confidence: 90,
      notes: "Official heat sheet; source research flagged one extra merged relay line in the text layer.",
    }),
  ],
  "Girls|4x200m Relay": [
    seedCutoff(2025, "1:47.10"),
    seedCutoff(2024, "1:47.35"),
  ],
  "Girls|4x400m Relay": [
    seedCutoff(2025, "4:10.29"),
    seedCutoff(2024, "4:12.40"),
  ],
  "Girls|4x800m Relay": [
    seedCutoff(2025, "10:02.21"),
    seedCutoff(2024, "10:06.57"),
  ],
  "Girls|High Jump": [
    seedCutoff(2025, "5-00.00"),
    seedCutoff(2024, "4-10.50"),
  ],
  "Girls|Pole Vault": [
    seedCutoff(2025, "9-04.00"),
    seedCutoff(2024, "9-02.50"),
  ],
  "Girls|Long Jump": [
    seedCutoff(2025, "16-08.00"),
    seedCutoff(2024, "17-02.00"),
  ],
  "Girls|Triple Jump": [
    seedCutoff(2025, "34-08.00"),
    seedCutoff(2024, "34-04.25"),
  ],
  "Girls|Shot Put": [
    seedCutoff(2025, "34-07.50"),
    seedCutoff(2024, "33-05.75"),
  ],
  "Girls|Discus": [
    seedCutoff(2025, "105-00"),
    seedCutoff(2024, "111-05"),
  ],
};

// Additional CHSAA 4A state heat-sheet cutoffs recovered from public archived PDFs.
// 2020 had no normal spring state meet. The 2021 Rapid Results archive is useful
// for result validation, but is not included here until a full accepted-entry
// seed/performance list is found.
const legacyHistoricalSeedCutoffs: typeof historicalSeedCutoffs = {
  "Boys|100m": [
    { year: 2015, markRaw: "11.17" },
    { year: 2016, markRaw: "11.16" },
    { year: 2018, markRaw: "11.24" },
    { year: 2019, markRaw: "11.33" },
    { year: 2022, markRaw: "11.23" },
    { year: 2023, markRaw: "11.09" },
  ],
  "Boys|200m": [
    { year: 2015, markRaw: "22.60" },
    { year: 2016, markRaw: "22.65" },
    { year: 2018, markRaw: "22.67" },
    { year: 2019, markRaw: "23.04" },
    { year: 2022, markRaw: "22.66" },
    { year: 2023, markRaw: "22.58" },
  ],
  "Boys|400m": [
    { year: 2015, markRaw: "51.21" },
    { year: 2016, markRaw: "51.57" },
    { year: 2018, markRaw: "51.13" },
    { year: 2019, markRaw: "51.47" },
    { year: 2022, markRaw: "51.22" },
    { year: 2023, markRaw: "51.26" },
  ],
  "Boys|800m": [
    { year: 2015, markRaw: "2:00.83" },
    { year: 2016, markRaw: "1:58.58" },
    { year: 2018, markRaw: "1:58.87" },
    { year: 2019, markRaw: "1:59.58" },
    { year: 2022, markRaw: "1:58.11" },
    { year: 2023, markRaw: "1:59.14" },
  ],
  "Boys|1600m": [
    { year: 2015, markRaw: "4:34.33" },
    { year: 2016, markRaw: "4:30.06" },
    { year: 2018, markRaw: "4:27.26" },
    { year: 2019, markRaw: "4:26.60" },
    { year: 2022, markRaw: "4:22.83" },
    { year: 2023, markRaw: "4:23.99" },
  ],
  "Boys|3200m": [
    { year: 2015, markRaw: "9:57.89" },
    { year: 2016, markRaw: "10:02.82" },
    { year: 2018, markRaw: "9:45.06" },
    { year: 2019, markRaw: "9:54.42" },
    { year: 2022, markRaw: "9:36.35" },
    { year: 2023, markRaw: "9:39.19" },
  ],
  "Boys|110m Hurdles": [
    { year: 2015, markRaw: "15.80" },
    { year: 2016, markRaw: "15.77" },
    { year: 2018, markRaw: "15.78" },
    { year: 2019, markRaw: "15.98" },
    { year: 2022, markRaw: "15.93" },
    { year: 2023, markRaw: "16.00" },
  ],
  "Boys|300m Hurdles": [
    { year: 2015, markRaw: "40.93" },
    { year: 2016, markRaw: "40.77" },
    { year: 2018, markRaw: "40.94" },
    { year: 2019, markRaw: "41.43" },
    { year: 2022, markRaw: "41.68" },
    { year: 2023, markRaw: "41.53" },
  ],
  "Boys|4x100m Relay": [
    { year: 2015, markRaw: "43.96" },
    { year: 2016, markRaw: "44.01" },
    { year: 2018, markRaw: "43.98" },
    { year: 2019, markRaw: "44.09" },
    { year: 2022, markRaw: "43.85" },
    { year: 2023, markRaw: "44.12" },
  ],
  "Boys|4x200m Relay": [
    { year: 2015, markRaw: "1:31.37" },
    { year: 2016, markRaw: "1:31.34" },
    { year: 2018, markRaw: "1:31.90" },
    { year: 2019, markRaw: "1:32.72" },
    { year: 2022, markRaw: "1:31.94" },
    { year: 2023, markRaw: "1:32.11" },
  ],
  "Boys|4x400m Relay": [
    { year: 2015, markRaw: "3:30.07" },
    { year: 2016, markRaw: "3:28.90" },
    { year: 2018, markRaw: "3:28.66" },
    { year: 2019, markRaw: "3:30.81" },
    { year: 2022, markRaw: "3:31.69" },
    { year: 2023, markRaw: "3:31.78" },
  ],
  "Boys|4x800m Relay": [
    { year: 2015, markRaw: "8:20.43" },
    { year: 2016, markRaw: "8:20.69" },
    { year: 2018, markRaw: "8:17.28" },
    { year: 2019, markRaw: "8:25.33" },
    { year: 2022, markRaw: "8:26.13" },
    { year: 2023, markRaw: "8:23.47" },
  ],
  "Boys|High Jump": [
    { year: 2015, markRaw: "6-02.00" },
    { year: 2016, markRaw: "6-01.50" },
    { year: 2018, markRaw: "6-02.00" },
    { year: 2019, markRaw: "6-01.00" },
    { year: 2022, markRaw: "6-02.00" },
    { year: 2023, markRaw: "6-01.00" },
  ],
  "Boys|Pole Vault": [
    { year: 2015, markRaw: "12-04.00" },
    { year: 2016, markRaw: "11-08.00" },
    { year: 2018, markRaw: "12-09.00" },
    { year: 2019, markRaw: "12-00.00" },
    { year: 2022, markRaw: "11-09.00" },
    { year: 2023, markRaw: "11-10.25" },
  ],
  "Boys|Long Jump": [
    { year: 2015, markRaw: "21-02.00" },
    { year: 2016, markRaw: "21-00.25" },
    { year: 2018, markRaw: "21-01.50" },
    { year: 2019, markRaw: "21-02.50" },
    { year: 2022, markRaw: "21-02.25" },
    { year: 2023, markRaw: "21-01.50" },
  ],
  "Boys|Triple Jump": [
    { year: 2015, markRaw: "42-11.00" },
    { year: 2016, markRaw: "42-03.50" },
    { year: 2018, markRaw: "42-02.00" },
    { year: 2019, markRaw: "42-05.75" },
    { year: 2022, markRaw: "42-01.00" },
    { year: 2023, markRaw: "42-11.00" },
  ],
  "Boys|Shot Put": [
    { year: 2015, markRaw: "46-09.75" },
    { year: 2016, markRaw: "46-08.50" },
    { year: 2018, markRaw: "47-03.75" },
    { year: 2019, markRaw: "47-06.00" },
    { year: 2022, markRaw: "46-06.50" },
    { year: 2023, markRaw: "46-10.75" },
  ],
  "Boys|Discus": [
    { year: 2015, markRaw: "139-07" },
    { year: 2016, markRaw: "142-01" },
    { year: 2018, markRaw: "141-00" },
    { year: 2019, markRaw: "134-08" },
    { year: 2022, markRaw: "140-07" },
    { year: 2023, markRaw: "141-04" },
  ],
  "Girls|100m": [
    { year: 2015, markRaw: "12.84" },
    { year: 2016, markRaw: "12.81" },
    { year: 2018, markRaw: "12.83" },
    { year: 2019, markRaw: "12.91" },
    { year: 2022, markRaw: "12.95" },
    { year: 2023, markRaw: "12.82" },
  ],
  "Girls|200m": [
    { year: 2015, markRaw: "26.45" },
    { year: 2016, markRaw: "26.22" },
    { year: 2018, markRaw: "26.41" },
    { year: 2019, markRaw: "26.36" },
    { year: 2022, markRaw: "26.83" },
    { year: 2023, markRaw: "26.60" },
  ],
  "Girls|400m": [
    { year: 2015, markRaw: "1:00.31" },
    { year: 2016, markRaw: "59.82" },
    { year: 2018, markRaw: "1:00.07" },
    { year: 2019, markRaw: "1:00.37" },
    { year: 2022, markRaw: "1:00.70" },
    { year: 2023, markRaw: "1:01.63" },
  ],
  "Girls|800m": [
    { year: 2015, markRaw: "2:22.72" },
    { year: 2016, markRaw: "2:21.83" },
    { year: 2018, markRaw: "2:22.32" },
    { year: 2019, markRaw: "2:21.91" },
    { year: 2022, markRaw: "2:20.67" },
    { year: 2023, markRaw: "2:20.67" },
  ],
  "Girls|1600m": [
    { year: 2015, markRaw: "5:18.57" },
    { year: 2016, markRaw: "5:20.23" },
    { year: 2018, markRaw: "5:12.86" },
    { year: 2019, markRaw: "5:12.43" },
    { year: 2022, markRaw: "5:10.90" },
    { year: 2023, markRaw: "5:13.22" },
  ],
  "Girls|3200m": [
    { year: 2015, markRaw: "11:43.01" },
    { year: 2016, markRaw: "11:46.31" },
    { year: 2018, markRaw: "11:35.50" },
    { year: 2019, markRaw: "11:31.93" },
    { year: 2022, markRaw: "11:37.07" },
    { year: 2023, markRaw: "11:40.50" },
  ],
  "Girls|100m Hurdles": [
    { year: 2015, markRaw: "16.36" },
    { year: 2016, markRaw: "16.22" },
    { year: 2018, markRaw: "16.49" },
    { year: 2019, markRaw: "16.76" },
    { year: 2022, markRaw: "16.77" },
    { year: 2023, markRaw: "16.85" },
  ],
  "Girls|300m Hurdles": [
    { year: 2015, markRaw: "47.59" },
    { year: 2016, markRaw: "47.67" },
    { year: 2018, markRaw: "48.57" },
    { year: 2019, markRaw: "48.12" },
    { year: 2022, markRaw: "48.91" },
    { year: 2023, markRaw: "48.71" },
  ],
  "Girls|4x100m Relay": [
    { year: 2015, markRaw: "50.81" },
    { year: 2016, markRaw: "51.00" },
    { year: 2018, markRaw: "51.45" },
    { year: 2019, markRaw: "51.27" },
    { year: 2022, markRaw: "51.21" },
    { year: 2023, markRaw: "51.07" },
  ],
  "Girls|4x200m Relay": [
    { year: 2015, markRaw: "1:46.76" },
    { year: 2016, markRaw: "1:47.22" },
    { year: 2018, markRaw: "1:48.00" },
    { year: 2019, markRaw: "1:48.65" },
    { year: 2022, markRaw: "1:48.41" },
    { year: 2023, markRaw: "1:49.01" },
  ],
  "Girls|4x400m Relay": [
    { year: 2015, markRaw: "4:11.17" },
    { year: 2016, markRaw: "4:08.19" },
    { year: 2018, markRaw: "4:12.05" },
    { year: 2019, markRaw: "4:12.39" },
    { year: 2022, markRaw: "4:12.56" },
    { year: 2023, markRaw: "4:14.26" },
  ],
  "Girls|4x800m Relay": [
    { year: 2015, markRaw: "10:11.89" },
    { year: 2016, markRaw: "9:58.92" },
    { year: 2018, markRaw: "10:07.70" },
    { year: 2019, markRaw: "10:03.65" },
    { year: 2022, markRaw: "10:21.81" },
    { year: 2023, markRaw: "10:17.72" },
  ],
  "Girls|High Jump": [
    { year: 2015, markRaw: "5-01.00" },
    { year: 2016, markRaw: "5-01.00" },
    { year: 2018, markRaw: "5-00.50" },
    { year: 2019, markRaw: "5-00.50" },
    { year: 2022, markRaw: "4-11.00" },
    { year: 2023, markRaw: "4-10.00" },
  ],
  "Girls|Pole Vault": [
    { year: 2015, markRaw: "9-03.00" },
    { year: 2016, markRaw: "9-08.00" },
    { year: 2018, markRaw: "9-00.00" },
    { year: 2019, markRaw: "8-07.00" },
    { year: 2022, markRaw: "9-03.00" },
    { year: 2023, markRaw: "9-02.00" },
  ],
  "Girls|Long Jump": [
    { year: 2015, markRaw: "16-06.00" },
    { year: 2016, markRaw: "16-06.00" },
    { year: 2018, markRaw: "16-09.25" },
    { year: 2019, markRaw: "16-06.50" },
    { year: 2022, markRaw: "16-09.50" },
    { year: 2023, markRaw: "16-10.00" },
  ],
  "Girls|Triple Jump": [
    { year: 2015, markRaw: "34-06.50" },
    { year: 2016, markRaw: "34-02.00" },
    { year: 2018, markRaw: "34-00.25" },
    { year: 2019, markRaw: "34-07.00" },
    { year: 2022, markRaw: "34-00.00" },
    { year: 2023, markRaw: "34-05.50" },
  ],
  "Girls|Shot Put": [
    { year: 2015, markRaw: "34-02.00" },
    { year: 2016, markRaw: "35-03.75" },
    { year: 2018, markRaw: "35-03.00" },
    { year: 2019, markRaw: "34-10.00" },
    { year: 2022, markRaw: "33-09.75" },
    { year: 2023, markRaw: "33-00.00" },
  ],
  "Girls|Discus": [
    { year: 2015, markRaw: "111-02" },
    { year: 2016, markRaw: "109-05" },
    { year: 2018, markRaw: "111-04" },
    { year: 2019, markRaw: "110-07" },
    { year: 2022, markRaw: "104-00" },
    { year: 2023, markRaw: "108-07" },
  ],
};

export type LastChanceStatus =
  | "Likely safe"
  | "At risk"
  | "Must race"
  | "Monitor"
  | "Long shot";

export interface CutoffPrediction {
  event: EventKey;
  gender: Gender;
  eventLabel: string;
  currentCutoffRaw: string;
  currentCutoffRank: number;
  firstBubbleRaw?: string;
  firstBubbleName?: string;
  firstBubbleSchool?: string;
  predictedCutoffRaw: string;
  predictedCutoffValue: number;
  historicalCutoffRaw?: string;
  historicalBestCutoffRaw?: string;
  historicalBestCutoffYear?: number;
  historicalLoadedYearsLabel?: string;
  historicalCutoffs?: { year: number; markRaw: string }[];
  historicalYearCount: number;
  historicalAverageSourceConfidence?: number;
  historicalSourceQualityLabel?: string;
  historicalCaveatLabel?: string;
  historicalRangeRaw?: string;
  historicalRangeLabel?: string;
  historicalTrendLabel?: string;
  historicalTrendSummary?: string;
  movementRaw: string;
  lateWaveRaw: string;
  lateWaveSummary: string;
  confidence: "High" | "Medium" | "Low";
  confidenceScore: number;
  confidenceScoreLabel: string;
  confidenceSummary: string;
  sourceCoverageLabel: string;
  method: string;
}

export interface LastChanceRecommendation {
  id: string;
  event: EventKey;
  gender: Gender;
  grade?: number;
  eventLabel: string;
  athleteName: string;
  school: string;
  rank: number;
  rankLabel: string;
  markRaw: string;
  meetName: string;
  meetDate: string;
  predictedCutoffRaw: string;
  predictedCutoffValue: number;
  holdProbability: number;
  holdProbabilityLabel: string;
  holdConfidenceIntervalLabel: string;
  holdExplanation: string;
  stateProbability: number;
  stateProbabilityLabel: string;
  stateConfidenceIntervalLabel: string;
  makeProbability: number;
  probabilityLabel: string;
  confidenceIntervalLabel: string;
  improveProbability: number;
  improveProbabilityLabel: string;
  improveConfidenceIntervalLabel: string;
  improveExplanation: string;
  scratchProbability: number;
  scratchProbabilityLabel: string;
  scratchConfidenceIntervalLabel: string;
  scratchRiskLabel: string;
  scratchExplanation: string;
  expectedScratchOpenings: number;
  keepValue: number;
  keepValueLabel: string;
  scratchValue: number;
  scratchValueLabel: string;
  netScratchCall: "Keep" | "Maybe scratch" | "Likely scratch" | "Manual coach call";
  scratchTradeoffExplanation: string;
  oddsBandLabel: string;
  oddsExplanation: string;
  nearbyLabel: string;
  gapRaw: string;
  gapValue: number;
  status: LastChanceStatus;
  recommendation: string;
  priorityScore: number;
  isFocusTeam: boolean;
}

export interface ScratchPrediction {
  id: string;
  athleteName: string;
  school: string;
  gender: Gender;
  event: EventKey;
  eventLabel: string;
  rankLabel: string;
  markRaw: string;
  scratchProbability: number;
  confidenceIntervalLabel: string;
  reason: string;
  keepValue: number;
  scratchValue: number;
  netScratchCall: LastChanceRecommendation["netScratchCall"];
  scratchTradeoffExplanation: string;
}

export interface PuebloMeetMarkRow {
  id: string;
  athleteName: string;
  school: string;
  rankLabel?: string;
  markRaw: string;
  meetDate: string;
  verificationStatus: Performance["verificationStatus"];
  isSeasonBest: boolean;
  notes?: string;
}

export interface LastChanceDashboard {
  focusTeam: string;
  predictions: CutoffPrediction[];
  recommendations: LastChanceRecommendation[];
  scratchPredictions: ScratchPrediction[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function historicalRowsFor(
  classification: Classification,
  key: `${Gender}|${EventKey}`,
): HistoricalSeedCutoff[] {
  if (classification === "4A") {
    return [
      ...(legacyHistoricalSeedCutoffs[key] ?? []),
      ...(historicalSeedCutoffs[key] ?? []),
    ];
  }

  if (classification === "3A") {
    return [...(historical3ASeedCutoffs[key] ?? [])];
  }

  if (classification === "5A") {
    return [...(historical5ASeedCutoffs[key] ?? [])];
  }

  return [];
}

function historicalCutoffAverage(
  classification: Classification,
  gender: Gender,
  event: EventKey,
) {
  const key = `${gender}|${event}` as const;
  const rows = historicalRowsFor(classification, key);
  if (!rows?.length) return undefined;

  const parsedRows = rows
    .map((row) => ({
      ...row,
      value: parsePerformanceMark(event, row.markRaw),
    }))
    .filter(
      (
        row,
      ): row is HistoricalSeedCutoff & { value: number; confidence: number } =>
        row.value !== undefined,
    )
    .map((row) => ({
      ...row,
      confidence: row.confidence ?? (row.year >= 2022 ? 95 : row.year >= 2018 ? 90 : 86),
    }));

  if (!parsedRows.length) return undefined;

  const averageValue =
    parsedRows.reduce((total, row) => total + row.value, 0) / parsedRows.length;
  const definition = getEventDefinition(event);
  const hardest = [...parsedRows].sort((a, b) =>
    definition.sortDirection === "asc" ? a.value - b.value : b.value - a.value,
  )[0];
  const softest = [...parsedRows].sort((a, b) =>
    definition.sortDirection === "asc" ? b.value - a.value : a.value - b.value,
  )[0];
  const sortedRows = [...parsedRows]
    .sort((a, b) => a.year - b.year)
    .map(({ year, markRaw, confidence, notes, sourceName, sourceUrl }) => ({
      year,
      markRaw,
      confidence,
      notes,
      sourceName,
      sourceUrl,
    }));
  const averageSourceConfidence = Math.round(
    parsedRows.reduce((sum, row) => sum + row.confidence, 0) / parsedRows.length,
  );
  const caveatRows = sortedRows.filter((row) => Boolean(row.notes));

  return {
    averageValue,
    hardestValue: hardest.value,
    hardestRaw: hardest.markRaw,
    hardestYear: hardest.year,
    softestValue: softest.value,
    softestRaw: softest.markRaw,
    softestYear: softest.year,
    rows: sortedRows,
    years: sortedRows.map((row) => row.year),
    averageSourceConfidence,
    caveatRows,
  };
}

function historicalTrend(
  gender: Gender,
  event: EventKey,
  historical:
    | {
        averageValue: number;
        hardestValue: number;
        hardestRaw: string;
        hardestYear: number;
        softestValue: number;
        softestRaw: string;
        softestYear: number;
        rows: HistoricalSeedCutoff[];
        years: number[];
      }
    | undefined,
) {
  if (!historical?.rows.length) return undefined;

  const definition = getEventDefinition(event);
  const rows = historical.rows;
  const first = rows[0];
  const latest = rows.at(-1) ?? first;
  const firstValue = parsePerformanceMark(event, first.markRaw);
  const latestValue = parsePerformanceMark(event, latest.markRaw);
  const label = rows.map((row) => `${row.year}: ${row.markRaw}`).join(" / ");

  if (firstValue === undefined || latestValue === undefined || rows.length < 2) {
    return {
      label,
      summary: `${gender} ${event} uses ${rows.length} historical state cut mark${
        rows.length === 1 ? "" : "s"
      }.`,
    };
  }

  const improved =
    definition.sortDirection === "asc"
      ? latestValue < firstValue
      : latestValue > firstValue;
  const delta = Math.abs(latestValue - firstValue);
  const direction = improved ? "tougher" : "softer";

  return {
    label,
    summary: `${latest.year} was ${formatPerformanceGap(event, delta)} ${direction} than ${first.year}.`,
  };
}

function historicalRangeLabel(
  historical:
    | {
        hardestRaw: string;
        hardestYear: number;
        softestRaw: string;
        softestYear: number;
      }
    | undefined,
) {
  if (!historical) return undefined;

  return {
    raw: `${historical.hardestRaw} to ${historical.softestRaw}`,
    label: `Hardest loaded 18th was ${historical.hardestRaw} (${historical.hardestYear}); softest was ${historical.softestRaw} (${historical.softestYear}).`,
  };
}

function lateWavePressure(ranking: RankingResult) {
  const rows = [...ranking.top18, ...ranking.bubble];
  const nearCutline = rows.filter((row) => row.rank >= 13 && row.rank <= 30);
  const denominator = Math.max(1, nearCutline.length);
  const recentRows = nearCutline.filter(
    (row) =>
      row.meetDate >= LATE_WINDOW_START || lateWindowMeetNames.has(row.meetName),
  );
  const highPriorityRows = recentRows.filter((row) =>
    lateWindowMeetNames.has(row.meetName),
  );
  const recentShare = recentRows.length / denominator;
  const highPriorityShare = highPriorityRows.length / denominator;
  const pendingMeetPressure = PENDING_LAST_CHANCE_MEETS.length * 0.045;
  const factor = clamp(
    recentShare * 0.2 + highPriorityShare * 0.18 + pendingMeetPressure,
    0.08,
    0.46,
  );

  return {
    factor,
    recentRows: recentRows.length,
    highPriorityRows: highPriorityRows.length,
  };
}

function cutoffConfidenceAudit(
  ranking: RankingResult,
  historical:
    | {
        years: number[];
        averageSourceConfidence: number;
        caveatRows: HistoricalSeedCutoff[];
      }
    | undefined,
  lateWave: ReturnType<typeof lateWavePressure>,
  confidence: CutoffPrediction["confidence"],
) {
  const currentRows = [...ranking.top18, ...ranking.bubble];
  const verifiedShare = currentRows.length
    ? currentRows.filter((row) =>
        ["verified", "manual_approved"].includes(row.verificationStatus),
      ).length / currentRows.length
    : 0;
  const publicSourceShare = currentRows.length
    ? currentRows.filter((row) => row.source !== "athletic_net").length /
      currentRows.length
    : 0;
  const historicalYears = historical?.years.length ?? 0;
  const hasRecentOfficialYears =
    historical?.years.includes(2024) && historical.years.includes(2025);
  const sourceQualityShare = historical
    ? clamp((historical.averageSourceConfidence - 70) / 25, 0, 1)
    : 0;
  const historicalScore = clamp(
    (historicalYears / 8) * 27 + sourceQualityShare * 7,
    0,
    34,
  );
  const recentOfficialScore = hasRecentOfficialYears ? 10 : historicalYears >= 3 ? 5 : 0;
  const currentTopScore = clamp((ranking.top18.length / TOP_LIMIT) * 18, 0, 18);
  const bubbleScore = clamp((ranking.bubble.length / 12) * 12, 0, 12);
  const verificationScore = verifiedShare * 14;
  const publicSourceScore = publicSourceShare * 6;
  const lateWaveScore = lateWave.highPriorityRows > 0 ? 6 : lateWave.recentRows > 0 ? 3 : 0;
  const caveatPenalty = Math.min(8, (historical?.caveatRows.length ?? 0) * 1.5);
  const rawScore =
    historicalScore +
    recentOfficialScore +
    currentTopScore +
    bubbleScore +
    verificationScore +
    publicSourceScore +
    lateWaveScore -
    caveatPenalty;
  const cap =
    ranking.top18.length < TOP_LIMIT
      ? 58
      : historicalYears < 2
        ? 76
        : confidence === "Low"
          ? 84
          : 100;
  const score = Math.round(clamp(rawScore, 12, cap));
  const confidenceWord =
    score >= 92
      ? "very strong"
      : score >= 82
        ? "strong"
        : score >= 70
          ? "usable"
          : "limited";

  return {
    score,
    label: `${score}/100`,
    sourceCoverageLabel: `${historicalYears} CHSAA seed-cut years, ${ranking.top18.length} current top-18 marks, ${ranking.bubble.length} bubble marks, source grade ${
      historical?.averageSourceConfidence ?? 0
    }/100`,
    summary: `${score}/100 means ${confidenceWord} source support, not certainty. It reflects official historical cutoffs, current public ranking depth, verification status, and late-meet pressure.`,
  };
}

function rankLabel(row: RankingRow) {
  return row.rank <= TOP_LIMIT ? `#${row.rank}` : `B${row.rank - TOP_LIMIT}`;
}

function scorePoints(rank: number) {
  return SCORING[rank - 1] ?? 0;
}

function pointsLabel(points: number) {
  return `${Number.isInteger(points) ? points : points.toFixed(1)} pts`;
}

function signedGap(row: RankingRow, prediction: CutoffPrediction) {
  const definition = getEventDefinition(row.event);

  return definition.sortDirection === "asc"
    ? row.markValue - prediction.predictedCutoffValue
    : prediction.predictedCutoffValue - row.markValue;
}

function probabilityFor(
  row: RankingRow,
  gap: number,
  prediction: CutoffPrediction,
  scratchAdjustment = 0,
): { probability: number; interval: string } {
  const movementConfig = movementFor(row.event, row.gender);
  const calibration = top18VolatilityCalibration(row.gender, row.event);
  const uncertainty = Math.max(
    movementConfig.min * 2,
    movementConfig.max * (prediction.confidence === "High" ? 0.6 : 0.85),
  );
  const rankPenalty = Math.max(0, row.rank - TOP_LIMIT) * 4.2;
  const bubbleBase = row.rank <= TOP_LIMIT ? 91 : 61 - rankPenalty;
  const cutlinePenalty = clamp((gap / uncertainty) * 32, -18, 46);
  const topPressure = row.rank <= TOP_LIMIT ? Math.max(0, row.rank - 12) * 2.2 : 0;
  const volatilityPenalty =
    row.rank <= TOP_LIMIT
      ? calibration.holdPenalty * clamp((row.rank - 10) / 8, 0, 1)
      : calibration.holdPenalty * 0.65;
  const rawProbability = clamp(
    bubbleBase -
      cutlinePenalty -
      topPressure -
      volatilityPenalty +
      scratchAdjustment,
    2,
    98,
  );
  const probability = Math.round(rawProbability / 2) * 2;
  const intervalWidth =
    prediction.confidence === "High" ? 2 : prediction.confidence === "Medium" ? 4 : 8;
  const low = Math.round(clamp(probability - intervalWidth, 2, 98));
  const high = Math.round(clamp(probability + intervalWidth, 2, 98));

  return {
    probability,
    interval: `${low}-${high}%`,
  };
}

function intervalAround(probability: number, width: number) {
  const low = Math.round(clamp(probability - width, 2, 98));
  const high = Math.round(clamp(probability + width, 2, 98));
  return `${low}-${high}%`;
}

function setProbabilityLabels(
  recommendation: LastChanceRecommendation,
  probability: number,
  interval: string,
) {
  return {
    ...recommendation,
    stateProbability: probability,
    stateProbabilityLabel: `${probability}%`,
    stateConfidenceIntervalLabel: interval,
    makeProbability: probability,
    probabilityLabel: `${probability}%`,
    confidenceIntervalLabel: interval,
    oddsBandLabel: oddsBandLabel(probability),
  };
}

function improvementFor(
  row: RankingRow,
  gap: number,
  prediction: CutoffPrediction,
): { probability: number; interval: string; explanation: string } {
  const definition = getEventDefinition(row.event);
  const movementConfig = movementFor(row.event, row.gender);
  const calibration = top18VolatilityCalibration(row.gender, row.event);
  const strikeWindow = Math.max(movementConfig.max, movementConfig.min * 2);
  const disciplineBase = {
    sprint: 30,
    hurdle: 32,
    distance: 34,
    relay: 48,
    jump: 40,
    throw: 42,
  }[definition.discipline];
  const closeBonus = gap > 0 ? clamp(22 - (gap / strikeWindow) * 28, -22, 20) : 0;
  const rankUrgency = row.rank > TOP_LIMIT ? clamp((TOP_LIMIT + 8 - row.rank) * 2, -18, 12) : 0;
  const safeSeedPenalty = row.rank <= TOP_LIMIT && gap <= 0 ? Math.max(0, 12 - row.rank) * 0.9 : 0;
  const lateWaveBoost = Number.parseInt(prediction.lateWaveRaw, 10) > 24 ? 4 : 0;
  const backtestBoost = row.rank >= 13 ? calibration.improveBoost : 0;
  const rawProbability = clamp(
    disciplineBase +
      closeBonus +
      rankUrgency +
      lateWaveBoost +
      backtestBoost -
      safeSeedPenalty,
    4,
    86,
  );
  const probability = Math.round(rawProbability / 2) * 2;
  const intervalWidth =
    prediction.confidence === "High" ? 6 : prediction.confidence === "Medium" ? 8 : 12;
  const low = Math.round(clamp(probability - intervalWidth, 2, 96));
  const high = Math.round(clamp(probability + intervalWidth, 2, 96));
  const backtestNote = backtestBoost
    ? " Backtest volatility raises the value of another attempt in this event."
    : "";
  const explanation =
    gap > 0
      ? `Chance to get the needed ${formatPerformanceGap(row.event, gap)} improvement.${backtestNote}`
      : `Chance to improve seed if raced again; current mark already projects in.${backtestNote}`;

  return {
    probability,
    interval: `${low}-${high}%`,
    explanation,
  };
}

function oddsBandLabel(probability: number) {
  if (probability >= 96) return "Lock";
  if (probability >= 88) return "Likely";
  if (probability >= 68) return "Lean in";
  if (probability >= 54) return "Bubble";
  if (probability >= 40) return "Must improve";
  if (probability >= 24) return "Needs big jump";
  return "Long shot";
}

function oddsExplanation(row: RankingRow, prediction: CutoffPrediction, gapRaw: string) {
  const history = prediction.historicalCutoffRaw
    ? ` History says the average cut is ${prediction.historicalCutoffRaw}.`
    : "";

  return `${rankLabel(row)} seed, ${gapRaw} vs projected cut ${prediction.predictedCutoffRaw}.${history}`;
}

function statusFor(row: RankingRow, gap: number, strikeWindow: number): LastChanceStatus {
  if (row.rank <= TOP_LIMIT) {
    return gap > 0 ? "At risk" : "Likely safe";
  }

  if (gap <= strikeWindow) {
    return "Must race";
  }

  return row.rank <= TOP_LIMIT + 10 ? "Monitor" : "Long shot";
}

function recommendationFor(status: LastChanceStatus, row: RankingRow) {
  if (status === "At risk") {
    return "Race if this state spot matters; projected cutoff can pass this mark.";
  }

  if (status === "Must race") {
    return "Prioritize at last chance; close enough to move into the projected top 18.";
  }

  if (status === "Monitor") {
    return "Watch scratches and other teams, but this needs a meaningful improvement.";
  }

  if (status === "Long shot") {
    return "Only prioritize if the athlete has a realistic breakthrough target.";
  }

  return row.rank >= 15
    ? "Keep available as an entry, but save legs unless the event is strategic."
    : "State position is currently strong.";
}

function priorityFor(status: LastChanceStatus, row: RankingRow, gap: number) {
  const statusBase: Record<LastChanceStatus, number> = {
    "Must race": 500,
    "At risk": 450,
    Monitor: 250,
    "Likely safe": 100,
    "Long shot": 50,
  };
  const rankPressure = Math.max(0, TOP_LIMIT + 10 - row.rank) * 6;
  const gapPressure = Math.max(0, 80 - Math.abs(gap));

  return statusBase[status] + rankPressure + gapPressure;
}

export function buildCutoffPrediction(ranking: RankingResult): CutoffPrediction | undefined {
  const rows = [...ranking.top18, ...ranking.bubble];
  const cutoff = ranking.top18[TOP_LIMIT - 1] ?? ranking.top18.at(-1);

  if (!cutoff) {
    return undefined;
  }

  const definition = getEventDefinition(ranking.event);
  const movementConfig = movementFor(ranking.event, ranking.gender);
  const calibration = top18VolatilityCalibration(ranking.gender, ranking.event);
  const spreadAnchor =
    ranking.bubble[Math.min(5, ranking.bubble.length - 1)] ??
    ranking.bubble[0] ??
    rows.at(-1) ??
    cutoff;
  const spread = Math.abs(spreadAnchor.markValue - cutoff.markValue);
  const lateWave = lateWavePressure(ranking);
  const movement = ranking.bubble.length
    ? clamp(
        spread * movementConfig.factor * (1 + lateWave.factor),
        movementConfig.min,
        movementConfig.max * (1 + lateWave.factor * 0.5),
      )
    : 0;
  const spreadForecast =
    definition.sortDirection === "asc"
      ? cutoff.markValue - movement
      : cutoff.markValue + movement;
  const historical =
    historicalCutoffAverage(ranking.classification, ranking.gender, ranking.event);
  const trend = historicalTrend(ranking.gender, ranking.event, historical);
  const range = historicalRangeLabel(historical);
  const historicalSourceQualityLabel = historical
    ? `Historical source grade ${historical.averageSourceConfidence}/100 from official/archived heat-sheet rows.`
    : undefined;
  const historicalCaveatLabel = historical?.caveatRows.length
    ? `Source caveats: ${historical.caveatRows
        .map((row) => `${row.year}${row.notes ? ` (${row.notes})` : ""}`)
        .join("; ")}.`
    : undefined;
  const predictedCutoffValue = historical
    ? definition.sortDirection === "asc"
      ? Math.min(spreadForecast, historical.averageValue)
      : Math.max(spreadForecast, historical.averageValue)
    : spreadForecast;
  const effectiveMovement = Math.abs(cutoff.markValue - predictedCutoffValue);
  const firstBubble = ranking.bubble[0];
  const confidence =
    ranking.top18.length < TOP_LIMIT
      ? "Low"
      : ranking.bubble.length >= 6 && historical
        ? "High"
        : historical
          ? "Medium"
          : "Low";
  const confidenceAudit = cutoffConfidenceAudit(
    ranking,
    historical,
    lateWave,
    confidence,
  );
  const lateWaveSummary = `Late movement is weighted from ${LAST_CHANCE_SIGNAL_MEETS.join(
    ", ",
  )}; current near-cutline sample has ${lateWave.recentRows} recent mark${
    lateWave.recentRows === 1 ? "" : "s"
  } and ${lateWave.highPriorityRows} high-priority last-chance mark${
    lateWave.highPriorityRows === 1 ? "" : "s"
  }.${calibration.label ? ` ${calibration.label}` : ""}`;

  return {
    event: ranking.event,
    gender: ranking.gender,
    eventLabel: `${ranking.gender} ${definition.displayName}`,
    currentCutoffRaw: cutoff.markRaw,
    currentCutoffRank: cutoff.rank,
    firstBubbleRaw: firstBubble?.markRaw,
    firstBubbleName: firstBubble?.athleteName,
    firstBubbleSchool: firstBubble?.school,
    predictedCutoffRaw: formatPerformanceValue(ranking.event, predictedCutoffValue),
    predictedCutoffValue,
    historicalCutoffRaw: historical
      ? formatPerformanceValue(ranking.event, historical.averageValue)
      : undefined,
    historicalBestCutoffRaw: historical
      ? formatPerformanceValue(ranking.event, historical.hardestValue)
      : undefined,
    historicalBestCutoffYear: historical?.hardestYear,
    historicalLoadedYearsLabel: historical?.years.join(", "),
    historicalCutoffs: historical?.rows,
    historicalYearCount: historical?.years.length ?? 0,
    historicalAverageSourceConfidence: historical?.averageSourceConfidence,
    historicalSourceQualityLabel,
    historicalCaveatLabel,
    historicalRangeRaw: range?.raw,
    historicalRangeLabel: range?.label,
    historicalTrendLabel: trend?.label,
    historicalTrendSummary: trend?.summary,
    movementRaw: formatPerformanceGap(ranking.event, effectiveMovement),
    lateWaveRaw: `${Math.round(lateWave.factor * 100)}%`,
    lateWaveSummary,
    confidence,
    confidenceScore: confidenceAudit.score,
    confidenceScoreLabel: confidenceAudit.label,
    confidenceSummary: confidenceAudit.summary,
    sourceCoverageLabel: confidenceAudit.sourceCoverageLabel,
    method: historical
      ? `${OFFICIAL_SOURCE_SPINE} Public-source model only: current rank spread, event-specific May 6-10 Top 18 retention calibration, recent high-priority meet pressure (${lateWave.highPriorityRows} near-cutline marks), pending ${PENDING_LAST_CHANCE_MEETS.join(" and ")} risk, and loaded CHSAA state seed cutoffs (${historical.years.join(", ")}). ${RESULT_ONLY_SOURCE_NOTE}`
      : `${OFFICIAL_SOURCE_SPINE} Public-source model only: current rank spread, event-specific May 6-10 Top 18 retention calibration, recent high-priority meet pressure (${lateWave.highPriorityRows} near-cutline marks), and pending ${PENDING_LAST_CHANCE_MEETS.join(" and ")} risk. ${ranking.classification}-specific CHSAA historical seed-cut rows are not loaded yet, so this view does not reuse the 4A historical model. ${RESULT_ONLY_SOURCE_NOTE}`,
  };
}

export function buildRecommendation(
  row: RankingRow,
  prediction: CutoffPrediction,
  focusTeam: string = TEAM_DEFAULT,
  nearbyLabel = "",
): LastChanceRecommendation {
  const definition = getEventDefinition(row.event);
  const movementConfig = movementFor(row.event, row.gender);
  const gap = signedGap(row, prediction);
  const strikeWindow = Math.max(movementConfig.max, movementConfig.min * 2);
  const status = statusFor(row, gap, strikeWindow);
  const probability = probabilityFor(row, gap, prediction);
  const improveProbability = improvementFor(row, gap, prediction);
  const gapRaw =
    gap > 0
      ? `Needs ${formatPerformanceGap(row.event, gap)}`
      : `${formatPerformanceGap(row.event, gap)} cushion`;

  return {
    id: `${row.id}-last-chance`,
    event: row.event,
    gender: row.gender,
    grade: row.grade,
    eventLabel: `${row.gender} ${definition.displayName}`,
    athleteName: definition.relay ? `${row.school} Relay` : row.athleteName,
    school: row.school,
    rank: row.rank,
    rankLabel: rankLabel(row),
    markRaw: row.markRaw,
    meetName: row.meetName,
    meetDate: row.meetDate,
    predictedCutoffRaw: prediction.predictedCutoffRaw,
    predictedCutoffValue: prediction.predictedCutoffValue,
    holdProbability: probability.probability,
    holdProbabilityLabel: `${probability.probability}%`,
    holdConfidenceIntervalLabel: probability.interval,
    holdExplanation: "Chance this exact mark qualifies if the athlete or relay does not improve.",
    stateProbability: probability.probability,
    stateProbabilityLabel: `${probability.probability}%`,
    stateConfidenceIntervalLabel: probability.interval,
    makeProbability: probability.probability,
    probabilityLabel: `${probability.probability}%`,
    confidenceIntervalLabel: probability.interval,
    improveProbability: improveProbability.probability,
    improveProbabilityLabel: `${improveProbability.probability}%`,
    improveConfidenceIntervalLabel: improveProbability.interval,
    improveExplanation: improveProbability.explanation,
    scratchProbability: 0,
    scratchProbabilityLabel: "0%",
    scratchConfidenceIntervalLabel: definition.relay ? "0-2%" : "0-8%",
    scratchRiskLabel: "Very low",
    scratchExplanation: definition.relay
      ? "Relays are treated as declared and contested in this model; no relay scratch is projected unless a coach manually removes it."
      : "No strong scratch signal from current individual load, relay pressure, or schedule.",
    expectedScratchOpenings: 0,
    keepValue: scorePoints(row.rank),
    keepValueLabel: pointsLabel(scorePoints(row.rank)),
    scratchValue: 0,
    scratchValueLabel: pointsLabel(0),
    netScratchCall: "Keep",
    scratchTradeoffExplanation: definition.relay
      ? "Relay entries are evaluated for repeatability, not scratch openings."
      : "Keep by default unless another event or relay clearly improves expected team points.",
    oddsBandLabel: oddsBandLabel(probability.probability),
    oddsExplanation: oddsExplanation(row, prediction, gapRaw),
    nearbyLabel,
    gapRaw,
    gapValue: gap,
    status,
    recommendation: recommendationFor(status, row),
    priorityScore: priorityFor(status, row, gap),
    isFocusTeam: row.school === focusTeam,
  };
}

function nearbyLabelFor(row: RankingRow, rows: RankingRow[]) {
  const cutoff = rows.find((candidate) => candidate.rank === TOP_LIMIT);
  const firstBubble = rows.find((candidate) => candidate.rank === TOP_LIMIT + 1);

  if (row.rank <= TOP_LIMIT) {
    return firstBubble
      ? `First out: ${firstBubble.athleteName}, ${firstBubble.markRaw}`
      : "No bubble mark loaded";
  }

  return cutoff
    ? `Cut line: ${cutoff.athleteName}, ${cutoff.markRaw}`
    : "No cut line loaded";
}

function buildRecommendationsForRanking(
  ranking: RankingResult,
  prediction: CutoffPrediction,
  focusTeam: string,
) {
  const rows = [...ranking.top18, ...ranking.bubble];

  return rows.map((row) =>
    buildRecommendation(row, prediction, focusTeam, nearbyLabelFor(row, rows)),
  );
}

const relatedRelaysByEvent: Partial<Record<EventKey, EventKey[]>> = {
  "100m": ["4x100m Relay", "4x200m Relay"],
  "200m": ["4x100m Relay", "4x200m Relay", "4x400m Relay"],
  "400m": ["4x200m Relay", "4x400m Relay"],
  "800m": ["4x800m Relay", "4x400m Relay"],
  "1600m": ["4x800m Relay"],
  "3200m": ["4x800m Relay"],
  "100m Hurdles": ["4x100m Relay"],
  "110m Hurdles": ["4x100m Relay"],
  "300m Hurdles": ["4x400m Relay"],
};

const relayDepthEvents: Record<
  Extract<EventKey, "4x100m Relay" | "4x200m Relay" | "4x400m Relay" | "4x800m Relay">,
  Array<{ event: EventKey; weight: number }>
> = {
  "4x100m Relay": [
    { event: "100m", weight: 1 },
    { event: "200m", weight: 0.7 },
    { event: "400m", weight: 0.25 },
    { event: "100m Hurdles", weight: 0.22 },
    { event: "110m Hurdles", weight: 0.22 },
  ],
  "4x200m Relay": [
    { event: "200m", weight: 1 },
    { event: "100m", weight: 0.75 },
    { event: "400m", weight: 0.48 },
    { event: "300m Hurdles", weight: 0.25 },
  ],
  "4x400m Relay": [
    { event: "400m", weight: 1 },
    { event: "800m", weight: 0.7 },
    { event: "200m", weight: 0.55 },
    { event: "300m Hurdles", weight: 0.45 },
    { event: "1600m", weight: 0.28 },
  ],
  "4x800m Relay": [
    { event: "800m", weight: 1 },
    { event: "1600m", weight: 0.78 },
    { event: "3200m", weight: 0.5 },
    { event: "400m", weight: 0.32 },
  ],
};

type RelayEventKey = keyof typeof relayDepthEvents;

interface RelayDepthCandidate {
  athleteName: string;
  school: string;
  gender: Gender;
  score: number;
  bestEvent: EventKey;
  bestRank: number;
  eventCount: number;
}

type RelayDepthChart = Map<string, RelayDepthCandidate[]>;

const distanceScratchEvents = new Set<EventKey>(["800m", "1600m", "3200m"]);
const distanceProfileEvents = ["800m", "1600m", "3200m"] as const;
const distanceMeters: Record<(typeof distanceProfileEvents)[number], number> = {
  "800m": 800,
  "1600m": 1600,
  "3200m": 3200,
};
const distanceEquivalentReliability: Partial<
  Record<`${EventKey}->${EventKey}`, number>
> = {
  "800m->1600m": 0.62,
  "800m->3200m": 0.18,
  "1600m->800m": 0.58,
  "1600m->3200m": 0.74,
  "3200m->800m": 0.16,
  "3200m->1600m": 0.66,
};
const distanceEquivalentSupportCap: Partial<
  Record<`${EventKey}->${EventKey}`, number>
> = {
  "800m->1600m": 8,
  "800m->3200m": 16,
  "1600m->800m": 1.4,
  "1600m->3200m": 24,
  "3200m->800m": 1.2,
  "3200m->1600m": 8,
};
const hurdleScratchEvents = new Set<EventKey>([
  "100m Hurdles",
  "110m Hurdles",
  "300m Hurdles",
]);
const sprintScratchEvents = new Set<EventKey>([
  "100m",
  "200m",
  "400m",
  "100m Hurdles",
  "110m Hurdles",
  "300m Hurdles",
]);
const jumpScratchEvents = new Set<EventKey>([
  "High Jump",
  "Pole Vault",
  "Long Jump",
  "Triple Jump",
]);
const throwScratchEvents = new Set<EventKey>(["Shot Put", "Discus"]);
const trackIndividualScratchEvents = new Set<EventKey>([
  ...sprintScratchEvents,
  ...distanceScratchEvents,
]);

type DistanceProfileEvent = (typeof distanceProfileEvents)[number];
type DistanceProfile = Partial<Record<DistanceProfileEvent, RankingRow>>;
type DistanceProfileMap = Map<string, DistanceProfile>;

function isDistanceProfileEvent(event: EventKey): event is DistanceProfileEvent {
  return distanceProfileEvents.includes(event as DistanceProfileEvent);
}

function athleteProfileKey(gender: Gender, athleteName: string, school: string) {
  return `${gender}|${athleteName.toLowerCase()}|${school.toLowerCase()}`;
}

function equivalentDistanceMark(
  sourceEvent: DistanceProfileEvent,
  targetEvent: DistanceProfileEvent,
  sourceMarkValue: number,
) {
  // Riegel-style conversion. This is used only as a potential signal, not as a
  // replacement for the actual qualifying mark.
  return (
    sourceMarkValue *
    Math.pow(distanceMeters[targetEvent] / distanceMeters[sourceEvent], 1.06)
  );
}

function buildDistanceProfiles(
  performances: Performance[],
  classification: Classification,
): DistanceProfileMap {
  const profiles: DistanceProfileMap = new Map();

  for (const event of distanceProfileEvents) {
    for (const gender of getEventDefinition(event).genders) {
      const ranking = getSeasonBestRankings(performances, {
        classification,
        event,
        gender,
        topLimit: 160,
        bubbleLimit: 0,
      });

      for (const row of ranking.top18) {
        const key = athleteProfileKey(row.gender, row.athleteName, row.school);
        const profile = profiles.get(key) ?? {};
        profile[event] = row;
        profiles.set(key, profile);
      }
    }
  }

  return profiles;
}

function crossEventPotentialSignal(
  recommendation: LastChanceRecommendation,
  profile: DistanceProfile | undefined,
  prediction: CutoffPrediction | undefined,
) {
  if (
    !profile ||
    !prediction ||
    !isDistanceProfileEvent(recommendation.event)
  ) {
    return {
      improveAdjustment: 0,
      stateAdjustment: 0,
      priorityAdjustment: 0,
      explanation: "",
    };
  }
  const targetEvent: DistanceProfileEvent = recommendation.event;

  const candidates = distanceProfileEvents
    .filter((event) => event !== targetEvent && profile[event])
    .map((sourceEvent) => {
      const source = profile[sourceEvent];
      if (!source) return undefined;

      const equivalentValue = equivalentDistanceMark(
        sourceEvent,
        targetEvent,
        source.markValue,
      );
      const support = recommendation.gapValue + prediction.predictedCutoffValue - equivalentValue;
      const reliability =
        distanceEquivalentReliability[`${sourceEvent}->${targetEvent}`] ?? 0.5;
      const targetMovement = movementFor(targetEvent, recommendation.gender);
      const supportCap =
        distanceEquivalentSupportCap[`${sourceEvent}->${targetEvent}`] ??
        targetMovement.max * 2;
      const cappedSupport =
        support > 0 ? Math.min(support, supportCap) : Math.max(support, -supportCap);

      return {
        source,
        sourceEvent,
        equivalentValue,
        support,
        cappedSupport,
        weightedSupport: cappedSupport * reliability,
        reliability,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> =>
      Boolean(candidate),
    );

  if (!candidates.length) {
    return {
      improveAdjustment: 0,
      stateAdjustment: 0,
      priorityAdjustment: 0,
      explanation: "",
    };
  }

  const bestSupport = [...candidates].sort(
    (a, b) => b.weightedSupport - a.weightedSupport,
  )[0];
  const worstSupport = [...candidates].sort(
    (a, b) => a.weightedSupport - b.weightedSupport,
  )[0];
  const movementConfig = movementFor(recommendation.event, recommendation.gender);
  const breakthroughWindow = movementConfig.max * 1.6;
  const sourceLabel = getEventDefinition(bestSupport.sourceEvent).displayName;
  const equivalentRaw = formatPerformanceValue(
    recommendation.event,
    bestSupport.equivalentValue,
  );
  const supportRaw = formatPerformanceGap(
    recommendation.event,
    Math.abs(bestSupport.support),
  );
  const cappedSupportRaw = formatPerformanceGap(
    recommendation.event,
    Math.abs(bestSupport.cappedSupport),
  );

  if (bestSupport.cappedSupport >= movementConfig.min) {
    const profileBoost = clamp(
      (bestSupport.cappedSupport / breakthroughWindow) * 18 * bestSupport.reliability,
      2,
      22,
    );
    const equivalentCutGap = bestSupport.equivalentValue - prediction.predictedCutoffValue;
    const cutlineBoost =
      equivalentCutGap <= 0
        ? recommendation.rank > TOP_LIMIT
          ? 10
          : 5
        : recommendation.gapValue > 0 && equivalentCutGap < recommendation.gapValue
          ? 6
          : 0;
    const improveAdjustment = Math.round(profileBoost + cutlineBoost);
    const stateAdjustment = Math.round(
      clamp(improveAdjustment * (recommendation.rank > TOP_LIMIT ? 0.62 : 0.36), 2, 16),
    );

    return {
      improveAdjustment,
      stateAdjustment,
      priorityAdjustment: improveAdjustment * 2,
      explanation: `Range profile: ${bestSupport.source.markRaw} ${sourceLabel} converts near ${equivalentRaw}, about ${supportRaw} stronger than this ${getEventDefinition(
        recommendation.event,
      ).displayName} mark. The model caps that at ${cappedSupportRaw} of usable upside for odds. Treat as upside, not a guarantee.`,
    };
  }

  if (
    recommendation.rank > 12 &&
    worstSupport.cappedSupport <= -movementConfig.max * 1.5
  ) {
    const source = worstSupport.source;
    const sourceName = getEventDefinition(worstSupport.sourceEvent).displayName;
    const equivalentRaw = formatPerformanceValue(
      recommendation.event,
      worstSupport.equivalentValue,
    );
    const penalty = Math.round(
      clamp(
        (-worstSupport.cappedSupport / (movementConfig.max * 2.5)) *
          10 *
          worstSupport.reliability,
        2,
        10,
      ),
    );

    return {
      improveAdjustment: -penalty,
      stateAdjustment: -Math.min(6, Math.round(penalty * 0.55)),
      priorityAdjustment: -penalty,
      explanation: `Range profile: ${source.markRaw} ${sourceName} converts near ${equivalentRaw}, so the breakthrough case is weaker unless training evidence says otherwise.`,
    };
  }

  return {
    improveAdjustment: 0,
    stateAdjustment: 0,
    priorityAdjustment: 0,
    explanation: "",
  };
}

function applyCrossEventPotential(
  recommendations: LastChanceRecommendation[],
  profiles: DistanceProfileMap,
  predictions: CutoffPrediction[],
) {
  const predictionByEvent = new Map(
    predictions.map((prediction) => [
      `${prediction.gender}|${prediction.event}`,
      prediction,
    ]),
  );

  return recommendations.map((recommendation) => {
    if (
      getEventDefinition(recommendation.event).relay ||
      !isDistanceProfileEvent(recommendation.event)
    ) {
      return recommendation;
    }

    const profile = profiles.get(
      athleteProfileKey(
        recommendation.gender,
        recommendation.athleteName,
        recommendation.school,
      ),
    );
    const prediction = predictionByEvent.get(
      `${recommendation.gender}|${recommendation.event}`,
    );
    const signal = crossEventPotentialSignal(recommendation, profile, prediction);

    if (!signal.explanation) return recommendation;

    const improveProbability =
      Math.round(
        clamp(
          recommendation.improveProbability + signal.improveAdjustment,
          2,
          94,
        ) / 2,
      ) * 2;
    const stateProbability =
      Math.round(
        clamp(
          recommendation.makeProbability + signal.stateAdjustment,
          2,
          98,
        ) / 2,
      ) * 2;
    const adjusted = setProbabilityLabels(
      recommendation,
      stateProbability,
      intervalAround(stateProbability, signal.stateAdjustment > 0 ? 6 : 5),
    );

    return {
      ...adjusted,
      improveProbability,
      improveProbabilityLabel: `${improveProbability}%`,
      improveConfidenceIntervalLabel: intervalAround(improveProbability, 8),
      improveExplanation: `${recommendation.improveExplanation} ${signal.explanation}`,
      oddsExplanation: `${recommendation.oddsExplanation} ${signal.explanation}`,
      recommendation:
        signal.stateAdjustment > 0 && recommendation.rank > TOP_LIMIT
          ? `Range profile says this event has real upside. ${recommendation.recommendation}`
          : signal.stateAdjustment < 0
            ? `${recommendation.recommendation} Range profile is not backing a big breakthrough yet.`
            : recommendation.recommendation,
      priorityScore: recommendation.priorityScore + signal.priorityAdjustment,
    };
  });
}

function historicalScratchPatternPressure(
  row: LastChanceRecommendation,
  rows: LastChanceRecommendation[],
) {
  let pressure = 0;
  const notes: string[] = [];
  const individualLoad = rows.length;
  const distanceLoad = rows.filter((entry) =>
    distanceScratchEvents.has(entry.event),
  );
  const hurdleLoad = rows.filter((entry) =>
    hurdleScratchEvents.has(entry.event),
  );
  const jumpLoad = rows.filter((entry) => jumpScratchEvents.has(entry.event));

  if (individualLoad >= 4) {
    pressure += 8;
    notes.push("4-event individual load");
  } else if (individualLoad === 3) {
    pressure += 5;
    notes.push("3-event individual load");
  }

  if (distanceScratchEvents.has(row.event) && distanceLoad.length >= 2) {
    const hasTriangle =
      distanceLoad.some((entry) => entry.event === "800m") &&
      distanceLoad.some((entry) => entry.event === "1600m") &&
      distanceLoad.some((entry) => entry.event === "3200m");
    const isScoringDistanceSeed = row.rank <= 9;
    pressure += hasTriangle
      ? isScoringDistanceSeed
        ? 6
        : 12
      : isScoringDistanceSeed
        ? 4
        : 7;
    notes.push(
      hasTriangle
        ? isScoringDistanceSeed
          ? "800/1600/3200 workload, but this seed can still score"
          : "800/1600/3200 distance triage"
        : isScoringDistanceSeed
          ? "distance double workload, but this seed can still score"
          : "distance double triage",
    );
  }

  if (
    (hurdleScratchEvents.has(row.event) || jumpScratchEvents.has(row.event)) &&
    hurdleLoad.length >= 2 &&
    jumpLoad.length >= 1
  ) {
    pressure += 10;
    notes.push("hurdle-jump combo triage");
  }

  if (row.rank > 12 && rows.some((entry) => entry.rank <= 9)) {
    pressure += 6;
    notes.push("bubble event next to stronger scoring event");
  }

  return {
    pressure: Math.min(22, pressure),
    note: notes[0] ?? "",
  };
}

function distanceProfilePressure(
  row: LastChanceRecommendation,
  rows: LastChanceRecommendation[],
  teamEventRows: LastChanceRecommendation[],
) {
  if (!distanceScratchEvents.has(row.event)) {
    return { pressure: 0, relief: 0, note: "" };
  }

  const distanceRows = rows.filter((entry) =>
    distanceScratchEvents.has(entry.event),
  );
  const rowFor = (event: EventKey) =>
    distanceRows.find((entry) => entry.event === event);
  const eight = rowFor("800m");
  const sixteen = rowFor("1600m");
  const thirtyTwo = rowFor("3200m");
  const bestPoints = Math.max(...distanceRows.map((entry) => scorePoints(entry.rank)));
  const rowPoints = scorePoints(row.rank);
  const rowIsPrimary =
    row.rank <= 4 || rowPoints >= Math.max(6, bestPoints - 1);
  let pressure = 0;
  let relief = 0;
  const notes: string[] = [];

  if (row.event === "3200m") {
    if (rowIsPrimary && (!eight || eight.rank > 10)) {
      relief += 34;
      notes.push("3200 profile is a primary scoring event, not a default scratch");
    }

    if (sixteen && row.rank <= 12 && sixteen.rank <= 12) {
      relief += 34;
      notes.push("1600/3200 profile makes the 3200 a likely kept event");
    }

    if (
      eight &&
      sixteen &&
      (eight.rank <= 4 || row.rank - eight.rank >= 8) &&
      sixteen.rank <= 9 &&
      row.rank > 12 &&
      rowPoints <= scorePoints(eight.rank)
    ) {
      pressure += 18;
      notes.push("800/1600 profile likely takes priority over 3200");
    } else if (eight && eight.rank <= 4 && row.rank > 12) {
      pressure += 8;
      notes.push("800 strength is materially stronger than 3200 seed");
    }

    const scoringTeammate = teamEventRows
      .filter((entry) => entry.id !== row.id && entry.rank <= 9)
      .sort((a, b) => a.rank - b.rank)[0];

    if (scoringTeammate && eight && eight.rank <= 6 && row.rank > 3) {
      pressure += 7;
      notes.push(
        `team already has ${scoringTeammate.rankLabel} 3200 scorer and this athlete has a top-800 path`,
      );
    }
  }

  if (row.event === "800m" && thirtyTwo && thirtyTwo.rank <= 5 && row.rank > 10) {
    pressure += 14;
    notes.push("3200 profile is stronger than 800 seed");
  } else if (row.event === "800m" && rowIsPrimary && (!thirtyTwo || thirtyTwo.rank > 9)) {
    relief += 18;
    notes.push("800 profile is a primary scoring event");
  }

  if (
    row.event === "1600m" &&
    eight &&
    thirtyTwo &&
    eight.rank <= 6 &&
    thirtyTwo.rank <= 6 &&
    row.rank > 9
  ) {
    pressure += 8;
    notes.push("800/3200 endpoints are stronger than the 1600 seed");
  } else if (
    row.event === "1600m" &&
    eight &&
    eight.rank <= 6 &&
    row.rank <= 12
  ) {
    relief += 18;
    notes.push("1600 is a realistic bridge event for this distance profile");
  } else if (row.event === "1600m" && rowIsPrimary) {
    relief += 30;
    notes.push("1600 profile is a primary scoring event");
  }

  if (row.event === "1600m") {
    relief += 34;
    notes.push("Saturday 1600 is a late championship event athletes usually keep");
  }

  return {
    pressure: Math.min(24, pressure),
    relief: Math.min(34, relief),
    note: notes[0] ?? "",
  };
}

function sprintIndividualPriorityRelief(row: LastChanceRecommendation) {
  if (!sprintScratchEvents.has(row.event)) {
    return { protected: false, relief: 0, cap: 88, note: "" };
  }

  const projectedPoints = scorePoints(row.rank);

  if (row.rank <= 6 || projectedPoints >= 4) {
    return {
      protected: true,
      relief: 38,
      cap: 12,
      note: "top sprint/hurdle individual seed is protected before relay load",
    };
  }

  if (row.rank <= 9 || projectedPoints > 0) {
    return {
      protected: false,
      relief: 22,
      cap: 24,
      note: "scoring sprint/hurdle seed usually stays individual-first",
    };
  }

  if (row.rank <= TOP_LIMIT) {
    return {
      protected: false,
      relief: 10,
      cap: 42,
      note: "sprinters commonly contest individual events plus relays",
    };
  }

  return { protected: false, relief: 0, cap: 88, note: "" };
}

function throwScratchContext(
  row: LastChanceRecommendation,
  rows: LastChanceRecommendation[],
) {
  if (!throwScratchEvents.has(row.event)) {
    return { protected: false, relief: 0, cap: 88, note: "" };
  }

  const projectedPoints = scorePoints(row.rank);
  const hasFullTrackLoad =
    rows.length >= 4 &&
    rows.some((entry) => trackIndividualScratchEvents.has(entry.event));

  if (projectedPoints > 0 || !hasFullTrackLoad) {
    return {
      protected: true,
      relief: 42,
      cap: 10,
      note: "throws rarely scratch unless the athlete is overloaded in track events",
    };
  }

  return {
    protected: false,
    relief: 20,
    cap: 30,
    note: "throw scratch only modeled because this athlete also has a full track-event load",
  };
}

function championshipWorkloadRelief(
  row: LastChanceRecommendation,
  rows: LastChanceRecommendation[],
  relay: { pressure: number; note: string },
  schedule: { pressure: number; note: string },
) {
  if (!distanceScratchEvents.has(row.event)) {
    return { relief: 0, note: "" };
  }

  const distanceRows = rows.filter((entry) =>
    distanceScratchEvents.has(entry.event),
  );
  const eventSet = new Set(distanceRows.map((entry) => entry.event));
  const hasEight = eventSet.has("800m");
  const hasSixteen = eventSet.has("1600m");
  const hasThirtyTwo = eventSet.has("3200m");
  const hasDistanceTriple = hasEight && hasSixteen && hasThirtyTwo;
  const relayContext = `${relay.note} ${schedule.note}`;
  const hasFourByEight = relayContext.includes("4x800m Relay");
  const hasFourByFour = relayContext.includes("4x400m Relay");
  const rowPoints = scorePoints(row.rank);
  const bestPoints = Math.max(
    ...distanceRows.map((entry) => scorePoints(entry.rank)),
  );
  const isScoringSeed = row.rank <= 9;
  const isPrimaryOrNearPrimary =
    row.rank <= 3 || rowPoints >= Math.max(5, bestPoints - 1);
  let relief = 0;
  const notes: string[] = [];

  if (isScoringSeed && hasDistanceTriple) {
    relief += row.rank <= 4 ? 28 : 22;
    notes.push(
      "scoring-quality 800/1600/3200 profile can still contest the full distance load",
    );
  } else if (
    isScoringSeed &&
    hasEight &&
    hasSixteen &&
    (hasFourByEight || hasFourByFour)
  ) {
    relief += row.rank <= 4 ? 20 : 14;
    notes.push(
      "scoring-quality 800/1600 profile fits a relay-heavy state weekend",
    );
  }

  if (row.event === "800m" && row.rank <= 6 && hasFourByFour) {
    relief += 10;
    notes.push("top-800 athletes often still anchor the 4x400 path");
  }

  if (row.event === "3200m" && row.rank <= 6 && hasFourByEight) {
    relief += 10;
    notes.push("top-3200 athletes can handle the Thursday 4x800 to Friday 3200 path");
  }

  if (isPrimaryOrNearPrimary && rows.length >= 3) {
    relief += 12;
    notes.push("primary scoring event should not be scratched just because the workload is hard");
  }

  if (row.event === "1600m") {
    relief += 24;
    notes.push("Saturday 1600 is late enough that scratches should be rare");
  }

  if (row.rank > 9) {
    relief = row.event === "1600m" ? Math.min(relief, 24) : Math.min(relief, 6);
  } else if (row.rank > 6 && rowPoints <= 1) {
    relief = row.event === "1600m" ? Math.min(relief, 24) : Math.min(relief, 10);
  }

  return {
    relief: Math.min(42, relief),
    note: notes[0] ?? "",
  };
}

function minutesForDay(day: StateMeetScheduleSlot["day"]) {
  return {
    Thursday: 0,
    Friday: 24 * 60,
    Saturday: 48 * 60,
  }[day];
}

function minutesForStartTime(startTime: string) {
  const match = startTime.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return undefined;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toLowerCase();

  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  return hour * 60 + minute;
}

function stateScheduleSlotsFor(
  row: LastChanceRecommendation,
  classification: Classification,
) {
  const slots = stateMeetScheduleSlots
    .filter(
      (item) =>
        item.classification === classification &&
        item.gender === row.gender &&
        normalizeEvent(item.event) === row.event,
    )
    .sort((a, b) => scheduleSlotMinutes(a) - scheduleSlotMinutes(b));

  if (slots.length) return slots;

  const fallback = stateMeetSchedule.find(
    (item) =>
      item.classification === classification &&
      item.gender === row.gender &&
      normalizeEvent(item.event) === row.event,
  );

  if (!fallback) return [];

  return [{ ...fallback, round: "Final" as const }];
}

function scheduleSlotMinutes(slot: Pick<StateMeetScheduleSlot, "day" | "startTime">) {
  return minutesForDay(slot.day) + (minutesForStartTime(slot.startTime) ?? 0);
}

function formatGapMinutes(minutes: number) {
  const rounded = Math.round(minutes / 5) * 5;
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;

  if (!hours) return `${remainder} min`;
  if (!remainder) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function formatSlot(slot: StateMeetScheduleSlot) {
  return `${slot.day} ${slot.startTime} ${slot.round.toLowerCase()}`;
}

function relayDepthKey(gender: Gender, school: string, relay: EventKey) {
  return `${gender}|${school}|${relay}`;
}

function isRelayDepthEvent(event: EventKey): event is RelayEventKey {
  return event in relayDepthEvents;
}

function buildRelayDepthCharts(
  recommendations: LastChanceRecommendation[],
): RelayDepthChart {
  const charts: RelayDepthChart = new Map();

  for (const row of recommendations) {
    if (getEventDefinition(row.event).relay) continue;

    for (const [relay, components] of Object.entries(relayDepthEvents) as Array<
      [RelayEventKey, (typeof relayDepthEvents)[RelayEventKey]]
    >) {
      const component = components.find((item) => item.event === row.event);
      if (!component) continue;

      const key = relayDepthKey(row.gender, row.school, relay);
      const candidateKey = `${row.athleteName}|${row.school}`;
      const chart = charts.get(key) ?? [];
      const existing = chart.find(
        (candidate) => `${candidate.athleteName}|${candidate.school}` === candidateKey,
      );
      // Global state rank is an imperfect but useful depth-chart signal. Weight
      // primary relay events hardest, then add smaller credit for range.
      const eventScore =
        Math.max(0, 56 - row.rank) * component.weight +
        scorePoints(row.rank) * 3 +
        (row.rank <= TOP_LIMIT ? 4 : 0);

      if (existing) {
        existing.score += eventScore * 0.45;
        existing.eventCount += 1;
        if (eventScore > Math.max(0, 56 - existing.bestRank)) {
          existing.bestEvent = row.event;
          existing.bestRank = row.rank;
        }
      } else {
        chart.push({
          athleteName: row.athleteName,
          school: row.school,
          gender: row.gender,
          score: eventScore,
          bestEvent: row.event,
          bestRank: row.rank,
          eventCount: 1,
        });
      }

      charts.set(
        key,
        chart.sort(
          (a, b) =>
            b.score - a.score ||
            a.bestRank - b.bestRank ||
            a.athleteName.localeCompare(b.athleteName),
        ),
      );
    }
  }

  return charts;
}

function relayDepthSignal(
  row: LastChanceRecommendation,
  relay: EventKey,
  relayDepthCharts: RelayDepthChart,
) {
  if (!isRelayDepthEvent(relay)) {
    return { multiplier: 0, label: "", note: "" };
  }

  const chart = relayDepthCharts.get(relayDepthKey(row.gender, row.school, relay)) ?? [];
  const index = chart.findIndex(
    (candidate) =>
      candidate.athleteName === row.athleteName &&
      candidate.school === row.school,
  );

  if (index < 0) {
    return {
      multiplier: 0,
      label: "not projected relay pool",
      note: `not in loaded ${relay} depth chart`,
    };
  }

  const candidate = chart[index];
  const position = index + 1;
  const bestEvent = getEventDefinition(candidate.bestEvent).displayName;

  if (position <= 4) {
    return {
      multiplier: 1,
      label: `projected ${relay} leg ${position}`,
      note: `projected ${relay} leg ${position} from ${bestEvent} depth`,
    };
  }

  if (position <= 6) {
    return {
      multiplier: 0.65,
      label: `${relay} alternate range ${position}`,
      note: `${relay} alternate range ${position} from ${bestEvent} depth`,
    };
  }

  if (position <= 8) {
    return {
      multiplier: 0.35,
      label: `${relay} fringe range ${position}`,
      note: `${relay} fringe relay range ${position}`,
    };
  }

  return {
    multiplier: 0,
    label: "outside projected relay pool",
    note: `outside loaded ${relay} top-8 depth chart`,
  };
}

function scheduleRowsFor(
  row: LastChanceRecommendation,
  otherRows: LastChanceRecommendation[],
  relaysBySchoolGender?: Map<string, LastChanceRecommendation[]>,
  relayDepthCharts?: RelayDepthChart,
) {
  const relatedRelays = new Set(
    [row, ...otherRows].flatMap((entry) => relatedRelaysByEvent[entry.event] ?? []),
  );
  if (!relatedRelays.size || !relaysBySchoolGender) return [];

  return (relaysBySchoolGender.get(`${row.gender}|${row.school}`) ?? [])
    .filter((relay) => {
      if (!relatedRelays.has(relay.event) || relay.rank > 10) return false;
      if (!relayDepthCharts) return true;
      return relayDepthSignal(row, relay.event, relayDepthCharts).multiplier > 0;
    })
    .sort((a, b) => a.rank - b.rank);
}

function schedulePressure(
  row: LastChanceRecommendation,
  otherRows: LastChanceRecommendation[],
  classification: Classification,
  relaysBySchoolGender?: Map<string, LastChanceRecommendation[]>,
  relayDepthCharts?: RelayDepthChart,
) {
  const rowSlots = stateScheduleSlotsFor(row, classification);
  if (!rowSlots.length) {
    return { pressure: 0, note: "" };
  }

  let pressure = 0;
  const notes: string[] = [];
  const otherScheduleRows = [
    ...otherRows.filter((other) => other.id !== row.id),
    ...scheduleRowsFor(row, otherRows, relaysBySchoolGender, relayDepthCharts),
  ];

  if (rowSlots.length > 1 && row.rank <= 12) {
    pressure = Math.max(pressure, row.rank <= 9 ? 5 : 3);
    notes.push(
      `${row.eventLabel} has ${rowSlots
        .map((slot) => `${slot.day} ${slot.round.toLowerCase()}`)
        .join(" + ")}`,
    );
  }

  for (const other of otherScheduleRows) {
    const otherSlots = stateScheduleSlotsFor(other, classification);
    if (!otherSlots.length) continue;

    const closest = rowSlots
      .flatMap((rowSlot) =>
        otherSlots.map((otherSlot) => ({
          rowSlot,
          otherSlot,
          gap: Math.abs(scheduleSlotMinutes(rowSlot) - scheduleSlotMinutes(otherSlot)),
        })),
      )
      .sort((a, b) => a.gap - b.gap)[0];

    if (!closest) continue;

    const sameDay = closest.rowSlot.day === closest.otherSlot.day;
    const isRelay = getEventDefinition(other.event).relay;

    if (
      sameDay &&
      ((row.event === "3200m" && other.event === "800m") ||
        (row.event === "800m" && other.event === "3200m"))
    ) {
      pressure = Math.max(pressure, row.event === "800m" ? 15 : 11);
      notes.push(`Friday 3200/800 double with ${formatGapMinutes(closest.gap)} recovery`);
      continue;
    }

    if (row.event === "800m" && other.event === "4x400m Relay" && sameDay) {
      pressure = Math.max(pressure, 16);
      notes.push(`4x400 prelim is ${formatGapMinutes(closest.gap)} after the 800`);
      continue;
    }

    if (row.event === "400m" && other.event === "4x400m Relay") {
      pressure = Math.max(pressure, 12);
      notes.push("400/4x400 stack includes Thursday prelim, Friday relay prelim, Saturday finals");
      continue;
    }

    if (row.event === "3200m" && other.event === "4x800m Relay") {
      pressure = Math.max(pressure, 5);
      notes.push("4x800 final is Thursday morning before Friday 3200");
      continue;
    }

    if (row.event === "1600m" && sameDay && closest.gap <= 30 * 60) {
      pressure = Math.max(pressure, other.event === "800m" ? 8 : 6);
      notes.push(`Saturday 1600 comes after ${other.eventLabel} on ${closest.otherSlot.day}`);
      continue;
    }

    if (closest.gap <= 90) {
      pressure = Math.max(pressure, isRelay ? 14 : 16);
      notes.push(`${other.eventLabel} is ${formatGapMinutes(closest.gap)} away`);
    } else if (closest.gap <= 150) {
      pressure = Math.max(pressure, isRelay ? 12 : 14);
      notes.push(`${other.eventLabel} is ${formatGapMinutes(closest.gap)} away`);
    } else if (sameDay && closest.gap <= 300) {
      pressure = Math.max(pressure, 10);
      notes.push(`${other.eventLabel} is same-day with ${formatGapMinutes(closest.gap)} recovery`);
    } else if (closest.gap <= 24 * 60) {
      pressure = Math.max(pressure, 5);
    } else if (closest.gap <= 30 * 60) {
      pressure = Math.max(pressure, 4);
    }
  }

  const hasFourRaceDistanceWeekend =
    otherScheduleRows.some((other) => other.event === "4x800m Relay") &&
    [row, ...otherRows].some((entry) => entry.event === "3200m") &&
    [row, ...otherRows].some((entry) => entry.event === "800m") &&
    [row, ...otherRows].some((entry) => entry.event === "1600m");

  if (hasFourRaceDistanceWeekend) {
    pressure = Math.max(pressure, 12);
    notes.push("4x800/3200/800/1600 distance weekend");
  }

  if (
    (row.event === "3200m" && otherRows.some((other) => other.event === "1600m")) ||
    (row.event === "1600m" && otherRows.some((other) => other.event === "3200m"))
  ) {
    pressure = Math.max(pressure, 6);
    notes.push("Friday 3200 plus Saturday 1600");
  }

  return {
    pressure: Math.min(24, pressure),
    note: notes[0] ?? (pressure ? `state schedule load around ${formatSlot(rowSlots[0])}` : ""),
  };
}

function relayPressure(
  row: LastChanceRecommendation,
  relaysBySchoolGender: Map<string, LastChanceRecommendation[]>,
  relayDepthCharts: RelayDepthChart,
) {
  const relatedRelays = relatedRelaysByEvent[row.event] ?? [];
  if (!relatedRelays.length) return { pressure: 0, note: "" };

  const relays = (relaysBySchoolGender.get(`${row.gender}|${row.school}`) ?? [])
    .filter((relay) => relatedRelays.includes(relay.event) && relay.rank <= 10)
    .map((relay) => ({
      relay,
      depth: relayDepthSignal(row, relay.event, relayDepthCharts),
    }))
    .filter(({ depth }) => depth.multiplier > 0)
    .sort(
      (a, b) =>
        b.depth.multiplier - a.depth.multiplier ||
        a.relay.rank - b.relay.rank,
    );
  const strongest = relays[0];

  if (!strongest) return { pressure: 0, note: "" };

  const basePressure =
    strongest.relay.rank <= 4 ? 16 : strongest.relay.rank <= 9 ? 11 : 7;
  const pressure = Math.round(basePressure * strongest.depth.multiplier);

  return {
    pressure,
    note: `school has ${strongest.relay.rankLabel} ${strongest.relay.eventLabel}; ${strongest.depth.note}`,
  };
}

interface PointsTradeoff {
  keepValue: number;
  scratchValue: number;
  netCall: LastChanceRecommendation["netScratchCall"];
  pressure: number;
  relief: number;
  probabilityCap: number;
  note: string;
}

function relayPointValue(
  row: LastChanceRecommendation,
  relaysBySchoolGender: Map<string, LastChanceRecommendation[]>,
  relayDepthCharts: RelayDepthChart,
) {
  const relatedRelays = relatedRelaysByEvent[row.event] ?? [];
  let bestValue = 0;
  let bestNote = "";
  let projectedRelayCount = 0;

  for (const relay of relaysBySchoolGender.get(`${row.gender}|${row.school}`) ?? []) {
    if (!relatedRelays.includes(relay.event) || relay.rank > TOP_LIMIT) continue;

    const depth = relayDepthSignal(row, relay.event, relayDepthCharts);
    if (depth.multiplier <= 0) continue;
    if (depth.multiplier >= 0.65) projectedRelayCount += 1;

    const value = scorePoints(relay.rank) * depth.multiplier;
    if (value > bestValue) {
      bestValue = value;
      bestNote = `${relay.rankLabel} ${relay.eventLabel} relay path (${depth.label})`;
    }
  }

  return {
    value: Math.round(bestValue * 10) / 10,
    note: bestNote,
    projectedRelayCount,
  };
}

function pointsTradeoff(
  row: LastChanceRecommendation,
  rows: LastChanceRecommendation[],
  relaysBySchoolGender: Map<string, LastChanceRecommendation[]>,
  relayDepthCharts: RelayDepthChart,
): PointsTradeoff {
  const keepValue = scorePoints(row.rank);
  const strongestOther = rows
    .filter((entry) => entry.id !== row.id)
    .map((entry) => ({
      row: entry,
      value: scorePoints(entry.rank),
    }))
    .sort((a, b) => b.value - a.value || a.row.rank - b.row.rank)[0];
  const relayValue = relayPointValue(row, relaysBySchoolGender, relayDepthCharts);
  const scratchValue = Math.max(strongestOther?.value ?? 0, relayValue.value);
  const pointDelta = scratchValue - keepValue;
  const eventLoad = rows.length + relayValue.projectedRelayCount;
  const eventCapPressure = Math.max(0, eventLoad - 4) * 18;
  const notes: string[] = [];
  let pressure = eventCapPressure;
  let relief = 0;
  let probabilityCap = 88;

  if (strongestOther && strongestOther.value >= scratchValue && strongestOther.value > 0) {
    notes.push(
      `${strongestOther.row.rankLabel} ${strongestOther.row.eventLabel} is the stronger points path`,
    );
  } else if (relayValue.note) {
    notes.push(relayValue.note);
  }

  if (eventLoad > 4) {
    notes.push(`${eventLoad}-event projected load creates an event-cap decision`);
  }

  if (keepValue >= 4 && pointDelta <= 1) {
    relief += 44;
    probabilityCap = Math.min(probabilityCap, 10);
    notes.push(`${row.rankLabel} ${row.eventLabel} is worth ${pointsLabel(keepValue)} and should be protected`);
  } else if (keepValue > 0 && pointDelta <= 2) {
    relief += 30;
    probabilityCap = Math.min(probabilityCap, 20);
    notes.push(`scoring seed still has clear keep value (${pointsLabel(keepValue)})`);
  }

  if (row.rank <= 6) {
    relief += pointDelta >= 4 && eventLoad > 4 ? 14 : 38;
    probabilityCap = Math.min(probabilityCap, pointDelta >= 4 && eventLoad > 4 ? 34 : 12);
    notes.push("rank 1-6 individual seeds are protected unless the points math is obvious");
  } else if (row.rank <= 9) {
    relief += pointDelta >= 3 && eventLoad > 4 ? 12 : 26;
    probabilityCap = Math.min(probabilityCap, pointDelta >= 3 && eventLoad > 4 ? 38 : 22);
    notes.push("rank 7-9 scoring seeds stay low scratch risk without a better points path");
  } else if (row.rank <= TOP_LIMIT) {
    if (pointDelta >= 4) {
      pressure += 18;
      notes.push(`another path projects about ${pointsLabel(pointDelta)} more than keeping this event`);
    } else if (pointDelta >= 2) {
      pressure += 9;
      notes.push("another event or relay has a modest points edge");
    } else {
      relief += 12;
      probabilityCap = Math.min(probabilityCap, 42);
      notes.push("no clear team-points gain from scratching this event");
    }
  }

  const netCall: PointsTradeoff["netCall"] =
    pointDelta >= 4 && eventLoad > 4
      ? "Likely scratch"
      : pointDelta >= 2 && (eventLoad > 4 || row.rank > 12)
        ? "Maybe scratch"
        : pointDelta > 0 && row.rank > 9
          ? "Manual coach call"
          : "Keep";

  return {
    keepValue,
    scratchValue,
    netCall,
    pressure: Math.min(30, pressure),
    relief: Math.min(52, relief),
    probabilityCap,
    note:
      notes[0] ??
      `keep value ${pointsLabel(keepValue)} vs alternate value ${pointsLabel(scratchValue)}`,
  };
}

function scratchRiskLabel(probability: number) {
  if (probability >= 65) return "High";
  if (probability >= 42) return "Medium";
  if (probability >= 20) return "Low";
  return "Very low";
}

function buildScratchPredictions(
  recommendations: LastChanceRecommendation[],
  classification: Classification,
): ScratchPrediction[] {
  const grouped = new Map<string, LastChanceRecommendation[]>();
  const relaysBySchoolGender = new Map<string, LastChanceRecommendation[]>();
  const relayDepthCharts = buildRelayDepthCharts(recommendations);
  const individualsBySchoolGenderEvent = new Map<
    string,
    LastChanceRecommendation[]
  >();

  for (const recommendation of recommendations) {
    if (
      recommendation.rank <= TOP_LIMIT &&
      getEventDefinition(recommendation.event).relay
    ) {
      const key = `${recommendation.gender}|${recommendation.school}`;
      relaysBySchoolGender.set(key, [
        ...(relaysBySchoolGender.get(key) ?? []),
        recommendation,
      ]);
    }

    if (
      recommendation.rank <= TOP_LIMIT &&
      !getEventDefinition(recommendation.event).relay
    ) {
      const key = `${recommendation.gender}|${recommendation.school}|${recommendation.event}`;
      individualsBySchoolGenderEvent.set(key, [
        ...(individualsBySchoolGenderEvent.get(key) ?? []),
        recommendation,
      ]);
    }
  }

  for (const recommendation of recommendations) {
    if (recommendation.rank > TOP_LIMIT) continue;
    if (getEventDefinition(recommendation.event).relay) continue;

    const key = `${recommendation.gender}|${recommendation.athleteName}|${recommendation.school}`;
    grouped.set(key, [...(grouped.get(key) ?? []), recommendation]);
  }

  const scratchPredictions: ScratchPrediction[] = [];

  for (const rows of grouped.values()) {
    const strongest = [...rows].sort(
      (a, b) =>
        scorePoints(b.rank) - scorePoints(a.rank) ||
        a.rank - b.rank ||
        b.makeProbability - a.makeProbability ||
        a.eventLabel.localeCompare(b.eventLabel),
    )[0];

    for (const row of rows) {
      const relay = relayPressure(row, relaysBySchoolGender, relayDepthCharts);
      const historicalPattern = historicalScratchPatternPressure(row, rows);
      const teamEventRows =
        individualsBySchoolGenderEvent.get(
          `${row.gender}|${row.school}|${row.event}`,
        ) ?? [];
      const distanceProfile = distanceProfilePressure(row, rows, teamEventRows);
      const schedule = schedulePressure(
        row,
        rows,
        classification,
        relaysBySchoolGender,
        relayDepthCharts,
      );
      const sprintPriority = sprintIndividualPriorityRelief(row);
      const throwContext = throwScratchContext(row, rows);
      const points = pointsTradeoff(
        row,
        rows,
        relaysBySchoolGender,
        relayDepthCharts,
      );
      const protectedScoringDistance =
        distanceScratchEvents.has(row.event) &&
        (row.event === "1600m" ||
          row.rank <= 9 ||
          (row.event === "3200m" && row.rank <= 12) ||
          (row.event === "800m" && row.rank <= 10));
      const protectedPrimaryDistance =
        distanceScratchEvents.has(row.event) &&
        distanceProfile.relief >= 18 &&
        distanceProfile.pressure < 12;
      const protectedLateSixteen =
        row.event === "1600m" &&
        distanceProfile.relief >= 24 &&
        distanceProfile.pressure < 16;

      if (
        protectedScoringDistance ||
        protectedPrimaryDistance ||
        protectedLateSixteen ||
        sprintPriority.protected ||
        throwContext.protected ||
        (points.netCall === "Keep" && row.rank <= 9)
      ) {
        continue;
      }

      if (
        row.id === strongest.id &&
        relay.pressure < 10 &&
        historicalPattern.pressure < 10 &&
        distanceProfile.pressure < 10 &&
        schedule.pressure < 10
      ) {
        continue;
      }

      const rankGap = Math.max(0, row.rank - strongest.rank);
      const workloadRelief = championshipWorkloadRelief(
        row,
        rows,
        relay,
        schedule,
      );
      const loadPressure = Math.max(0, rows.length - 1) * 8;
      const weakSeedPressure = Math.max(0, row.rank - 8) * 2.4;
      const primaryEventRelief =
        row.id === strongest.id ||
        (scorePoints(row.rank) >= scorePoints(strongest.rank) - 1 &&
          row.rank <= 5)
          ? 26
          : 0;
      const strongerEventPressure =
        row.id === strongest.id
          ? 0
          : clamp(
              (scorePoints(strongest.rank) - scorePoints(row.rank)) * 4 +
                rankGap * 2,
              5,
              24,
            );
      const protectiveProbabilityCap = protectedLateSixteen
        ? 18
        : row.event === "1600m"
          ? 18
          : distanceProfile.relief >= 18 || workloadRelief.relief >= 18
            ? 34
            : 88;
      const nearTopDistanceCap =
        distanceScratchEvents.has(row.event) && row.rank <= 12
          ? 38
          : protectiveProbabilityCap;
      const activeProbabilityCap = Math.min(
        protectiveProbabilityCap,
        nearTopDistanceCap,
        sprintPriority.cap,
        throwContext.cap,
      );
      const probability = Math.round(
        clamp(
          8 +
            loadPressure +
            weakSeedPressure +
            strongerEventPressure +
            relay.pressure +
            schedule.pressure +
            historicalPattern.pressure +
            distanceProfile.pressure -
            points.relief +
            points.pressure -
            distanceProfile.relief -
            sprintPriority.relief -
            throwContext.relief -
            workloadRelief.relief -
            primaryEventRelief,
          4,
        primaryEventRelief
            ? Math.min(34, activeProbabilityCap, points.probabilityCap)
            : Math.min(activeProbabilityCap, points.probabilityCap),
        ) / 2,
      ) * 2;

      if (probability < 20) continue;

      const intervalWidth = probability >= 60 ? 10 : 14;
      const reasonParts = Array.from(
        new Set(
          [
            row.id !== strongest.id
              ? `stronger event: ${strongest.rankLabel} in ${strongest.eventLabel}`
              : "",
            rows.length > 1 ? `${rows.length}-event individual load` : "",
            distanceProfile.note,
            workloadRelief.note,
            sprintPriority.note,
            throwContext.note,
            points.note,
            historicalPattern.note,
            relay.note,
            schedule.note,
          ].filter(Boolean),
        ),
      );

      scratchPredictions.push({
        id: `${row.id}-scratch`,
        athleteName: row.athleteName,
        school: row.school,
        gender: row.gender,
        event: row.event,
        eventLabel: row.eventLabel,
        rankLabel: row.rankLabel,
        markRaw: row.markRaw,
        scratchProbability: probability,
        confidenceIntervalLabel: `${Math.round(
          clamp(probability - intervalWidth, 1, 99),
        )}-${Math.round(clamp(probability + intervalWidth, 1, 99))}%`,
        reason: reasonParts.length
          ? reasonParts.join("; ")
          : "weaker state-entry position compared with stronger team scoring paths",
        keepValue: points.keepValue,
        scratchValue: points.scratchValue,
        netScratchCall: points.netCall,
        scratchTradeoffExplanation: `${points.netCall}: keep ${pointsLabel(
          points.keepValue,
        )}, alternate path ${pointsLabel(points.scratchValue)}. ${points.note}`,
      });
    }
  }

  return scratchPredictions.sort(
    (a, b) =>
      b.scratchProbability - a.scratchProbability ||
      a.athleteName.localeCompare(b.athleteName) ||
      a.eventLabel.localeCompare(b.eventLabel),
  );
}

function applyScratchModel(
  recommendations: LastChanceRecommendation[],
  scratchPredictions: ScratchPrediction[],
) {
  const scratchByRecommendationId = new Map(
    scratchPredictions.map((scratch) => [
      scratch.id.replace(/-scratch$/, ""),
      scratch,
    ]),
  );
  const expectedOpeningsByEvent = new Map<string, number>();

  for (const recommendation of recommendations) {
    if (recommendation.rank > TOP_LIMIT) continue;

    const scratch = scratchByRecommendationId.get(recommendation.id);
    const key = `${recommendation.gender}|${recommendation.event}`;
    expectedOpeningsByEvent.set(
      key,
      (expectedOpeningsByEvent.get(key) ?? 0) +
        (scratch?.scratchProbability ?? 0) / 100,
    );
  }

  return recommendations.map((recommendation) => {
    const scratch = scratchByRecommendationId.get(recommendation.id);
    const key = `${recommendation.gender}|${recommendation.event}`;
    const definition = getEventDefinition(recommendation.event);
    const rawEventOpenings = expectedOpeningsByEvent.get(key) ?? 0;
    // Scratch predictions are useful as a signal, but state entries rarely open
    // by many spots. Cap the boost so speculative scratches do not dominate the
    // actual mark/cutoff math.
    const eventOpenings = definition.relay ? 0 : Math.min(rawEventOpenings, 1.35);
    const ownScratch = scratch?.scratchProbability ?? 0;
    const openingsAhead =
      recommendation.rank > TOP_LIMIT
        ? eventOpenings
        : Math.max(0, eventOpenings - ownScratch / 100);
    const bubblePosition = Math.max(0, recommendation.rank - TOP_LIMIT);
    const bubbleBoost =
      recommendation.rank > TOP_LIMIT
        ? clamp((openingsAhead - (bubblePosition - 1) * 0.5) * 14, 0, 20)
        : 0;
    const ownScratchPenalty = ownScratch * (ownScratch >= 60 ? 0.45 : 0.32);
    const adjustedProbability =
      Math.round(
        clamp(
          recommendation.makeProbability + bubbleBoost - ownScratchPenalty,
          2,
          98,
        ) / 2,
      );
    const makeProbability = adjustedProbability * 2;
    const stateInterval = intervalAround(makeProbability, scratch ? 6 : 4);
    const scratchExplanation = scratch
      ? scratch.reason
      : definition.relay
        ? "Relays are treated as declared and contested in this model; no relay scratch is projected unless a coach manually removes it."
        : recommendation.rank > TOP_LIMIT && openingsAhead >= 0.25
        ? `About ${openingsAhead.toFixed(1)} modeled scratch opening${
            openingsAhead >= 1.5 ? "s" : ""
          } ahead from other top-18 scratch signals, capped for realism.`
        : "No strong scratch signal from current individual load, relay pressure, or schedule.";
    const oddsExplanation =
      recommendation.rank > TOP_LIMIT && bubbleBoost > 0
        ? `${recommendation.oddsExplanation} Scratch model adds ${openingsAhead.toFixed(
            1,
          )} modeled opening${openingsAhead >= 1.5 ? "s" : ""} ahead.`
        : scratch
          ? `${recommendation.oddsExplanation} Entry odds are reduced by scratch risk.`
          : recommendation.oddsExplanation;
    const recommendationText = scratch
      ? `Scratch watch: ${scratch.reason}. ${recommendation.recommendation}`
      : recommendation.rank > TOP_LIMIT && bubbleBoost > 0
        ? `Scratch path exists: projected scratches ahead could open a state spot. ${recommendation.recommendation}`
        : recommendation.recommendation;
    const keepValue = scratch?.keepValue ?? recommendation.keepValue;
    const scratchValue = scratch?.scratchValue ?? recommendation.scratchValue;
    const netScratchCall = scratch?.netScratchCall ?? recommendation.netScratchCall;
    const scratchTradeoffExplanation =
      scratch?.scratchTradeoffExplanation ??
      recommendation.scratchTradeoffExplanation;

    const priorityContextBoost = priorityContextAdjustment(recommendation);

    return {
      ...recommendation,
      stateProbability: makeProbability,
      stateProbabilityLabel: `${makeProbability}%`,
      stateConfidenceIntervalLabel: stateInterval,
      makeProbability,
      probabilityLabel: `${makeProbability}%`,
      confidenceIntervalLabel: stateInterval,
      scratchProbability: ownScratch,
      scratchProbabilityLabel: ownScratch ? `${ownScratch}%` : "0%",
      scratchConfidenceIntervalLabel:
        scratch?.confidenceIntervalLabel ?? (definition.relay ? "0-2%" : "0-8%"),
      scratchRiskLabel: scratch ? scratchRiskLabel(ownScratch) : "Very low",
      scratchExplanation,
      keepValue,
      keepValueLabel: pointsLabel(keepValue),
      scratchValue,
      scratchValueLabel: pointsLabel(scratchValue),
      netScratchCall,
      scratchTradeoffExplanation,
      expectedScratchOpenings: openingsAhead,
      oddsBandLabel: oddsBandLabel(makeProbability),
      oddsExplanation,
      recommendation: recommendationText,
      priorityScore:
        recommendation.priorityScore +
        bubbleBoost * 3 +
        ownScratch * 0.8 +
        priorityContextBoost,
    };
  });
}

function priorityContextAdjustment(recommendation: LastChanceRecommendation) {
  const definition = getEventDefinition(recommendation.event);

  if (definition.relay) return 0;

  let adjustment = 0;
  const senior = recommendation.grade === 12;
  const isDistance = definition.discipline === "distance";

  if (senior && recommendation.rank > TOP_LIMIT) {
    adjustment += 24;
  }

  if (senior && recommendation.rank <= TOP_LIMIT && recommendation.stateProbability < 88) {
    adjustment += 18;
  }

  if (
    senior &&
    recommendation.rank > TOP_LIMIT &&
    recommendation.improveProbability >= 68 &&
    recommendation.holdProbability <= 20
  ) {
    adjustment += 52;
  }

  if (senior && isDistance && recommendation.improveProbability >= 60) {
    adjustment += 14;
  }

  return adjustment;
}

export function buildLastChanceDashboard(
  performances: Performance[],
  classification: Classification = "4A",
  focusTeam: string = TEAM_DEFAULT,
): LastChanceDashboard {
  const predictions: CutoffPrediction[] = [];
  const recommendations: LastChanceRecommendation[] = [];

  for (const definition of eventDefinitions) {
    for (const gender of definition.genders) {
      const ranking = getSeasonBestRankings(performances, {
        classification,
        event: definition.event,
        gender,
        bubbleLimit: 32,
      });
      const prediction = buildCutoffPrediction(ranking);

      if (!prediction) {
        continue;
      }

      predictions.push(prediction);
      recommendations.push(
        ...buildRecommendationsForRanking(ranking, prediction, focusTeam),
      );
    }
  }
  const distanceProfiles = buildDistanceProfiles(
    performances,
    classification,
  );
  const recommendationsWithRangeProfile = applyCrossEventPotential(
    recommendations,
    distanceProfiles,
    predictions,
  );
  const scratchPredictions = buildScratchPredictions(
    recommendationsWithRangeProfile,
    classification,
  );
  const adjustedRecommendations = applyScratchModel(
    recommendationsWithRangeProfile,
    scratchPredictions,
  );

  return {
    focusTeam,
    predictions,
    recommendations: adjustedRecommendations.sort((a, b) => {
      const priority = b.priorityScore - a.priorityScore;
      if (priority !== 0) return priority;
      return a.eventLabel.localeCompare(b.eventLabel);
    }),
    scratchPredictions,
  };
}

export function buildEventRecommendations(
  ranking: RankingResult,
  focusTeam: string = TEAM_DEFAULT,
): { prediction?: CutoffPrediction; recommendations: LastChanceRecommendation[] } {
  const prediction = buildCutoffPrediction(ranking);

  return {
    prediction,
    recommendations: prediction
      ? buildRecommendationsForRanking(ranking, prediction, focusTeam)
      : [],
  };
}

function sameRankingEntity(a: Performance, b: Performance) {
  const definition = getEventDefinition(a.event);

  if (definition.relay) {
    return a.school === b.school && a.event === b.event && a.gender === b.gender;
  }

  return (
    a.athleteName === b.athleteName &&
    a.school === b.school &&
    a.event === b.event &&
    a.gender === b.gender
  );
}

export function buildPuebloMeetMarks(
  performances: Performance[],
  ranking: RankingResult,
): PuebloMeetMarkRow[] {
  const scoped = applyClassifications(performances).filter(
    (performance) =>
      performance.meetName === PUEBLO_TWILIGHT &&
      performance.event === ranking.event &&
      performance.gender === ranking.gender &&
      performance.classification === ranking.classification,
  );
  const rankedRows = [...ranking.top18, ...ranking.bubble];

  return scoped
    .sort((a, b) => comparePerformanceMarks(ranking.event, a.markValue, b.markValue))
    .map((performance) => {
      const exactRank = rankedRows.find((row) => row.id === performance.id);
      const seasonBest = rankedRows.find((row) => sameRankingEntity(row, performance));

      return {
        id: performance.id,
        athleteName: performance.athleteName,
        school: performance.school,
        rankLabel: exactRank ? rankLabel(exactRank) : undefined,
        markRaw: performance.markRaw,
        meetDate: performance.meetDate,
        verificationStatus: performance.verificationStatus,
        isSeasonBest: Boolean(exactRank) && isRankingEligible(performance),
        notes:
          seasonBest && !exactRank
            ? `Season best is ${seasonBest.markRaw} from ${seasonBest.meetName}.`
            : undefined,
      };
    });
}
