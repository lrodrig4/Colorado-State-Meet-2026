import assert from "node:assert/strict";
import test from "node:test";
import { stateMeetScheduleSlots } from "@/lib/data/stateSchedule";
import type { Classification, EventKey, Gender } from "@/types/domain";
import { normalizeEvent } from "@/lib/utils/time";

function slot(classification: Classification, gender: Gender, event: EventKey) {
  return stateMeetScheduleSlots.find(
    (item) =>
      item.classification === classification &&
      item.gender === gender &&
      normalizeEvent(item.event) === event &&
      item.round === "Final",
  );
}

test("loads class-specific 2026 state schedule finals from the provided PDF", () => {
  assert.equal(slot("5A", "Girls", "3200m")?.day, "Thursday");
  assert.equal(slot("5A", "Girls", "3200m")?.startTime, "8:20 am");
  assert.equal(slot("5A", "Boys", "800m")?.day, "Friday");
  assert.equal(slot("5A", "Boys", "800m")?.startTime, "12:35 pm");
  assert.equal(slot("3A", "Girls", "3200m")?.day, "Thursday");
  assert.equal(slot("3A", "Girls", "3200m")?.startTime, "6:00 pm");
  assert.equal(slot("3A", "Boys", "1600m")?.day, "Saturday");
  assert.equal(slot("3A", "Boys", "1600m")?.startTime, "4:15 pm");
  assert.equal(slot("4A", "Girls", "1600m")?.day, "Saturday");
  assert.equal(slot("4A", "Girls", "1600m")?.startTime, "11:10 am");
});

test("loads full deployed-class event schedule coverage", () => {
  for (const classification of ["3A", "4A", "5A"] as const) {
    for (const gender of ["Boys", "Girls"] as const) {
      const finals = stateMeetScheduleSlots.filter(
        (item) =>
          item.classification === classification &&
          item.gender === gender &&
          item.round === "Final",
      );

      assert.equal(finals.length, 18, `${classification} ${gender}`);
    }
  }
});
