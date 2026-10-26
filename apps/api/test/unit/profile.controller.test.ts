import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { parseProfileInput } from "../../src/profile/profile.controller.js";

const cv = "x".repeat(200);

// The messages a rejected input produced.
function errorsOf(body: unknown): string[] {
  try {
    parseProfileInput(body);
  } catch (error) {
    assert.ok(error instanceof BadRequestException);
    const { message } = error.getResponse() as { message: string | string[] };
    return Array.isArray(message) ? message : [message];
  }
  assert.fail("expected a BadRequestException");
}

describe("parseProfileInput", () => {
  it("accepts a valid profile", () => {
    assert.deepEqual(parseProfileInput({ cvText: cv, lookingFor: "Full Stack" }), {
      cvText: cv,
      lookingFor: "Full Stack",
    });
  });

  it("trims both fields", () => {
    assert.deepEqual(parseProfileInput({ cvText: `  ${cv}\n`, lookingFor: "  junior  " }), {
      cvText: cv,
      lookingFor: "junior",
    });
  });

  it("treats a missing or null lookingFor as empty", () => {
    assert.equal(parseProfileInput({ cvText: cv }).lookingFor, "");
    assert.equal(parseProfileInput({ cvText: cv, lookingFor: null }).lookingFor, "");
  });

  it("ignores unknown fields such as userId", () => {
    const parsed = parseProfileInput({ cvText: cv, userId: "attacker" });
    assert.deepEqual(Object.keys(parsed).sort(), ["cvText", "lookingFor"]);
  });

  it("enforces the cvText length boundaries", () => {
    assert.equal(parseProfileInput({ cvText: "x".repeat(200) }).cvText.length, 200);
    assert.equal(parseProfileInput({ cvText: "x".repeat(20_000) }).cvText.length, 20_000);
    assert.equal(errorsOf({ cvText: "x".repeat(199) }).length, 1);
    assert.equal(errorsOf({ cvText: "x".repeat(20_001) }).length, 1);
  });

  it("measures length after trimming", () => {
    assert.equal(errorsOf({ cvText: `${"x".repeat(199)}${" ".repeat(50)}` }).length, 1);
  });

  it("rejects a missing, blank or non-string cvText", () => {
    for (const body of [{}, { cvText: "" }, { cvText: "   " }, { cvText: 123 }, { cvText: null }]) {
      assert.equal(errorsOf(body).length, 1, JSON.stringify(body));
    }
  });

  it("enforces the lookingFor maximum", () => {
    assert.equal(
      parseProfileInput({ cvText: cv, lookingFor: "y".repeat(2_000) }).lookingFor.length,
      2_000,
    );
    assert.equal(errorsOf({ cvText: cv, lookingFor: "y".repeat(2_001) }).length, 1);
    assert.equal(errorsOf({ cvText: cv, lookingFor: 5 }).length, 1);
  });

  it("collects errors from both fields", () => {
    assert.equal(errorsOf({ cvText: "short", lookingFor: "y".repeat(2_001) }).length, 2);
  });

  it("rejects a null character, which the database cannot store", () => {
    assert.equal(errorsOf({ cvText: `${cv}\u0000` }).length, 1);
    assert.equal(errorsOf({ cvText: cv, lookingFor: "a\u0000b" }).length, 1);
  });

  it("rejects a body that is not an object", () => {
    for (const body of [null, undefined, "text", 5]) {
      assert.equal(errorsOf(body).length, 1);
    }
  });

  it("never puts the submitted text in the error messages", () => {
    const secret = "SECRET-PERSONAL-DETAIL";
    const messages = [
      ...errorsOf({ cvText: secret }),
      ...errorsOf({ cvText: cv, lookingFor: secret.repeat(200) }),
      ...errorsOf({ cvText: secret.repeat(1_000) }),
    ];
    assert.ok(messages.length >= 3);
    for (const message of messages) {
      assert.equal(message.includes(secret), false);
    }
  });
});
