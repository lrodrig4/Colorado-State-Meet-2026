import type { EventKey } from "@/types/domain";
import { getEventDefinition } from "@/lib/data/events";

const EVENT_ALIASES: Record<string, EventKey | "ambiguous"> = {
  "100": "100m",
  "100m": "100m",
  "100m dash": "100m",
  "200": "200m",
  "200m": "200m",
  "200m dash": "200m",
  "400": "400m",
  "400m": "400m",
  "400m dash": "400m",
  "800": "800m",
  "800m": "800m",
  "800m run": "800m",
  "1600": "1600m",
  "1600m": "1600m",
  "1600m run": "1600m",
  "3200": "3200m",
  "3200m": "3200m",
  "3200m run": "3200m",
  "100m hurdles": "100m Hurdles",
  "100m hurdle": "100m Hurdles",
  "100 hurdles": "100m Hurdles",
  "110m hurdles": "110m Hurdles",
  "110m hurdle": "110m Hurdles",
  "110 hurdles": "110m Hurdles",
  "300m hurdles": "300m Hurdles",
  "300 hurdles": "300m Hurdles",
  "4 x 100m relay": "4x100m Relay",
  "4x100m relay": "4x100m Relay",
  "4 x 100 relay": "4x100m Relay",
  "4x100 relay": "4x100m Relay",
  "4 x 200m relay": "4x200m Relay",
  "4x200m relay": "4x200m Relay",
  "4 x 200 relay": "4x200m Relay",
  "4x200 relay": "4x200m Relay",
  "4 x 400m relay": "4x400m Relay",
  "4x400m relay": "4x400m Relay",
  "4 x 400 relay": "4x400m Relay",
  "4x400 relay": "4x400m Relay",
  "4 x 800m relay": "4x800m Relay",
  "4x800m relay": "4x800m Relay",
  "4 x 800 relay": "4x800m Relay",
  "4x800 relay": "4x800m Relay",
  "high jump": "High Jump",
  "pole vault": "Pole Vault",
  "long jump": "Long Jump",
  "triple jump": "Triple Jump",
  "shot put": "Shot Put",
  discus: "Discus",
  "discus throw": "Discus",
  mile: "ambiguous",
  "1 mile": "ambiguous",
  "2 mile": "ambiguous",
  "two mile": "ambiguous",
};

export function normalizeEvent(raw: string): EventKey | undefined {
  const key = raw
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\b(run|race)\b/g, "run")
    .trim();

  const direct = EVENT_ALIASES[key];
  if (direct && direct !== "ambiguous") {
    return direct;
  }

  const normalizedRelay = key.replace(/\s*x\s*/g, "x").replace(/\s+/g, " ");
  const relay = normalizedRelay.match(/\b4x(100|200|400|800)\s*m?\s*relay\b/);
  if (relay) {
    return `4x${relay[1]}m Relay` as EventKey;
  }

  if (/\b100\s*m?\b/.test(key) && /\bhurdles?\b/.test(key)) {
    return "100m Hurdles";
  }
  if (/\b110\s*m?\b/.test(key) && /\bhurdles?\b/.test(key)) {
    return "110m Hurdles";
  }
  if (/\b300\s*m?\b/.test(key) && /\bhurdles?\b/.test(key)) {
    return "300m Hurdles";
  }

  for (const event of ["100", "200", "400", "800", "1600", "3200"]) {
    if (new RegExp(`\\b${event}\\s*m?\\b`).test(key)) {
      return `${event}m` as EventKey;
    }
  }

  for (const fieldEvent of [
    "high jump",
    "pole vault",
    "long jump",
    "triple jump",
    "shot put",
    "discus",
  ]) {
    if (key.includes(fieldEvent)) {
      return EVENT_ALIASES[fieldEvent] as EventKey;
    }
  }

  return undefined;
}

export function isAmbiguousDistanceEvent(raw: string): boolean {
  return /\b(1\s*)?mile\b/i.test(raw) || /\b2\s*mile\b/i.test(raw);
}

export function parseMarkToSeconds(mark: string): number | undefined {
  const clean = mark
    .trim()
    .replace(/[†*#]/g, "")
    .replace(/\s+(FAT|AUTO|HAND|HT)$/i, "");

  if (!clean) {
    return undefined;
  }

  const parts = clean.split(":");
  const secondsPart = parts.pop();

  if (!secondsPart || Number.isNaN(Number(secondsPart))) {
    return undefined;
  }

  const seconds = Number(secondsPart);
  const minutes = parts.length ? Number(parts.pop()) : 0;
  const hours = parts.length ? Number(parts.pop()) : 0;

  if ([seconds, minutes, hours].some((part) => Number.isNaN(part))) {
    return undefined;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

export function parseDistanceMarkToInches(mark: string): number | undefined {
  const clean = mark
    .trim()
    .replace(/[†*#]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'");

  const feetInches =
    clean.match(/^(\d{1,3})\s*[-']\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:"|in)?$/) ??
    clean.match(/^(\d{1,3})\s+(\d{1,2}(?:\.\d{1,2})?)$/);

  if (feetInches) {
    return Number(feetInches[1]) * 12 + Number(feetInches[2]);
  }

  const inchesOnly = clean.match(/^(\d{1,3}(?:\.\d{1,2})?)\s*(?:in|")$/i);
  if (inchesOnly) {
    return Number(inchesOnly[1]);
  }

  return undefined;
}

export function parsePerformanceMark(
  event: EventKey,
  mark: string,
): number | undefined {
  const definition = getEventDefinition(event);
  return definition.markType === "distance"
    ? parseDistanceMarkToInches(mark)
    : parseMarkToSeconds(mark);
}

export function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
}

export function formatTimeValue(totalSeconds: number): string {
  return totalSeconds >= 60 ? formatSeconds(totalSeconds) : totalSeconds.toFixed(2);
}

export function formatDistanceInches(totalInches: number): string {
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches - feet * 12;
  const inchesText =
    Math.abs(inches - Math.round(inches)) < 0.005
      ? String(Math.round(inches))
      : inches.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

  return `${feet}-${inchesText}`;
}

export function formatPerformanceValue(event: EventKey, value: number): string {
  const definition = getEventDefinition(event);
  return definition.markType === "distance"
    ? formatDistanceInches(value)
    : formatTimeValue(value);
}

export function formatPerformanceGap(event: EventKey, value: number): string {
  const definition = getEventDefinition(event);
  const absolute = Math.abs(value);

  if (definition.markType === "distance") {
    if (absolute < 12) {
      return `${absolute.toFixed(1).replace(/\.0$/, "")} in`;
    }

    return formatDistanceInches(absolute);
  }

  return absolute >= 60 ? formatSeconds(absolute) : `${absolute.toFixed(2)}s`;
}

export function comparePerformanceMarks(
  event: EventKey,
  a: number,
  b: number,
): number {
  const direction = getEventDefinition(event).sortDirection;
  return direction === "asc" ? a - b : b - a;
}
