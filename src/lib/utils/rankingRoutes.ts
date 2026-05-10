import type { Gender } from "@/types/domain";
import { eventDefinitions, eventDefinitionsBySlug } from "@/lib/data/events";

export function rankingSlug(gender: Gender, eventSlug: string) {
  return `${gender.toLowerCase()}-${eventSlug}`;
}

export function rankingPath(gender: Gender, eventSlug: string) {
  return `/rankings/${rankingSlug(gender, eventSlug)}`;
}

export function parseRankingSlug(slug: string) {
  const gender: Gender | undefined = slug.startsWith("boys-")
    ? "Boys"
    : slug.startsWith("girls-")
      ? "Girls"
      : undefined;
  const eventSlug = slug.replace(/^(boys|girls)-/, "");
  const eventDefinition = eventDefinitionsBySlug.get(eventSlug);

  if (!gender || !eventDefinition || !eventDefinition.genders.includes(gender)) {
    return undefined;
  }

  return {
    gender,
    eventDefinition,
  };
}

export function allRankingParams() {
  return eventDefinitions.flatMap((definition) =>
    definition.genders.map((gender) => ({
      rankingSlug: rankingSlug(gender, definition.slug),
    })),
  );
}
