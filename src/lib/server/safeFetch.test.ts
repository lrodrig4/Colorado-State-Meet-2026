import assert from "node:assert/strict";
import test from "node:test";
import {
  isPrivateAddress,
  parseSafeHttpUrl,
  SafeFetchError,
} from "@/lib/server/safeFetch";

test("accepts only absolute http and https URLs without credentials", () => {
  assert.equal(
    parseSafeHttpUrl("https://co.milesplit.com/meets/123").hostname,
    "co.milesplit.com",
  );

  assert.throws(() => parseSafeHttpUrl("/relative"), SafeFetchError);
  assert.throws(() => parseSafeHttpUrl("ftp://example.com/file"), /http or https/);
  assert.throws(
    () => parseSafeHttpUrl("https://user:pass@example.com"),
    /credentials/,
  );
});

test("identifies private and loopback addresses", () => {
  assert.equal(isPrivateAddress("127.0.0.1"), true);
  assert.equal(isPrivateAddress("10.0.0.5"), true);
  assert.equal(isPrivateAddress("172.16.2.9"), true);
  assert.equal(isPrivateAddress("192.168.1.1"), true);
  assert.equal(isPrivateAddress("169.254.169.254"), true);
  assert.equal(isPrivateAddress("::1"), true);
  assert.equal(isPrivateAddress("fe80::1"), true);
  assert.equal(isPrivateAddress("8.8.8.8"), false);
  assert.equal(isPrivateAddress("2606:4700:4700::1111"), false);
});
