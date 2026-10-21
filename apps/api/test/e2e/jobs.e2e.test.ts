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
    assert.equal(res.body.userId, user.id);
    assert.equal(typeof res.body.createdAt, "string");
    assert.equal("url" in res.body, false);
    const row = await app.prisma.job.findUniqueOrThrow({ where: { id: res.body.id } });
    assert.equal(row.userId, user.id);
  });

  it("the response includes the first posting, with source and site set by the server", async () => {
    const user = await app.createUser();
    const res = await app.request("POST", "/jobs", {
      body: { ...jobBody, url: "https://www.LinkedIn.com/jobs/view/1" },
      token: user.token,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.postings.length, 1);
    const posting = res.body.postings[0];
    assert.equal(typeof posting.id, "string");
    assert.equal(posting.jobId, res.body.id);
    assert.equal(posting.userId, user.id);
    assert.equal(posting.url, "https://www.LinkedIn.com/jobs/view/1");
    assert.equal(posting.site, "linkedin.com");
    assert.equal(posting.source, "MANUAL");
    assert.equal(posting.sourceMessageId, null);
    assert.equal(typeof posting.createdAt, "string");
  });

  it("ignores source, site and sourceMessageId sent by the client", async () => {
    const user = await app.createUser();
    const res = await app.request("POST", "/jobs", {
      body: {
        ...jobBody,
        url: "https://example.com/forged",
        source: "EMAIL",
        site: "evil.com",
        sourceMessageId: "gmail-123",
      },
      token: user.token,
    });
    assert.equal(res.status, 201);
    const posting = res.body.postings[0];
    assert.equal(posting.source, "MANUAL");
    assert.equal(posting.site, "example.com");
    assert.equal(posting.sourceMessageId, null);
  });

  it("rejects a URL the user already has with 409 and creates no extra job", async () => {
    const user = await app.createUser();
    const first = await app.request("POST", "/jobs", { body: jobBody, token: user.token });
    assert.equal(first.status, 201);

    const second = await app.request("POST", "/jobs", {
      body: { ...jobBody, title: "Another title" },
      token: user.token,
    });
    assert.equal(second.status, 409);

    const list = await app.request("GET", "/jobs", { token: user.token });
    assert.deepEqual(ids(list.body), [first.body.id]);
    assert.equal(await app.prisma.jobPosting.count({ where: { userId: user.id } }), 1);
  });

  it("allows the same URL for two different users", async () => {
    const a = await app.createUser();
    const b = await app.createUser();
    const resA = await app.request("POST", "/jobs", { body: jobBody, token: a.token });
    const resB = await app.request("POST", "/jobs", { body: jobBody, token: b.token });
    assert.equal(resA.status, 201);
    assert.equal(resB.status, 201);
    assert.equal(resA.body.postings[0].url, resB.body.postings[0].url);
    assert.notEqual(resA.body.id, resB.body.id);
  });

  it("GET /jobs returns the newest jobs first, each with its postings", async () => {
    const user = await app.createUser();
    const created: string[] = [];
    for (const n of [1, 2, 3]) {
      const res = await app.request("POST", "/jobs", {
        body: { ...jobBody, url: `https://example.com/job-${n}` },
        token: user.token,
      });
      created.push(res.body.id);
    }
    // Set explicit timestamps so the test does not depend on request timing.
    // The middle job is the newest, the first job the oldest.
    const times = [
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-02-01T00:00:00Z"),
    ];
    for (const [i, id] of created.entries()) {
      await app.prisma.job.update({ where: { id }, data: { createdAt: times[i] } });
    }

    const list = await app.request("GET", "/jobs", { token: user.token });
    assert.equal(list.status, 200);
    assert.deepEqual(ids(list.body), [created[1], created[2], created[0]]);
    for (const job of list.body) {
      assert.equal(job.postings.length, 1);
      assert.equal(job.postings[0].jobId, job.id);
    }
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
    assert.equal(res.body.postings.length, 1);
    assert.equal(res.body.postings[0].url, jobBody.url);
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
      { ...jobBody, url: "http://" },
      { title: jobBody.title },
    ];
    for (const body of invalid) {
      const res = await app.request("POST", "/jobs", { body, token: user.token });
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.deepEqual((await app.request("GET", "/jobs", { token: user.token })).body, []);
  });
});
