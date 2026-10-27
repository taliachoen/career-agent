import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { JobScore } from "@prisma/client";
import { compareJobs, isStale, toScoreView } from "../../src/jobs/scoring/job-score.js";

const at = (iso: string) => new Date(iso);

describe("isStale", () => {
  const scoredAt = at("2026-10-27T10:00:00.000Z");

  it("is fresh when there is no profile date", () => {
    assert.equal(isStale(scoredAt, null), false);
  });

  it("is fresh when the profile was saved before the scoring", () => {
    assert.equal(isStale(scoredAt, at("2026-10-27T09:59:59.999Z")), false);
  });

  it("is fresh when the profile date equals the scoring date", () => {
    assert.equal(isStale(scoredAt, scoredAt), false);
  });

  it("is stale when the profile was saved after the scoring", () => {
    assert.equal(isStale(scoredAt, at("2026-10-27T10:00:00.001Z")), true);
  });
});

describe("toScoreView", () => {
  const row: JobScore = {
    id: "s1",
    jobId: "j1",
    userId: "u1",
    score: 70,
    summary: "ok",
    matches: ["a"],
    gaps: [],
    model: "m",
    scoredAt: at("2026-10-27T10:00:00.000Z"),
  };

  it("returns null without a score", () => {
    assert.equal(toScoreView(null, null), null);
  });

  it("exposes neither ids nor the owner, and computes stale", () => {
    const view = toScoreView(row, at("2026-10-28T00:00:00.000Z"));
    assert.deepEqual(view, {
      score: 70,
      summary: "ok",
      matches: ["a"],
      gaps: [],
      model: "m",
      scoredAt: row.scoredAt,
      stale: true,
    });
  });
});

describe("compareJobs", () => {
  const job = (id: string, created: string, score: number | null) => ({
    id,
    createdAt: at(created),
    score: score === null ? null : { score },
  });

  it("sorts by score high to low, unscored last, newest first inside each group", () => {
    const jobs = [
      job("a", "2026-10-01T00:00:00Z", null),
      job("b", "2026-10-02T00:00:00Z", 60),
      job("c", "2026-10-03T00:00:00Z", null),
      job("d", "2026-10-04T00:00:00Z", 90),
      job("e", "2026-10-05T00:00:00Z", 60),
    ];
    assert.deepEqual(
      jobs.sort(compareJobs).map((j) => j.id),
      ["d", "e", "b", "c", "a"],
    );
  });

  it("keeps a stable order for jobs created in the same millisecond", () => {
    const x = job("x", "2026-10-01T00:00:00Z", 50);
    const y = job("y", "2026-10-01T00:00:00Z", 50);
    assert.deepEqual(
      [x, y].sort(compareJobs).map((j) => j.id),
      ["y", "x"],
    );
    assert.deepEqual(
      [y, x].sort(compareJobs).map((j) => j.id),
      ["y", "x"],
    );
  });
});
