import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeLlmProvider } from "../../src/llm/fake.provider.js";
import { LlmError, LlmNotConfiguredError } from "../../src/llm/llm-provider.js";
import { createLlmProvider } from "../../src/llm/llm.module.js";
import { OpenAiProvider } from "../../src/llm/openai.provider.js";

const request = (user: string) => ({
  system: "s",
  user,
  schemaName: "x",
  schema: {},
});

describe("createLlmProvider", () => {
  it("defaults to openai", () => {
    assert.ok(createLlmProvider({ OPENAI_API_KEY: "k" }) instanceof OpenAiProvider);
  });

  it("selects openai and fake by name", () => {
    assert.equal(createLlmProvider({ LLM_PROVIDER: "openai" }).name, "openai");
    assert.equal(createLlmProvider({ LLM_PROVIDER: " Fake " }).name, "fake");
  });

  it("refuses fake in production", () => {
    assert.throws(
      () => createLlmProvider({ LLM_PROVIDER: "fake", NODE_ENV: "production" }),
      /not allowed/,
    );
  });

  it("rejects an unknown provider at startup", () => {
    assert.throws(() => createLlmProvider({ LLM_PROVIDER: "claude" }), /LLM_PROVIDER/);
  });

  it("starts without an API key and only fails when the provider is used", async () => {
    const provider = createLlmProvider({ LLM_PROVIDER: "openai" });
    assert.throws(() => provider.checkReady(), LlmNotConfiguredError);
    await assert.rejects(() => provider.completeJson(request("x")), LlmNotConfiguredError);
  });

  it("treats a blank API key as missing", () => {
    const provider = createLlmProvider({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "  " });
    assert.throws(() => provider.checkReady(), LlmNotConfiguredError);
  });
});

describe("FakeLlmProvider", () => {
  const fake = new FakeLlmProvider();

  it("is deterministic and answers with the requested JSON shape", async () => {
    const a = await fake.completeJson(request("same input"));
    const b = await fake.completeJson(request("same input"));
    assert.equal(a.text, b.text);
    const parsed = JSON.parse(a.text);
    assert.deepEqual(Object.keys(parsed).sort(), ["gaps", "matches", "score", "summary"]);
  });

  it("follows the score, fail and badjson markers", async () => {
    assert.equal(
      JSON.parse((await fake.completeJson(request("[[fake:score=77]]"))).text).score,
      77,
    );
    await assert.rejects(() => fake.completeJson(request("[[fake:fail]]")), LlmError);
    assert.equal((await fake.completeJson(request("[[fake:badjson]]"))).text, "this is not json");
  });
});
