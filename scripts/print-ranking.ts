import { performances } from "../src/lib/data/performances";
import { getEventDefinition } from "../src/lib/data/events";
import { getSeasonBestRankings } from "../src/lib/services/ranking";
import type { Classification, EventKey, Gender } from "../src/types/domain";

const classifications = new Set(["3A", "4A", "5A"]);
const genders = new Set(["Boys", "Girls"]);

function getArg(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function assertClassification(value: string): asserts value is Classification {
  if (!classifications.has(value)) {
    throw new Error(`Invalid --class=${value}. Use 3A, 4A, or 5A.`);
  }
}

function assertGender(value: string): asserts value is Gender {
  if (!genders.has(value)) {
    throw new Error(`Invalid --gender=${value}. Use Boys or Girls.`);
  }
}

function assertEvent(value: string): asserts value is EventKey {
  getEventDefinition(value as EventKey);
}

const classification = getArg("class", "4A")!;
const gender = getArg("gender", "Girls")!;
const event = getArg("event", "4x800m Relay")!;
const top = Number(getArg("top", "18"));

assertClassification(classification);
assertGender(gender);
assertEvent(event);

const ranking = getSeasonBestRankings(performances, {
  classification,
  gender,
  event,
  topLimit: top,
  bubbleLimit: 0,
});

console.log(`${classification} ${gender} ${event} top ${top}`);
for (const row of ranking.top18) {
  console.log(
    `#${row.rank}\t${row.athleteName}\t${row.school}\t${row.markRaw}\t${row.meetName}\t${row.meetDate}`,
  );
}
