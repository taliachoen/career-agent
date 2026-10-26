import "../support/require-test-db.js";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { startTestApp, type TestApp } from "../support/e2e-app.js";

const profileBody = { cvText: "a".repeat(300), lookingFor: "Full Stack junior, center, hybrid" };

describe("profile (e2e)", () => {
  let app: TestApp;
  before(async () => {
    app = await startTestApp();
  });
  after(async () => {
    await app.close();
  });

  it("requires authentication on every profile endpoint", async () => {
    assert.equal((await app.request("GET", "/profile")).status, 401);
    assert.equal((await app.request("PUT", "/profile", { body: profileBody })).status, 401);
    assert.equal((await app.request("GET", "/profile", { token: "garbage" })).status, 401);
    assert.equal(
      (await app.request("PUT", "/profile", { body: profileBody, token: "garbage" })).status,
      401,
    );
  });

  it("a new user gets an empty profile, not a 404", async () => {
    const user = await app.createUser();
    const res = await app.request("GET", "/profile", { token: user.token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { cvText: "", lookingFor: "", updatedAt: null });
  });

  it("saving and then reading returns what was saved", async () => {
    const user = await app.createUser();
    const put = await app.request("PUT", "/profile", { body: profileBody, token: user.token });
    assert.equal(put.status, 200);
    assert.equal(put.body.cvText, profileBody.cvText);
    assert.equal(put.body.lookingFor, profileBody.lookingFor);
    assert.equal(typeof put.body.updatedAt, "string");
    assert.equal("userId" in put.body, false);
    assert.equal("id" in put.body, false);

    const get = await app.request("GET", "/profile", { token: user.token });
    assert.equal(get.status, 200);
    assert.deepEqual(get.body, put.body);
  });

  it("a second save replaces the first and keeps a single profile", async () => {
    const user = await app.createUser();
    await app.request("PUT", "/profile", { body: profileBody, token: user.token });
    const second = { cvText: "b".repeat(250), lookingFor: "" };
    const put = await app.request("PUT", "/profile", { body: second, token: user.token });
    assert.equal(put.status, 200);

    const get = await app.request("GET", "/profile", { token: user.token });
    assert.equal(get.body.cvText, second.cvText);
    assert.equal(get.body.lookingFor, "");
    assert.equal(await app.prisma.profile.count({ where: { userId: user.id } }), 1);
  });

  it("lookingFor is optional", async () => {
    const user = await app.createUser();
    const put = await app.request("PUT", "/profile", {
      body: { cvText: profileBody.cvText },
      token: user.token,
    });
    assert.equal(put.status, 200);
    assert.equal(put.body.lookingFor, "");
  });

  it("one user neither sees nor changes another user's profile", async () => {
    const a = await app.createUser();
    const b = await app.createUser();
    await app.request("PUT", "/profile", { body: profileBody, token: a.token });

    const bView = await app.request("GET", "/profile", { token: b.token });
    assert.deepEqual(bView.body, { cvText: "", lookingFor: "", updatedAt: null });

    const bBody = { cvText: "c".repeat(300), lookingFor: "something else" };
    await app.request("PUT", "/profile", { body: bBody, token: b.token });

    const aView = await app.request("GET", "/profile", { token: a.token });
    assert.equal(aView.body.cvText, profileBody.cvText);
    assert.equal(aView.body.lookingFor, profileBody.lookingFor);
  });

  it("ignores a forged userId in the request body", async () => {
    const attacker = await app.createUser();
    const victim = await app.createUser();
    const res = await app.request("PUT", "/profile", {
      body: { ...profileBody, userId: victim.id },
      token: attacker.token,
    });
    assert.equal(res.status, 200);
    assert.equal(await app.prisma.profile.count({ where: { userId: victim.id } }), 0);
    assert.equal(await app.prisma.profile.count({ where: { userId: attacker.id } }), 1);
  });

  it("rejects an invalid profile with 400, saves nothing and does not echo the text", async () => {
    const user = await app.createUser();
    const secret = "SECRET-PERSONAL-DETAIL";
    const invalid: unknown[] = [
      {},
      { lookingFor: "only this" },
      { cvText: "" },
      { cvText: "a".repeat(199) },
      { cvText: `${secret}${"a".repeat(20_000)}` },
      { cvText: profileBody.cvText, lookingFor: "y".repeat(2_001) },
      { cvText: `${profileBody.cvText}\u0000` },
    ];
    for (const body of invalid) {
      const res = await app.request("PUT", "/profile", { body, token: user.token });
      assert.equal(res.status, 400, JSON.stringify(body).slice(0, 80));
      assert.equal(JSON.stringify(res.body).includes(secret), false);
    }
    assert.equal(await app.prisma.profile.count({ where: { userId: user.id } }), 0);
  });

  it("deleting the user deletes the profile", async () => {
    const user = await app.createUser();
    await app.request("PUT", "/profile", { body: profileBody, token: user.token });
    await app.prisma.user.delete({ where: { id: user.id } });
    assert.equal(await app.prisma.profile.count({ where: { userId: user.id } }), 0);
  });
});
