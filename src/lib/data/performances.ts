import type {
  Classification,
  EventKey,
  Gender,
  Performance,
  SourceKind,
  TimingType,
  VerificationStatus,
} from "@/types/domain";
import { current3ABrowserRankingPerformances } from "@/lib/data/current3ABrowserRankings.generated";
import { current3AMaxPrepsRankingPerformances } from "@/lib/data/current3AMaxPrepsRankings.generated";
import { current4AMaxPrepsRankingPerformances } from "@/lib/data/current4AMaxPrepsRankings.generated";
import { current5ABrowserRankingPerformances } from "@/lib/data/current5ABrowserRankings.generated";
import { current5AMaxPrepsRankingPerformances } from "@/lib/data/current5AMaxPrepsRankings.generated";
import { currentAthleticLiveLastChancePerformances } from "@/lib/data/currentAthleticLiveLastChanceResults.generated";
import { currentMileSplitPerformances } from "@/lib/data/currentPerformances";
import { getEventDefinition } from "@/lib/data/events";
import { applyClassifications } from "@/lib/services/classification";
import { comparePerformanceMarks, parsePerformanceMark } from "@/lib/utils/time";
import { stableId } from "@/lib/utils/text";

interface PerformanceSeed {
  athleteName: string;
  gender: Gender;
  grade?: number;
  school: string;
  event: EventKey;
  markRaw: string;
  meetName: string;
  meetDate: string;
  source?: SourceKind;
  sourceUrl?: string;
  timingType?: TimingType;
  verificationStatus?: VerificationStatus;
  classificationVerified?: boolean;
  notes?: string;
}

function perf(seed: PerformanceSeed): Performance {
  const markValue = parsePerformanceMark(seed.event, seed.markRaw);

  if (markValue === undefined) {
    throw new Error(`Invalid seed mark: ${seed.markRaw}`);
  }

  const timingType =
    seed.timingType ??
    (getEventDefinition(seed.event).markType === "distance" ? "Field" : "FAT");

  return {
    id: stableId([
      seed.athleteName,
      seed.school,
      seed.event,
      seed.markRaw,
      seed.meetDate,
    ]),
    athleteName: seed.athleteName,
    gender: seed.gender,
    grade: seed.grade,
    school: seed.school,
    event: seed.event,
    markRaw: seed.markRaw,
    markValue,
    timingType,
    isFAT: timingType === "FAT",
    meetName: seed.meetName,
    meetDate: seed.meetDate,
    source: seed.source ?? "official_timing",
    sourceUrl: seed.sourceUrl,
    verificationStatus: seed.verificationStatus ?? "verified",
    classificationVerified: seed.classificationVerified ?? true,
    notes: seed.notes,
  };
}

const basePerformances: Performance[] = [
  perf({
    athleteName: "Logan Reid",
    gender: "Boys",
    grade: 12,
    school: "Niwot",
    event: "1600m",
    markRaw: "4:12.84",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
    sourceUrl: "https://finishedresults.trackscoreboard.com/example/st-vrain",
  }),
  perf({
    athleteName: "Owen Morales",
    gender: "Boys",
    grade: 11,
    school: "Cheyenne Mountain",
    event: "1600m",
    markRaw: "4:15.32",
    meetName: "Niwot Invitational",
    meetDate: "2026-03-28",
    sourceUrl: "https://live.tfmeetpro.com/example/niwot-invitational",
  }),
  perf({
    athleteName: "Eli Carter",
    gender: "Boys",
    grade: 12,
    school: "Battle Mountain",
    event: "1600m",
    markRaw: "4:17.09",
    meetName: "Pomona Invitational",
    meetDate: "2026-04-04",
    source: "athletic_net",
    sourceUrl: "https://www.athletic.net/TrackAndField/meet/example",
  }),
  perf({
    athleteName: "Miles Peterson",
    gender: "Boys",
    grade: 10,
    school: "Thompson Valley",
    event: "1600m",
    markRaw: "4:18.41",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
    sourceUrl: "https://finishedresults.trackscoreboard.com/example/st-vrain",
  }),
  perf({
    athleteName: "Noah Jensen",
    gender: "Boys",
    grade: 11,
    school: "Centaurus",
    event: "1600m",
    markRaw: "4:19.22",
    meetName: "Niwot Invitational",
    meetDate: "2026-03-28",
  }),
  perf({
    athleteName: "Ben Kline",
    gender: "Boys",
    grade: 12,
    school: "D'Evelyn",
    event: "1600m",
    markRaw: "4:20.01",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
  }),
  perf({
    athleteName: "Sawyer Holt",
    gender: "Boys",
    grade: 11,
    school: "Durango",
    event: "1600m",
    markRaw: "4:21.63",
    meetName: "Pomona Invitational",
    meetDate: "2026-04-04",
    source: "milesplit",
  }),
  perf({
    athleteName: "Jack Morgan",
    gender: "Boys",
    grade: 12,
    school: "Erie",
    event: "1600m",
    markRaw: "4:22.48",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
  }),
  perf({
    athleteName: "Leo Russell",
    gender: "Boys",
    grade: 10,
    school: "Golden",
    event: "1600m",
    markRaw: "4:23.15",
    meetName: "Niwot Invitational",
    meetDate: "2026-03-28",
  }),
  perf({
    athleteName: "Mason Walsh",
    gender: "Boys",
    grade: 12,
    school: "Silver Creek",
    event: "1600m",
    markRaw: "4:24.08",
    meetName: "Pomona Invitational",
    meetDate: "2026-04-04",
  }),
  perf({
    athleteName: "Logan Reid",
    gender: "Boys",
    grade: 12,
    school: "Niwot",
    event: "1600m",
    markRaw: "4:25.20",
    meetName: "Niwot Invitational",
    meetDate: "2026-03-28",
    notes: "Slower duplicate should be excluded from ranking.",
  }),
  perf({
    athleteName: "Henry Brooks",
    gender: "Boys",
    grade: 9,
    school: "Green Mountain",
    event: "1600m",
    markRaw: "4:24.91",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
  }),
  perf({
    athleteName: "Aiden Flores",
    gender: "Boys",
    grade: 12,
    school: "Longmont",
    event: "1600m",
    markRaw: "4:25.66",
    meetName: "Pomona Invitational",
    meetDate: "2026-04-04",
  }),
  perf({
    athleteName: "Caleb Price",
    gender: "Boys",
    grade: 11,
    school: "Riverdale Ridge",
    event: "1600m",
    markRaw: "4:26.19",
    meetName: "Niwot Invitational",
    meetDate: "2026-03-28",
  }),
  perf({
    athleteName: "Mateo Silva",
    gender: "Boys",
    grade: 12,
    school: "Palisade",
    event: "1600m",
    markRaw: "4:27.03",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
  }),
  perf({
    athleteName: "Wyatt Neal",
    gender: "Boys",
    grade: 11,
    school: "Severance",
    event: "1600m",
    markRaw: "4:28.77",
    meetName: "Pomona Invitational",
    meetDate: "2026-04-04",
  }),
  perf({
    athleteName: "Ethan Kim",
    gender: "Boys",
    grade: 10,
    school: "Standley Lake",
    event: "1600m",
    markRaw: "4:29.28",
    meetName: "Niwot Invitational",
    meetDate: "2026-03-28",
  }),
  perf({
    athleteName: "Isaac Romero",
    gender: "Boys",
    grade: 12,
    school: "Widefield",
    event: "1600m",
    markRaw: "4:30.12",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
  }),
  perf({
    athleteName: "Cole Martin",
    gender: "Boys",
    grade: 11,
    school: "The Classical Academy",
    event: "1600m",
    markRaw: "4:31.44",
    meetName: "Pomona Invitational",
    meetDate: "2026-04-04",
  }),
  perf({
    athleteName: "Parker Stone",
    gender: "Boys",
    grade: 12,
    school: "Unknown Track Club",
    event: "1600m",
    markRaw: "4:18.90",
    meetName: "Manual pasted results batch",
    meetDate: "2026-04-25",
    source: "manual",
    verificationStatus: "needs_review",
    classificationVerified: false,
    notes: "Unattached or club source should stay out of rankings until resolved.",
  }),
  perf({
    athleteName: "Owen Morales",
    gender: "Boys",
    grade: 11,
    school: "Cheyenne Mountain",
    event: "3200m",
    markRaw: "9:12.18",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
  }),
  perf({
    athleteName: "Eli Carter",
    gender: "Boys",
    grade: 12,
    school: "Battle Mountain",
    event: "3200m",
    markRaw: "9:16.73",
    meetName: "Niwot Invitational",
    meetDate: "2026-03-28",
  }),
  perf({
    athleteName: "Miles Peterson",
    gender: "Boys",
    grade: 10,
    school: "Thompson Valley",
    event: "3200m",
    markRaw: "9:18.02",
    meetName: "Pomona Invitational",
    meetDate: "2026-04-04",
    source: "athletic_net",
  }),
  perf({
    athleteName: "Noah Jensen",
    gender: "Boys",
    grade: 11,
    school: "Centaurus",
    event: "3200m",
    markRaw: "9:20.41",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
  }),
  perf({
    athleteName: "Sawyer Holt",
    gender: "Boys",
    grade: 11,
    school: "Durango",
    event: "3200m",
    markRaw: "9:24.92",
    meetName: "Pomona Invitational",
    meetDate: "2026-04-04",
  }),
  perf({
    athleteName: "Jack Morgan",
    gender: "Boys",
    grade: 12,
    school: "Erie",
    event: "3200m",
    markRaw: "9:27.11",
    meetName: "Niwot Invitational",
    meetDate: "2026-03-28",
  }),
  perf({
    athleteName: "Mason Walsh",
    gender: "Boys",
    grade: 12,
    school: "Silver Creek",
    event: "3200m",
    markRaw: "9:29.88",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
  }),
  perf({
    athleteName: "Aiden Flores",
    gender: "Boys",
    grade: 12,
    school: "Longmont",
    event: "3200m",
    markRaw: "9:31.04",
    meetName: "Pomona Invitational",
    meetDate: "2026-04-04",
  }),
  perf({
    athleteName: "Caleb Price",
    gender: "Boys",
    grade: 11,
    school: "Riverdale Ridge",
    event: "3200m",
    markRaw: "9:35.67",
    meetName: "Niwot Invitational",
    meetDate: "2026-03-28",
  }),
  perf({
    athleteName: "Mateo Silva",
    gender: "Boys",
    grade: 12,
    school: "Palisade",
    event: "3200m",
    markRaw: "9:37.45",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
  }),
  perf({
    athleteName: "Nora Bennett",
    gender: "Girls",
    grade: 12,
    school: "Niwot",
    event: "1600m",
    markRaw: "4:53.18",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
  }),
  perf({
    athleteName: "Avery Collins",
    gender: "Girls",
    grade: 11,
    school: "Cheyenne Mountain",
    event: "1600m",
    markRaw: "4:56.42",
    meetName: "Niwot Invitational",
    meetDate: "2026-03-28",
  }),
  perf({
    athleteName: "Mia Sanchez",
    gender: "Girls",
    grade: 12,
    school: "Thompson Valley",
    event: "1600m",
    markRaw: "4:58.03",
    meetName: "Pomona Invitational",
    meetDate: "2026-04-04",
  }),
  perf({
    athleteName: "Lila Anderson",
    gender: "Girls",
    grade: 10,
    school: "Battle Mountain",
    event: "1600m",
    markRaw: "5:00.66",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
  }),
  perf({
    athleteName: "Emma Brooks",
    gender: "Girls",
    grade: 11,
    school: "Centaurus",
    event: "1600m",
    markRaw: "5:03.27",
    meetName: "Niwot Invitational",
    meetDate: "2026-03-28",
  }),
  perf({
    athleteName: "Grace Kim",
    gender: "Girls",
    grade: 12,
    school: "D'Evelyn",
    event: "1600m",
    markRaw: "5:05.91",
    meetName: "Pomona Invitational",
    meetDate: "2026-04-04",
  }),
  perf({
    athleteName: "Ivy Ross",
    gender: "Girls",
    grade: 9,
    school: "Durango",
    event: "1600m",
    markRaw: "5:07.14",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
  }),
  perf({
    athleteName: "Sophie Turner",
    gender: "Girls",
    grade: 12,
    school: "Erie",
    event: "1600m",
    markRaw: "5:08.82",
    meetName: "Pomona Invitational",
    meetDate: "2026-04-04",
  }),
  perf({
    athleteName: "Clara Evans",
    gender: "Girls",
    grade: 11,
    school: "Golden",
    event: "1600m",
    markRaw: "5:10.08",
    meetName: "Niwot Invitational",
    meetDate: "2026-03-28",
  }),
  perf({
    athleteName: "Zoe Patel",
    gender: "Girls",
    grade: 10,
    school: "Silver Creek",
    event: "1600m",
    markRaw: "5:12.44",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
  }),
  perf({
    athleteName: "Nora Bennett",
    gender: "Girls",
    grade: 12,
    school: "Niwot",
    event: "3200m",
    markRaw: "10:36.22",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
  }),
  perf({
    athleteName: "Avery Collins",
    gender: "Girls",
    grade: 11,
    school: "Cheyenne Mountain",
    event: "3200m",
    markRaw: "10:45.80",
    meetName: "Niwot Invitational",
    meetDate: "2026-03-28",
  }),
  perf({
    athleteName: "Mia Sanchez",
    gender: "Girls",
    grade: 12,
    school: "Thompson Valley",
    event: "3200m",
    markRaw: "10:51.13",
    meetName: "Pomona Invitational",
    meetDate: "2026-04-04",
  }),
  perf({
    athleteName: "Lila Anderson",
    gender: "Girls",
    grade: 10,
    school: "Battle Mountain",
    event: "3200m",
    markRaw: "10:57.64",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
  }),
  perf({
    athleteName: "Emma Brooks",
    gender: "Girls",
    grade: 11,
    school: "Centaurus",
    event: "3200m",
    markRaw: "11:03.21",
    meetName: "Niwot Invitational",
    meetDate: "2026-03-28",
  }),
  perf({
    athleteName: "Grace Kim",
    gender: "Girls",
    grade: 12,
    school: "D'Evelyn",
    event: "3200m",
    markRaw: "11:08.78",
    meetName: "Pomona Invitational",
    meetDate: "2026-04-04",
  }),
  perf({
    athleteName: "Ivy Ross",
    gender: "Girls",
    grade: 9,
    school: "Durango",
    event: "3200m",
    markRaw: "11:14.32",
    meetName: "St. Vrain Invitational",
    meetDate: "2026-04-18",
  }),
  perf({
    athleteName: "Sophie Turner",
    gender: "Girls",
    grade: 12,
    school: "Erie",
    event: "3200m",
    markRaw: "11:20.09",
    meetName: "Pomona Invitational",
    meetDate: "2026-04-04",
  }),
  perf({
    athleteName: "Manual Runner",
    gender: "Girls",
    grade: 11,
    school: "Niwot",
    event: "3200m",
    markRaw: "11:01.00",
    meetName: "Manual pasted results batch",
    meetDate: "2026-04-25",
    source: "manual",
    verificationStatus: "needs_review",
    notes: "Manual parse candidates require review before rankings.",
  }),
  perf({
    athleteName: "Hand Timed Runner",
    gender: "Girls",
    grade: 12,
    school: "Golden",
    event: "1600m",
    markRaw: "5:01.2",
    meetName: "Manual pasted results batch",
    meetDate: "2026-04-25",
    source: "manual",
    timingType: "Hand",
    verificationStatus: "needs_review",
    notes: "Hand time excluded unless manually approved.",
  }),
];

const supplementalSeeds: PerformanceSeed[] = [
  { athleteName: "Kai Mitchell", gender: "Boys", grade: 12, school: "Niwot", event: "100m", markRaw: "10.84", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Jace Walker", gender: "Boys", grade: 11, school: "Riverdale Ridge", event: "100m", markRaw: "10.91", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Tessa Grant", gender: "Girls", grade: 12, school: "Erie", event: "100m", markRaw: "12.02", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Amaya Lee", gender: "Girls", grade: 11, school: "Longmont", event: "100m", markRaw: "12.14", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Kai Mitchell", gender: "Boys", grade: 12, school: "Niwot", event: "200m", markRaw: "21.78", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Dante Moore", gender: "Boys", grade: 12, school: "Golden", event: "200m", markRaw: "22.04", meetName: "Niwot Invitational", meetDate: "2026-03-28" },
  { athleteName: "Tessa Grant", gender: "Girls", grade: 12, school: "Erie", event: "200m", markRaw: "24.74", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Maren Blake", gender: "Girls", grade: 10, school: "Silver Creek", event: "200m", markRaw: "25.18", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Dante Moore", gender: "Boys", grade: 12, school: "Golden", event: "400m", markRaw: "48.62", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Evan Brooks", gender: "Boys", grade: 11, school: "Centaurus", event: "400m", markRaw: "49.18", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Maren Blake", gender: "Girls", grade: 10, school: "Silver Creek", event: "400m", markRaw: "56.21", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Ari Chavez", gender: "Girls", grade: 12, school: "Niwot", event: "400m", markRaw: "57.08", meetName: "Niwot Invitational", meetDate: "2026-03-28" },
  { athleteName: "Sam Ortega", gender: "Boys", grade: 12, school: "Cheyenne Mountain", event: "800m", markRaw: "1:53.44", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Henry Brooks", gender: "Boys", grade: 9, school: "Green Mountain", event: "800m", markRaw: "1:55.02", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Ari Chavez", gender: "Girls", grade: 12, school: "Niwot", event: "800m", markRaw: "2:11.38", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Lila Anderson", gender: "Girls", grade: 10, school: "Battle Mountain", event: "800m", markRaw: "2:14.73", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Carter Hayes", gender: "Boys", grade: 12, school: "Thompson Valley", event: "110m Hurdles", markRaw: "14.52", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Ronan West", gender: "Boys", grade: 11, school: "Widefield", event: "110m Hurdles", markRaw: "14.83", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Ella Foster", gender: "Girls", grade: 12, school: "Cheyenne Mountain", event: "100m Hurdles", markRaw: "14.72", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Maya Wilson", gender: "Girls", grade: 11, school: "Durango", event: "100m Hurdles", markRaw: "15.04", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Carter Hayes", gender: "Boys", grade: 12, school: "Thompson Valley", event: "300m Hurdles", markRaw: "38.82", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Ronan West", gender: "Boys", grade: 11, school: "Widefield", event: "300m Hurdles", markRaw: "39.28", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Ella Foster", gender: "Girls", grade: 12, school: "Cheyenne Mountain", event: "300m Hurdles", markRaw: "44.62", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Maya Wilson", gender: "Girls", grade: 11, school: "Durango", event: "300m Hurdles", markRaw: "45.11", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Niwot Relay", gender: "Boys", school: "Niwot", event: "4x100m Relay", markRaw: "42.12", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Erie Relay", gender: "Boys", school: "Erie", event: "4x100m Relay", markRaw: "42.48", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Erie Relay", gender: "Girls", school: "Erie", event: "4x100m Relay", markRaw: "48.21", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Longmont Relay", gender: "Girls", school: "Longmont", event: "4x100m Relay", markRaw: "48.74", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Niwot Relay", gender: "Boys", school: "Niwot", event: "4x200m Relay", markRaw: "1:28.80", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Golden Relay", gender: "Boys", school: "Golden", event: "4x200m Relay", markRaw: "1:30.04", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Erie Relay", gender: "Girls", school: "Erie", event: "4x200m Relay", markRaw: "1:42.33", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Niwot Relay", gender: "Girls", school: "Niwot", event: "4x200m Relay", markRaw: "1:43.15", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Cheyenne Mountain Relay", gender: "Boys", school: "Cheyenne Mountain", event: "4x400m Relay", markRaw: "3:22.91", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Niwot Relay", gender: "Boys", school: "Niwot", event: "4x400m Relay", markRaw: "3:24.10", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Niwot Relay", gender: "Girls", school: "Niwot", event: "4x400m Relay", markRaw: "3:55.20", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Silver Creek Relay", gender: "Girls", school: "Silver Creek", event: "4x400m Relay", markRaw: "3:59.77", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Niwot Relay", gender: "Boys", school: "Niwot", event: "4x800m Relay", markRaw: "7:55.62", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Cheyenne Mountain Relay", gender: "Boys", school: "Cheyenne Mountain", event: "4x800m Relay", markRaw: "8:00.14", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Niwot Relay", gender: "Girls", school: "Niwot", event: "4x800m Relay", markRaw: "9:18.43", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Battle Mountain Relay", gender: "Girls", school: "Battle Mountain", event: "4x800m Relay", markRaw: "9:31.55", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Grant Miller", gender: "Boys", grade: 12, school: "Palisade", event: "High Jump", markRaw: "6-06", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Drew Nelson", gender: "Boys", grade: 11, school: "Severance", event: "High Jump", markRaw: "6-04", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Kate Miller", gender: "Girls", grade: 12, school: "Golden", event: "High Jump", markRaw: "5-08", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Paige Ellis", gender: "Girls", grade: 11, school: "The Classical Academy", event: "High Jump", markRaw: "5-06", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Luke Bryant", gender: "Boys", grade: 12, school: "Longmont", event: "Pole Vault", markRaw: "15-00", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Nate Cross", gender: "Boys", grade: 11, school: "Centaurus", event: "Pole Vault", markRaw: "14-06", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Molly Chen", gender: "Girls", grade: 12, school: "Niwot", event: "Pole Vault", markRaw: "12-06", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Ainsley Park", gender: "Girls", grade: 11, school: "D'Evelyn", event: "Pole Vault", markRaw: "12-00", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Marcus Hill", gender: "Boys", grade: 12, school: "Widefield", event: "Long Jump", markRaw: "22-07.50", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Jace Walker", gender: "Boys", grade: 11, school: "Riverdale Ridge", event: "Long Jump", markRaw: "22-01.25", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Amaya Lee", gender: "Girls", grade: 11, school: "Longmont", event: "Long Jump", markRaw: "18-04.75", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Tessa Grant", gender: "Girls", grade: 12, school: "Erie", event: "Long Jump", markRaw: "18-01.50", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Marcus Hill", gender: "Boys", grade: 12, school: "Widefield", event: "Triple Jump", markRaw: "45-10.25", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Drew Nelson", gender: "Boys", grade: 11, school: "Severance", event: "Triple Jump", markRaw: "44-08.50", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Paige Ellis", gender: "Girls", grade: 11, school: "The Classical Academy", event: "Triple Jump", markRaw: "37-02.25", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Molly Chen", gender: "Girls", grade: 12, school: "Niwot", event: "Triple Jump", markRaw: "36-08.75", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Cole Jensen", gender: "Boys", grade: 12, school: "Thompson Valley", event: "Shot Put", markRaw: "55-04.50", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Ty Adams", gender: "Boys", grade: 11, school: "Palisade", event: "Shot Put", markRaw: "52-11.00", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Sienna Wells", gender: "Girls", grade: 12, school: "Durango", event: "Shot Put", markRaw: "42-03.00", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Reese Young", gender: "Girls", grade: 11, school: "Green Mountain", event: "Shot Put", markRaw: "40-07.50", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Cole Jensen", gender: "Boys", grade: 12, school: "Thompson Valley", event: "Discus", markRaw: "166-08", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Ty Adams", gender: "Boys", grade: 11, school: "Palisade", event: "Discus", markRaw: "158-11", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
  { athleteName: "Sienna Wells", gender: "Girls", grade: 12, school: "Durango", event: "Discus", markRaw: "139-06", meetName: "Pomona Invitational", meetDate: "2026-04-04" },
  { athleteName: "Reese Young", gender: "Girls", grade: 11, school: "Green Mountain", event: "Discus", markRaw: "130-02", meetName: "St. Vrain Invitational", meetDate: "2026-04-18" },
];

const mockPerformances: Performance[] = [
  ...basePerformances,
  ...supplementalSeeds.map(perf),
];

function performanceScopeKey(performance: {
  classification?: Classification;
  gender: Gender;
  event: EventKey;
}) {
  return `${performance.classification ?? "unknown"}|${performance.gender}|${performance.event}`;
}

function maxPrepsPrimaryScopeCutoffs(maxPrepsRows: Performance[]) {
  const byScope = new Map<string, Map<string, Performance>>();

  for (const performance of maxPrepsRows) {
    if (
      performance.source !== "maxpreps" ||
      performance.verificationStatus !== "verified" ||
      !performance.classificationVerified ||
      !performance.classification
    ) {
      continue;
    }

    const key = performanceScopeKey(performance);
    const definition = getEventDefinition(performance.event);
    const athleteKey = definition.relay
      ? performance.school.toLowerCase()
      : `${performance.athleteName.toLowerCase()}|${performance.school.toLowerCase()}`;
    const scoped = byScope.get(key) ?? new Map<string, Performance>();
    const existing = scoped.get(athleteKey);

    if (
      !existing ||
      comparePerformanceMarks(
        performance.event,
        performance.markValue,
        existing.markValue,
      ) < 0
    ) {
      scoped.set(athleteKey, performance);
    }

    byScope.set(key, scoped);
  }

  return new Map(
    [...byScope.entries()]
      .map(([key, rows]) => {
        const ordered = [...rows.values()].sort((a, b) =>
          comparePerformanceMarks(a.event, a.markValue, b.markValue),
        );
        return [key, ordered.length >= 18 ? (ordered[49] ?? ordered.at(-1)) : undefined] as const;
      })
      .filter((entry): entry is [string, Performance] => Boolean(entry[1])),
  );
}

function gradeKey(performance: Performance, includeEvent: boolean) {
  return [
    performance.gender,
    includeEvent ? performance.event : "",
    performance.athleteName.toLowerCase(),
    performance.school.toLowerCase(),
  ].join("|");
}

function enrichMaxPrepsGrades(performances: Performance[]) {
  const gradeByEvent = new Map<string, number>();
  const gradeByAthlete = new Map<string, number>();

  for (const performance of performances) {
    if (!performance.grade) continue;
    gradeByEvent.set(gradeKey(performance, true), performance.grade);
    gradeByAthlete.set(gradeKey(performance, false), performance.grade);
  }

  return performances.map((performance) => {
    if (performance.source !== "maxpreps" || performance.grade) {
      return performance;
    }

    const grade =
      gradeByEvent.get(gradeKey(performance, true)) ??
      gradeByAthlete.get(gradeKey(performance, false));

    return grade ? { ...performance, grade } : performance;
  });
}

function preferFreshMaxPrepsRows(performances: Performance[]) {
  const maxPrepsRows = performances.filter(
    (performance) => performance.source === "maxpreps",
  );
  const primaryScopeCutoffs = maxPrepsPrimaryScopeCutoffs(maxPrepsRows);

  return performances.filter((performance) => {
    if (
      performance.source === "maxpreps" ||
      performance.source === "official_timing" ||
      performance.source === "athletic_net"
    ) {
      return true;
    }

    const cutoff = primaryScopeCutoffs.get(performanceScopeKey(performance));
    if (!cutoff) {
      return true;
    }

    return (
      comparePerformanceMarks(
        performance.event,
        performance.markValue,
        cutoff.markValue,
      ) > 0
    );
  });
}

const generatedPerformances = preferFreshMaxPrepsRows(
  enrichMaxPrepsGrades(
    applyClassifications([
      ...currentMileSplitPerformances,
      ...current3ABrowserRankingPerformances,
      ...current3AMaxPrepsRankingPerformances,
      ...current4AMaxPrepsRankingPerformances,
      ...current5ABrowserRankingPerformances,
      ...current5AMaxPrepsRankingPerformances,
      ...currentAthleticLiveLastChancePerformances,
    ]),
  ),
);

export const performances: Performance[] =
  currentMileSplitPerformances.length > 0
    ? generatedPerformances
    : mockPerformances;
