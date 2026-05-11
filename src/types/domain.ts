export type Classification = "1A" | "2A" | "3A" | "4A" | "5A";

export type EventSquadScope = Classification | "All";

export type Gender = "Boys" | "Girls";

export type EventKey =
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

export type EventDiscipline = "sprint" | "hurdle" | "distance" | "relay" | "jump" | "throw";

export interface EventDefinition {
  event: EventKey;
  slug: string;
  displayName: string;
  discipline: EventDiscipline;
  markType: "time" | "distance";
  sortDirection: "asc" | "desc";
  relay: boolean;
  genders: Gender[];
}

export type TimingType = "FAT" | "Hand" | "Field" | "Unknown";

export type VerificationStatus =
  | "verified"
  | "needs_review"
  | "rejected"
  | "manual_approved"
  | "depth_only";

export type DiscoveryStatus =
  | "not_started"
  | "discovering"
  | "sources_found"
  | "needs_review"
  | "failed";

export type MeetEligibilityStatus = "eligible" | "excluded" | "needs_review";

export type MeetSourceUrlStatus =
  | "pending_discovery"
  | "manual"
  | "discovered"
  | "none";

export type SourceKind =
  | "official_timing"
  | "athletic_net"
  | "milesplit"
  | "maxpreps"
  | "generic"
  | "manual";

export interface School {
  id: string;
  schoolName: string;
  classification: Classification;
  abbreviation?: string;
  aliases: string[];
  city: string;
  state: "CO";
  chsaaMember: boolean;
  lastVerified: string;
  source: "chsaa_track_bulletin_2026";
  sourceFile: string;
  sourcePage: number;
  abbreviationSourcePage?: number;
}

export interface Meet {
  id: string;
  name: string;
  date: string;
  rawDate?: string;
  startDate?: string;
  endDate?: string;
  location: string;
  eligibilityStatus?: MeetEligibilityStatus;
  sourceUrlStatus?: MeetSourceUrlStatus;
  statusLabel?: string;
  registrationStatus?: string;
  mileSplitUrl?: string;
  discoveredSourceUrls: string[];
  primaryResultsUrl?: string;
  secondaryResultsUrls: string[];
  timingCompany?: string;
  discoveryStatus: DiscoveryStatus;
  notes?: string;
}

export interface Performance {
  id: string;
  athleteName: string;
  gender: Gender;
  grade?: number;
  school: string;
  classification?: Classification;
  classificationVerified: boolean;
  event: EventKey;
  markRaw: string;
  markValue: number;
  timingType: TimingType;
  isFAT: boolean;
  meetName: string;
  meetDate: string;
  source: SourceKind;
  sourceUrl?: string;
  verificationStatus: VerificationStatus;
  notes?: string;
}

export interface ReviewFlag {
  id: string;
  performanceId: string;
  severity: "low" | "medium" | "high";
  reason: string;
  field?: keyof Performance;
}

export interface RankingRow extends Performance {
  rank: number;
  isBubble: boolean;
}

export interface RankingResult {
  classification: Classification;
  event: EventKey;
  gender: Gender;
  top18: RankingRow[];
  bubble: RankingRow[];
  excluded: Performance[];
}

export interface EventSquadAthlete extends RankingRow {
  squadSlot: number;
}

export interface EventSquadRankingRow {
  rank: number;
  school: string;
  classification: EventSquadScope;
  event: EventKey;
  gender: Gender;
  athletes: EventSquadAthlete[];
  aggregateValue: number;
  aggregateRaw: string;
  averageValue: number;
  averageRaw: string;
}

export interface EventSquadIncompleteRow {
  school: string;
  classification: EventSquadScope;
  event: EventKey;
  gender: Gender;
  athleteCount: number;
  bestAthlete?: RankingRow;
}

export interface EventSquadRankingResult {
  classification: EventSquadScope;
  event: EventKey;
  gender: Gender;
  squadSize: number;
  squads: EventSquadRankingRow[];
  incompleteSquads: EventSquadIncompleteRow[];
  eligibleAthleteCount: number;
}

export interface DiscoveredSource {
  url: string;
  source: SourceKind;
  score: number;
  label: string;
  reason: string;
}

export interface SourceDiscoveryResult {
  primaryResultsUrl?: string;
  secondaryResultsUrls: string[];
  discoveredSourceUrls: DiscoveredSource[];
  timingCompany?: string;
  status: DiscoveryStatus;
  notes: string[];
}

export interface StateMeetScheduleItem {
  id: string;
  day: "Thursday" | "Friday" | "Saturday";
  session: "Morning" | "Afternoon" | "Field";
  startTime: string;
  classification: Classification;
  gender: Gender;
  event: string;
  sourceFile: string;
}

export interface VirtualMeetEntry extends RankingRow {
  seed: number;
  projectedPlace?: number;
  projectedPoints: number;
  schedule?: StateMeetScheduleItem;
}

export interface TeamScore {
  school: string;
  gender: Gender | "Combined";
  points: number;
  scoringEntries: number;
}

export interface VirtualStateMeetEvent {
  event: EventKey;
  gender: Gender;
  schedule?: StateMeetScheduleItem;
  entries: VirtualMeetEntry[];
}

export interface VirtualStateMeet {
  classification: Classification;
  generatedAt: string;
  eventCap: number;
  scoringPlaces: number;
  events: VirtualStateMeetEvent[];
  teamScores: TeamScore[];
  notes: string[];
}

export interface DataProvider {
  id: string;
  name: string;
  source: SourceKind;
  baseUrl: string;
  coloradoScopeUrl: string;
  refreshCadenceMinutes: number;
  priority: number;
  enabled: boolean;
  notes: string;
}

export interface IngestionRun {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: "queued" | "running" | "completed" | "failed";
  providerIds: string[];
  meetsDiscovered: number;
  sourceUrlsDiscovered: number;
  candidatePerformances: number;
  flaggedCandidates: number;
  notes: string[];
}

export interface AutoUpdatePolicy {
  enabled: boolean;
  afterMeetDelayMinutes: number;
  steadyStateRefreshMinutes: number;
  providers: DataProvider[];
  verificationRule: string;
}
