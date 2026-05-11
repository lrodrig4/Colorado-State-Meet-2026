import type { EventKey, Gender } from "@/types/domain";
import { eventDefinitions, getEventDefinition } from "@/lib/data/events";
import { isHokaStVrainAttendingSchool } from "@/lib/data/hokaStVrainTeams";
import { weekendMeetEntries, type WeekendMeetEntry } from "@/lib/data/weekendMeetEntries";
import {
  formatScheduleSlot,
  lastChanceScheduleSlots,
  scheduleSlotsFor,
} from "@/lib/data/lastChanceSchedules";
import {
  weatherNoteForMeet,
  weatherPlanNotes,
} from "@/lib/data/weekendWeather";
import type { LastChanceRecommendation } from "@/lib/services/lastChance";
import type {
  RelayChaseDecision,
  RelayLineupTradeoff,
} from "@/lib/services/relayStrategy";
import { coachCall, type CoachCallTone } from "@/lib/utils/coachCall";

export interface WeekendAthletePlan {
  id: string;
  athleteName: string;
  eventLabel: string;
  gradeLabel: string;
  rankLabel: string;
  markRaw: string;
  coachCallLabel: string;
  coachCallTone: CoachCallTone;
  stateProbabilityLabel: string;
  holdProbabilityLabel: string;
  improveProbabilityLabel: string;
  gapRaw: string;
  primarySlotLabel?: string;
  backupSlotLabel?: string;
  repeatWarning?: string;
  eventChoiceNote?: string;
  restAdvice?: string;
  weekendEntryLabels: string[];
  weekendStateMarkChanceLabel?: string;
  weekendEntryReason?: string;
  instruction: string;
  reason: string;
  priorityScore: number;
}

export interface WeekendRelayAthleteImpact {
  athleteName: string;
  gradeLabel: string;
  opportunityLabel: string;
  individualEventLabel?: string;
  individualCoachCallLabel?: string;
  individualStateOddsLabel?: string;
  individualSlotLabel?: string;
  detail: string;
}

export interface WeekendRelayPlan {
  id: string;
  relayLabel: string;
  call: RelayChaseDecision["call"];
  tone: RelayChaseDecision["tone"];
  currentRankLabel: string;
  currentMarkRaw?: string;
  relayStateOddsLabel: string;
  relayStateIntervalLabel: string;
  relayImproveOddsLabel: string;
  projectedLineupRaw?: string;
  projectedGapLabel?: string;
  adjustedProjectedMarkRaw?: string;
  repeatabilityLabel: RelayChaseDecision["repeatabilityLabel"];
  repeatabilitySummary: string;
  alternateLossRaw?: string;
  projectedPointsSwingLabel: string;
  projectedQualifyOddsLabel: string;
  confidenceIntervalLabel: string;
  lineupCost: number;
  primarySlotLabel?: string;
  backupSlotLabel?: string;
  recommendation: string;
  tradeoffSummary: string;
  alternateSummary?: string;
  athleteImpacts: WeekendRelayAthleteImpact[];
  priorityScore: number;
}

export interface WeekendStrategy {
  focusTeam: string;
  basisLabel: string;
  quickQuestions: string[];
  defaultAnswerTitle: string;
  defaultAnswerBullets: string[];
  athletePlans: WeekendAthletePlan[];
  relayPlans: WeekendRelayPlan[];
  hokaEventForecasts: WeekendMeetEventForecast[];
  weekendMeetSummaries: WeekendMeetFieldSummary[];
  scenarioPlans: WeekendScenarioPlan[];
  decisionTree: WeekendDecisionNode[];
  scheduleNotes: string[];
}

export interface FinalizedHokaEntry {
  gender: Gender;
  event: EventKey;
  athleteOrRelay: string;
  school: string;
}

export type WeekendMeetForecastTone =
  | "green"
  | "amber"
  | "rose"
  | "slate"
  | "sky";

export interface WeekendMeetEventForecastEntry {
  id: string;
  athleteOrRelay: string;
  school: string;
  markRaw: string;
  rankLabel: string;
  probabilityLabel: string;
  callLabel: string;
  tone: WeekendMeetForecastTone;
  reason: string;
  isFocusTeam: boolean;
  sortScore: number;
}

export interface WeekendMeetEventForecast {
  id: string;
  gender: Gender;
  event: EventKey;
  eventLabel: string;
  slotLabel: string;
  expectedCount: number;
  watchCount: number;
  confidenceLabel: string;
  summary: string;
  entries: WeekendMeetEventForecastEntry[];
}

export interface WeekendMeetFieldEntry {
  id: string;
  athleteOrRelay: string;
  school: string;
  seedMarkRaw?: string;
  rankLabel?: string;
  stateProbabilityLabel?: string;
  improveProbabilityLabel?: string;
  weekendChanceLabel?: string;
  isFocusTeam: boolean;
  reason: string;
  sortScore: number;
}

export interface WeekendMeetFieldSummary {
  id: string;
  meetName: string;
  meetDate: string;
  sourceUrl: string;
  gender: Gender;
  event: EventKey;
  eventLabel: string;
  entryCount: number;
  seededCount: number;
  focusEntryCount: number;
  stateRelevantCount: number;
  fieldStrengthLabel: string;
  summary: string;
  entries: WeekendMeetFieldEntry[];
}

export interface WeekendScenarioEntry {
  id: string;
  label: string;
  athleteOrRelay: string;
  eventLabel: string;
  meetPlan: string;
  oddsLabel: string;
  priorityLabel: string;
  reason: string;
}

export interface WeekendScenarioPlan {
  id:
    | "st-vrain-first"
    | "split-weekend"
    | "teddy-only"
    | "relay-first"
    | "rest-protect";
  title: string;
  subtitle: string;
  objective: string;
  expectedStateAddsLabel: string;
  riskLabel: string;
  entries: WeekendScenarioEntry[];
}

export interface WeekendDecisionNode {
  id: string;
  question: string;
  yes: string;
  no: string;
  scenarioId: WeekendScenarioPlan["id"];
}

function gradeLabel(grade?: number) {
  if (!grade) return "Grade unknown";
  if (grade === 12) return "Senior";
  if (grade === 11) return "Junior";
  if (grade === 10) return "Sophomore";
  if (grade === 9) return "Freshman";
  return `Grade ${grade}`;
}

function normalizeEntryName(value: string) {
  return value
    .toLowerCase()
    .replace(/\(co\)/g, "")
    .replace(/\s+relay$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function weekendEntryKey({
  gender,
  event,
  athleteOrRelay,
  school,
}: Pick<WeekendMeetEntry, "gender" | "event" | "athleteOrRelay" | "school">) {
  return [
    gender,
    event,
    normalizeEntryName(athleteOrRelay),
    normalizeEntryName(school),
  ].join("|");
}

function weekendMeetEventKey(entry: Pick<WeekendMeetEntry, "meetName" | "gender" | "event">) {
  return `${entry.meetName}|${entry.gender}|${entry.event}`;
}

const weekendEntriesByEntryKey = new Map<string, WeekendMeetEntry[]>();
const weekendEntriesByMeetEventKey = new Map<string, WeekendMeetEntry[]>();

for (const entry of weekendMeetEntries) {
  const entryKey = weekendEntryKey(entry);
  weekendEntriesByEntryKey.set(entryKey, [
    ...(weekendEntriesByEntryKey.get(entryKey) ?? []),
    entry,
  ]);
  const meetEventKey = weekendMeetEventKey(entry);
  weekendEntriesByMeetEventKey.set(meetEventKey, [
    ...(weekendEntriesByMeetEventKey.get(meetEventKey) ?? []),
    entry,
  ]);
}

function weekendEntriesForRow(row: LastChanceRecommendation) {
  return (
    weekendEntriesByEntryKey.get(
      weekendEntryKey({
        gender: row.gender,
        event: row.event,
        athleteOrRelay: row.athleteName,
        school: row.school,
      }),
    ) ?? []
  );
}

function eventFieldEntries(entry: WeekendMeetEntry) {
  return weekendEntriesByMeetEventKey.get(weekendMeetEventKey(entry)) ?? [];
}

function markMeetsTarget(
  event: EventKey,
  markValue: number | undefined,
  target: number,
) {
  if (markValue === undefined) return false;
  return getEventDefinition(event).sortDirection === "asc"
    ? markValue <= target
    : markValue >= target;
}

function markNearTarget(
  event: EventKey,
  markValue: number | undefined,
  target: number,
) {
  if (markValue === undefined) return false;
  const definition = getEventDefinition(event);
  if (definition.markType === "distance") {
    return Math.abs(markValue - target) <= 12;
  }

  return Math.abs(markValue - target) <= Math.max(0.35, target * 0.012);
}

function weekendEntryLabel(entry: WeekendMeetEntry) {
  const day = entry.meetDate === "2026-05-09" ? "Sat" : "Fri";
  return `${entry.meetName} (${day})${entry.seedMarkRaw ? ` seed ${entry.seedMarkRaw}` : ""}`;
}

function weekendEntryOpportunity(row: LastChanceRecommendation) {
  const matches = weekendEntriesForRow(row);
  if (!matches.length) {
    return {
      labels: [] as string[],
      reason:
        "No Windjammer, Friday Night Lights, or Teddy entry is loaded for this event, so the model does not give a weekend-field boost.",
      priorityBoost: 0,
    };
  }

  const base = row.rank <= 18 ? row.holdProbability : row.improveProbability;
  let bestChance = base;
  let bestReason = "";
  let bestBoost = 0;

  for (const entry of matches) {
    const field = eventFieldEntries(entry);
    const stateLevelCount = field.filter((candidate) =>
      markMeetsTarget(row.event, candidate.seedMarkValue, row.predictedCutoffValue),
    ).length;
    const nearCount = field.filter((candidate) =>
      markNearTarget(row.event, candidate.seedMarkValue, row.predictedCutoffValue),
    ).length;
    const seededCount = field.filter(
      (candidate) => candidate.seedMarkValue !== undefined,
    ).length;
    const ownSeedIsStateLevel = markMeetsTarget(
      row.event,
      entry.seedMarkValue,
      row.predictedCutoffValue,
    );
    const ownSeedIsNear = markNearTarget(
      row.event,
      entry.seedMarkValue,
      row.predictedCutoffValue,
    );
    const fieldBoost =
      stateLevelCount >= 8
        ? 12
        : stateLevelCount >= 4
          ? 9
          : stateLevelCount >= 2
            ? 6
            : nearCount >= 8
              ? 5
              : nearCount >= 4
                ? 3
                : 0;
    const ownSeedBoost = ownSeedIsStateLevel ? 8 : ownSeedIsNear ? 4 : 0;
    const distanceRepeatPenalty =
      row.event === "3200m" && matches.length > 1 && entry.meetDate === "2026-05-09"
        ? 8
        : row.event === "1600m" && matches.length > 1 && entry.meetDate === "2026-05-09"
          ? 3
          : 0;
    const chance = clamp(
      base + fieldBoost + ownSeedBoost - distanceRepeatPenalty,
      2,
      98,
    );

    if (chance >= bestChance) {
      bestChance = chance;
      bestBoost = fieldBoost + ownSeedBoost - distanceRepeatPenalty;
      bestReason = `${entry.meetName} has ${field.length} entries, ${seededCount} seeds, ${stateLevelCount} already at/better than the projected state mark, and ${nearCount} close enough to help pull the race.`;
      if (distanceRepeatPenalty) {
        bestReason += " The model discounts a Saturday repeat for this distance event.";
      }
    }
  }

  return {
    labels: matches.map(weekendEntryLabel),
    chanceLabel: `${Math.round(bestChance)}%`,
    reason: bestReason,
    priorityBoost: Math.max(0, Math.round(bestBoost)),
  };
}

function hokaEntryKey({
  gender,
  event,
  athleteOrRelay,
  school,
}: FinalizedHokaEntry) {
  return [
    gender,
    event,
    normalizeEntryName(athleteOrRelay),
    normalizeEntryName(school),
  ].join("|");
}

function hokaEntrySet(entries?: Iterable<FinalizedHokaEntry>) {
  if (!entries) return undefined;
  return new Set([...entries].map(hokaEntryKey));
}

function hasFinalizedHokaEntry(
  row: FinalizedHokaEntry,
  finalizedEntries?: Set<string>,
) {
  if (!finalizedEntries) return true;
  return finalizedEntries.has(hokaEntryKey(row));
}

function availableSlotsFor({
  gender,
  event,
  athleteOrRelay,
  school,
  finalizedHokaEntries,
}: FinalizedHokaEntry & { finalizedHokaEntries?: Set<string> }) {
  const allSlots = scheduleSlotsFor(gender, event);

  if (!finalizedHokaEntries) return allSlots;

  const hasHokaSlot = allSlots.some(
    (slot) => slot.meetName === "HOKA St. Vrain Invitational",
  );
  if (!hasHokaSlot) return allSlots;

  const enteredAtHoka = hasFinalizedHokaEntry(
    { gender, event, athleteOrRelay, school },
    finalizedHokaEntries,
  );

  return enteredAtHoka
    ? allSlots
    : allSlots.filter(
        (slot) => slot.meetName !== "HOKA St. Vrain Invitational",
      );
}

function hokaNotEnteredNote(
  row: FinalizedHokaEntry,
  finalizedHokaEntries?: Set<string>,
) {
  if (!finalizedHokaEntries) return undefined;
  const hasHokaSlot = hokaSlotsFor(row.gender, row.event).length > 0;
  if (!hasHokaSlot || hasFinalizedHokaEntry(row, finalizedHokaEntries)) {
    return undefined;
  }

  return "Not in the finalized St. Vrain entries for this event, so the app treats St. Vrain as unavailable and does not recommend racing it there.";
}

function slotsFor(
  row: Pick<LastChanceRecommendation, "gender" | "event" | "athleteName" | "school">,
  finalizedHokaEntries?: Set<string>,
) {
  const slots = availableSlotsFor({
    gender: row.gender,
    event: row.event,
    athleteOrRelay: row.athleteName,
    school: row.school,
    finalizedHokaEntries,
  });
  return {
    primary: slots[0],
    backup: slots.find((slot) => slot.day === "Saturday"),
  };
}

function priorityForRow(row: LastChanceRecommendation) {
  const definition = getEventDefinition(row.event);
  const call = coachCall(row);
  let score = row.priorityScore;

  if (call.urgent) score += 20;
  if (row.grade === 12 && !definition.relay) score += 18;
  if (row.rank <= 18 && row.stateProbability < 90) score += 16;
  if (row.rank > 18 && row.improveProbability >= 60) score += 16;
  if (definition.relay) score -= 12;

  return score;
}

function restGuidance(row: LastChanceRecommendation) {
  const definition = getEventDefinition(row.event);
  const state = row.stateProbability;
  const hold = row.holdProbability;

  if (row.rank > 18 || state < 88 || hold < 80) return undefined;

  if (definition.relay) {
    return "Already in good state position. Use a relay tune-up only if handoffs or lineup chemistry need it; otherwise protect legs for state week.";
  }

  if (definition.discipline === "distance") {
    if (row.event === "3200m") {
      return "Rest is strongly preferred over another hard 3200. Use strides or a controlled tune-up, not a second long race before state.";
    }

    return "Rest or a controlled rhythm race is more valuable than chasing a mark that already holds. Avoid stacking hard distance efforts before state.";
  }

  if (definition.discipline === "sprint" || definition.discipline === "hurdle") {
    return "A controlled tune-up can help rhythm, but do not add extra rounds or relays unless it clearly improves state scoring.";
  }

  if (definition.discipline === "jump" || definition.discipline === "throw") {
    return "A technical tune-up is reasonable. Cap attempts and warmups so the athlete arrives at state healthy.";
  }

  return "Protect the state seed. Only race if the entry plan improves state-weekend scoring.";
}

function athleteInstruction(
  row: LastChanceRecommendation,
  finalizedHokaEntries?: Set<string>,
) {
  const definition = getEventDefinition(row.event);
  const senior = row.grade === 12 && !definition.relay;
  const inField = row.rank <= 18;
  const slots = slotsFor(row, finalizedHokaEntries);
  const primarySlot = slots.primary ? formatScheduleSlot(slots.primary) : undefined;
  const backupSlot = slots.backup ? formatScheduleSlot(slots.backup) : undefined;
  const entryNote = hokaNotEnteredNote(
    {
      gender: row.gender,
      event: row.event,
      athleteOrRelay: row.athleteName,
      school: row.school,
    },
    finalizedHokaEntries,
  );

  const repeat = repeatGuidance(row.event);
  const rest = restGuidance(row);
  const primaryWeather = slots.primary
    ? weatherNoteForMeet(slots.primary.meetName)
    : undefined;
  const backupWeather = slots.backup
    ? weatherNoteForMeet(slots.backup.meetName)
    : undefined;
  const weatherContext = [primaryWeather, backupWeather]
    .filter(Boolean)
    .join(" ");

  if (rest && row.stateProbability >= 92) {
    return {
      instruction: "Rest or use a controlled tune-up. Do not spend a hard last-chance effort unless it changes state-weekend scoring.",
      reason: `${row.rankLabel} with ${row.stateProbabilityLabel} state odds and ${row.holdProbabilityLabel} hold odds. ${entryNote ? `${entryNote} ` : ""}${rest} ${weatherContext}`,
    };
  }

  if (row.event === "3200m" && slots.primary && slots.backup) {
    const hasFriday = slots.primary.day === "Friday" || slots.backup.day === "Friday";
    return {
      instruction: hasFriday
        ? `Pick one 3200, with Friday preferred if available. Do not plan on racing the 3200 on back-to-back days; use Teddy only if St. Vrain is not available or the Friday start does not happen.`
        : `Pick one 3200. St. Vrain is not available from finalized entries, so this becomes a Teddy-only decision if the athlete is entered there.`,
      reason: `${row.gapRaw}; ${entryNote ? `${entryNote} ` : ""}the 3200 has the steepest second-day fatigue penalty, so the model treats Saturday as an alternate meet, not a backup repeat. ${weatherContext}`,
    };
  }

  if (senior && !inField && row.improveProbability >= 60) {
    return {
      instruction: `Give this senior the cleanest fresh attempt. ${primarySlot ?? "The first available race"} should be the priority; ${backupSlot ?? "a second-day option"} is backup only if the first race does not solve it.`,
      reason: `${row.gapRaw}; ${entryNote ? `${entryNote} ` : ""}improve odds are ${row.improveProbabilityLabel}, so this is a real one-weekend individual opportunity. ${weatherContext}`,
    };
  }

  if (inField && row.stateProbability >= 78 && row.stateProbability < 92) {
    return {
      instruction: `Protect the current state seed. Do not add relay load unless the relay has a clearly better state-points path.`,
      reason: `${row.rankLabel} with ${row.stateProbabilityLabel} state odds; the goal is to hold the spot, not spend the legs chasing a lower-return race.`,
    };
  }

  if (inField) {
    return {
      instruction: `Keep this event protected and avoid unnecessary doubles before declarations.`,
      reason: `${row.rankLabel} is inside the current top 18 with ${row.holdProbabilityLabel} hold odds.`,
    };
  }

  if (row.stateProbability >= 45 || row.improveProbability >= 55) {
    return {
      instruction: `Race this when the athlete is fresh; avoid putting a relay before the best individual attempt.`,
      reason: `${row.gapRaw}; ${entryNote ? `${entryNote} ` : ""}this is close enough that fatigue can decide whether the mark moves into the projected field. ${weatherContext}`,
    };
  }

  return {
    instruction: `Only chase if the lineup or entry plan is already available and it does not cost a higher-priority event.`,
    reason: `${row.gapRaw}; ${entryNote ? `${entryNote} ` : ""}current state odds are ${row.stateProbabilityLabel}. ${repeat}`,
  };
}

function repeatGuidance(event: LastChanceRecommendation["event"]) {
  if (event === "3200m") {
    return "Do not plan a Friday/Saturday 3200 repeat; pick one 3200 attempt.";
  }
  if (event === "1600m") {
    return "A Friday/Saturday 1600 repeat is possible, but the second-day chance is lower after a hard first race.";
  }
  if (event === "800m") {
    return "An 800 repeat is possible, but protect recovery if the athlete is also on a relay.";
  }
  if (["100m", "200m", "400m", "100m Hurdles", "110m Hurdles", "300m Hurdles"].includes(event)) {
    return "Repeating is more realistic than the 3200, but keep the best attempt fresh.";
  }
  if (["Shot Put", "Discus", "High Jump", "Pole Vault", "Long Jump", "Triple Jump"].includes(event)) {
    return "Field-event repeats are more realistic, but manage attempts and warmups.";
  }
  return "";
}

function sameAthleteEventChoiceNote(
  row: LastChanceRecommendation,
  athleteRows: LastChanceRecommendation[],
) {
  const individualRows = athleteRows.filter(
    (entry) => !getEventDefinition(entry.event).relay,
  );
  if (individualRows.length <= 1) return undefined;

  const ordered = [...individualRows].sort(
    (a, b) => priorityForRow(b) - priorityForRow(a),
  );
  const best = ordered[0];
  const next = ordered.find((entry) => entry.id !== row.id);

  if (!best || !next) return undefined;

  if (best.id === row.id) {
    return `Best current event choice for this athlete. Next option: ${next.eventLabel} (${next.rankLabel}, ${next.stateProbabilityLabel} state).`;
  }

  return `Secondary event behind ${best.eventLabel} (${best.rankLabel}, ${best.stateProbabilityLabel} state).`;
}

function buildAthletePlan(
  row: LastChanceRecommendation,
  athleteRows: LastChanceRecommendation[] = [row],
  finalizedHokaEntries?: Set<string>,
): WeekendAthletePlan {
  const call = coachCall(row);
  const slots = slotsFor(row, finalizedHokaEntries);
  const text = athleteInstruction(row, finalizedHokaEntries);
  const repeatWarning = repeatGuidance(row.event);
  const restAdvice = restGuidance(row);
  const weekendOpportunity = weekendEntryOpportunity(row);

  return {
    id: row.id,
    athleteName: row.athleteName,
    eventLabel: row.eventLabel,
    gradeLabel: gradeLabel(row.grade),
    rankLabel: row.rankLabel,
    markRaw: row.markRaw,
    coachCallLabel: call.label,
    coachCallTone: call.tone,
    stateProbabilityLabel: row.stateProbabilityLabel,
    holdProbabilityLabel: row.holdProbabilityLabel,
    improveProbabilityLabel: row.improveProbabilityLabel,
    gapRaw: row.gapRaw,
    primarySlotLabel: slots.primary ? formatScheduleSlot(slots.primary) : undefined,
    backupSlotLabel: slots.backup ? formatScheduleSlot(slots.backup) : undefined,
    repeatWarning,
    eventChoiceNote: sameAthleteEventChoiceNote(row, athleteRows),
    restAdvice,
    weekendEntryLabels: weekendOpportunity.labels,
    weekendStateMarkChanceLabel: weekendOpportunity.chanceLabel,
    weekendEntryReason: weekendOpportunity.reason,
    instruction: text.instruction,
    reason: weekendOpportunity.labels.length
      ? `${text.reason} Entry-confirmed this weekend: ${weekendOpportunity.labels.join("; ")}. ${weekendOpportunity.reason}`
      : text.reason,
    priorityScore: priorityForRow(row) + weekendOpportunity.priorityBoost,
  };
}

function athleteKey(name: string) {
  return name.toLowerCase();
}

function individualRowsByAthlete(rows: LastChanceRecommendation[]) {
  const map = new Map<string, LastChanceRecommendation[]>();

  for (const row of rows) {
    if (getEventDefinition(row.event).relay) continue;
    const key = athleteKey(row.athleteName);
    map.set(key, [...(map.get(key) ?? []), row]);
  }

  for (const [key, athleteRows] of map.entries()) {
    map.set(
      key,
      athleteRows.sort((a, b) => priorityForRow(b) - priorityForRow(a)),
    );
  }

  return map;
}

function impactForLineupMember(
  candidate: RelayLineupTradeoff,
  athleteRows: Map<string, LastChanceRecommendation[]>,
  finalizedHokaEntries?: Set<string>,
): WeekendRelayAthleteImpact {
  const individual = athleteRows.get(athleteKey(candidate.athleteName))?.[0];
  const call = individual ? coachCall(individual) : undefined;
  const primarySlot = individual
    ? slotsFor(individual, finalizedHokaEntries).primary
    : undefined;

  return {
    athleteName: candidate.athleteName,
    gradeLabel: candidate.gradeLabel,
    opportunityLabel: candidate.opportunityLabel,
    individualEventLabel: individual?.eventLabel,
    individualCoachCallLabel: call?.label,
    individualStateOddsLabel: individual?.stateProbabilityLabel,
    individualSlotLabel: primarySlot ? formatScheduleSlot(primarySlot) : undefined,
    detail: individual
      ? `${candidate.opportunityDetail} Individual priority: ${individual.eventLabel}, ${individual.rankLabel}, ${individual.stateProbabilityLabel} state odds.`
      : candidate.opportunityDetail,
  };
}

function relayPriority(decision: RelayChaseDecision) {
  const callScore: Record<RelayChaseDecision["call"], number> = {
    "Protect individuals": 100,
    "Conditional chase": 74,
    "Chase relay": 62,
    "Low ROI": 30,
    "Already qualified": 24,
  };

  return (
    callScore[decision.call] +
    decision.lineupCost +
    decision.projectedQualifyOdds * 0.4
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hokaSlotsFor(gender: Gender, event: EventKey) {
  return lastChanceScheduleSlots.filter(
    (slot) =>
      slot.meetName === "HOKA St. Vrain Invitational" &&
      slot.gender === gender &&
      slot.event === event,
  );
}

function hokaSlotLabel(gender: Gender, event: EventKey) {
  const slots = hokaSlotsFor(gender, event);
  if (!slots.length) return "HOKA St. Vrain";

  return slots
    .map((slot) =>
      slot.notes
        ? `${formatScheduleSlot(slot)} (${slot.notes.replace(/\.$/, "")})`
        : formatScheduleSlot(slot),
    )
    .join(" / ");
}

function hokaRacePrediction(row: LastChanceRecommendation): Pick<
  WeekendMeetEventForecastEntry,
  "probabilityLabel" | "callLabel" | "tone" | "reason" | "sortScore"
> {
  const definition = getEventDefinition(row.event);
  const outside = row.rank > 18;

  if (definition.relay) {
    const probability = outside
      ? clamp(54 + row.improveProbability * 0.35 + row.stateProbability * 0.18, 38, 88)
      : row.rank > 12 || row.stateProbability < 82 || row.holdProbability < 75
        ? clamp(58 + (82 - row.holdProbability) * 0.2, 48, 78)
        : 42;
    const callLabel = outside
      ? "Likely relay chase"
      : probability >= 56
        ? "Relay tune/defend"
        : "Qualified relay watch";

    return {
      probabilityLabel: `${Math.round(probability)}%`,
      callLabel,
      tone: outside ? "amber" : probability >= 56 ? "sky" : "slate",
      reason: outside
        ? `${row.rankLabel} relay from an attending school. If the lineup is available, HOKA is the clean Friday chance to move this mark.`
        : `${row.rankLabel} relay is already in the state picture. The model treats relays as entered; HOKA is a repeatability/tune-up call, not a scratch source.`,
      sortScore:
        probability +
        (outside ? 22 : 0) +
        (row.rank <= 18 && row.rank > 12 ? 10 : 0),
    };
  }

  if (outside) {
    const seniorBoost = row.grade === 12 ? 7 : 0;
    const probability = clamp(
      26 + row.improveProbability * 0.5 + row.stateProbability * 0.24 + seniorBoost,
      8,
      94,
    );

    return {
      probabilityLabel: `${Math.round(probability)}%`,
      callLabel:
        probability >= 70
          ? "Likely chase"
          : probability >= 48
            ? "Possible chase"
            : "Long-shot chase",
      tone: probability >= 70 ? "rose" : probability >= 48 ? "amber" : "slate",
      reason: `${row.rankLabel}; ${row.gapRaw}. HOKA is preferred over a Saturday-only attempt when the athlete has a real state-mark path.`,
      sortScore: probability + row.improveProbability * 0.35 + seniorBoost,
    };
  }

  const thinHold = row.stateProbability < 88 || row.holdProbability < 76;
  if (thinHold) {
    const probability = clamp(
      64 + (88 - row.stateProbability) * 0.22 + (76 - row.holdProbability) * 0.18,
      56,
      86,
    );

    return {
      probabilityLabel: `${Math.round(probability)}%`,
      callLabel: "Likely defend",
      tone: "amber",
      reason: `${row.rankLabel} is currently in, but the hold is thin. A fresh Friday defense makes sense if this event matters.`,
      sortScore: probability + 24,
    };
  }

  const discipline = definition.discipline;
  const safeScorer = row.rank <= 9 && row.stateProbability >= 90;
  let probability =
    discipline === "distance"
      ? safeScorer
        ? 22
        : 38
      : discipline === "sprint" || discipline === "hurdle"
        ? safeScorer
          ? 46
          : 55
        : discipline === "jump" || discipline === "throw"
          ? safeScorer
            ? 40
            : 52
          : 36;

  if (row.event === "1600m" && row.rank <= 12) {
    probability += 8;
  }
  if (row.event === "3200m" && safeScorer) {
    probability -= 8;
  }

  probability = clamp(probability, 10, 72);

  return {
    probabilityLabel: `${Math.round(probability)}%`,
    callLabel:
      probability >= 52
        ? "Possible tune-up"
        : probability >= 34
          ? "Coach call"
          : "Likely protects",
    tone: probability >= 52 ? "sky" : probability >= 34 ? "slate" : "green",
    reason: safeScorer
      ? `${row.rankLabel} projects safely into state. The model leans protect/rest unless the coach wants a controlled rhythm or technical tune-up.`
      : `${row.rankLabel} is inside the field with ${row.stateProbabilityLabel} state odds. HOKA is a coach-call tune-up, not a must-run.`,
    sortScore: probability + (safeScorer ? -12 : 0),
  };
}

function buildHokaEventForecasts(
  recommendations: LastChanceRecommendation[],
  focusTeam: string,
  finalizedHokaEntries?: Set<string>,
): WeekendMeetEventForecast[] {
  const recommendationsByEvent = new Map<string, LastChanceRecommendation[]>();

  for (const row of recommendations) {
    if (!hokaSlotsFor(row.gender, row.event).length) continue;
    if (!isHokaStVrainAttendingSchool(row.school, row.gender)) continue;
    if (
      finalizedHokaEntries &&
      !hasFinalizedHokaEntry(
        {
          gender: row.gender,
          event: row.event,
          athleteOrRelay: row.athleteName,
          school: row.school,
        },
        finalizedHokaEntries,
      )
    ) {
      continue;
    }

    const key = `${row.gender}|${row.event}`;
    recommendationsByEvent.set(key, [
      ...(recommendationsByEvent.get(key) ?? []),
      row,
    ]);
  }

  const eventOrder = lastChanceScheduleSlots
    .filter((slot) => slot.meetName === "HOKA St. Vrain Invitational")
    .reduce<string[]>((keys, slot) => {
      const key = `${slot.gender}|${slot.event}`;
      return keys.includes(key) ? keys : [...keys, key];
    }, []);
  const eventLabelByKey = new Map<string, string>();
  for (const definition of eventDefinitions) {
    for (const gender of definition.genders) {
      eventLabelByKey.set(
        `${gender}|${definition.event}`,
        `${gender} ${definition.displayName}`,
      );
    }
  }

  return eventOrder.map((key) => {
    const [gender, event] = key.split("|") as [Gender, EventKey];
    const rows = recommendationsByEvent.get(key) ?? [];
    const entries = rows
      .map((row) => {
        const prediction = hokaRacePrediction(row);
        return {
          id: row.id,
          athleteOrRelay: getEventDefinition(row.event).relay
            ? `${row.school} Relay`
            : row.athleteName,
          school: row.school,
          markRaw: row.markRaw,
          rankLabel: row.rankLabel,
          probabilityLabel: prediction.probabilityLabel,
          callLabel: prediction.callLabel,
          tone: prediction.tone,
          reason: prediction.reason,
          isFocusTeam: row.school === focusTeam,
          sortScore: prediction.sortScore + (row.school === focusTeam ? 18 : 0),
        } satisfies WeekendMeetEventForecastEntry;
      })
      .filter((entry) => {
        const probability = Number.parseInt(entry.probabilityLabel, 10) || 0;
        return probability >= 34 || entry.isFocusTeam;
      })
      .sort((a, b) => b.sortScore - a.sortScore)
      .slice(0, 12);
    const expectedCount = entries.filter((entry) => {
      const probability = Number.parseInt(entry.probabilityLabel, 10) || 0;
      return probability >= 55;
    }).length;
    const watchCount = entries.filter((entry) => {
      const probability = Number.parseInt(entry.probabilityLabel, 10) || 0;
      return probability >= 34 && probability < 55;
    }).length;
    const confidenceLabel =
      rows.length >= 10
        ? "Medium-high"
        : rows.length >= 5
          ? "Medium"
          : rows.length
            ? "Low-medium"
            : "Low";

    return {
      id: `hoka-${gender}-${event}`,
      gender,
      event,
      eventLabel: eventLabelByKey.get(key) ?? `${gender} ${event}`,
      slotLabel: hokaSlotLabel(gender, event),
      expectedCount,
      watchCount,
      confidenceLabel,
      summary: entries.length
        ? `${expectedCount} likely run calls and ${watchCount} watch calls from HOKA-attending schools in the current class top-50/bubble data.`
        : "No current top-50 state-relevant HOKA signal for this class/event yet.",
      entries,
    };
  });
}

function recommendationKey(row: LastChanceRecommendation) {
  return weekendEntryKey({
    gender: row.gender,
    event: row.event,
    athleteOrRelay: row.athleteName,
    school: row.school,
  });
}

function buildWeekendMeetSummaries(
  recommendations: LastChanceRecommendation[],
  focusTeam: string,
): WeekendMeetFieldSummary[] {
  const recommendationsByEntry = new Map<string, LastChanceRecommendation>();
  const targetByEvent = new Map<string, LastChanceRecommendation>();

  for (const row of recommendations) {
    recommendationsByEntry.set(recommendationKey(row), row);
    const eventKey = `${row.gender}|${row.event}`;
    if (!targetByEvent.has(eventKey)) {
      targetByEvent.set(eventKey, row);
    }
  }

  return [...weekendEntriesByMeetEventKey.entries()]
    .map(([key, entries]) => {
      const [meetName, gender, event] = key.split("|") as [
        string,
        Gender,
        EventKey,
      ];
      const sample = entries[0];
      const target = targetByEvent.get(`${gender}|${event}`);
      const seededCount = entries.filter(
        (entry) => entry.seedMarkValue !== undefined,
      ).length;
      const stateSeedCount = target
        ? entries.filter((entry) =>
            markMeetsTarget(event, entry.seedMarkValue, target.predictedCutoffValue),
          ).length
        : 0;
      const nearSeedCount = target
        ? entries.filter((entry) =>
            markNearTarget(event, entry.seedMarkValue, target.predictedCutoffValue),
          ).length
        : 0;
      const focusEntries = entries.filter((entry) => entry.school === focusTeam);
      const scoredEntries = entries
        .reduce<WeekendMeetFieldEntry[]>((acc, entry) => {
          const recommendation = recommendationsByEntry.get(
            weekendEntryKey(entry),
          );
          const seededState = target
            ? markMeetsTarget(event, entry.seedMarkValue, target.predictedCutoffValue)
            : false;
          const seededNear = target
            ? markNearTarget(event, entry.seedMarkValue, target.predictedCutoffValue)
            : false;
          const weekendChance = recommendation
            ? weekendEntryOpportunity(recommendation).chanceLabel
            : undefined;
          const relevant =
            entry.school === focusTeam ||
            seededState ||
            seededNear ||
            Boolean(
              recommendation &&
                (recommendation.rank <= 24 ||
                  recommendation.stateProbability >= 35 ||
                  recommendation.improveProbability >= 45),
            );

          if (!relevant) return acc;

          acc.push({
            id: [
              entry.meetName,
              entry.gender,
              entry.event,
              entry.school,
              entry.athleteOrRelay,
            ]
              .map(normalizeEntryName)
              .join("|"),
            athleteOrRelay: getEventDefinition(event).relay
              ? `${entry.school} Relay`
              : entry.athleteOrRelay,
            school: entry.school,
            seedMarkRaw: entry.seedMarkRaw,
            rankLabel: recommendation?.rankLabel,
            stateProbabilityLabel: recommendation?.stateProbabilityLabel,
            improveProbabilityLabel: recommendation?.improveProbabilityLabel,
            weekendChanceLabel: weekendChance,
            isFocusTeam: entry.school === focusTeam,
            reason: recommendation
              ? `${recommendation.rankLabel}; ${recommendation.gapRaw}. Entered at ${entry.meetName}.`
              : seededState
                ? "Seed is already at or better than the projected state mark."
                : seededNear
                  ? "Seed is close enough to the projected state mark to influence the field."
                  : "Selected-team entry.",
            sortScore:
              (entry.school === focusTeam ? 1000 : 0) +
              (recommendation ? Math.max(recommendation.stateProbability, recommendation.improveProbability) : 0) +
              (seededState ? 90 : seededNear ? 45 : 0),
          });

          return acc;
        }, [])
        .sort((a, b) => b.sortScore - a.sortScore)
        .slice(0, 14);
      const fieldStrengthLabel =
        stateSeedCount >= 8
          ? "Hot state field"
          : stateSeedCount >= 4
            ? "Strong state field"
            : nearSeedCount >= 8
              ? "Useful chase field"
              : nearSeedCount >= 4
                ? "Some pull"
                : "Light state pull";

      return {
        id: `${meetName}-${gender}-${event}`.replace(/[^a-zA-Z0-9]+/g, "-"),
        meetName,
        meetDate: sample?.meetDate ?? "",
        sourceUrl: sample?.sourceUrl ?? "",
        gender,
        event,
        eventLabel: `${gender} ${getEventDefinition(event).displayName}`,
        entryCount: entries.length,
        seededCount,
        focusEntryCount: focusEntries.length,
        stateRelevantCount: scoredEntries.length,
        fieldStrengthLabel,
        summary: target
          ? `${stateSeedCount} seeds are already at/better than projected ${target.predictedCutoffRaw}; ${nearSeedCount} more are close enough to help shape the race.`
          : `${entries.length} entries loaded from the public MileSplit page.`,
        entries: scoredEntries,
      } satisfies WeekendMeetFieldSummary;
    })
    .filter(
      (summary) =>
        summary.focusEntryCount > 0 ||
        summary.stateRelevantCount > 0 ||
        summary.fieldStrengthLabel !== "Light state pull",
    )
    .sort(
      (a, b) =>
        a.meetDate.localeCompare(b.meetDate) ||
        a.meetName.localeCompare(b.meetName) ||
        a.gender.localeCompare(b.gender) ||
        eventDefinitions.findIndex((definition) => definition.event === a.event) -
          eventDefinitions.findIndex((definition) => definition.event === b.event),
    );
}

function relayRecommendation(
  decision: RelayChaseDecision,
  impacts: WeekendRelayAthleteImpact[],
  slots = scheduleSlotsFor(decision.gender, decision.relay),
  hokaUnavailable = false,
) {
  const highest = impacts.find(
    (impact) =>
      impact.opportunityLabel === "High individual cost" ||
      impact.opportunityLabel === "Real trade-off",
  );
  const primarySlot = slots[0] ? formatScheduleSlot(slots[0]) : "the first relay window";
  const backupSlot = slots.find((slot) => slot.day === "Saturday");
  const entryNote = hokaUnavailable
    ? " This relay is not in the finalized St. Vrain entries, so remove the Friday relay option."
    : "";

  if (decision.call === "Protect individuals" && highest) {
    return `Protect ${highest.athleteName}'s individual path first. Use ${decision.relayLabel} only if alternates can run it, or if the relay projection clearly beats the individual state opportunity.${entryNote} ${primarySlot} is the cleanest available relay try; ${backupSlot ? formatScheduleSlot(backupSlot) : "Saturday"} is less fresh after Friday work.`;
  }

  if (decision.call === "Conditional chase") {
    return `Chase ${decision.relayLabel} only after the top individual priorities are locked.${entryNote} If the relay is entered, prefer ${primarySlot} so Saturday remains a backup, not the main plan.`;
  }

  if (decision.call === "Chase relay") {
    return `${decision.relayLabel} is worth a focused attempt if the best four are available.${entryNote} Prefer ${primarySlot}; avoid making Saturday the only shot.`;
  }

  if (decision.call === "Already qualified") {
    return `${decision.relayLabel} is already in the field. Protect the lineup and use last-chance races only to sharpen, not to risk a primary individual event.`;
  }

  return `${decision.relayLabel} is a lower-return chase in the selected team view. Do not spend a senior or high-odds individual attempt here unless new entries change the math.`;
}

function buildRelayPlan(
  decision: RelayChaseDecision,
  athleteRows: Map<string, LastChanceRecommendation[]>,
  focusTeam: string,
  finalizedHokaEntries?: Set<string>,
): WeekendRelayPlan {
  const hokaUnavailable = Boolean(
    finalizedHokaEntries &&
      hokaSlotsFor(decision.gender, decision.relay).length &&
      !hasFinalizedHokaEntry(
        {
          gender: decision.gender,
          event: decision.relay,
          athleteOrRelay: focusTeam,
          school: focusTeam,
        },
        finalizedHokaEntries,
      ),
  );
  const slots = availableSlotsFor({
    gender: decision.gender,
    event: decision.relay,
    athleteOrRelay: focusTeam,
    school: focusTeam,
    finalizedHokaEntries,
  });
  const impacts = decision.lineup.map((candidate) =>
    impactForLineupMember(candidate, athleteRows, finalizedHokaEntries),
  );

  return {
    id: decision.id,
    relayLabel: decision.relayLabel,
    call: decision.call,
    tone: decision.tone,
    currentRankLabel: decision.currentRankLabel,
    currentMarkRaw: decision.currentMarkRaw,
    relayStateOddsLabel: decision.relayStateOddsLabel,
    relayStateIntervalLabel: decision.relayStateIntervalLabel,
    relayImproveOddsLabel: decision.relayImproveOddsLabel,
    projectedLineupRaw: decision.projectedLineupRaw,
    projectedGapLabel: decision.projectedGapLabel,
    adjustedProjectedMarkRaw: decision.adjustedProjectedMarkRaw,
    repeatabilityLabel: decision.repeatabilityLabel,
    repeatabilitySummary: decision.repeatabilitySummary,
    alternateLossRaw: decision.alternateLossRaw,
    projectedPointsSwingLabel: decision.projectedPointsSwingLabel,
    projectedQualifyOddsLabel: decision.projectedQualifyOddsLabel,
    confidenceIntervalLabel: decision.confidenceIntervalLabel,
    lineupCost: decision.lineupCost,
    primarySlotLabel: slots[0] ? formatScheduleSlot(slots[0]) : undefined,
    backupSlotLabel: slots.find((slot) => slot.day === "Saturday")
      ? formatScheduleSlot(slots.find((slot) => slot.day === "Saturday")!)
      : undefined,
    recommendation: relayRecommendation(decision, impacts, slots, hokaUnavailable),
    tradeoffSummary: decision.tradeoffSummary,
    alternateSummary: decision.alternateSummary,
    athleteImpacts: impacts,
    priorityScore: relayPriority(decision),
  };
}

function defaultBullets(
  focusTeam: string,
  athletePlans: WeekendAthletePlan[],
  relayPlans: WeekendRelayPlan[],
) {
  const first = athletePlans[0];
  const relay = relayPlans.find((plan) => plan.call === "Protect individuals") ?? relayPlans[0];
  const bullets: string[] = [];

  if (first) {
    bullets.push(
      `${first.athleteName}: ${first.instruction} ${first.reason}`,
    );
  }

  if (relay) {
    bullets.push(`${relay.relayLabel}: ${relay.recommendation}`);
  }

  bullets.push(
    `This is based on the saved ${focusTeam} team view. Switching and saving a different focus school rebuilds these calls from that team's rankings and depth chart.`,
  );

  return bullets;
}

function expectedAdds(plans: WeekendAthletePlan[], weight = 1) {
  const value = plans.reduce((sum, plan) => {
    const state = Number.parseInt(plan.stateProbabilityLabel, 10) || 0;
    const improve = Number.parseInt(plan.improveProbabilityLabel, 10) || 0;
    return sum + Math.max(state, improve * 0.72) / 100;
  }, 0);

  return `${Math.max(0.1, value * weight).toFixed(1)} likely state entries`;
}

function entryFromAthlete(
  plan: WeekendAthletePlan,
  meetPlan: string,
  priorityLabel = plan.coachCallLabel,
): WeekendScenarioEntry {
  return {
    id: `${plan.id}-${meetPlan}`,
    label: priorityLabel,
    athleteOrRelay: plan.athleteName,
    eventLabel: plan.eventLabel,
    meetPlan: plan.weekendEntryLabels.length
      ? `${meetPlan}; entered ${plan.weekendEntryLabels.join("; ")}`
      : meetPlan,
    oddsLabel: plan.weekendStateMarkChanceLabel
      ? `${plan.weekendStateMarkChanceLabel} weekend mark / ${plan.stateProbabilityLabel} state`
      : `${plan.stateProbabilityLabel} state / ${plan.improveProbabilityLabel} improve`,
    priorityLabel,
    reason: [
      plan.reason,
      plan.eventChoiceNote,
      plan.repeatWarning,
      plan.restAdvice,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function entryFromRelay(plan: WeekendRelayPlan, meetPlan: string): WeekendScenarioEntry {
  return {
    id: `${plan.id}-${meetPlan}`,
    label: plan.call,
    athleteOrRelay: plan.relayLabel,
    eventLabel: plan.relayLabel,
    meetPlan,
    oddsLabel: `${plan.relayStateOddsLabel} state`,
    priorityLabel: plan.call,
    reason: plan.recommendation,
  };
}

function buildScenarioPlans(
  athletePlans: WeekendAthletePlan[],
  relayPlans: WeekendRelayPlan[],
): WeekendScenarioPlan[] {
  const topIndividuals = athletePlans
    .filter((plan) => !plan.eventLabel.includes("Relay"))
    .slice(0, 7);
  const fridayIndividuals = topIndividuals.filter((plan) =>
    plan.primarySlotLabel?.includes("Friday"),
  );
  const saturdayBackups = topIndividuals.filter((plan) =>
    plan.backupSlotLabel?.includes("Saturday"),
  );
  const repeatableSaturdayBackups = saturdayBackups.filter(
    (plan) => !plan.eventLabel.includes("3200m"),
  );
  const restPlans = athletePlans.filter((plan) => plan.restAdvice);
  const chaseableRelays = relayPlans.filter(
    (plan) => plan.call === "Chase relay" || plan.call === "Conditional chase",
  );
  const protectedRelays = relayPlans.filter(
    (plan) => plan.call === "Protect individuals",
  );
  const relayFirstEntries = [
    ...chaseableRelays.slice(0, 3).map((plan) =>
      entryFromRelay(
        plan,
        plan.primarySlotLabel ?? "Best available relay window",
      ),
    ),
    ...protectedRelays.slice(0, 2).map((plan) =>
      entryFromRelay(
        plan,
        `Only with alternates${plan.primarySlotLabel ? ` at ${plan.primarySlotLabel}` : ""}`,
      ),
    ),
  ];

  return [
    {
      id: "st-vrain-first",
      title: "St. Vrain first",
      subtitle: "Use Friday as the fresh shot for the highest-upside individuals.",
      objective: "Maximize state qualifiers before Saturday fatigue enters the model.",
      expectedStateAddsLabel: expectedAdds(fridayIndividuals, 1),
      riskLabel: "Lowest fatigue risk",
      entries: fridayIndividuals.slice(0, 6).map((plan) =>
        entryFromAthlete(
          plan,
          plan.eventLabel.includes("3200m")
            ? `${plan.primarySlotLabel ?? "St. Vrain"} only; do not repeat 3200 Saturday`
            : plan.primarySlotLabel ?? "St. Vrain first available slot",
          plan.gradeLabel === "Senior" ? "Protect senior" : plan.coachCallLabel,
        ),
      ),
    },
    {
      id: "split-weekend",
      title: "St. Vrain + Teddy backup",
      subtitle: "Race Friday fresh, then use Saturday only for misses or low-conflict backups.",
      objective: "Get the most kids to state without stacking hard doubles unnecessarily.",
      expectedStateAddsLabel: expectedAdds(topIndividuals, 1.08),
      riskLabel: "Balanced",
      entries: [
        ...fridayIndividuals.slice(0, 4).map((plan) =>
          entryFromAthlete(
            plan,
            plan.eventLabel.includes("3200m")
              ? `${plan.primarySlotLabel ?? "Friday"} only; Teddy 3200 only if no Friday start`
              : `${plan.primarySlotLabel ?? "Friday"}; Teddy only if needed`,
          ),
        ),
        ...repeatableSaturdayBackups.slice(0, 2).map((plan) =>
          entryFromAthlete(
            plan,
            plan.backupSlotLabel ?? "Teddy backup",
            "Backup attempt",
          ),
        ),
      ],
    },
    {
      id: "teddy-only",
      title: "Teddy only",
      subtitle: "One-shot Saturday plan if St. Vrain is not available.",
      objective: "Prioritize the athletes whose event profile says one more race can move the mark.",
      expectedStateAddsLabel: expectedAdds(saturdayBackups, 0.82),
      riskLabel: "Higher pressure",
      entries: saturdayBackups.slice(0, 7).map((plan) =>
        entryFromAthlete(
          plan,
          plan.backupSlotLabel ?? "Teddy only",
          plan.gradeLabel === "Senior" ? "Senior one-shot" : plan.coachCallLabel,
        ),
      ),
    },
    {
      id: "relay-first",
      title: "Relay-first version",
      subtitle: "Only use this if the relay path is clearly better than the open-event path.",
      objective: "Check whether relay depth improves state odds without sacrificing top individuals.",
      expectedStateAddsLabel: relayFirstEntries.length
        ? `${relayFirstEntries.length} relay decisions`
        : "No relay-first edge",
      riskLabel: protectedRelays.length ? "High individual cost" : "Manageable",
      entries: relayFirstEntries.length
        ? relayFirstEntries
        : [
            ...topIndividuals
              .slice(0, 3)
              .map((plan) =>
                entryFromAthlete(
                  plan,
                  plan.primarySlotLabel ?? "Individual first",
                  "No relay edge",
                ),
              ),
          ],
    },
    {
      id: "rest-protect",
      title: "Rest / protect",
      subtitle: "Use this when the athlete or relay is already safely in.",
      objective:
        "Protect state-weekend freshness instead of chasing a mark that does not materially change qualifying or scoring.",
      expectedStateAddsLabel: restPlans.length
        ? `${restPlans.length} protect calls`
        : "No rest calls",
      riskLabel: "Best freshness",
      entries: restPlans.slice(0, 7).map((plan) =>
        entryFromAthlete(
          plan,
          plan.restAdvice ?? "Rest or controlled tune-up",
          "Rest/protect",
        ),
      ),
    },
  ];
}

function buildDecisionTree(
  scenarioPlans: WeekendScenarioPlan[],
): WeekendDecisionNode[] {
  const hasRelayFirst =
    scenarioPlans.find((plan) => plan.id === "relay-first")?.riskLabel !==
    "No relay-first edge";

  return [
    {
      id: "friday-access",
      question: "Can this team race St. Vrain on Friday?",
      yes: "Use the fresh Friday plan first.",
      no: "Use the Teddy-only one-shot plan.",
      scenarioId: "st-vrain-first",
    },
    {
      id: "friday-result",
      question: "Did Friday get the needed mark?",
      yes: "Scratch the Saturday backup and protect recovery.",
      no: "Move only the top misses to Teddy.",
      scenarioId: "split-weekend",
    },
    {
      id: "relay-cost",
      question: "Does the relay need a senior or high-upside individual?",
      yes: "Protect the individual unless the relay has the better state-points path.",
      no: hasRelayFirst
        ? "A relay chase can be considered."
        : "Keep the plan individual-first.",
      scenarioId: "relay-first",
    },
    {
      id: "saturday-only",
      question: "If Saturday is the only meet, who gets the one shot?",
      yes: "Use the Teddy-only priority order.",
      no: "Do not double athletes just to chase a low-probability mark.",
      scenarioId: "teddy-only",
    },
    {
      id: "rest-safe",
      question: "Is the athlete already safely in or projected to score?",
      yes: "Rest or use a controlled tune-up if it helps rhythm.",
      no: "Keep them in the last-chance decision tree.",
      scenarioId: "rest-protect",
    },
  ];
}

export function buildWeekendStrategy({
  focusTeam,
  recommendations,
  relayDecisions,
  finalizedHokaEntries,
}: {
  focusTeam: string;
  recommendations: LastChanceRecommendation[];
  relayDecisions: RelayChaseDecision[];
  finalizedHokaEntries?: Iterable<FinalizedHokaEntry>;
}): WeekendStrategy {
  const finalizedHokaEntrySet = hokaEntrySet(finalizedHokaEntries);
  const focusRows = recommendations.filter((row) => row.school === focusTeam);
  const individualFocusRows = focusRows.filter(
    (row) => !getEventDefinition(row.event).relay,
  );
  const athleteRows = individualRowsByAthlete(individualFocusRows);
  const athletePlans = individualFocusRows
    .sort((a, b) => priorityForRow(b) - priorityForRow(a))
    .map((row) =>
      buildAthletePlan(
        row,
        athleteRows.get(athleteKey(row.athleteName)),
        finalizedHokaEntrySet,
      ),
    );
  const relayPlans = relayDecisions
    .map((decision) =>
      buildRelayPlan(decision, athleteRows, focusTeam, finalizedHokaEntrySet),
    )
    .sort((a, b) => b.priorityScore - a.priorityScore);
  const hokaEventForecasts = buildHokaEventForecasts(
    recommendations,
    focusTeam,
    finalizedHokaEntrySet,
  );
  const weekendMeetSummaries = buildWeekendMeetSummaries(
    recommendations,
    focusTeam,
  );
  const scenarioPlans = buildScenarioPlans(athletePlans, relayPlans);

  return {
    focusTeam,
    basisLabel: `Using saved team view: ${focusTeam}`,
    quickQuestions: [
      "Who should race fresh Friday?",
      "Who is entered at Windjammer or Friday Night Lights?",
      "Who is entered at Teddy's?",
      "Should we chase 4x800?",
      "Should we chase 4x400?",
      "Which seniors should we protect?",
      "Who should rest?",
    ],
    defaultAnswerTitle: "Weekend decision read",
    defaultAnswerBullets: defaultBullets(focusTeam, athletePlans, relayPlans),
    athletePlans,
    relayPlans,
    hokaEventForecasts,
    weekendMeetSummaries,
    scenarioPlans,
    decisionTree: buildDecisionTree(scenarioPlans),
    scheduleNotes: [
      "St. Vrain is Friday, so it is the preferred fresh attempt for priority individual marks.",
      "Windjammer and Friday Night Lights are also loaded from public entries; if an athlete is entered there, the weekend mark chance gets a field-quality boost.",
      "Teddy's is Saturday, so treat it as the backup plan or a second attempt after seeing Friday results.",
      ...weatherPlanNotes(),
      "A relay chase should not pull a senior or high-state-odds athlete away from the best individual qualifying chance unless the relay has a better state-points path.",
      "For the 3200, the model treats Friday and Saturday as either/or, not back-to-back attempts. Safe distance qualifiers are rest-first unless a controlled tune-up has a clear purpose.",
    ],
  };
}
