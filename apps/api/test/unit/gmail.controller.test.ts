import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCallbackQuery } from "../../src/gmail/gmail.controller.js";

describe("parseCallbackQuery", () => {
  it("reads state, code and error", () => {
    assert.deepEqual(parseCallbackQuery({ state: "s", code: "c" }), { state: "s", code: "c" });
    assert.deepEqual(parseCallbackQuery({ state: "s", error: "access_denied" }), {
      state: "s",
      error: "access_denied",
    });
  });

  it("ignores unknown parameters", () => {
    assert.deepEqual(parseCallbackQuery({ state: "s", scope: "x", authuser: "0" }), { state: "s" });
  });

  it("returns null for repeated parameters, empty or over-long values, and non-objects", () => {
    assert.equal(parseCallbackQuery({ state: ["a", "b"] }), null);
    assert.equal(parseCallbackQuery({ state: { a: 1 } }), null);
    assert.equal(parseCallbackQuery({ state: "" }), null);
    assert.equal(parseCallbackQuery({ state: "s".repeat(1025) }), null);
    assert.equal(parseCallbackQuery({ code: "c".repeat(2049) }), null);
    assert.equal(parseCallbackQuery({ error: "e".repeat(129) }), null);
    assert.equal(parseCallbackQuery(null), null);
    assert.equal(parseCallbackQuery("state=x"), null);
  });
});
