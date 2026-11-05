import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  jobKey,
  locationsCompatible,
  normalizeCompany,
  normalizeLocation,
  normalizeText,
  normalizeTitle,
} from "../../src/ingest/job-matching.js";

describe("normalizeCompany", () => {
  it("ignores case, punctuation and legal suffixes", () => {
    assert.equal(normalizeCompany("Acme Software Ltd."), normalizeCompany("ACME software"));
    assert.equal(normalizeCompany("Acme, Inc"), "acme");
    assert.equal(normalizeCompany('Initech בע"מ'), normalizeCompany("Initech"));
    assert.equal(normalizeCompany("Initech בע״מ"), "initech");
  });

  it("keeps different companies different", () => {
    assert.notEqual(normalizeCompany("Acme Software"), normalizeCompany("Acme Hardware"));
  });
});

describe("normalizeTitle", () => {
  it("ignores gender markers and a trailing (m/f/d)", () => {
    assert.equal(normalizeTitle("מפתח/ת Full Stack"), normalizeTitle("מפתח Full Stack"));
    assert.equal(
      normalizeTitle("Full Stack Developer (m/f/d)"),
      normalizeTitle("full stack developer"),
    );
    assert.equal(
      normalizeTitle("Full Stack Developer m/f/x"),
      normalizeTitle("Full Stack Developer"),
    );
    assert.equal(normalizeTitle("Full-Stack  Developer"), normalizeTitle("full stack developer"));
  });

  it("keeps different roles different", () => {
    assert.notEqual(normalizeTitle("Backend Developer"), normalizeTitle("Frontend Developer"));
    assert.notEqual(
      normalizeTitle("Senior Backend Developer"),
      normalizeTitle("Backend Developer"),
    );
  });
});

describe("normalizeLocation", () => {
  it("uses the city: the part before the first comma, with Yafo/Jaffa dropped", () => {
    assert.equal(normalizeLocation("Tel Aviv-Yafo, Tel Aviv District, Israel"), "tel aviv");
    assert.equal(normalizeLocation("Tel Aviv"), "tel aviv");
    assert.equal(normalizeLocation("תל אביב-יפו, ישראל"), "תל אביב");
    assert.equal(normalizeLocation("  Haifa , Israel"), "haifa");
  });

  it("is null when there is no location", () => {
    for (const value of [null, undefined, "", "   ", ", Israel"]) {
      assert.equal(normalizeLocation(value), null, JSON.stringify(value));
    }
  });
});

describe("jobKey and locationsCompatible", () => {
  it("is the same for the same company and role on different sites", () => {
    assert.equal(
      jobKey("Acme Software", "Full Stack Developer"),
      jobKey("Acme Software Ltd", "Full Stack Developer (m/f/d)"),
    );
  });

  it("is null when the company or the role is empty after normalizing", () => {
    assert.equal(jobKey("", "Developer"), null);
    assert.equal(jobKey("Acme", "  "), null);
    assert.equal(jobKey("!!!", "Developer"), null);
  });

  it("two cities are two jobs; a missing location can be either", () => {
    assert.equal(locationsCompatible("tel aviv", "tel aviv"), true);
    assert.equal(locationsCompatible("tel aviv", "haifa"), false);
    assert.equal(locationsCompatible(null, "haifa"), true);
    assert.equal(locationsCompatible("haifa", null), true);
    assert.equal(locationsCompatible(null, null), true);
  });
});

describe("normalizeText", () => {
  it("removes niqqud, quotes and punctuation, and keeps letters and digits of any script", () => {
    assert.equal(normalizeText("שָׁלוֹם, עולם!"), "שלום עולם");
    assert.equal(normalizeText("C++ / .NET (v8)"), "c net v8");
  });
});
