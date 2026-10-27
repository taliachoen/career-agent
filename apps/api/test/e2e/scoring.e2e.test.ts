import "../support/require-test-db.js";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { startTestApp, type TestApp } from "../support/e2e-app.js";

const profileBody = { cvText: "Full stack developer. ".repeat(20), lookingFor: "Junior, center" };

let counter = 0;
// The fake provider reads [[fake:...]] markers from the description.
function jobBody(marker = "", title = `Job ${++counter}`) {
  return {
    title,
    company: "Acme",
    description: `A role. ${marker}`,
    url: `https://example.com/scoring-e2e/${Date.now()}-${++counter}`,
  };
}

describe("job scoring (e2e, fake provider)", () => {
  let app: TestApp;
  before(async () => {
    app = await startTestApp();
  });
  after(async () => {
    await app.close();
  });

  async function userWithProfile() {
    const user = await app.createUser();
    const put = await app.request("PUT", "/profile", { body: profileBody, token: user.token });
    assert.equal(put.status, 200);
    return user;
  }

  async function addJob(token: string, marker = "", title?: string) {
    const res = await app.request("POST", "/jobs", { body: jobBody(marker, title), token });
    assert.equal(res.status, 201);
    return res.body as { id: string; title: string };
  }

  it("requires authentication", async () => {
    assert.equal((await app.request("POST", "/jobs/score")).status, 401);
    assert.equal((await app.request("POST", "/jobs/score", { token: "garbage" })).status, 401);
  });

  it("answers 400 with a clear message when the user has no profile", async () => {
    const user = await app.createUser();
    await addJob(user.token);
    const res = await app.request("POST", "/jobs/score", { token: user.token });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /profile/i);
    assert.equal(await app.prisma.jobScore.count({ where: { userId: user.id } }), 0);
  });

  it("scores unscored jobs and stores one score per job with model and date", async () => {
    const user = await userWithProfile();
    const job = await addJob(user.token, "[[fake:score=73]]");

    const res = await app.request("POST", "/jobs/score", { token: user.token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { scored: 1, failed: 0, remaining: 0 });

    const stored = await app.prisma.jobScore.findUniqueOrThrow({ where: { jobId: job.id } });
    assert.equal(stored.userId, user.id);
    assert.equal(stored.score, 73);
    assert.equal(stored.model, "fake-model");
    assert.ok(stored.summary.length > 0);
    assert.ok(stored.matches.length > 0 && stored.gaps.length > 0);
    assert.ok(Math.abs(Date.now() - stored.scoredAt.getTime()) < 60_000);

    const listed = await app.request("GET", "/jobs", { token: user.token });
    const view = listed.body.find((j: { id: string }) => j.id === job.id).score;
    assert.equal(view.score, 73);
    assert.equal(view.stale, false);
    assert.equal(view.model, "fake-model");
    assert.equal("userId" in view, false);
  });

  it("does not score an already scored job again", async () => {
    const user = await userWithProfile();
    await addJob(user.token);
    await app.request("POST", "/jobs/score", { token: user.token });
    const second = await app.request("POST", "/jobs/score", { token: user.token });
    assert.deepEqual(second.body, { scored: 0, failed: 0, remaining: 0 });
    assert.equal(await app.prisma.jobScore.count({ where: { userId: user.id } }), 1);
  });

  it("scores at most 10 jobs per call and reports how many remain", async () => {
    const user = await userWithProfile();
    for (let i = 0; i < 12; i++) await addJob(user.token);

    const first = await app.request("POST", "/jobs/score", { token: user.token });
    assert.deepEqual(first.body, { scored: 10, failed: 0, remaining: 2 });
    const second = await app.request("POST", "/jobs/score", { token: user.token });
    assert.deepEqual(second.body, { scored: 2, failed: 0, remaining: 0 });
    assert.equal(await app.prisma.jobScore.count({ where: { userId: user.id } }), 12);
  });

  it("a failing job does not stop the others, and is retried on the next call", async () => {
    const user = await userWithProfile();
    const good = await addJob(user.token);
    const failing = await addJob(user.token, "[[fake:fail]]");
    const broken = await addJob(user.token, "[[fake:badjson]]");
    const outOfRange = await addJob(user.token, "[[fake:score=150]]");

    const res = await app.request("POST", "/jobs/score", { token: user.token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { scored: 1, failed: 3, remaining: 3 });

    const saved = await app.prisma.jobScore.findMany({ where: { userId: user.id } });
    assert.deepEqual(
      saved.map((s) => s.jobId),
      [good.id],
    );
    for (const job of [failing, broken, outOfRange]) {
      const listed = await app.request("GET", `/jobs/${job.id}`, { token: user.token });
      assert.equal(listed.body.score, null);
    }
  });

  it("GET /jobs sorts by score, unscored last, newest first within each group", async () => {
    const user = await userWithProfile();
    const unscoredOld = await addJob(user.token, "[[fake:fail]]", "unscored old");
    const mid = await addJob(user.token, "[[fake:score=50]]", "mid");
    const unscoredNew = await addJob(user.token, "[[fake:fail]]", "unscored new");
    const high = await addJob(user.token, "[[fake:score=90]]", "high");
    const midNewer = await addJob(user.token, "[[fake:score=50]]", "mid newer");

    await app.request("POST", "/jobs/score", { token: user.token });
    const res = await app.request("GET", "/jobs", { token: user.token });
    assert.deepEqual(
      res.body.map((j: { id: string }) => j.id),
      [high.id, midNewer.id, mid.id, unscoredNew.id, unscoredOld.id],
    );
  });

  it("marks a score stale after the profile changes, and scores it again", async () => {
    const user = await userWithProfile();
    const job = await addJob(user.token, "[[fake:score=60]]");
    await app.request("POST", "/jobs/score", { token: user.token });

    await new Promise((resolve) => setTimeout(resolve, 15));
    const put = await app.request("PUT", "/profile", {
      body: { ...profileBody, lookingFor: "Something else" },
      token: user.token,
    });
    assert.equal(put.status, 200);

    const stale = await app.request("GET", `/jobs/${job.id}`, { token: user.token });
    assert.equal(stale.body.score.score, 60);
    assert.equal(stale.body.score.stale, true);

    const again = await app.request("POST", "/jobs/score", { token: user.token });
    assert.deepEqual(again.body, { scored: 1, failed: 0, remaining: 0 });
    const fresh = await app.request("GET", `/jobs/${job.id}`, { token: user.token });
    assert.equal(fresh.body.score.stale, false);
    assert.equal(await app.prisma.jobScore.count({ where: { jobId: job.id } }), 1);
  });

  it("keeps the old score when re-scoring a stale job fails", async () => {
    const user = await userWithProfile();
    const job = await addJob(user.token, "[[fake:score=60]]");
    await app.request("POST", "/jobs/score", { token: user.token });
    await app.prisma.job.update({
      where: { id: job.id },
      data: { description: "now [[fake:fail]]" },
    });
    await new Promise((resolve) => setTimeout(resolve, 15));
    await app.request("PUT", "/profile", { body: profileBody, token: user.token });

    const res = await app.request("POST", "/jobs/score", { token: user.token });
    assert.deepEqual(res.body, { scored: 0, failed: 1, remaining: 1 });
    const view = (await app.request("GET", `/jobs/${job.id}`, { token: user.token })).body.score;
    assert.equal(view.score, 60);
    assert.equal(view.stale, true);
  });

  it("scores only the caller's jobs and never shows another user's scores", async () => {
    const alice = await userWithProfile();
    const bob = await userWithProfile();
    const aliceJob = await addJob(alice.token, "[[fake:score=88]]");
    const bobJob = await addJob(bob.token, "[[fake:score=11]]");

    const run = await app.request("POST", "/jobs/score", { token: alice.token });
    assert.deepEqual(run.body, { scored: 1, failed: 0, remaining: 0 });

    // Bob's job was not touched by Alice's run.
    assert.equal(await app.prisma.jobScore.count({ where: { jobId: bobJob.id } }), 0);
    const bobList = await app.request("GET", "/jobs", { token: bob.token });
    assert.deepEqual(
      bobList.body.map((j: { id: string }) => j.id),
      [bobJob.id],
    );
    assert.equal(bobList.body[0].score, null);

    // Alice's job and score are invisible to Bob: 404, not 403.
    assert.equal(
      (await app.request("GET", `/jobs/${aliceJob.id}`, { token: bob.token })).status,
      404,
    );

    // Each user's score is stored under their own id.
    const stored = await app.prisma.jobScore.findUniqueOrThrow({ where: { jobId: aliceJob.id } });
    assert.equal(stored.userId, alice.id);
  });

  it("deletes the score with the job", async () => {
    const user = await userWithProfile();
    const job = await addJob(user.token);
    await app.request("POST", "/jobs/score", { token: user.token });
    await app.prisma.job.delete({ where: { id: job.id } });
    assert.equal(await app.prisma.jobScore.count({ where: { jobId: job.id } }), 0);
  });
});

describe("job scoring without an API key (e2e, openai provider)", () => {
  let app: TestApp;
  before(async () => {
    app = await startTestApp({ llmProvider: "openai" });
  });
  after(async () => {
    await app.close();
  });

  it("the server runs; only scoring answers 503 with a clear message", async () => {
    const user = await app.createUser();
    await app.request("PUT", "/profile", { body: profileBody, token: user.token });
    const created = await app.request("POST", "/jobs", { body: jobBody(), token: user.token });
    assert.equal(created.status, 201);

    assert.equal((await app.request("GET", "/jobs", { token: user.token })).status, 200);
    const res = await app.request("POST", "/jobs/score", { token: user.token });
    assert.equal(res.status, 503);
    assert.match(res.body.message, /not configured/i);
  });

  it("still answers 400 for a missing profile before it reports the missing key", async () => {
    const user = await app.createUser();
    assert.equal((await app.request("POST", "/jobs/score", { token: user.token })).status, 400);
  });
});
