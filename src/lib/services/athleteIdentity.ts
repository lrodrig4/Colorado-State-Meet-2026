import { getEventDefinition } from "@/lib/data/events";
import type { Performance } from "@/types/domain";

export function normalizedAthleteNameParts(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function hasCompatibleContext(a: Performance, b: Performance) {
  return (
    a.school.toLowerCase() === b.school.toLowerCase() &&
    a.event === b.event &&
    a.gender === b.gender &&
    (!a.grade || !b.grade || a.grade === b.grade)
  );
}

function editDistanceAtMostOne(a: string, b: string) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;

  let edits = 0;
  let aIndex = 0;
  let bIndex = 0;

  while (aIndex < a.length && bIndex < b.length) {
    if (a[aIndex] === b[bIndex]) {
      aIndex += 1;
      bIndex += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) return false;

    if (a.length > b.length) {
      aIndex += 1;
    } else if (b.length > a.length) {
      bIndex += 1;
    } else {
      aIndex += 1;
      bIndex += 1;
    }
  }

  return true;
}

function hasSubsetNameAlias(
  aParts: string[],
  bParts: string[],
  a: Performance,
  b: Performance,
) {
  const [shorter, longer] =
    aParts.length <= bParts.length ? [aParts, bParts] : [bParts, aParts];

  if (!shorter.every((part) => longer.includes(part))) {
    return false;
  }

  return shorter.length > 1 || a.markValue === b.markValue;
}

const firstNameAliases = [
  ["alex", "alexander", "alexandra", "alexandria"],
  ["ben", "benjamin"],
  ["charles", "charlie"],
  ["gvozden", "gzodven"],
  ["jake", "jacob"],
  ["joey", "joseph"],
  ["stuart", "stewart"],
  ["will", "william"],
];

function firstNameAliasKey(value: string) {
  return (
    firstNameAliases.find((aliases) => aliases.includes(value))?.[0] ?? value
  );
}

function firstNameText(parts: string[]) {
  return parts.slice(0, -1).join("");
}

function lastName(parts: string[]) {
  return parts.at(-1);
}

function hasOneCharacterFirstNameTypo(aParts: string[], bParts: string[]) {
  if (aParts.length < 2 || bParts.length < 2) {
    return false;
  }

  const aFirst = aParts[0];
  const bFirst = bParts[0];
  const aLast = aParts.at(-1);
  const bLast = bParts.at(-1);

  return (
    aLast === bLast &&
    aFirst[0] === bFirst[0] &&
    Math.min(aFirst.length, bFirst.length) >= 4 &&
    editDistanceAtMostOne(aFirst, bFirst)
  );
}

function hasSharedLastName(aParts: string[], bParts: string[]) {
  return Boolean(lastName(aParts) && lastName(aParts) === lastName(bParts));
}

function hasExactMarkFirstNameVariant(
  aParts: string[],
  bParts: string[],
  a: Performance,
  b: Performance,
) {
  if (
    aParts.length < 2 ||
    bParts.length < 2 ||
    !hasSharedLastName(aParts, bParts) ||
    a.markValue !== b.markValue
  ) {
    return false;
  }

  return aParts[0]?.[0] === bParts[0]?.[0];
}

function hasFirstNameAlias(aParts: string[], bParts: string[]) {
  if (
    aParts.length < 2 ||
    bParts.length < 2 ||
    !hasSharedLastName(aParts, bParts)
  ) {
    return false;
  }

  const aFirst = firstNameText(aParts);
  const bFirst = firstNameText(bParts);
  const shorter = aFirst.length <= bFirst.length ? aFirst : bFirst;
  const longer = aFirst.length <= bFirst.length ? bFirst : aFirst;
  const hasShortFirstNameAbbreviation =
    shorter.length >= 2 &&
    (aParts[0].length <= 2 || bParts[0].length <= 2) &&
    longer.startsWith(shorter);

  return (
    firstNameAliasKey(aFirst) === firstNameAliasKey(bFirst) ||
    (shorter.length >= 4 && longer.startsWith(shorter)) ||
    hasShortFirstNameAbbreviation
  );
}

function singleLastNameAliasCandidate(
  performance: Performance,
  bestByAthlete: Map<string, Performance>,
) {
  const performanceParts = normalizedAthleteNameParts(performance.athleteName);
  if (performanceParts.length !== 1) {
    return undefined;
  }

  const candidates = [...bestByAthlete].filter(([, existing]) => {
    if (!hasCompatibleContext(performance, existing)) {
      return false;
    }

    const existingParts = normalizedAthleteNameParts(existing.athleteName);
    return (
      existingParts.length > 1 &&
      lastName(existingParts) === performanceParts[0]
    );
  });

  const exactMarkCandidates = candidates.filter(
    ([, existing]) => existing.markValue === performance.markValue,
  );
  if (exactMarkCandidates.length === 1) {
    return exactMarkCandidates[0][0];
  }

  if (candidates.length === 1) {
    return candidates[0][0];
  }

  return undefined;
}

function existingSingleLastNameAliasCandidate(
  performance: Performance,
  bestByAthlete: Map<string, Performance>,
) {
  const performanceParts = normalizedAthleteNameParts(performance.athleteName);
  if (performanceParts.length < 2) {
    return undefined;
  }

  const candidates = [...bestByAthlete].filter(([, existing]) => {
    if (!hasCompatibleContext(performance, existing)) {
      return false;
    }

    const existingParts = normalizedAthleteNameParts(existing.athleteName);
    return existingParts.length === 1 && existingParts[0] === lastName(performanceParts);
  });

  const exactMarkCandidates = candidates.filter(
    ([, existing]) => existing.markValue === performance.markValue,
  );
  if (exactMarkCandidates.length === 1) {
    return exactMarkCandidates[0][0];
  }

  if (candidates.length === 1) {
    return candidates[0][0];
  }

  return undefined;
}

export function isLikelySameAthlete(a: Performance, b: Performance) {
  if (!hasCompatibleContext(a, b)) {
    return false;
  }

  const aParts = normalizedAthleteNameParts(a.athleteName);
  const bParts = normalizedAthleteNameParts(b.athleteName);
  if (!aParts.length || !bParts.length) {
    return false;
  }

  return (
    hasSubsetNameAlias(aParts, bParts, a, b) ||
    hasOneCharacterFirstNameTypo(aParts, bParts) ||
    hasExactMarkFirstNameVariant(aParts, bParts, a, b) ||
    hasFirstNameAlias(aParts, bParts)
  );
}

export function performanceIdentityKey(performance: Performance) {
  const definition = getEventDefinition(performance.event);
  return definition.relay
    ? `${performance.school.toLowerCase()}|${performance.event}`
    : `${performance.athleteName.toLowerCase()}|${performance.school.toLowerCase()}|${performance.event}`;
}

export function resolvePerformanceIdentityKey(
  performance: Performance,
  bestByAthlete: Map<string, Performance>,
) {
  if (getEventDefinition(performance.event).relay) {
    return performanceIdentityKey(performance);
  }

  const exactKey = performanceIdentityKey(performance);
  if (bestByAthlete.has(exactKey)) {
    return exactKey;
  }

  const singleLastNameKey =
    singleLastNameAliasCandidate(performance, bestByAthlete) ??
    existingSingleLastNameAliasCandidate(performance, bestByAthlete);
  if (singleLastNameKey) {
    return singleLastNameKey;
  }

  for (const [existingKey, existing] of bestByAthlete) {
    if (isLikelySameAthlete(performance, existing)) {
      return existingKey;
    }
  }

  return exactKey;
}

export function hasMoreCompleteAthleteName(a: Performance, b: Performance) {
  return (
    normalizedAthleteNameParts(a.athleteName).length >
    normalizedAthleteNameParts(b.athleteName).length
  );
}
