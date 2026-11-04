import "../support/require-test-db.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { FakeGmailProvider } from "../../src/gmail/fake.provider.js";
import { GMAIL_READONLY_SCOPE } from "../../src/gmail/gmail-provider.js";
import { deriveStateKey, signState } from "../../src/gmail/oauth-state.js";
import { decryptToken, encryptToken, parseEncryptionKey } from "../../src/gmail/token-crypto.js";
import { startTestApp, type TestApp } from "../support/e2e-app.js";

type User = Awaited<ReturnType<TestApp["createUser"]>>;

describe("gmail connection (e2e, fake Google)", () => {
  let app: TestApp;
  before(async () => {
    app = await startTestApp();
  });
  after(async () => {
    await app.close();
  });

  // Starts a connection like the web app does, and reads what the fake "Google" was sent.
  async function connect(user: User) {
    const res = await app.request("POST", "/gmail/connect", { token: user.token });
    assert.equal(res.status, 200);
    const url = new URL(res.body.authUrl);
    return {
      authUrl: res.body.authUrl as string,
      state: url.searchParams.get("state")!,
      code: url.searchParams.get("code")!,
      challenge: url.searchParams.get("code_challenge")!,
      method: url.searchParams.get("code_challenge_method"),
    };
  }

  function callback(params: Record<string, string>) {
    return app.request("GET", `/gmail/oauth/callback?${new URLSearchParams(params)}`);
  }

  // Runs the whole flow and returns the stored row.
  async function connectFully(user: User, code = "fake-ok") {
    const flow = await connect(user);
    const res = await callback({ code, state: flow.state });
    return { flow, res };
  }

  function row(userId: string) {
    return app.prisma.gmailConnection.findUnique({ where: { userId } });
  }

  function webLocation(outcome: string) {
    return `/profile?gmail=${outcome}`;
  }

  it("requires authentication on every endpoint except the callback", async () => {
    for (const [method, path] of [
      ["GET", "/gmail/status"],
      ["POST", "/gmail/connect"],
      ["DELETE", "/gmail/connection"],
    ] as const) {
      assert.equal((await app.request(method, path)).status, 401, `${method} ${path}`);
      assert.equal(
        (await app.request(method, path, { token: "garbage" })).status,
        401,
        `${method} ${path}`,
      );
    }
  });

  it("a new user is not connected", async () => {
    const user = await app.createUser();
    const res = await app.request("GET", "/gmail/status", { token: user.token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { state: "not_connected", email: null });
  });

  it("connects: PKCE challenge goes out, callback redirects, status shows the e-mail", async () => {
    const user = await app.createUser();
    const flow = await connect(user);
    assert.equal(flow.method, "S256");

    // Before the callback: the verifier is stored encrypted and matches the challenge sent.
    const pending = await row(user.id);
    assert.ok(pending?.oauthCodeVerifier && pending.oauthNonce && pending.oauthExpiresAt);
    const verifier = decryptToken(pending.oauthCodeVerifier, user.id, parseEncryptionKey());
    assert.equal(createHash("sha256").update(verifier).digest("base64url"), flow.challenge);
    assert.equal(pending.oauthCodeVerifier.includes(verifier), false);
    assert.deepEqual(
      await app.request("GET", "/gmail/status", { token: user.token }).then((r) => r.body),
      {
        state: "not_connected",
        email: null,
      },
    );

    const res = await callback({ code: flow.code, state: flow.state });
    assert.equal(res.status, 302);
    assert.ok(res.location?.endsWith(webLocation("connected")), res.location ?? "");

    const status = await app.request("GET", "/gmail/status", { token: user.token });
    assert.deepEqual(status.body, { state: "connected", email: "fake.user@example.com" });

    // After: the one-time values are gone, the refresh token is stored encrypted, scope is exact.
    const saved = (await row(user.id))!;
    assert.equal(saved.status, "CONNECTED");
    assert.equal(saved.oauthNonce, null);
    assert.equal(saved.oauthCodeVerifier, null);
    assert.equal(saved.oauthExpiresAt, null);
    assert.equal(saved.scope, GMAIL_READONLY_SCOPE);
    assert.ok(saved.encryptedRefreshToken);
    assert.equal(saved.encryptedRefreshToken.includes("fake-refresh"), false);
    assert.match(
      decryptToken(saved.encryptedRefreshToken, user.id, parseEncryptionKey()),
      /^fake-refresh-/,
    );
  });

  it("no response, redirect or status contains a token, code or secret", async () => {
    const user = await app.createUser();
    const { flow, res } = await connectFully(user);
    const status = await app.request("GET", "/gmail/status", { token: user.token });
    const everything = JSON.stringify([flow.authUrl, res.location, res.body, status.body]);
    for (const secret of [
      "fake-refresh",
      "fake-access",
      "oauthCodeVerifier",
      "encryptedRefreshToken",
    ]) {
      assert.equal(everything.includes(secret), false, secret);
    }
    // The redirect carries a status word only.
    assert.equal(new URL(res.location!).search, "?gmail=connected");
  });

  it("the signed state is not accepted as an access token", async () => {
    const user = await app.createUser();
    const flow = await connect(user);
    assert.equal((await app.request("GET", "/profile", { token: flow.state })).status, 401);
    assert.equal((await app.request("GET", "/gmail/status", { token: flow.state })).status, 401);
  });

  it("cancelling at Google redirects with a denied message and connects nothing", async () => {
    const user = await app.createUser();
    const flow = await connect(user);
    const res = await callback({ error: "access_denied", state: flow.state });
    assert.equal(res.status, 302);
    assert.ok(res.location?.endsWith(webLocation("denied")), res.location ?? "");
    assert.deepEqual((await app.request("GET", "/gmail/status", { token: user.token })).body, {
      state: "not_connected",
      email: null,
    });
    // The cancelled attempt used up its state.
    const replay = await callback({ code: flow.code, state: flow.state });
    assert.ok(replay.location?.endsWith(webLocation("error")));
  });

  it("any other Google error is a generic error", async () => {
    const user = await app.createUser();
    const flow = await connect(user);
    const res = await callback({ error: "server_error", state: flow.state });
    assert.ok(res.location?.endsWith(webLocation("error")), res.location ?? "");
  });

  it("rejects a missing, garbage, tampered or unsigned state and changes nothing", async () => {
    const user = await app.createUser();
    const flow = await connect(user);
    const before = await row(user.id);
    const [body, signature] = flow.state.split(".");
    const tampered = `${Buffer.from(JSON.stringify({ uid: "someone-else", nonce: "x", exp: Date.now() + 60_000 })).toString("base64url")}.${signature}`;
    const attempts: Record<string, string>[] = [
      { code: "fake-ok" },
      { code: "fake-ok", state: "garbage" },
      { code: "fake-ok", state: tampered },
      { code: "fake-ok", state: `${body}.` },
      { code: "fake-ok", state: [flow.state, flow.state].join(",") },
    ];
    // A repeated parameter reaches the controller as an array, not as one string.
    const repeated = await app.request(
      "GET",
      `/gmail/oauth/callback?code=fake-ok&state=${flow.state}&state=${flow.state}`,
    );
    assert.ok(repeated.location?.endsWith(webLocation("error")), repeated.location ?? "");
    for (const params of attempts) {
      const res = await callback(params);
      assert.equal(res.status, 302);
      assert.ok(res.location?.endsWith(webLocation("error")), JSON.stringify(params));
    }
    assert.deepEqual(await row(user.id), before);
  });

  it("rejects an expired state, even with a valid signature", async () => {
    const user = await app.createUser();
    const flow = await connect(user);
    const key = deriveStateKey(process.env.JWT_SECRET!);
    const expired = signState({ uid: user.id, nonce: "n", exp: Date.now() - 1000 }, key);
    assert.ok(
      (await callback({ code: flow.code, state: expired })).location?.endsWith(
        webLocation("error"),
      ),
    );
    assert.equal((await row(user.id))?.status, "PENDING");
  });

  it("rejects a state whose pending attempt expired in the database", async () => {
    const user = await app.createUser();
    const flow = await connect(user);
    await app.prisma.gmailConnection.update({
      where: { userId: user.id },
      data: { oauthExpiresAt: new Date(Date.now() - 1000) },
    });
    assert.ok(
      (await callback({ code: flow.code, state: flow.state })).location?.endsWith(
        webLocation("error"),
      ),
    );
    assert.equal((await row(user.id))?.encryptedRefreshToken, null);
  });

  it("rejects a correctly signed state with a nonce that is not pending, or for a user with no attempt", async () => {
    const user = await app.createUser();
    const other = await app.createUser();
    await connect(user);
    const key = deriveStateKey(process.env.JWT_SECRET!);
    const exp = Date.now() + 60_000;
    const wrongNonce = signState({ uid: user.id, nonce: "not-the-pending-nonce", exp }, key);
    const noAttempt = signState({ uid: other.id, nonce: "n", exp }, key);
    assert.ok(
      (await callback({ code: "fake-ok", state: wrongNonce })).location?.endsWith(
        webLocation("error"),
      ),
    );
    assert.ok(
      (await callback({ code: "fake-ok", state: noAttempt })).location?.endsWith(
        webLocation("error"),
      ),
    );
    assert.equal(await row(other.id), null);
    assert.equal((await row(user.id))?.status, "PENDING");
  });

  it("a state can be used only once (replay is rejected, the connection stays)", async () => {
    const user = await app.createUser();
    const { flow } = await connectFully(user);
    const before = await row(user.id);
    const replay = await callback({ code: flow.code, state: flow.state });
    assert.ok(replay.location?.endsWith(webLocation("error")));
    assert.deepEqual(await row(user.id), before);
    assert.equal(
      (await app.request("GET", "/gmail/status", { token: user.token })).body.state,
      "connected",
    );
  });

  it("starting again invalidates the earlier attempt", async () => {
    const user = await app.createUser();
    const first = await connect(user);
    const second = await connect(user);
    assert.ok(
      (await callback({ code: first.code, state: first.state })).location?.endsWith(
        webLocation("error"),
      ),
    );
    assert.ok(
      (await callback({ code: second.code, state: second.state })).location?.endsWith(
        webLocation("connected"),
      ),
    );
  });

  it("rejects extra scopes: nothing is saved and the grant is revoked at Google", async () => {
    const user = await app.createUser();
    const before = FakeGmailProvider.revokedTokens.length;
    const { res } = await connectFully(user, "fake-wrong-scope");
    assert.ok(res.location?.endsWith(webLocation("scope_error")), res.location ?? "");
    const saved = (await row(user.id))!;
    assert.equal(saved.status, "PENDING");
    assert.equal(saved.encryptedRefreshToken, null);
    assert.equal(saved.googleEmail, null);
    assert.deepEqual((await app.request("GET", "/gmail/status", { token: user.token })).body, {
      state: "not_connected",
      email: null,
    });
    assert.equal(FakeGmailProvider.revokedTokens.length, before + 1);
    assert.match(FakeGmailProvider.revokedTokens.at(-1)!, /^fake-refresh-/);
  });

  it("an answer without a refresh token is an error and saves nothing", async () => {
    const user = await app.createUser();
    const { res } = await connectFully(user, "fake-no-refresh");
    assert.ok(res.location?.endsWith(webLocation("error")), res.location ?? "");
    assert.equal((await row(user.id))?.encryptedRefreshToken, null);
  });

  it("a code Google does not accept is an error", async () => {
    const user = await app.createUser();
    const { res } = await connectFully(user, "fake-unknown");
    assert.ok(res.location?.endsWith(webLocation("error")), res.location ?? "");
    assert.equal((await row(user.id))?.status, "PENDING");
  });

  it("a refresh token Google no longer accepts turns into needs_reconnect, then reconnecting works", async () => {
    const user = await app.createUser();
    await connectFully(user);
    await app.prisma.gmailConnection.update({
      where: { userId: user.id },
      data: {
        encryptedRefreshToken: encryptToken("fake-refresh-revoked", user.id, parseEncryptionKey()),
        lastVerifiedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    });

    const status = await app.request("GET", "/gmail/status", { token: user.token });
    assert.deepEqual(status.body, { state: "needs_reconnect", email: "fake.user@example.com" });
    const saved = (await row(user.id))!;
    assert.equal(saved.status, "NEEDS_RECONNECT");
    assert.equal(saved.encryptedRefreshToken, null);

    const { res } = await connectFully(user);
    assert.ok(res.location?.endsWith(webLocation("connected")));
    assert.equal(
      (await app.request("GET", "/gmail/status", { token: user.token })).body.state,
      "connected",
    );
  });

  it("disconnects: revokes the token at Google and deletes it here", async () => {
    const user = await app.createUser();
    await connectFully(user);
    const stored = decryptToken(
      (await row(user.id))!.encryptedRefreshToken!,
      user.id,
      parseEncryptionKey(),
    );

    const res = await app.request("DELETE", "/gmail/connection", { token: user.token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { revoked: true });
    assert.ok(FakeGmailProvider.revokedTokens.includes(stored));
    assert.equal(await row(user.id), null);
    assert.deepEqual((await app.request("GET", "/gmail/status", { token: user.token })).body, {
      state: "not_connected",
      email: null,
    });
  });

  it("disconnecting twice, or without ever connecting, is a 404", async () => {
    const user = await app.createUser();
    assert.equal(
      (await app.request("DELETE", "/gmail/connection", { token: user.token })).status,
      404,
    );
    await connectFully(user);
    assert.equal(
      (await app.request("DELETE", "/gmail/connection", { token: user.token })).status,
      200,
    );
    assert.equal(
      (await app.request("DELETE", "/gmail/connection", { token: user.token })).status,
      404,
    );
  });

  it("an unfinished attempt is not a connection: disconnect is a 404 and clears it", async () => {
    const user = await app.createUser();
    await connect(user);
    assert.equal(
      (await app.request("DELETE", "/gmail/connection", { token: user.token })).status,
      404,
    );
    assert.equal(await row(user.id), null);
  });

  it("disconnect deletes the tokens even when Google cannot be reached, and reports it", async () => {
    const user = await app.createUser();
    await connectFully(user);
    await app.prisma.gmailConnection.update({
      where: { userId: user.id },
      data: {
        encryptedRefreshToken: encryptToken("fake-revoke-fails", user.id, parseEncryptionKey()),
      },
    });
    const res = await app.request("DELETE", "/gmail/connection", { token: user.token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { revoked: false });
    assert.equal(await row(user.id), null);
  });

  it("one user neither sees nor disconnects another user's connection", async () => {
    const a = await app.createUser();
    const b = await app.createUser();
    await connectFully(a);

    const bStatus = await app.request("GET", "/gmail/status", { token: b.token });
    assert.deepEqual(bStatus.body, { state: "not_connected", email: null });
    assert.equal(
      (await app.request("DELETE", "/gmail/connection", { token: b.token })).status,
      404,
    );

    const aStatus = await app.request("GET", "/gmail/status", { token: a.token });
    assert.deepEqual(aStatus.body, { state: "connected", email: "fake.user@example.com" });
    assert.ok((await row(a.id))?.encryptedRefreshToken);
  });

  it("a state binds the attempt to the user who started it", async () => {
    const a = await app.createUser();
    const b = await app.createUser();
    const flow = await connect(a);
    // Even if B's browser delivers A's callback, the connection belongs to A, never to B.
    await callback({ code: flow.code, state: flow.state });
    assert.equal(await row(b.id), null);
    assert.equal(
      (await app.request("GET", "/gmail/status", { token: b.token })).body.state,
      "not_connected",
    );
    assert.equal(
      (await app.request("GET", "/gmail/status", { token: a.token })).body.state,
      "connected",
    );
  });

  it("ignores a forged userId in the callback query", async () => {
    const attacker = await app.createUser();
    const victim = await app.createUser();
    const flow = await connect(attacker);
    await callback({ code: flow.code, state: flow.state, userId: victim.id, uid: victim.id });
    assert.equal(await row(victim.id), null);
    assert.equal((await row(attacker.id))?.status, "CONNECTED");
  });

  it("deleting the user deletes the connection", async () => {
    const user = await app.createUser();
    await connectFully(user);
    await app.prisma.user.delete({ where: { id: user.id } });
    assert.equal(await row(user.id), null);
  });
});
