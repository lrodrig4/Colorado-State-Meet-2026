import type { Classification, Performance } from "@/types/domain";
import { CLASSIFICATION_QUERY_PARAM } from "@/lib/utils/classificationScope";

export const DEFAULT_FOCUS_TEAM = "Niwot High School";
export const FOCUS_TEAM_QUERY_PARAM = "team";
export const FOCUS_TEAM_STORAGE_KEY = "co.track.v2.focusTeam";
export const FOCUS_TEAM_COOKIE_NAME = "co_track_v2_focus_team";

export type SearchParamValue = string | string[] | undefined;

export function focusTeamStorageKey(classification: Classification) {
  return `co${classification.toLowerCase()}.v2.focusTeam`;
}

export function focusTeamCookieName(classification: Classification) {
  return `co${classification.toLowerCase()}_v2_focus_team`;
}

export function schoolOptionsFromPerformances(performances: Performance[]) {
  return [...new Set(performances.map((performance) => performance.school))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function resolveFocusTeam(
  rawTeam: SearchParamValue,
  schools: string[],
  fallback = DEFAULT_FOCUS_TEAM,
) {
  const requested = Array.isArray(rawTeam) ? rawTeam[0] : rawTeam;

  if (requested) {
    const exact = schools.find((school) => school === requested);
    if (exact) return exact;

    const normalized = requested.toLowerCase().replace(/[^a-z0-9]/g, "");
    const loose = schools.find(
      (school) => school.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized,
    );
    if (loose) return loose;
  }

  return schools.includes(fallback) ? fallback : schools[0] ?? fallback;
}

export function focusTeamHref(
  path: string,
  focusTeam: string,
  classification?: Classification,
) {
  const [basePath, hash = ""] = path.split("#");
  const params = new URLSearchParams();
  params.set(FOCUS_TEAM_QUERY_PARAM, focusTeam);

  if (classification) {
    params.set(CLASSIFICATION_QUERY_PARAM, classification);
  }

  const separator = basePath.includes("?") ? "&" : "?";
  const scoped = `${basePath}${separator}${params.toString()}`;

  return hash ? `${scoped}#${hash}` : scoped;
}

export function appendFocusTeamToHref(path: string, focusTeam: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${FOCUS_TEAM_QUERY_PARAM}=${encodeURIComponent(
    focusTeam,
  )}`;
}

export function decodeFocusTeamCookie(value: string | undefined) {
  if (!value) return undefined;

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function shortSchoolName(school: string) {
  return school
    .replace(/\s+High School$/i, "")
    .replace(/\s+\(CO\)$/i, "");
}
