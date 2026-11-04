import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeGmailProvider } from "../../src/gmail/fake.provider.js";
import { GMAIL_READONLY_SCOPE, GmailNotConfiguredError } from "../../src/gmail/gmail-provider.js";
import { createGmailProvider } from "../../src/gmail/gmail.module.js";
import { GoogleGmailProvider } from "../../src/gmail/google.provider.js";

describe("createGmailProvider", () => {
  it("defaults to the real provider", () => {
    assert.ok(createGmailProvider({}) instanceof GoogleGmailProvider);
  });

  it("starts without Google settings, but is not ready", () => {
    const provider = createGmailProvider({});
    assert.throws(() => provider.checkReady(), GmailNotConfiguredError);
    assert.throws(
      () => provider.buildAuthUrl({ state: "s", codeChallenge: "c" }),
      GmailNotConfiguredError,
    );
  });

  it("asks Google for gmail.readonly only, offline, with PKCE S256", () => {
    const provider = createGmailProvider({
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
      GOOGLE_REDIRECT_URI: "http://localhost:3001/gmail/oauth/callback",
    });
    const url = new URL(
      provider.buildAuthUrl({ state: "the-state", codeChallenge: "the-challenge" }),
    );
    assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
    assert.equal(url.searchParams.get("scope"), GMAIL_READONLY_SCOPE);
    assert.equal(url.searchParams.get("access_type"), "offline");
    assert.equal(url.searchParams.get("code_challenge"), "the-challenge");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("state"), "the-state");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      "http://localhost:3001/gmail/oauth/callback",
    );
    assert.equal(url.searchParams.get("client_id"), "id");
    assert.equal(url.search.includes("secret"), false);
  });

  it("allows the fake outside production only", () => {
    assert.ok(createGmailProvider({ GMAIL_PROVIDER: "fake" }) instanceof FakeGmailProvider);
    assert.throws(
      () => createGmailProvider({ GMAIL_PROVIDER: "fake", NODE_ENV: "production" }),
      /not allowed/,
    );
  });

  it("rejects an unknown provider name at startup", () => {
    assert.throws(() => createGmailProvider({ GMAIL_PROVIDER: "gogle" }), /GMAIL_PROVIDER/);
  });
});
