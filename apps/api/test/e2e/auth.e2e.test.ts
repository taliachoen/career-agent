import "../support/require-test-db.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PASSWORD, startTestApp, type TestApp } from "../support/e2e-app.js";

describe("auth (e2e)", () => {
  let app: TestApp;
  before(async () => {
    app = await startTestApp();
  });
  after(async () => {
    await app.close();
  });

  const newEmail = () => `auth-${randomUUID()}@example.com`;

  it("GET /health is public", async () => {
    const res = await app.request("GET", "/health");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: "ok", service: "api" });
  });

  it("registers a user and returns safe user data only", async () => {
    const email = newEmail().toUpperCase();
    const res = await app.request("POST", "/auth/register", {
      body: { email, password: PASSWORD },
    });
    // Not created through createUser(), so remove it explicitly.
    await app.prisma.user.deleteMany({ where: { email: email.toLowerCase() } });
    assert.equal(res.status, 201);
    assert.equal(res.body.email, email.toLowerCase());
    assert.deepEqual(Object.keys(res.body).sort(), ["createdAt", "email", "id"]);
  });

  it("stores a hash, not the plaintext password", async () => {
    const user = await app.createUser();
    const row = await app.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.notEqual(row.passwordHash, PASSWORD);
    assert.match(row.passwordHash, /^\$2[aby]\$/);
  });

  it("rejects a duplicate email with 409 (case-insensitive)", async () => {
    const user = await app.createUser();
    const res = await app.request("POST", "/auth/register", {
      body: { email: user.email.toUpperCase(), password: PASSWORD },
    });
    assert.equal(res.status, 409);
  });

  it("rejects invalid registration input with 400", async () => {
    const cases: Record<string, unknown>[] = [
      { email: "not-an-email", password: PASSWORD },
      { email: newEmail(), password: "short" },
      { email: newEmail() },
      { password: PASSWORD },
      { email: newEmail(), password: "x".repeat(73) },
    ];
    for (const body of cases) {
      const res = await app.request("POST", "/auth/register", { body });
      assert.equal(res.status, 400, `fields: ${Object.keys(body).join(",")}`);
    }
  });

  it("login returns an access token and safe user data", async () => {
    const user = await app.createUser();
    const res = await app.request("POST", "/auth/login", {
      body: { email: user.email, password: PASSWORD },
    });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.accessToken, "string");
    assert.equal(res.body.user.id, user.id);
    assert.equal("passwordHash" in res.body.user, false);
  });

  it("login with a wrong password and with an unknown email both return the same 401", async () => {
    const user = await app.createUser();
    const wrongPassword = await app.request("POST", "/auth/login", {
      body: { email: user.email, password: "wrong-password" },
    });
    const unknownEmail = await app.request("POST", "/auth/login", {
      body: { email: newEmail(), password: PASSWORD },
    });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.deepEqual(wrongPassword.body, unknownEmail.body);
  });

  it("GET /auth/me returns the user for a valid token", async () => {
    const user = await app.createUser();
    const res = await app.request("GET", "/auth/me", { token: user.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.id, user.id);
    assert.equal(res.body.email, user.email);
    assert.equal("passwordHash" in res.body, false);
  });

  it("GET /auth/me rejects missing, malformed, tampered and unsigned tokens", async () => {
    const user = await app.createUser();
    const tampered = user.token.slice(0, -2) + (user.token.endsWith("aa") ? "bb" : "aa");
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: user.id })).toString("base64url");
    const unsigned = `${header}.${payload}.`;

    assert.equal((await app.request("GET", "/auth/me")).status, 401);
    for (const token of ["garbage", "a.b.c", tampered, unsigned]) {
      const res = await app.request("GET", "/auth/me", { token });
      assert.equal(res.status, 401);
    }
  });
});
