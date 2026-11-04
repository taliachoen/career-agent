import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STATE_TTL_MS,
  codeChallengeFor,
  deriveStateKey,
  newCodeVerifier,
  newNonce,
  signState,
  verifyState,
} from "../../src/gmail/oauth-state.js";

const key = deriveStateKey("a".repeat(32));
const now = 1_000_000;
const payload = { uid: "user-1", nonce: "nonce-1", exp: now + STATE_TTL_MS };

describe("oauth-state", () => {
  it("accepts a state it signed and returns the user", () => {
    assert.deepEqual(verifyState(signState(payload, key), key, now), payload);
  });

  it("rejects an expired state", () => {
    const state = signState(payload, key);
    assert.equal(verifyState(state, key, payload.exp), null);
    assert.equal(verifyState(state, key, payload.exp + 1), null);
  });

  it("rejects a state signed with another key", () => {
    const state = signState(payload, deriveStateKey("b".repeat(32)));
    assert.equal(verifyState(state, key, now), null);
  });

  it("rejects a state whose payload was changed to another user", () => {
    const [, signature] = signState(payload, key).split(".");
    const forgedBody = Buffer.from(JSON.stringify({ ...payload, uid: "user-2" })).toString(
      "base64url",
    );
    assert.equal(verifyState(`${forgedBody}.${signature}`, key, now), null);
  });

  it("rejects malformed values without throwing", () => {
    const notAnObject = Buffer.from('"x"').toString("base64url");
    for (const bad of ["", "abc", "a.b.c", ".", `${notAnObject}.sig`]) {
      assert.equal(verifyState(bad, key, now), null);
    }
  });

  it("rejects a payload with missing or wrong-typed fields, even if correctly signed", () => {
    for (const odd of [
      { uid: "u", nonce: "n" },
      { uid: 1, nonce: "n", exp: now + 1 },
      { uid: "u", nonce: "n", exp: "x" },
    ]) {
      assert.equal(verifyState(signState(odd as never, key), key, now), null);
    }
  });

  it("derives a different key than JWT_SECRET itself, so the state is not a JWT", () => {
    assert.notEqual(deriveStateKey("a".repeat(32)).toString(), "a".repeat(32));
    assert.equal(signState(payload, key).split(".").length, 2);
  });

  it("creates unique nonces and verifiers", () => {
    assert.notEqual(newNonce(), newNonce());
    assert.notEqual(newCodeVerifier(), newCodeVerifier());
  });

  it("PKCE verifiers are 43+ characters of base64url, and the S256 challenge matches RFC 7636", () => {
    assert.match(newCodeVerifier(), /^[A-Za-z0-9_-]{43,128}$/);
    // Test vector from RFC 7636, appendix B.
    assert.equal(
      codeChallengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
});
