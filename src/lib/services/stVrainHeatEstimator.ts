import type { EventKey, Gender } from "@/types/domain";
import { getEventDefinition } from "@/lib/data/events";
import type {
  CutoffPrediction,
  LastChanceRecommendation,
} from "@/lib/services/lastChance";
import type {
  FinalizedHokaEntry,
  WeekendMeetEventForecast,
  WeekendMeetEventForecastEntry,
} from "@/lib/services/weekendStrategy";
import {
  formatPerformanceGap,
  parsePerformanceMark,
} from "@/lib/utils/time";

const HOKA_MEET_ID = 71954;
const FIREBASE_EVENT_SUMMARY_URL =
  "https://trackmeet-io.firebaseio.com/meet_71954/event_summary.json";
const ATHLETIC_LIVE_BLOB_ROOT =
  "https://athleticlive.blob.core.windows.net/$web";
const LIVE_FETCH_OPTIONS = {
  next: { revalidate: 180 },
} as RequestInit & { next: { revalidate: number } };

type TrackEventCategory = "Individual" | "Relay";

interface RawEventSummary {
  i?: number;
  ec?: TrackEventCategory;
  gl?: string;
  n?: string;
  ab?: string;
  sd?: string;
  sso?: number;
}

interface RawAthleteTeam {
  f?: string;
  n?: string;
}

interface RawAthlete {
  n?: string;
  y?: string;
  t?: RawAthleteTeam;
}

interface RawIndividualEntry {
  i?: number;
  p?: string;
  s?: string;
  pr?: string;
  er?: string;
  alt?: boolean;
  a?: RawAthlete;
}

interface RawRelayMember {
  to?: number;
  a?: RawAthlete;
}

interface RawRelayEntry {
  i?: number;
  p?: string;
  s?: string;
  er?: string;
  alt?: boolean;
  rm?: RawRelayMember[];
  t?: RawAthleteTeam;
}

interface AthleticLiveDoc<T> {
  _source?: T;
}

interface IndividualEntriesSource extends RawEventSummary {
  en?: RawIndividualEntry[];
  ua?: string;
}

interface RelayEntriesSource extends RawEventSummary {
  rns?: RawRelayEntry[];
  ua?: string;
}

interface HokaHeatPattern {
  heats: number;
  fastSections?: number;
  label: string;
}

interface NormalizedEntry {
  id: string;
  athleteOrRelay: string;
  school: string;
  seedMarkRaw: string;
  seedRank: number;
  relayMembers: string[];
}

export interface StVrainHeatRacePlan {
  id: string;
  athleteOrRelay: string;
  school: string;
  seedRank: number;
  seedMarkRaw: string;
  projectedHeatLabel: string;
  stateSignalLabel: string;
  raceInstruction: string;
  isFocusTeam: boolean;
  isFastSection: boolean;
  stateMarkOpportunity?: StVrainStateMarkOpportunity;
}

export interface StVrainEstimatedHeatEntry {
  id: string;
  athleteOrRelay: string;
  school: string;
  seedRank: number;
  seedMarkRaw: string;
  relayMembers: string[];
  stateMarkOpportunity?: StVrainStateMarkOpportunity;
}

export interface StVrainEstimatedHeat {
  id: string;
  label: string;
  rankRangeLabel: string;
  seedRangeLabel: string;
  entryCount: number;
  isFastSection: boolean;
  entries: StVrainEstimatedHeatEntry[];
}

export interface StVrainHeatWatchTarget {
  id: string;
  athleteOrRelay: string;
  school: string;
  seedRank: number;
  seedMarkRaw: string;
}

export interface StVrainTeamHeatWatch {
  id: string;
  athleteOrRelay: string;
  school: string;
  seedRank: number;
  seedMarkRaw: string;
  projectedHeatLabel: string;
  heatRankRangeLabel: string;
  heatOddsLabel: string;
  heatOddsTone: "green" | "amber" | "rose" | "slate";
  summary: string;
  sameHeatAhead: StVrainHeatWatchTarget[];
  sameHeatChasers: StVrainHeatWatchTarget[];
  fasterHeatTargets: StVrainHeatWatchTarget[];
  fastCutoffContext: string;
  stateSignalLabel: string;
  stateMarkOpportunity?: StVrainStateMarkOpportunity;
}

export interface StVrainStateMarkOpportunity {
  id: string;
  liveEntryId: string;
  athleteOrRelay: string;
  school: string;
  seedRank: number;
  seedMarkRaw: string;
  event: EventKey;
  gender: Gender;
  targetMarkRaw: string;
  currentMarkRaw: string;
  currentRankLabel?: string;
  neededImprovementLabel: string;
  heatAdjustedChance: number;
  heatAdjustedChanceLabel: string;
  baseChanceLabel: string;
  heatAdjustmentLabel: string;
  profileLabel: string;
  chanceTone: "green" | "amber" | "rose" | "slate";
  reason: string;
  projectedHeatLabel: string;
  heatRankRangeLabel: string;
  sectionNoun: "heat" | "flight";
  isRelay: boolean;
  isFocusTeam: boolean;
}

export interface StVrainEventStoryline {
  id: string;
  title: string;
  body: string;
  tone: "green" | "amber" | "rose" | "slate" | "sky";
}

export interface StVrainHeatEstimate {
  id: string;
  gender: Gender;
  event: EventKey;
  eventLabel: string;
  startLabel: string;
  entryCount: number;
  heatCount: number;
  heatPatternLabel: string;
  heatSizeLabel: string;
  fastSectionLimit: number;
  fastSectionLabel: string;
  fastCutoffLabel: string;
  fastCutoffName?: string;
  fastestSeedLabel?: string;
  heatConfidenceLabel: string;
  historicalBasisLabel: string;
  forecastSummary?: string;
  updatedAtLabel?: string;
  racePlans: StVrainHeatRacePlan[];
  estimatedHeats: StVrainEstimatedHeat[];
  teamHeatWatches: StVrainTeamHeatWatch[];
  stateMarkOpportunities: StVrainStateMarkOpportunity[];
  storylines: StVrainEventStoryline[];
  sectionNoun: "heat" | "flight";
  sectionNounPlural: "heats" | "flights";
}

const hokaHeatPatterns: Record<string, HokaHeatPattern> = {
  "Girls|3200m": { heats: 2, label: "2 seeded 3200 sections" },
  "Boys|3200m": { heats: 3, label: "3 seeded 3200 sections" },
  "Girls|4x200m Relay": { heats: 6, label: "6 relay heats" },
  "Boys|4x200m Relay": { heats: 6, label: "6 relay heats" },
  "Girls|100m Hurdles": { heats: 10, label: "10 hurdle heats" },
  "Boys|110m Hurdles": { heats: 10, label: "10 hurdle heats" },
  "Girls|4x800m Relay": { heats: 2, label: "2 relay heats" },
  "Boys|4x800m Relay": { heats: 2, label: "2 relay heats" },
  "Girls|100m": { heats: 16, label: "16 sprint heats" },
  "Boys|100m": { heats: 17, label: "17 sprint heats" },
  "Girls|400m": { heats: 10, label: "10 sprint heats" },
  "Boys|400m": { heats: 11, label: "11 sprint heats" },
  "Girls|800m": { heats: 6, label: "6 seeded 800 sections" },
  "Boys|800m": { heats: 6, label: "6 seeded 800 sections" },
  "Girls|300m Hurdles": { heats: 12, label: "12 hurdle heats" },
  "Boys|300m Hurdles": { heats: 12, label: "12 hurdle heats" },
  "Girls|4x100m Relay": { heats: 6, label: "6 relay heats" },
  "Boys|4x100m Relay": { heats: 6, label: "6 relay heats" },
  "Girls|200m": { heats: 14, label: "14 sprint heats" },
  "Boys|200m": { heats: 14, label: "14 sprint heats" },
  "Girls|4x400m Relay": { heats: 3, label: "3 relay heats" },
  "Boys|4x400m Relay": { heats: 5, label: "5 relay heats" },
  "Boys|High Jump": { heats: 2, label: "2 estimated high jump flights" },
  "Girls|High Jump": { heats: 2, label: "2 estimated high jump flights" },
  "Boys|Long Jump": { heats: 3, label: "3 estimated long jump flights" },
  "Girls|Long Jump": { heats: 3, label: "3 estimated long jump flights" },
  "Boys|Triple Jump": { heats: 3, label: "3 estimated triple jump flights" },
  "Girls|Triple Jump": { heats: 3, label: "3 estimated triple jump flights" },
  "Boys|Pole Vault": { heats: 2, label: "2 estimated pole vault flights" },
  "Girls|Pole Vault": { heats: 2, label: "2 estimated pole vault flights" },
  "Boys|Shot Put": { heats: 3, label: "3 estimated shot put flights" },
  "Girls|Shot Put": { heats: 3, label: "3 estimated shot put flights" },
  "Boys|Discus": { heats: 3, label: "3 estimated discus flights" },
  "Girls|Discus": { heats: 3, label: "3 estimated discus flights" },
  "Girls|1600m": {
    heats: 7,
    fastSections: 2,
    label: "5 regular heats plus 2 elite sections",
  },
  "Boys|1600m": {
    heats: 7,
    fastSections: 2,
    label: "5 regular heats plus 2 elite sections",
  },
};

const eventDisplayName: Partial<Record<EventKey, string>> = {
  "100m": "100m Dash",
  "200m": "200m Dash",
  "400m": "400m Dash",
  "800m": "800m Run",
  "1600m": "1600m Run",
  "3200m": "3200m Run",
  "100m Hurdles": "100m Hurdles",
  "110m Hurdles": "110m Hurdles",
  "300m Hurdles": "300m Hurdles",
  "4x100m Relay": "4x100m Relay",
  "4x200m Relay": "4x200m Relay",
  "4x400m Relay": "4x400m Relay",
  "4x800m Relay": "4x800m Relay",
  "High Jump": "High Jump",
  "Long Jump": "Long Jump",
  "Triple Jump": "Triple Jump",
  "Pole Vault": "Pole Vault",
  "Shot Put": "Shot Put",
  Discus: "Discus",
};

const historicalHeatCounts: Record<string, Record<number, number>> = {
  "Girls|3200m": { 2021: 2, 2022: 1, 2023: 2, 2024: 2, 2025: 2 },
  "Boys|3200m": { 2021: 2, 2022: 1, 2023: 2, 2024: 2, 2025: 3 },
  "Girls|4x200m Relay": { 2021: 3, 2022: 4, 2023: 5, 2024: 4, 2025: 6 },
  "Boys|4x200m Relay": { 2021: 4, 2022: 6, 2023: 6, 2024: 5, 2025: 6 },
  "Girls|100m Hurdles": { 2021: 8, 2022: 11, 2023: 11, 2024: 10, 2025: 10 },
  "Boys|110m Hurdles": { 2021: 8, 2022: 12, 2023: 11, 2024: 9, 2025: 10 },
  "Girls|4x800m Relay": { 2021: 1, 2022: 2, 2023: 2, 2024: 2, 2025: 2 },
  "Boys|4x800m Relay": { 2021: 1, 2022: 2, 2023: 2, 2024: 2, 2025: 2 },
  "Girls|100m": { 2021: 12, 2022: 11, 2023: 13, 2024: 13, 2025: 16 },
  "Boys|100m": { 2021: 13, 2022: 12, 2023: 13, 2024: 15, 2025: 17 },
  "Girls|400m": { 2021: 6, 2022: 9, 2023: 11, 2024: 7, 2025: 10 },
  "Boys|400m": { 2021: 11, 2022: 9, 2023: 10, 2024: 12, 2025: 11 },
  "Girls|800m": { 2021: 4, 2022: 4, 2023: 5, 2024: 6, 2025: 6 },
  "Boys|800m": { 2021: 6, 2022: 7, 2023: 6, 2024: 6, 2025: 6 },
  "Girls|300m Hurdles": { 2021: 7, 2022: 11, 2023: 12, 2024: 10, 2025: 12 },
  "Boys|300m Hurdles": { 2021: 8, 2022: 13, 2023: 13, 2024: 11, 2025: 12 },
  "Girls|4x100m Relay": { 2021: 5, 2022: 6, 2023: 5, 2024: 5, 2025: 6 },
  "Boys|4x100m Relay": { 2021: 4, 2022: 6, 2023: 6, 2024: 5, 2025: 6 },
  "Girls|200m": { 2021: 9, 2022: 11, 2023: 10, 2024: 12, 2025: 14 },
  "Boys|200m": { 2021: 10, 2022: 11, 2023: 10, 2024: 15, 2025: 14 },
  "Girls|1600m": { 2021: 4, 2022: 4, 2023: 5, 2024: 6, 2025: 7 },
  "Boys|1600m": { 2021: 6, 2022: 6, 2023: 6, 2024: 7, 2025: 7 },
  "Girls|4x400m Relay": { 2021: 4, 2022: 5, 2023: 5, 2024: 3, 2025: 3 },
  "Boys|4x400m Relay": { 2021: 3, 2022: 5, 2023: 7, 2024: 5, 2025: 5 },
};

const practicalHeatCaps: Partial<Record<EventKey, number>> = {
  "100m": 8,
  "200m": 8,
  "400m": 8,
  "800m": 20,
  "1600m": 22,
  "3200m": 30,
  "100m Hurdles": 8,
  "110m Hurdles": 8,
  "300m Hurdles": 8,
  "4x100m Relay": 8,
  "4x200m Relay": 8,
  "4x400m Relay": 8,
  "4x800m Relay": 20,
  "High Jump": 30,
  "Pole Vault": 30,
  "Long Jump": 24,
  "Triple Jump": 24,
  "Shot Put": 24,
  "Discus": 24,
};

function projectedHeatCount({
  entryCount,
  event,
  scheduledHeats,
}: {
  entryCount: number;
  event: EventKey;
  scheduledHeats: number;
}) {
  const cap = practicalHeatCaps[event];
  if (!cap || entryCount <= 0) return scheduledHeats;

  return Math.max(scheduledHeats, Math.ceil(entryCount / cap));
}

function historicalHeatBasis({
  gender,
  event,
  heatCount,
  scheduledHeats,
  entryCount,
}: {
  gender: Gender;
  event: EventKey;
  heatCount: number;
  scheduledHeats: number;
  entryCount: number;
}) {
  const yearlyCounts = historicalHeatCounts[eventPatternKey(gender, event)];
  if (!yearlyCounts) {
    return {
      heatConfidenceLabel: "Schedule-confirmed heat count",
      historicalBasisLabel:
        "No five-year St. Vrain history stored yet; using the 2026 HOKA schedule and live entries.",
    };
  }

  const values = Object.values(yearlyCounts);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const latest = yearlyCounts[2025];
  const schedulePerHeat = Math.ceil(entryCount / Math.max(1, scheduledHeats));
  const matchesLatest = latest === heatCount;
  const inHistoricalRange = heatCount >= min && heatCount <= max;
  const basis = `2021-25 St. Vrain range ${min}-${max} heats; 2025 used ${latest}; 2026 schedule lists ${scheduledHeats}.`;

  if (heatCount > scheduledHeats) {
    return {
      heatConfidenceLabel: `Entry-load model: ${heatCount} heats is more realistic than ${scheduledHeats}`,
      historicalBasisLabel: `${basis} With ${entryCount} live entries, the schedule split would be about ${schedulePerHeat} per heat, so the model uses ${heatCount} for coach planning.`,
    };
  }

  if (matchesLatest) {
    return {
      heatConfidenceLabel: "Very high: matches 2025 and the 2026 schedule",
      historicalBasisLabel: basis,
    };
  }

  if (inHistoricalRange) {
    return {
      heatConfidenceLabel: "High: inside the five-year St. Vrain range",
      historicalBasisLabel: basis,
    };
  }

  return {
    heatConfidenceLabel:
      "Medium-high: 2026 schedule confirmed, but above the prior five-year range",
    historicalBasisLabel: basis,
  };
}

function eventKeyFromAbbreviation(abbreviation?: string): EventKey | undefined {
  const normalized = abbreviation?.replace(/R$/, " Relay");
  const map: Record<string, EventKey> = {
    "100m": "100m",
    "200m": "200m",
    "400m": "400m",
    "800m": "800m",
    "1600m": "1600m",
    "3200m": "3200m",
    "100mH": "100m Hurdles",
    "110mH": "110m Hurdles",
    "300mH": "300m Hurdles",
    "4x100m Relay": "4x100m Relay",
    "4x200m Relay": "4x200m Relay",
    "4x400m Relay": "4x400m Relay",
    "4x800m Relay": "4x800m Relay",
    HJ: "High Jump",
    LJ: "Long Jump",
    TJ: "Triple Jump",
    PV: "Pole Vault",
    SP: "Shot Put",
    DT: "Discus",
  };

  return normalized ? map[normalized] : undefined;
}

function genderFromRaw(raw?: string): Gender | undefined {
  if (raw === "Boys" || raw === "Girls") return raw as Gender;
  return undefined;
}

function eventPatternKey(gender: Gender, event: EventKey) {
  return `${gender}|${event}`;
}

function sectionNounFor(event: EventKey): Pick<
  StVrainHeatEstimate,
  "sectionNoun" | "sectionNounPlural"
> {
  const discipline = getEventDefinition(event).discipline;

  return discipline === "jump" || discipline === "throw"
    ? { sectionNoun: "flight", sectionNounPlural: "flights" }
    : { sectionNoun: "heat", sectionNounPlural: "heats" };
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\(co\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function signalKey(
  gender: Gender,
  event: EventKey,
  athleteOrRelay: string,
  school: string,
) {
  return [
    gender,
    event,
    normalize(athleteOrRelay.replace(/\s+Relay$/i, "")),
    normalize(school),
  ].join("|");
}

function forecastSignals(forecasts: WeekendMeetEventForecast[]) {
  const signals = new Map<string, WeekendMeetEventForecastEntry>();

  for (const forecast of forecasts) {
    for (const entry of forecast.entries) {
      signals.set(
        signalKey(
          forecast.gender,
          forecast.event,
          entry.athleteOrRelay,
          entry.school,
        ),
        entry,
      );
    }
  }

  return signals;
}

function recommendationSignals(recommendations: LastChanceRecommendation[]) {
  const signals = new Map<string, LastChanceRecommendation>();

  for (const recommendation of recommendations) {
    signals.set(
      signalKey(
        recommendation.gender,
        recommendation.event,
        recommendation.athleteName,
        recommendation.school,
      ),
      recommendation,
    );
  }

  return signals;
}

function profileKey(gender: Gender, athleteOrRelay: string, school: string) {
  return [gender, normalize(athleteOrRelay), normalize(school)].join("|");
}

function athleteProfiles(recommendations: LastChanceRecommendation[]) {
  const profiles = new Map<string, LastChanceRecommendation[]>();

  for (const recommendation of recommendations) {
    if (getEventDefinition(recommendation.event).relay) continue;
    const key = profileKey(
      recommendation.gender,
      recommendation.athleteName,
      recommendation.school,
    );
    profiles.set(key, [...(profiles.get(key) ?? []), recommendation]);
  }

  return profiles;
}

function predictionSignals(predictions: CutoffPrediction[]) {
  return new Map(
    predictions.map((prediction) => [
      eventPatternKey(prediction.gender, prediction.event),
      prediction,
    ]),
  );
}

const relatedProfileEvents: Partial<Record<EventKey, EventKey[]>> = {
  "100m": ["200m", "400m", "100m Hurdles", "110m Hurdles"],
  "200m": ["100m", "400m", "300m Hurdles"],
  "400m": ["200m", "800m", "300m Hurdles"],
  "800m": ["400m", "1600m", "3200m"],
  "1600m": ["800m", "3200m"],
  "3200m": ["1600m", "800m"],
  "100m Hurdles": ["100m", "300m Hurdles", "Long Jump"],
  "110m Hurdles": ["100m", "300m Hurdles", "Long Jump"],
  "300m Hurdles": ["400m", "200m", "100m Hurdles", "110m Hurdles"],
  "High Jump": ["Long Jump", "Triple Jump"],
  "Pole Vault": ["High Jump", "Long Jump"],
  "Long Jump": ["Triple Jump", "100m", "200m", "High Jump"],
  "Triple Jump": ["Long Jump", "High Jump"],
  "Shot Put": ["Discus"],
  Discus: ["Shot Put"],
};

function profileAdjustmentFor(
  event: EventKey,
  row: LastChanceRecommendation | undefined,
  profileRows: LastChanceRecommendation[],
) {
  const definition = getEventDefinition(event);
  const related = profileRows.filter((profile) =>
    (relatedProfileEvents[event] ?? []).includes(profile.event),
  );

  if (definition.relay) {
    return {
      adjustment: 0,
      label: "Relay depth read",
      reason:
        "Relay chance is based on the relay seed and repeatability, not an individual scratch opening.",
    };
  }

  if (!related.length) {
    return {
      adjustment: row ? 0 : -4,
      label: "Limited profile",
      reason:
        "No strong related-event profile is loaded, so this is mostly a seed-and-heat read.",
    };
  }

  const strongest = [...related].sort(
    (a, b) =>
      b.stateProbability +
      b.improveProbability * 0.35 -
      (a.stateProbability + a.improveProbability * 0.35),
  )[0];
  const strongState = related.some(
    (profile) => profile.rank <= 18 || profile.stateProbability >= 70,
  );
  const strongUpside = related.some(
    (profile) => profile.improveProbability >= 60 || profile.stateProbability >= 55,
  );
  const distanceSpecific =
    definition.discipline === "distance" &&
    ((event === "3200m" &&
      related.some(
        (profile) =>
          profile.event === "1600m" &&
          (profile.stateProbability >= 45 || profile.improveProbability >= 58),
      )) ||
      (event === "800m" &&
        related.some(
          (profile) =>
            profile.event === "1600m" &&
            (profile.stateProbability >= 55 || profile.improveProbability >= 58),
        )));
  const adjustment = strongState
    ? 10
    : distanceSpecific
      ? 8
      : strongUpside
        ? 6
        : 2;

  return {
    adjustment,
    label: strongest
      ? `${strongest.eventLabel.replace(/^(Boys|Girls)\s+/, "")} profile`
      : "Related-event profile",
    reason: strongest
      ? `${strongest.eventLabel.replace(/^(Boys|Girls)\s+/, "")}: ${strongest.rankLabel}, ${strongest.markRaw}, ${strongest.stateProbabilityLabel} state / ${strongest.improveProbabilityLabel} improve supports this read.`
      : "Related-event marks give a small profile boost.",
  };
}

function chanceTone(chance: number): StVrainStateMarkOpportunity["chanceTone"] {
  if (chance >= 72) return "green";
  if (chance >= 46) return "amber";
  if (chance >= 24) return "rose";
  return "slate";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundChance(value: number) {
  return Math.round(clamp(value, 2, 98) / 2) * 2;
}

function currentMarkMeetsTarget({
  event,
  currentValue,
  targetValue,
}: {
  event: EventKey;
  currentValue: number;
  targetValue: number;
}) {
  const definition = getEventDefinition(event);
  return definition.sortDirection === "asc"
    ? currentValue <= targetValue
    : currentValue >= targetValue;
}

function improvementGap({
  event,
  currentValue,
  targetValue,
}: {
  event: EventKey;
  currentValue: number;
  targetValue: number;
}) {
  const definition = getEventDefinition(event);
  return definition.sortDirection === "asc"
    ? currentValue - targetValue
    : targetValue - currentValue;
}

function strikeWindowFor(event: EventKey) {
  const windows: Record<EventKey, number> = {
    "100m": 0.18,
    "200m": 0.42,
    "400m": 0.95,
    "800m": 2.25,
    "1600m": 7,
    "3200m": 18,
    "100m Hurdles": 0.55,
    "110m Hurdles": 0.55,
    "300m Hurdles": 1.35,
    "4x100m Relay": 0.65,
    "4x200m Relay": 1.8,
    "4x400m Relay": 4,
    "4x800m Relay": 10,
    "High Jump": 3,
    "Pole Vault": 9,
    "Long Jump": 10,
    "Triple Jump": 14,
    "Shot Put": 36,
    Discus: 96,
  };

  return windows[event];
}

function baseChanceFor({
  event,
  gap,
  meetsTarget,
  recommendation,
}: {
  event: EventKey;
  gap: number;
  meetsTarget: boolean;
  recommendation?: LastChanceRecommendation;
}) {
  const definition = getEventDefinition(event);

  if (recommendation) {
    if (definition.relay) {
      return meetsTarget
        ? clamp(
            58 +
              recommendation.holdProbability * 0.24 +
              recommendation.stateProbability * 0.12,
            48,
            92,
          )
        : clamp(
            34 +
              recommendation.improveProbability * 0.42 +
              recommendation.stateProbability * 0.18,
            14,
            84,
          );
    }

    return meetsTarget
      ? clamp(
          70 +
            recommendation.holdProbability * 0.18 +
            recommendation.stateProbability * 0.08,
          58,
          96,
        )
      : clamp(
          10 +
            recommendation.improveProbability * 0.72 +
            recommendation.stateProbability * 0.22,
          4,
          90,
        );
  }

  if (meetsTarget) return 78;

  const window = strikeWindowFor(event);
  return clamp(50 - (gap / Math.max(window, 0.01)) * 34, 4, 58);
}

function heatAdjustmentFor({
  event,
  category,
  heat,
  heatIndex,
  heatCount,
  sameHeatAhead,
  fasterHeatTargets,
  meetsTarget,
}: {
  event: EventKey;
  category: TrackEventCategory;
  heat: StVrainEstimatedHeat;
  heatIndex: number;
  heatCount: number;
  sameHeatAhead: StVrainHeatWatchTarget[];
  fasterHeatTargets: StVrainHeatWatchTarget[];
  meetsTarget: boolean;
}) {
  const definition = getEventDefinition(event);
  const sectionNoun = sectionNounFor(event).sectionNoun;
  let adjustment = 0;
  const reasons: string[] = [];

  if (definition.discipline === "jump" || definition.discipline === "throw") {
    adjustment += heat.isFastSection ? 4 : heatIndex >= heatCount - 2 ? 1 : -3;
    reasons.push(
      heat.isFastSection
        ? "top flight gives state-level comparison"
        : "field-event seed flight matters less than execution",
    );
  } else if (category === "Relay") {
    adjustment += heat.isFastSection ? 6 : heatIndex >= heatCount - 2 ? 2 : -5;
    reasons.push(
      heat.isFastSection
        ? "fast relay heat helps repeatability"
        : "relay needs a cleaner time-trial setup",
    );
  } else if (heat.isFastSection) {
    adjustment += definition.discipline === "distance" ? 12 : 10;
    reasons.push("fast heat gives direct state-mark race pressure");
  } else if (heatIndex >= heatCount - 2) {
    adjustment += meetsTarget ? 0 : 4;
    reasons.push("near-fast heat can work if they win it decisively");
  } else {
    adjustment -= definition.discipline === "distance" ? 10 : 8;
    reasons.push("lower heat creates a time-trial penalty");
  }

  if (sameHeatAhead.length) {
    adjustment += 2;
    reasons.push("same-heat targets are close enough to chase");
  }

  if (!heat.isFastSection && fasterHeatTargets.length >= 4) {
    adjustment -= 3;
    reasons.push("several faster-heat athletes still sit ahead");
  }

  return {
    adjustment,
    label: `${adjustment >= 0 ? "+" : ""}${adjustment} ${sectionNoun}`,
    reason: reasons.join("; "),
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, LIVE_FETCH_OPTIONS);
  if (!response.ok) {
    throw new Error(`Unable to load ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
}

function eventEntriesUrl(category: TrackEventCategory, id: number) {
  const collection = category === "Relay" ? "rel_ent_list" : "ind_ent_list";
  return `${ATHLETIC_LIVE_BLOB_ROOT}/${collection}/_doc/${id}`;
}

function heatSizesSlowToFast(entryCount: number, heatCount: number) {
  if (entryCount <= 0 || heatCount <= 0) return [];

  const base = Math.floor(entryCount / heatCount);
  const remainder = entryCount % heatCount;
  const sizes = Array.from({ length: heatCount }, () => base);

  for (let index = 0; index < remainder; index += 1) {
    sizes[heatCount - 1 - index] += 1;
  }

  return sizes;
}

function projectedHeatForRank(
  rank: number,
  heatSizes: number[],
  fastSections: number,
) {
  let cumulative = 0;

  for (let fastIndex = 0; fastIndex < heatSizes.length; fastIndex += 1) {
    const heatNumber = heatSizes.length - fastIndex;
    const heatSize = heatSizes[heatNumber - 1] ?? 0;
    cumulative += heatSize;

    if (rank <= cumulative) {
      if (fastIndex < fastSections) {
        return fastSections > 1
          ? `Elite/fast section ${fastIndex + 1} of ${fastSections}`
          : `Fast heat ${heatNumber}`;
      }

      return `Heat ${heatNumber} of ${heatSizes.length}`;
    }
  }

  return `Heat ${heatSizes.length}`;
}

function buildEstimatedHeats({
  category,
  entries,
  gender,
  event,
  heatSizes,
  fastSections,
}: {
  category: TrackEventCategory;
  entries: NormalizedEntry[];
  gender: Gender;
  event: EventKey;
  heatSizes: number[];
  fastSections: number;
}): StVrainEstimatedHeat[] {
  const fastestToSlowest: StVrainEstimatedHeat[] = [];
  let startIndex = 0;

  for (let heatIndex = heatSizes.length - 1; heatIndex >= 0; heatIndex -= 1) {
    const heatNumber = heatIndex + 1;
    const heatSize = heatSizes[heatIndex] ?? 0;
    const heatEntries = entries.slice(startIndex, startIndex + heatSize);
    startIndex += heatSize;

    const isFastSection = heatSizes.length - heatIndex <= fastSections;
    const firstEntry = heatEntries[0];
    const lastEntry = heatEntries[heatEntries.length - 1];

    fastestToSlowest.push({
      id: `${gender}-${event}-heat-${heatNumber}`,
      label: `${isFastSection ? "Fast " : ""}Heat ${heatNumber}`,
      rankRangeLabel:
        firstEntry && lastEntry
          ? `Ranks #${firstEntry.seedRank}-#${lastEntry.seedRank}`
          : "No entries",
      seedRangeLabel:
        firstEntry && lastEntry
          ? `${firstEntry.seedMarkRaw} to ${lastEntry.seedMarkRaw}`
          : "No seed range",
      entryCount: heatEntries.length,
      isFastSection,
      entries: heatEntries.map((entry) => ({
        id: `${gender}-${event}-heat-${heatNumber}-${entry.id}`,
        athleteOrRelay:
          category === "Relay"
            ? `${entry.athleteOrRelay} Relay`
            : entry.athleteOrRelay,
        school: entry.school,
        seedRank: entry.seedRank,
        seedMarkRaw: entry.seedMarkRaw,
        relayMembers: entry.relayMembers,
      })),
    });
  }

  return fastestToSlowest.reverse();
}

function entryTarget(entry: StVrainEstimatedHeatEntry): StVrainHeatWatchTarget {
  return {
    id: entry.id,
    athleteOrRelay: entry.athleteOrRelay,
    school: entry.school,
    seedRank: entry.seedRank,
    seedMarkRaw: entry.seedMarkRaw,
  };
}

function isSameEntry(
  heatEntry: StVrainEstimatedHeatEntry,
  entry: NormalizedEntry,
  category: TrackEventCategory,
) {
  const athleteOrRelay =
    category === "Relay" ? `${entry.athleteOrRelay} Relay` : entry.athleteOrRelay;

  return (
    heatEntry.seedRank === entry.seedRank &&
    normalize(heatEntry.school) === normalize(entry.school) &&
    normalize(heatEntry.athleteOrRelay) === normalize(athleteOrRelay)
  );
}

function heatWatchSummary({
  category,
  heat,
  signal,
  sameHeatAhead,
  fasterHeatTargets,
}: {
  category: TrackEventCategory;
  heat: StVrainEstimatedHeat;
  signal?: WeekendMeetEventForecastEntry;
  sameHeatAhead: StVrainHeatWatchTarget[];
  fasterHeatTargets: StVrainHeatWatchTarget[];
}) {
  if (category === "Relay") {
    return heat.isFastSection
      ? "Relay is projected in the state-race heat. Use this to check repeatability against the nearby seeded teams."
      : "Relay is outside the fastest heat estimate. A big jump is still possible, but it depends more on clean exchanges and a time trial than head-to-head racing.";
  }

  if (heat.isFastSection) {
    const targetText = sameHeatAhead.length
      ? ` Key targets ahead: ${sameHeatAhead
          .slice(-3)
          .map((target) => `${target.athleteOrRelay} #${target.seedRank}`)
          .join(", ")}.`
      : "";
    return `Direct state-race setup. If this athlete beats nearby seeds in the fast heat, the model treats it as stronger evidence than a solo time trial.${targetText}`;
  }

  if (fasterHeatTargets.length) {
    const targetText = fasterHeatTargets
      .slice(-3)
      .map((target) => `${target.athleteOrRelay} #${target.seedRank}`)
      .join(", ");
    return `Needs a time-trial race from this heat. Watch the faster heat cutoff group (${targetText}) because those are the marks this athlete must pull past.`;
  }

  if (signal) {
    return "App already sees a state-relevant chase, but this heat assignment does not add much. They need the race to turn into a clean solo effort.";
  }

  return "Useful depth-chart information, but the heat assignment does not create a clear state-qualifying path yet.";
}

function heatOddsFor({
  category,
  heat,
  heatIndex,
  heatCount,
  signal,
}: {
  category: TrackEventCategory;
  heat: StVrainEstimatedHeat;
  heatIndex: number;
  heatCount: number;
  signal?: WeekendMeetEventForecastEntry;
}): Pick<StVrainTeamHeatWatch, "heatOddsLabel" | "heatOddsTone"> {
  if (category === "Relay") {
    return heat.isFastSection
      ? { heatOddsLabel: "Repeatability read", heatOddsTone: "green" }
      : { heatOddsLabel: "Needs clean time trial", heatOddsTone: "amber" };
  }

  if (heat.isFastSection) {
    return {
      heatOddsLabel: signal ? "State-chase boost +10" : "Fast-heat boost",
      heatOddsTone: "green",
    };
  }

  if (heatIndex >= heatCount - 2) {
    return {
      heatOddsLabel: signal ? "Small boost if wins heat" : "Watch if dominates heat",
      heatOddsTone: "amber",
    };
  }

  return {
    heatOddsLabel: "Time-trial penalty",
    heatOddsTone: "rose",
  };
}

function buildStateMarkOpportunities({
  category,
  entries,
  estimatedHeats,
  focusTeam,
  recommendationMap,
  profileMap,
  prediction,
  gender,
  event,
}: {
  category: TrackEventCategory;
  entries: NormalizedEntry[];
  estimatedHeats: StVrainEstimatedHeat[];
  focusTeam: string;
  recommendationMap: Map<string, LastChanceRecommendation>;
  profileMap: Map<string, LastChanceRecommendation[]>;
  prediction?: CutoffPrediction;
  gender: Gender;
  event: EventKey;
}): StVrainStateMarkOpportunity[] {
  if (!prediction) return [];

  const targetValue = prediction.predictedCutoffValue;
  const opportunities: StVrainStateMarkOpportunity[] = [];
  const sectionNoun = sectionNounFor(event).sectionNoun;

  for (const entry of entries) {
    const recommendation = recommendationMap.get(
      signalKey(gender, event, entry.athleteOrRelay, entry.school),
    );
    const currentMarkRaw = recommendation?.markRaw ?? entry.seedMarkRaw;
    const currentValue = parsePerformanceMark(event, currentMarkRaw);
    if (currentValue === undefined) continue;

    const heatIndex = estimatedHeats.findIndex((heat) =>
      heat.entries.some((heatEntry) => isSameEntry(heatEntry, entry, category)),
    );
    const heat = estimatedHeats[heatIndex];
    if (!heat) continue;

    const heatEntryIndex = heat.entries.findIndex((heatEntry) =>
      isSameEntry(heatEntry, entry, category),
    );
    const sameHeatAhead = heat.entries
      .slice(Math.max(0, heatEntryIndex - 4), heatEntryIndex)
      .map(entryTarget);
    const nextFasterHeat = estimatedHeats[heatIndex + 1];
    const fasterHeatTargets =
      heat.isFastSection || !nextFasterHeat
        ? []
        : nextFasterHeat.entries.slice(-5).map(entryTarget);
    const meetsTarget = currentMarkMeetsTarget({
      event,
      currentValue,
      targetValue,
    });
    const gap = improvementGap({ event, currentValue, targetValue });
    const baseChance = baseChanceFor({
      event,
      gap,
      meetsTarget,
      recommendation,
    });
    const profileRows =
      category === "Relay"
        ? []
        : profileMap.get(profileKey(gender, entry.athleteOrRelay, entry.school)) ??
          [];
    const profile = profileAdjustmentFor(event, recommendation, profileRows);
    const heatAdjustment = heatAdjustmentFor({
      event,
      category,
      heat,
      heatIndex,
      heatCount: estimatedHeats.length,
      sameHeatAhead,
      fasterHeatTargets,
      meetsTarget,
    });
    const chance = roundChance(
      baseChance + profile.adjustment + heatAdjustment.adjustment,
    );
    const neededImprovementLabel = meetsTarget
      ? `${formatPerformanceGap(event, Math.abs(gap))} cushion`
      : `Needs ${formatPerformanceGap(event, gap)}`;
    const baseLabel = `${roundChance(baseChance)}% base`;

    opportunities.push({
      id: `${gender}-${event}-state-mark-${entry.id}`,
      liveEntryId: entry.id,
      athleteOrRelay:
        category === "Relay"
          ? `${entry.athleteOrRelay} Relay`
          : entry.athleteOrRelay,
      school: entry.school,
      seedRank: entry.seedRank,
      seedMarkRaw: entry.seedMarkRaw,
      event,
      gender,
      targetMarkRaw: prediction.predictedCutoffRaw,
      currentMarkRaw,
      currentRankLabel: recommendation?.rankLabel,
      neededImprovementLabel,
      heatAdjustedChance: chance,
      heatAdjustedChanceLabel: `${chance}%`,
      baseChanceLabel: baseLabel,
      heatAdjustmentLabel: heatAdjustment.label,
      profileLabel: profile.label,
      chanceTone: chanceTone(chance),
      projectedHeatLabel: heat.label,
      heatRankRangeLabel: heat.rankRangeLabel,
      sectionNoun,
      isRelay: category === "Relay",
      isFocusTeam: normalize(entry.school) === normalize(focusTeam),
      reason: `${heatAdjustment.reason}. ${profile.reason}`,
    });
  }

  return opportunities.sort(
    (a, b) =>
      b.heatAdjustedChance - a.heatAdjustedChance || a.seedRank - b.seedRank,
  );
}

function attachOpportunitiesToHeats(
  estimatedHeats: StVrainEstimatedHeat[],
  opportunities: StVrainStateMarkOpportunity[],
) {
  return estimatedHeats.map((heat) => ({
    ...heat,
    entries: heat.entries.map((entry) => ({
      ...entry,
      stateMarkOpportunity: opportunities.find(
        (opportunity) =>
          opportunity.seedRank === entry.seedRank &&
          normalize(opportunity.school) === normalize(entry.school) &&
          normalize(opportunity.athleteOrRelay) ===
            normalize(entry.athleteOrRelay),
      ),
    })),
  }));
}

function opportunityForEntry(
  opportunities: StVrainStateMarkOpportunity[],
  entry: NormalizedEntry,
  category: TrackEventCategory,
) {
  const athleteOrRelay =
    category === "Relay" ? `${entry.athleteOrRelay} Relay` : entry.athleteOrRelay;

  return opportunities.find(
    (opportunity) =>
      normalize(opportunity.athleteOrRelay) === normalize(athleteOrRelay) &&
      normalize(opportunity.school) === normalize(entry.school) &&
      opportunity.seedRank === entry.seedRank,
  );
}

function buildTeamHeatWatches({
  category,
  entries,
  estimatedHeats,
  focusTeam,
  signalMap,
  opportunities,
  gender,
  event,
  fastCutoff,
  fastSectionLimit,
}: {
  category: TrackEventCategory;
  entries: NormalizedEntry[];
  estimatedHeats: StVrainEstimatedHeat[];
  focusTeam: string;
  signalMap: Map<string, WeekendMeetEventForecastEntry>;
  opportunities: StVrainStateMarkOpportunity[];
  gender: Gender;
  event: EventKey;
  fastCutoff?: NormalizedEntry;
  fastSectionLimit: number;
}): StVrainTeamHeatWatch[] {
  return entries
    .filter((entry) => normalize(entry.school) === normalize(focusTeam))
    .flatMap((entry): StVrainTeamHeatWatch[] => {
      const heatIndex = estimatedHeats.findIndex((heat) =>
        heat.entries.some((heatEntry) => isSameEntry(heatEntry, entry, category)),
      );
      const heat = estimatedHeats[heatIndex];
      if (!heat) return [];

      const heatEntryIndex = heat.entries.findIndex((heatEntry) =>
        isSameEntry(heatEntry, entry, category),
      );
      const signal = signalMap.get(
        signalKey(gender, event, entry.athleteOrRelay, entry.school),
      );
      const stateMarkOpportunity = opportunityForEntry(
        opportunities,
        entry,
        category,
      );
      const sameHeatAhead = heat.entries
        .slice(Math.max(0, heatEntryIndex - 4), heatEntryIndex)
        .map(entryTarget);
      const sameHeatChasers = heat.entries
        .slice(heatEntryIndex + 1, heatEntryIndex + 4)
        .map(entryTarget);
      const nextFasterHeat = estimatedHeats[heatIndex + 1];
      const fasterHeatTargets =
        heat.isFastSection || !nextFasterHeat
          ? []
          : nextFasterHeat.entries.slice(-5).map(entryTarget);
      const odds = heatOddsFor({
        category,
        heat,
        heatIndex,
        heatCount: estimatedHeats.length,
        signal,
      });
      const fastCutoffContext = fastCutoff
        ? `Fast cutoff is #${fastSectionLimit} (${fastCutoff.seedMarkRaw}, ${fastCutoff.athleteOrRelay}).`
        : "Fast cutoff is not available yet.";

      return [{
        id: `${gender}-${event}-watch-${entry.id}`,
        athleteOrRelay:
          category === "Relay"
            ? `${entry.athleteOrRelay} Relay`
            : entry.athleteOrRelay,
        school: entry.school,
        seedRank: entry.seedRank,
        seedMarkRaw: entry.seedMarkRaw,
        projectedHeatLabel: heat.label,
        heatRankRangeLabel: heat.rankRangeLabel,
        heatOddsLabel: odds.heatOddsLabel,
        heatOddsTone: odds.heatOddsTone,
        summary: heatWatchSummary({
          category,
          heat,
          signal,
          sameHeatAhead,
          fasterHeatTargets,
        }),
        sameHeatAhead,
        sameHeatChasers,
        fasterHeatTargets,
        fastCutoffContext,
        stateSignalLabel: stateSignalLabel(signal),
        stateMarkOpportunity,
      }];
    })
    .sort((a, b) => {
      if (a.heatOddsTone !== b.heatOddsTone) {
        const order = { green: 0, amber: 1, rose: 2, slate: 3 };
        return order[a.heatOddsTone] - order[b.heatOddsTone];
      }
      return a.seedRank - b.seedRank;
    });
}

function formatStart(iso?: string) {
  if (!iso) return "HOKA Friday";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Denver",
  }).format(new Date(iso));
}

function sortedIndividualEntries(source: IndividualEntriesSource) {
  return (source.en ?? [])
    .filter((entry) => !entry.alt)
    .map((entry, index): NormalizedEntry => ({
      id: String(entry.i ?? `${source.i}-individual-${index}`),
      athleteOrRelay: entry.a?.n ?? "Unknown athlete",
      school: entry.a?.t?.f ?? entry.a?.t?.n ?? "Unknown school",
      seedMarkRaw: entry.s ?? entry.er ?? entry.pr ?? "No seed",
      seedRank: Number.parseInt(entry.p ?? "", 10) || index + 1,
      relayMembers: [],
    }))
    .sort((a, b) => a.seedRank - b.seedRank);
}

function sortedRelayEntries(source: RelayEntriesSource) {
  return (source.rns ?? [])
    .filter((entry) => !entry.alt)
    .map((entry, index): NormalizedEntry => ({
      id: String(entry.i ?? `${source.i}-relay-${index}`),
      athleteOrRelay: entry.t?.f ?? entry.t?.n ?? "Unknown relay",
      school: entry.t?.f ?? entry.t?.n ?? "Unknown school",
      seedMarkRaw: entry.s ?? entry.er ?? "No seed",
      seedRank: Number.parseInt(entry.p ?? "", 10) || index + 1,
      relayMembers: (entry.rm ?? [])
        .sort((a, b) => (a.to ?? 0) - (b.to ?? 0))
        .map((member) => member.a?.n)
        .filter(Boolean) as string[],
    }))
    .sort((a, b) => a.seedRank - b.seedRank);
}

function raceInstruction({
  signal,
  isFocusTeam,
  isFastSection,
  fastSectionLabel,
  projectedHeatLabel,
}: {
  signal?: WeekendMeetEventForecastEntry;
  isFocusTeam: boolean;
  isFastSection: boolean;
  fastSectionLabel: string;
  projectedHeatLabel: string;
}) {
  if (signal) {
    const placement = isFastSection
      ? `Seeded into the ${fastSectionLabel.toLowerCase()}; the state chase can happen straight up in-race.`
      : `Not projected in the fastest section; they likely need to win ${projectedHeatLabel.toLowerCase()} by a margin, or get moved into a faster section.`;
    return `${signal.reason} ${placement}`;
  }

  if (isFocusTeam) {
    return isFastSection
      ? "Selected-team entry in a fast section. Use this as a depth-chart or relay-read race unless the Top 18 board shows a state path."
      : "Selected-team entry outside the fastest section. Useful for depth and relay decisions; less likely to become a state-qualifying race without a major jump.";
  }

  return isFastSection
    ? "Fast-section entry. Use this athlete or relay as part of the projected field shape."
    : "Outside the fastest section estimate.";
}

function buildStorylines({
  category,
  focusTeam,
  fastCutoff,
  fastSectionLimit,
  opportunities,
  teamHeatWatches,
  prediction,
  sectionNoun,
}: {
  category: TrackEventCategory;
  focusTeam: string;
  fastCutoff?: NormalizedEntry;
  fastSectionLimit: number;
  opportunities: StVrainStateMarkOpportunity[];
  teamHeatWatches: StVrainTeamHeatWatch[];
  prediction?: CutoffPrediction;
  sectionNoun: "heat" | "flight";
}): StVrainEventStoryline[] {
  const stories: StVrainEventStoryline[] = [];
  const targetText = prediction?.predictedCutoffRaw
    ? `Projected state target: ${prediction.predictedCutoffRaw}.`
    : "Projected state target is not loaded yet.";

  stories.push({
    id: "fast-cutoff",
    title: `${sectionNoun === "heat" ? "Fast heat" : "Top flight"} cutoff`,
    body: fastCutoff
      ? `${fastCutoff.athleteOrRelay} at #${fastSectionLimit} (${fastCutoff.seedMarkRaw}) is the estimated ${sectionNoun} cutoff. ${targetText}`
      : `No live ${sectionNoun} cutoff is available yet. ${targetText}`,
    tone: "sky",
  });

  const stateJump = opportunities.find(
    (opportunity) =>
      !opportunity.neededImprovementLabel.includes("cushion") &&
      opportunity.heatAdjustedChance >= 34,
  );
  if (stateJump) {
    stories.push({
      id: "state-jump",
      title: "Most likely state jump",
      body: `${stateJump.athleteOrRelay} (${stateJump.school}) has a ${stateJump.heatAdjustedChanceLabel} heat-adjusted chance to hit ${stateJump.targetMarkRaw}; ${stateJump.neededImprovementLabel.toLowerCase()} from ${stateJump.currentMarkRaw}.`,
      tone: stateJump.chanceTone === "green" ? "green" : "amber",
    });
  }

  const focusOpportunities = opportunities.filter((opportunity) =>
    normalize(opportunity.school) === normalize(focusTeam),
  );
  if (focusOpportunities.length) {
    const names = focusOpportunities
      .slice(0, 3)
      .map(
        (opportunity) =>
          `${opportunity.athleteOrRelay} ${opportunity.heatAdjustedChanceLabel}`,
      )
      .join(" / ");
    stories.push({
      id: "focus-team",
      title: `${focusTeam} watch`,
      body: `${focusOpportunities.length} selected-team entr${
        focusOpportunities.length === 1 ? "y" : "ies"
      } have a state-mark read here: ${names}.`,
      tone: "green",
    });
  }

  const fasterThreat = teamHeatWatches.find(
    (watch) => watch.fasterHeatTargets.length,
  );
  if (fasterThreat) {
    stories.push({
      id: "faster-threats",
      title: "Faster-section threats",
      body: `${fasterThreat.athleteOrRelay} must compare against ${fasterThreat.fasterHeatTargets
        .slice(-3)
        .map((target) => `${target.athleteOrRelay} #${target.seedRank}`)
        .join(", ")} in the faster ${sectionNoun}.`,
      tone: "amber",
    });
  }

  if (category === "Relay") {
    const relayOpportunity = opportunities[0];
    stories.push({
      id: "relay-repeatability",
      title: "Relay repeatability",
      body: relayOpportunity
        ? `${relayOpportunity.athleteOrRelay} has a ${relayOpportunity.heatAdjustedChanceLabel} state-mark repeatability read. Relays are not treated as scratch openings here.`
        : "Relay entries are treated as repeatability calls, not projected scratch openings.",
      tone: "slate",
    });
  }

  return stories.slice(0, 5);
}

function stateSignalLabel(signal?: WeekendMeetEventForecastEntry) {
  if (!signal) return "No app state signal";
  return `${signal.callLabel} · ${signal.probabilityLabel}`;
}

function buildEstimateFromEntries({
  gender,
  event,
  category,
  eventName,
  start,
  updatedAt,
  entries,
  focusTeam,
  signalMap,
  recommendationMap,
  profileMap,
  prediction,
  forecast,
}: {
  gender: Gender;
  event: EventKey;
  category: TrackEventCategory;
  eventName?: string;
  start?: string;
  updatedAt?: string;
  entries: NormalizedEntry[];
  focusTeam: string;
  signalMap: Map<string, WeekendMeetEventForecastEntry>;
  recommendationMap: Map<string, LastChanceRecommendation>;
  profileMap: Map<string, LastChanceRecommendation[]>;
  prediction?: CutoffPrediction;
  forecast?: WeekendMeetEventForecast;
}): StVrainHeatEstimate | undefined {
  const pattern = hokaHeatPatterns[eventPatternKey(gender, event)];
  if (!pattern) return undefined;

  const scheduledHeats = Math.max(1, pattern.heats);
  const heatCount = projectedHeatCount({
    entryCount: entries.length,
    event,
    scheduledHeats,
  });
  const fastSections = Math.min(pattern.fastSections ?? 1, heatCount);
  const heatSizes = heatSizesSlowToFast(entries.length, heatCount);
  const fastSectionLimit = heatSizes
    .slice(-fastSections)
    .reduce((sum, size) => sum + size, 0);
  const baseEstimatedHeats = buildEstimatedHeats({
    category,
    entries,
    gender,
    event,
    heatSizes,
    fastSections,
  });
  const stateMarkOpportunities = buildStateMarkOpportunities({
    category,
    entries,
    estimatedHeats: baseEstimatedHeats,
    focusTeam,
    recommendationMap,
    profileMap,
    prediction,
    gender,
    event,
  });
  const estimatedHeats = attachOpportunitiesToHeats(
    baseEstimatedHeats,
    stateMarkOpportunities,
  );
  const fastCutoff = entries[fastSectionLimit - 1];
  const fastestSeed = entries[0];
  const teamHeatWatches = buildTeamHeatWatches({
    category,
    entries,
    estimatedHeats,
    focusTeam,
    signalMap,
    opportunities: stateMarkOpportunities,
    gender,
    event,
    fastCutoff,
    fastSectionLimit,
  });
  const fastSectionLabel =
    fastSections > 1 ? `top ${fastSections} fast sections` : "fastest heat";
  const sectionWords = sectionNounFor(event);
  const heatBasis = historicalHeatBasis({
    gender,
    event,
    heatCount,
    scheduledHeats,
    entryCount: entries.length,
  });

  const racePlans = entries
    .map((entry) => {
      const signal = signalMap.get(
        signalKey(gender, event, entry.athleteOrRelay, entry.school),
      );
      const isFocusTeam = normalize(entry.school) === normalize(focusTeam);
      const isFastSection = entry.seedRank <= fastSectionLimit;
      const stateMarkOpportunity = opportunityForEntry(
        stateMarkOpportunities,
        entry,
        category,
      );
      const projectedHeatLabel = projectedHeatForRank(
        entry.seedRank,
        heatSizes,
        fastSections,
      );

      return {
        id: `${gender}-${event}-${entry.id}`,
        athleteOrRelay:
          category === "Relay"
            ? `${entry.athleteOrRelay} Relay`
            : entry.athleteOrRelay,
        school: entry.school,
        seedRank: entry.seedRank,
        seedMarkRaw: entry.seedMarkRaw,
        projectedHeatLabel,
        stateSignalLabel: stateSignalLabel(signal),
        raceInstruction: raceInstruction({
          signal,
          isFocusTeam,
          isFastSection,
          fastSectionLabel,
          projectedHeatLabel,
        }),
        isFocusTeam,
        isFastSection,
        stateMarkOpportunity,
      };
    })
    .filter((plan) => {
      if (plan.isFocusTeam) return true;
      if (plan.stateSignalLabel !== "No app state signal") return true;
      return plan.isFastSection && plan.seedRank <= Math.min(fastSectionLimit, 12);
    })
    .slice(0, 18);

  return {
    id: `st-vrain-${gender}-${event}`,
    gender,
    event,
    eventLabel: `${gender} ${eventDisplayName[event] ?? eventName ?? event}`,
    startLabel: formatStart(start),
    entryCount: entries.length,
    heatCount,
    heatPatternLabel:
      heatCount > scheduledHeats
        ? `${heatCount} projected ${sectionWords.sectionNounPlural} from live entry load; schedule listed ${scheduledHeats}`
        : pattern.label,
    heatSizeLabel: heatSizes.length
      ? heatSizes.map((size) => String(size)).join(" / ")
      : "No entries",
    fastSectionLimit,
    fastSectionLabel:
      fastSections > 1
        ? `Top ${fastSectionLimit} across the elite/fast sections`
        : `Top ${fastSectionLimit} seeded into the fastest ${sectionWords.sectionNoun}`,
    fastCutoffLabel: fastCutoff
      ? `#${fastSectionLimit} · ${fastCutoff.seedMarkRaw}`
      : "No live cut yet",
    fastCutoffName: fastCutoff
      ? `${fastCutoff.athleteOrRelay} · ${fastCutoff.school}`
      : undefined,
    fastestSeedLabel: fastestSeed
      ? `#1 seed ${fastestSeed.seedMarkRaw} · ${fastestSeed.athleteOrRelay}`
      : undefined,
    heatConfidenceLabel: heatBasis.heatConfidenceLabel,
    historicalBasisLabel: heatBasis.historicalBasisLabel,
    forecastSummary: forecast?.summary,
    updatedAtLabel: updatedAt ? formatStart(updatedAt) : undefined,
    racePlans,
    estimatedHeats,
    teamHeatWatches,
    stateMarkOpportunities,
    storylines: buildStorylines({
      category,
      focusTeam,
      fastCutoff,
      fastSectionLimit,
      opportunities: stateMarkOpportunities,
      teamHeatWatches,
      prediction,
      sectionNoun: sectionWords.sectionNoun,
    }),
    ...sectionWords,
  };
}

export async function getStVrainHeatEstimates({
  focusTeam,
  forecasts,
  recommendations = [],
  predictions = [],
  eventFilter,
}: {
  focusTeam: string;
  forecasts: WeekendMeetEventForecast[];
  recommendations?: LastChanceRecommendation[];
  predictions?: CutoffPrediction[];
  eventFilter?: { gender: Gender; event: EventKey };
}): Promise<StVrainHeatEstimate[]> {
  try {
    const summary = await fetchJson<Record<string, RawEventSummary>>(
      FIREBASE_EVENT_SUMMARY_URL,
    );
    const signals = forecastSignals(forecasts);
    const recommendationMap = recommendationSignals(recommendations);
    const profileMap = athleteProfiles(recommendations);
    const predictionMap = predictionSignals(predictions);
    const forecastByEvent = new Map(
      forecasts.map((forecast) => [
        eventPatternKey(forecast.gender, forecast.event),
        forecast,
      ]),
    );
    const eventSummaries = Object.values(summary)
      .map((eventSummary) => {
        const gender = genderFromRaw(eventSummary.gl);
        const event = eventKeyFromAbbreviation(eventSummary.ab);
        const pattern =
          gender && event
            ? hokaHeatPatterns[eventPatternKey(gender, event)]
            : undefined;

        return {
          ...eventSummary,
          gender,
          event,
          pattern,
        };
      })
      .filter(
        (
          eventSummary,
        ): eventSummary is RawEventSummary & {
          i: number;
          ec: TrackEventCategory;
          gender: Gender;
          event: EventKey;
          pattern: HokaHeatPattern;
        } =>
          Boolean(
            eventSummary.i &&
              eventSummary.ec &&
              eventSummary.gender &&
              eventSummary.event &&
              eventSummary.pattern,
          ),
      )
      .filter((eventSummary) =>
        eventFilter
          ? eventSummary.gender === eventFilter.gender &&
            eventSummary.event === eventFilter.event
          : true,
      )
      .sort((a, b) => (a.sso ?? 0) - (b.sso ?? 0));

    const estimates = await Promise.all(
      eventSummaries.map(async (eventSummary) => {
        const doc = await fetchJson<
          AthleticLiveDoc<IndividualEntriesSource | RelayEntriesSource>
        >(eventEntriesUrl(eventSummary.ec, eventSummary.i));
        const source = doc._source;
        if (!source) return undefined;

        const entries =
          eventSummary.ec === "Relay"
            ? sortedRelayEntries(source as RelayEntriesSource)
            : sortedIndividualEntries(source as IndividualEntriesSource);

        return buildEstimateFromEntries({
          gender: eventSummary.gender,
          event: eventSummary.event,
          category: eventSummary.ec,
          eventName: eventSummary.n,
          start: eventSummary.sd,
          updatedAt: source.ua,
          entries,
          focusTeam,
          signalMap: signals,
          recommendationMap,
          profileMap,
          prediction: predictionMap.get(
            eventPatternKey(eventSummary.gender, eventSummary.event),
          ),
          forecast: forecastByEvent.get(
            eventPatternKey(eventSummary.gender, eventSummary.event),
          ),
        });
      }),
    );

    return estimates.filter(Boolean) as StVrainHeatEstimate[];
  } catch (error) {
    console.error("Unable to build St. Vrain heat estimates", error);
    return [];
  }
}

export function finalizedHokaEntriesFromEstimates(
  estimates: StVrainHeatEstimate[],
): FinalizedHokaEntry[] {
  const entries: FinalizedHokaEntry[] = [];
  const seen = new Set<string>();

  for (const estimate of estimates) {
    for (const heat of estimate.estimatedHeats) {
      for (const entry of heat.entries) {
        const athleteOrRelay = entry.athleteOrRelay.replace(/\s+Relay$/i, "");
        const key = [
          estimate.gender,
          estimate.event,
          athleteOrRelay.toLowerCase(),
          entry.school.toLowerCase(),
        ].join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push({
          gender: estimate.gender,
          event: estimate.event,
          athleteOrRelay,
          school: entry.school,
        });
      }
    }
  }

  return entries;
}

export const __testing = {
  athleteProfiles,
  buildEstimatedHeats,
  buildStateMarkOpportunities,
  heatSizesSlowToFast,
  predictionSignals,
  recommendationSignals,
};

export { HOKA_MEET_ID };
