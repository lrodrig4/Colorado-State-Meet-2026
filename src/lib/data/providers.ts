import type { AutoUpdatePolicy, DataProvider } from "@/types/domain";

export const dataProviders: DataProvider[] = [
  {
    id: "chsaa-official",
    name: "CHSAA / CHSAANow official",
    source: "official_timing",
    baseUrl: "https://chsaanow.com",
    coloradoScopeUrl:
      "https://chsaanow.com/sports/2021/7/23/track-and-field-information.aspx",
    refreshCadenceMinutes: 720,
    priority: 5,
    enabled: true,
    notes:
      "Highest-confidence source for state qualification rules, accepted-entry heat sheets, state qualifiers, and official full results. Used as the cutoff-history spine before timing-company and MileSplit data.",
  },
  {
    id: "rapid-results-live",
    name: "Rapid Results / AthleticLIVE public",
    source: "official_timing",
    baseUrl: "https://www.rapidresultslive.com",
    coloradoScopeUrl: "https://www.rapidresultslive.com",
    refreshCadenceMinutes: 60,
    priority: 4,
    enabled: true,
    notes:
      "Primary public timing archive for Colorado state meets and live meet links. Uses public pages/endpoints only; no hosted credentials.",
  },
  {
    id: "colorado-milesplit",
    name: "Colorado MileSplit",
    source: "milesplit",
    baseUrl: "https://co.milesplit.com",
    coloradoScopeUrl: "https://co.milesplit.com/calendar/colorado-outdoor-meet-calendar",
    refreshCadenceMinutes: 180,
    priority: 3,
    enabled: true,
    notes:
      "Calendar seed and meet-page source discovery. Parsed results remain candidates until verified.",
  },
  {
    id: "athletic-net",
    name: "Athletic.net",
    source: "athletic_net",
    baseUrl: "https://www.athletic.net",
    coloradoScopeUrl: "https://www.athletic.net/TrackAndField/Colorado/",
    refreshCadenceMinutes: 120,
    priority: 2,
    enabled: true,
    notes:
      "Public cross-check source only. Credentials are not stored, deployed, or used by hosted refresh jobs.",
  },
  {
    id: "maxpreps-track",
    name: "MaxPreps Track",
    source: "maxpreps",
    baseUrl: "https://www.maxpreps.com",
    coloradoScopeUrl: "https://www.maxpreps.com/co/track-field/",
    refreshCadenceMinutes: 240,
    priority: 1,
    enabled: true,
    notes:
      "Secondary validation source. Used behind official timing, Athletic.net, and MileSplit.",
  },
];

export const autoUpdatePolicy: AutoUpdatePolicy = {
  enabled: true,
  afterMeetDelayMinutes: 30,
  steadyStateRefreshMinutes: 120,
  providers: dataProviders,
  verificationRule:
    "Auto-updates collect public candidate marks only. Rankings include verified FAT performances after classification and review checks pass. Private credentials are never stored in the repo or hosted deployment.",
};
