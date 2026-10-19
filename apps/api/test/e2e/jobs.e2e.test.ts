import "../support/require-test-db.js";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { startTestApp, type TestApp } from "../support/e2e-app.js";

const jobBody = {
  title: "Backend Developer",
  company: "Example",
  description: "Backend development role",
  url: "https://example.com/job",
};

const ids = (jobs: { id: string }[]) => jobs.map((job) => job.id);

describe("jobs (e2e)", () => {
  let app: TestApp;
  before(async () => {
    app = await startTestApp();
  });
  after(async () => {
    await app.close();
  });

  it("requires authentication on every jobs endpoint", async () => {
    assert.equal((await app.request("GET", "/jobs")).status, 401);
    assert.equal((await app.request("GET", "/jobs/some-id")).status, 401);
    assert.equal((await app.request("POST", "/jobs", { body: jobBody })).status, 401);
    assert.equal((await app.request("GET", "/jobs", { token: "garbage" })).status, 401);
  });

  it("creates a job owned by the authenticated user", async () => {
    const user = await app.createUser();
    const res = await app.request("POST", "/jobs", { body: jobBody, token: user.token });
    assert.equal(res.status, 201);
    assert.equal(typeof res.body.id, "string");
    assert.equal(res.body.title, jobBody.title);
    assert.equal(res.body.url, jobBody.url);
    assert.equal(res.body.userId, user.id);
    const row = await app.prisma.job.findUniqueOrThrow({ where: { id: res.body.id } });
    assert.equal(row.userId, user.id);
  });

  it("trims whitespace in submitted fields", async () => {
    const user = await app.createUser();
    const res = await app.request("POST", "/jobs", {
      body: { ...jobBody, title: "  Padded Title  " },
      token: user.token,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, "Padded Title");
  });

  it("GET /jobs returns only the caller's jobs", async () => {
    const a = await app.createUser();
    const b = await app.createUser();
    const jobA = (await app.request("POST", "/jobs", { body: jobBody, token: a.token })).body;
    const jobB = (await app.request("POST", "/jobs", { body: jobBody, token: b.token })).body;

    const listA = await app.request("GET", "/jobs", { token: a.token });
    const listB = await app.request("GET", "/jobs", { token: b.token });
    assert.deepEqual(ids(listA.body), [jobA.id]);
    assert.deepEqual(ids(listB.body), [jobB.id]);
  });

  it("GET /jobs/:id returns the owner's job", async () => {
    const user = await app.createUser();
    const job = (await app.request("POST", "/jobs", { body: jobBody, token: user.token })).body;
    const res = await app.request("GET", `/jobs/${job.id}`, { token: user.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.id, job.id);
  });

  it("another user's job is 404, indistinguishable from a nonexistent job", async () => {
    const owner = await app.createUser();
    const other = await app.createUser();
    const job = (await app.request("POST", "/jobs", { body: jobBody, token: owner.token })).body;

    const foreign = await app.request("GET", `/jobs/${job.id}`, { token: other.token });
    const missingId = "00000000-0000-4000-8000-000000000000";
    const missing = await app.request("GET", `/jobs/${missingId}`, { token: other.token });

    assert.equal(foreign.status, 404);
    assert.equal(missing.status, 404);
    assert.deepEqual(
      { ...foreign.body, message: foreign.body.message.replace(job.id, "<id>") },
      { ...missing.body, message: missing.body.message.replace(missingId, "<id>") },
    );
  });

  it("ignores a forged userId in the request body", async () => {
    const attacker = await app.createUser();
    const victim = await app.createUser();
    const res = await app.request("POST", "/jobs", {
      body: { ...jobBody, userId: victim.id },
      token: attacker.token,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.userId, attacker.id);
    const row = await app.prisma.job.findUniqueOrThrow({ where: { id: res.body.id } });
    assert.equal(row.userId, attacker.id);
    const victimJobs = await app.request("GET", "/jobs", { token: victim.token });
    assert.deepEqual(victimJobs.body, []);
  });

  it("rejects invalid job input with 400 and creates nothing", async () => {
    const user = await app.createUser();
    const invalid: unknown[] = [
      {},
      { ...jobBody, title: "" },
      { ...jobBody, company: "   " },
      { ...jobBody, description: 123 },
      { ...jobBody, url: "ftp://example.com" },
      { title: jobBody.title },
    ];
    for (const body of invalid) {
      const res = await app.request("POST", "/jobs", { body, token: user.token });
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.deepEqual((await app.request("GET", "/jobs", { token: user.token })).body, []);
  });
});
