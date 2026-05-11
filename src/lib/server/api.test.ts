import assert from "node:assert/strict";
import test from "node:test";
import {
  ApiRequestError,
  optionalEvent,
  readJsonObject,
  requiredIsoDate,
  requiredString,
} from "@/lib/server/api";

test("reads bounded JSON request bodies", async () => {
  const request = new Request("https://example.test/api", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ meetName: "League Meet" }),
  });

  const body = await readJsonObject(request, { maxBytes: 64 });

  assert.equal(requiredString(body, "meetName"), "League Meet");
});

test("rejects oversized JSON payloads before parsing", async () => {
  const request = new Request("https://example.test/api", {
    method: "POST",
    headers: {
      "content-length": "100",
      "content-type": "application/json",
    },
    body: "{}",
  });

  await assert.rejects(
    () => readJsonObject(request, { maxBytes: 20 }),
    (error) =>
      error instanceof ApiRequestError &&
      error.status === 413 &&
      error.message === "Request body is too large.",
  );
});

test("validates route dates and event enums", () => {
  const valid = {
    meetDate: "2026-05-09",
    event: "1600m",
  };

  assert.equal(requiredIsoDate(valid, "meetDate"), "2026-05-09");
  assert.equal(optionalEvent(valid), "1600m");

  assert.throws(
    () => requiredIsoDate({ meetDate: "2026-02-31" }, "meetDate"),
    /valid calendar date/,
  );
  assert.throws(() => optionalEvent({ event: "Beer Mile" }), /must be one of/);
});
