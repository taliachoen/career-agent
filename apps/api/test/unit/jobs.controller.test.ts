import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { parseCreateJobInput } from "../../src/jobs/jobs.controller.js";
import { JOB_FIELD_MAX_LENGTHS } from "../../src/jobs/job.js";

const valid = {
  title: "Backend Developer",
  company: "Example",
  description: "Backend development role",
  url: "https://example.com/job",
};

function errorsOf(body: unknown): string[] {
  try {
    parseCreateJobInput(body);
  } catch (error) {
    assert.ok(error instanceof BadRequestException);
    const { message } = error.getResponse() as { message: string | string[] };
    return Array.isArray(message) ? message : [message];
  }
  assert.fail("expected a BadRequestException");
}

describe("parseCreateJobInput length limits", () => {
  it("accepts every field exactly at its limit", () => {
    const body = {
      title: "t".repeat(JOB_FIELD_MAX_LENGTHS.title),
      company: "c".repeat(JOB_FIELD_MAX_LENGTHS.company),
      description: "d".repeat(JOB_FIELD_MAX_LENGTHS.description),
      url: "https://example.com/" + "u".repeat(JOB_FIELD_MAX_LENGTHS.url - 20),
    };
    assert.deepEqual(parseCreateJobInput(body), body);
  });

  for (const field of ["title", "company", "description"] as const) {
    it(`rejects a ${field} over the limit, naming the field and the limit but not the value`, () => {
      const limit = JOB_FIELD_MAX_LENGTHS[field];
      const secret = "SECRET".repeat(limit);
      const errors = errorsOf({ ...valid, [field]: secret });
      assert.deepEqual(errors, [`${field} must be at most ${limit} characters`]);
      assert.ok(!JSON.stringify(errors).includes("SECRET"));
    });
  }

  it("rejects a url over the limit without echoing it", () => {
    const url = "https://example.com/" + "u".repeat(JOB_FIELD_MAX_LENGTHS.url);
    const errors = errorsOf({ ...valid, url });
    assert.deepEqual(errors, [`url must be at most ${JOB_FIELD_MAX_LENGTHS.url} characters`]);
  });

  it("counts the trimmed length, so surrounding whitespace does not push a value over", () => {
    const title = "t".repeat(JOB_FIELD_MAX_LENGTHS.title);
    assert.equal(parseCreateJobInput({ ...valid, title: `  ${title}  ` }).title, title);
  });

  it("reports every field that is too long", () => {
    const errors = errorsOf({
      ...valid,
      title: "t".repeat(JOB_FIELD_MAX_LENGTHS.title + 1),
      company: "c".repeat(JOB_FIELD_MAX_LENGTHS.company + 1),
    });
    assert.equal(errors.length, 2);
  });
});
