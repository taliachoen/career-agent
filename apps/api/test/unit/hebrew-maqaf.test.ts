import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseScoreResponse, useHebrewMaqaf } from "../../src/jobs/scoring/parse-score.js";

const MAQAF = "־";

describe("useHebrewMaqaf", () => {
  it("replaces a hyphen after a Hebrew letter", () => {
    assert.equal(useHebrewMaqaf("ו-Node.js"), `ו${MAQAF}Node.js`);
    assert.equal(useHebrewMaqaf("ה-Lead"), `ה${MAQAF}Lead`);
  });

  it("leaves a hyphen between two English words unchanged", () => {
    assert.equal(useHebrewMaqaf("full-stack developer"), "full-stack developer");
  });

  it("leaves a hyphen between numbers unchanged", () => {
    assert.equal(useHebrewMaqaf("3-5 שנים"), "3-5 שנים");
  });

  it("leaves a hyphen after a space or a Latin letter unchanged, even next to Hebrew", () => {
    assert.equal(useHebrewMaqaf("React - מצוין"), "React - מצוין");
    assert.equal(useHebrewMaqaf("Node-שרת"), "Node-שרת");
  });

  it("is applied to summary, matches and gaps of a parsed answer", () => {
    const result = parseScoreResponse(
      JSON.stringify({
        score: 70,
        summary: "מתאים ל-Backend.",
        matches: ["ניסיון ב-React"],
        gaps: ["ו-AWS"],
      }),
    );
    assert.equal(result.summary, `מתאים ל${MAQAF}Backend.`);
    assert.deepEqual(result.matches, [`ניסיון ב${MAQAF}React`]);
    assert.deepEqual(result.gaps, [`ו${MAQAF}AWS`]);
  });
});
