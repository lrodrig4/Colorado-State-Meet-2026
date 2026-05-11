import assert from "node:assert/strict";
import test from "node:test";
import { buildCoachInterestMailto } from "@/lib/utils/coachInterest";

test("buildCoachInterestMailto encodes coach lead context", () => {
  const href = buildCoachInterestMailto({
    recipient: "hello@example.com",
    coachName: "Luke Coach",
    school: "Castle View",
    email: "coach@example.com",
    classification: "5A",
    interest: "I want weekly scouting briefs",
  });

  assert.match(href, /^mailto:hello@example\.com\?/);
  assert.match(decodeURIComponent(href), /Luke Coach/);
  assert.match(decodeURIComponent(href), /Castle View/);
  assert.match(decodeURIComponent(href), /5A/);
  assert.match(decodeURIComponent(href), /weekly scouting briefs/);
});

test("buildCoachInterestMailto handles omitted optional fields", () => {
  const href = buildCoachInterestMailto({
    recipient: "hello@example.com",
    coachName: "Coach",
    school: "Unknown High",
  });

  const decoded = decodeURIComponent(href);
  assert.match(decoded, /Coach/);
  assert.match(decoded, /Unknown High/);
  assert.doesNotMatch(decoded, /undefined/);
});
