import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { GmailNotConfiguredError } from "../../src/gmail/gmail-provider.js";
import { decryptToken, encryptToken, parseEncryptionKey } from "../../src/gmail/token-crypto.js";

const key = randomBytes(32);

describe("token-crypto", () => {
  it("round-trips a token", () => {
    const encrypted = encryptToken("1//refresh-token", "user-1", key);
    assert.equal(decryptToken(encrypted, "user-1", key), "1//refresh-token");
  });

  it("does not contain the plaintext and uses a new IV every time", () => {
    const a = encryptToken("1//refresh-token", "user-1", key);
    const b = encryptToken("1//refresh-token", "user-1", key);
    assert.notEqual(a, b);
    assert.equal(a.includes("refresh-token"), false);
    assert.match(a, /^v1:[\w-]+:[\w-]+:[\w-]+$/);
  });

  it("fails for another user (the user id is authenticated)", () => {
    const encrypted = encryptToken("secret", "user-1", key);
    assert.throws(() => decryptToken(encrypted, "user-2", key), /Invalid encrypted token/);
  });

  it("fails for another key", () => {
    const encrypted = encryptToken("secret", "user-1", key);
    assert.throws(
      () => decryptToken(encrypted, "user-1", randomBytes(32)),
      /Invalid encrypted token/,
    );
  });

  it("fails when the ciphertext or the tag is tampered with", () => {
    const [version, iv, tag, ciphertext] = encryptToken("secret", "user-1", key).split(":");
    const flip = (value: string) => (value.startsWith("A") ? "B" : "A") + value.slice(1);
    assert.throws(() =>
      decryptToken([version, iv, tag, flip(ciphertext!)].join(":"), "user-1", key),
    );
    assert.throws(() =>
      decryptToken([version, iv, flip(tag!), ciphertext].join(":"), "user-1", key),
    );
  });

  it("rejects a truncated authentication tag", () => {
    const [version, iv, tag, ciphertext] = encryptToken("secret", "user-1", key).split(":");
    const truncated = Buffer.from(tag!, "base64url").subarray(0, 4).toString("base64url");
    assert.throws(
      () => decryptToken([version, iv, truncated, ciphertext].join(":"), "user-1", key),
      /Invalid encrypted token/,
    );
  });

  it("fails on malformed input without echoing it", () => {
    for (const bad of ["", "garbage", "v2:a:b:c", "v1:a:b"]) {
      assert.throws(() => decryptToken(bad, "user-1", key), /^Error: Invalid encrypted token$/);
    }
  });

  it("parseEncryptionKey accepts exactly 32 bytes of base64", () => {
    assert.equal(
      parseEncryptionKey({ TOKEN_ENCRYPTION_KEY: key.toString("base64") }).equals(key),
      true,
    );
  });

  it("parseEncryptionKey rejects a missing or wrong-sized key as not configured", () => {
    for (const value of [
      undefined,
      "",
      "   ",
      randomBytes(16).toString("base64"),
      "not base64!!",
    ]) {
      assert.throws(
        () => parseEncryptionKey({ TOKEN_ENCRYPTION_KEY: value }),
        GmailNotConfiguredError,
      );
    }
  });
});
