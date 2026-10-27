import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InvalidScoreError, parseScoreResponse } from "../../src/jobs/scoring/parse-score.js";

const valid = { score: 82, summary: "התאמה טובה.", matches: ["React"], gaps: ["AWS"] };
const parse = (value: unknown) => parseScoreResponse(JSON.stringify(value));
const rejects = (value: unknown) => assert.throws(() => parse(value), InvalidScoreError);

describe("parseScoreResponse", () => {
  it("accepts a valid answer and trims the text", () => {
    const result = parse({ ...valid, summary: "  סיכום  ", matches: [" React "] });
    assert.deepEqual(result, { score: 82, summary: "סיכום", matches: ["React"], gaps: ["AWS"] });
  });

  it("accepts the boundary scores 0 and 100 and empty lists", () => {
    assert.equal(parse({ ...valid, score: 0, matches: [], gaps: [] }).score, 0);
    assert.equal(parse({ ...valid, score: 100 }).score, 100);
  });

  it("rejects a score outside 0-100", () => {
    rejects({ ...valid, score: -1 });
    rejects({ ...valid, score: 101 });
    rejects({ ...valid, score: 1000 });
  });

  it("rejects a score that is not an integer number", () => {
    rejects({ ...valid, score: 82.5 });
    rejects({ ...valid, score: "82" });
    rejects({ ...valid, score: null });
    rejects({ ...valid, score: Number.NaN });
  });

  it("rejects missing fields", () => {
    for (const field of ["score", "summary", "matches", "gaps"]) {
      const { [field]: _removed, ...rest } = valid as Record<string, unknown>;
      rejects(rest);
    }
  });

  it("rejects fields of the wrong type or with bad content", () => {
    rejects({ ...valid, summary: "" });
    rejects({ ...valid, summary: "   " });
    rejects({ ...valid, summary: 5 });
    rejects({ ...valid, matches: "React" });
    rejects({ ...valid, matches: [1] });
    rejects({ ...valid, gaps: [""] });
    rejects({ ...valid, gaps: [{ text: "AWS" }] });
  });

  it("rejects fields we did not ask for", () => {
    rejects({ ...valid, action: "send_email" });
  });

  it("rejects answers that are too long", () => {
    rejects({ ...valid, summary: "א".repeat(601) });
    rejects({ ...valid, matches: ["א".repeat(301)] });
    rejects({ ...valid, gaps: ["a", "b", "c", "d", "e", "f"] });
  });

  it("rejects null characters, which the database cannot store", () => {
    rejects({ ...valid, summary: "a\u0000b" });
    rejects({ ...valid, matches: ["a\u0000"] });
  });

  it("rejects broken JSON and JSON that is not an object", () => {
    for (const text of ["", "not json", '{"score": 5', "[1,2]", "null", '"text"', "42"]) {
      assert.throws(() => parseScoreResponse(text), InvalidScoreError);
    }
  });

  it("never puts the model's text into the error message", () => {
    const secret = "TOP-SECRET-CV-LINE";
    const attempts = [
      `{"score": 5, "summary": "${secret}`,
      JSON.stringify({ ...valid, score: 500, summary: secret }),
      JSON.stringify({ ...valid, [secret]: 1 }),
      JSON.stringify({ ...valid, summary: secret.repeat(100) }),
    ];
    for (const text of attempts) {
      try {
        parseScoreResponse(text);
        assert.fail("expected a rejection");
      } catch (error) {
        assert.ok(error instanceof InvalidScoreError);
        assert.equal(error.message.includes(secret), false, error.message);
      }
    }
  });
});
