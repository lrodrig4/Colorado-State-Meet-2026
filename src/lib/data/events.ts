import type { EventDefinition, EventKey } from "@/types/domain";

const both = ["Boys", "Girls"] as const;

export const eventDefinitions: EventDefinition[] = [
  { event: "100m", slug: "100", displayName: "100m Dash", discipline: "sprint", markType: "time", sortDirection: "asc", relay: false, genders: [...both] },
  { event: "200m", slug: "200", displayName: "200m Dash", discipline: "sprint", markType: "time", sortDirection: "asc", relay: false, genders: [...both] },
  { event: "400m", slug: "400", displayName: "400m Dash", discipline: "sprint", markType: "time", sortDirection: "asc", relay: false, genders: [...both] },
  { event: "800m", slug: "800", displayName: "800m Run", discipline: "distance", markType: "time", sortDirection: "asc", relay: false, genders: [...both] },
  { event: "1600m", slug: "1600", displayName: "1600m Run", discipline: "distance", markType: "time", sortDirection: "asc", relay: false, genders: [...both] },
  { event: "3200m", slug: "3200", displayName: "3200m Run", discipline: "distance", markType: "time", sortDirection: "asc", relay: false, genders: [...both] },
  { event: "100m Hurdles", slug: "100h", displayName: "100m Hurdles", discipline: "hurdle", markType: "time", sortDirection: "asc", relay: false, genders: ["Girls"] },
  { event: "110m Hurdles", slug: "110h", displayName: "110m Hurdles", discipline: "hurdle", markType: "time", sortDirection: "asc", relay: false, genders: ["Boys"] },
  { event: "300m Hurdles", slug: "300h", displayName: "300m Hurdles", discipline: "hurdle", markType: "time", sortDirection: "asc", relay: false, genders: [...both] },
  { event: "4x100m Relay", slug: "4x100", displayName: "4x100m Relay", discipline: "relay", markType: "time", sortDirection: "asc", relay: true, genders: [...both] },
  { event: "4x200m Relay", slug: "4x200", displayName: "4x200m Relay", discipline: "relay", markType: "time", sortDirection: "asc", relay: true, genders: [...both] },
  { event: "4x400m Relay", slug: "4x400", displayName: "4x400m Relay", discipline: "relay", markType: "time", sortDirection: "asc", relay: true, genders: [...both] },
  { event: "4x800m Relay", slug: "4x800", displayName: "4x800m Relay", discipline: "relay", markType: "time", sortDirection: "asc", relay: true, genders: [...both] },
  { event: "High Jump", slug: "high-jump", displayName: "High Jump", discipline: "jump", markType: "distance", sortDirection: "desc", relay: false, genders: [...both] },
  { event: "Pole Vault", slug: "pole-vault", displayName: "Pole Vault", discipline: "jump", markType: "distance", sortDirection: "desc", relay: false, genders: [...both] },
  { event: "Long Jump", slug: "long-jump", displayName: "Long Jump", discipline: "jump", markType: "distance", sortDirection: "desc", relay: false, genders: [...both] },
  { event: "Triple Jump", slug: "triple-jump", displayName: "Triple Jump", discipline: "jump", markType: "distance", sortDirection: "desc", relay: false, genders: [...both] },
  { event: "Shot Put", slug: "shot-put", displayName: "Shot Put", discipline: "throw", markType: "distance", sortDirection: "desc", relay: false, genders: [...both] },
  { event: "Discus", slug: "discus", displayName: "Discus", discipline: "throw", markType: "distance", sortDirection: "desc", relay: false, genders: [...both] },
];

export const eventDefinitionsByEvent = new Map<EventKey, EventDefinition>(
  eventDefinitions.map((definition) => [definition.event, definition]),
);

export const eventDefinitionsBySlug = new Map<string, EventDefinition>(
  eventDefinitions.map((definition) => [definition.slug, definition]),
);

export function getEventDefinition(event: EventKey): EventDefinition {
  const definition = eventDefinitionsByEvent.get(event);
  if (!definition) {
    throw new Error(`Missing event definition for ${event}`);
  }
  return definition;
}

export function eventSlug(event: EventKey): string {
  return getEventDefinition(event).slug;
}
