import type {
  EventKey,
  Gender,
  Performance,
  SourceKind,
  TimingType,
} from "@/types/domain";
import { getEventDefinition } from "@/lib/data/events";
import { applyClassification } from "@/lib/services/classification";
import { isNonQualifyingMeetName } from "@/lib/services/nonQualifying";
import {
  isAmbiguousDistanceEvent,
  normalizeEvent,
  parsePerformanceMark,
} from "@/lib/utils/time";
import { cleanCell, stableId, titleCase } from "@/lib/utils/text";

const MARK_PATTERN =
  /\b\d{1,2}:\d{2}(?:\.\d{1,2})?\b|\b\d{1,3}\.\d{1,2}\b|\b\d{1,3}\s*[-']\s*\d{1,2}(?:\.\d{1,2})?\b/;
const GENDER_PATTERN = /\b(boys?|girls?|men|women)\b/i;

function normalizeGender(raw: string): Gender | undefined {
  const lower = raw.toLowerCase();
  if (/\b(boys?|men)\b/.test(lower)) {
    return "Boys";
  }
  if (/\b(girls?|women)\b/.test(lower)) {
    return "Girls";
  }
  return undefined;
}

function inferTiming(raw: string): TimingType {
  if (/\b(hand|ht|h\/t)\b/i.test(raw)) {
    return "Hand";
  }
  if (/\b(fat|auto|automatic)\b/i.test(raw)) {
    return "FAT";
  }
  return "Unknown";
}

function stripKnownTokens(line: string, mark: string, event?: EventKey) {
  return line
    .replace(mark, " ")
    .replace(/^\s*\d+\s*[).:-]?\s*/, " ")
    .replace(/\b(Fr|So|Jr|Sr|Freshman|Sophomore|Junior|Senior|9|10|11|12)\b/gi, " ")
    .replace(/\b(Boys?|Girls?|Men|Women)\b/gi, " ")
    .replace(event ?? "", " ")
    .replace(
      /\b(100m?|200m?|300m?|400m?|800m?|1600m?|3200m?|run|dash|hurdles?|relay|high|pole|long|triple|jump|vault|shot|put|discus|fat|auto|automatic|hand|ht|h\/t)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function inferGrade(line: string): number | undefined {
  const gradeWord = line.match(/\b(Fr|So|Jr|Sr|Freshman|Sophomore|Junior|Senior)\b/i)?.[1];
  if (gradeWord) {
    const normalized = gradeWord.toLowerCase();
    if (normalized.startsWith("fr")) return 9;
    if (normalized.startsWith("so")) return 10;
    if (normalized.startsWith("jr") || normalized.startsWith("jun")) return 11;
    if (normalized.startsWith("sr") || normalized.startsWith("sen")) return 12;
  }

  const numeric = line.match(/\b(9|10|11|12)\b/)?.[1];
  return numeric ? Number(numeric) : undefined;
}

function splitAthleteSchool(remainder: string) {
  const delimiters = [" - ", " | ", "\t"];

  for (const delimiter of delimiters) {
    if (remainder.includes(delimiter)) {
      const [athlete, school] = remainder.split(delimiter).map(cleanCell);
      return { athleteName: titleCase(athlete), school: titleCase(school) };
    }
  }

  const commaParts = remainder.split(",").map(cleanCell);
  if (commaParts.length >= 2) {
    return {
      athleteName: titleCase(commaParts[0]),
      school: titleCase(commaParts.slice(1).join(" ")),
    };
  }

  const words = remainder.split(" ").filter(Boolean);
  if (words.length >= 4) {
    return {
      athleteName: titleCase(words.slice(0, 2).join(" ")),
      school: titleCase(words.slice(2).join(" ")),
    };
  }

  return {
    athleteName: titleCase(remainder),
    school: "Unknown",
  };
}

export function parseManualResults(
  input: string,
  context: {
    meetName: string;
    meetDate: string;
    gender?: Gender;
    event?: EventKey;
    source?: SourceKind;
    sourceUrl?: string;
  },
): Performance[] {
  let currentGender = context.gender;
  let currentEvent = context.event;
  const depthOnly = isNonQualifyingMeetName(context.meetName);
  const performances: Performance[] = [];

  input.split(/\r?\n/).forEach((rawLine, lineIndex) => {
    const line = cleanCell(rawLine);
    if (!line) {
      return;
    }

    const gender = normalizeGender(line);
    if (gender && GENDER_PATTERN.test(line) && !MARK_PATTERN.test(line)) {
      currentGender = gender;
    }

    const event = normalizeEvent(line);
    if (event && !MARK_PATTERN.test(line)) {
      currentEvent = event;
    }

    const mark = line.match(MARK_PATTERN)?.[0];
    if (!mark) {
      return;
    }

    const parsedGender = normalizeGender(line) ?? currentGender;
    const parsedEvent = normalizeEvent(line) ?? currentEvent;
    const markValue = parsedEvent ? parsePerformanceMark(parsedEvent, mark) : undefined;

    if (!markValue || !parsedGender || !parsedEvent) {
      return;
    }

    const definition = getEventDefinition(parsedEvent);
    const timingType =
      definition.markType === "distance" ? "Field" : inferTiming(line);
    const remainder = stripKnownTokens(line, mark, parsedEvent);
    const parsedIdentity = splitAthleteSchool(remainder);
    const athleteName = definition.relay
      ? `${parsedIdentity.school === "Unknown" ? parsedIdentity.athleteName : parsedIdentity.school} Relay`
      : parsedIdentity.athleteName;
    const school = definition.relay
      ? parsedIdentity.school === "Unknown"
        ? parsedIdentity.athleteName
        : parsedIdentity.school
      : parsedIdentity.school;
    const ambiguous = isAmbiguousDistanceEvent(line);
    const notes = [
      "Parsed from manual input.",
      depthOnly
        ? "Depth-only/non-qualifying meet; excluded from CHSAA qualifying rankings and cutoff model."
        : undefined,
      timingType === "Unknown" ? "Timing type unknown." : undefined,
      ambiguous ? "Ambiguous mile or 2 mile reference needs approval." : undefined,
    ]
      .filter(Boolean)
      .join(" ");

    performances.push(
      applyClassification({
        id: stableId([
          context.meetName,
          context.meetDate,
          lineIndex,
          athleteName,
          school,
          mark,
        ]),
        athleteName,
        gender: parsedGender,
        grade: inferGrade(line),
        school,
        event: parsedEvent,
        markRaw: mark,
        markValue,
        timingType,
        isFAT: timingType === "FAT",
        meetName: context.meetName,
        meetDate: context.meetDate,
        source: context.source ?? "manual",
        sourceUrl: context.sourceUrl,
        verificationStatus: depthOnly ? "depth_only" : "needs_review",
        classificationVerified: false,
        notes,
      }),
    );
  });

  return performances;
}
