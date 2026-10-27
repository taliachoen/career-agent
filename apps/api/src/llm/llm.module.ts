import { Module } from "@nestjs/common";
import { FakeLlmProvider } from "./fake.provider.js";
import { LLM_PROVIDER, type LlmProvider } from "./llm-provider.js";
import { OpenAiProvider } from "./openai.provider.js";

// Small and cheap; see docs/plan.md. Override with OPENAI_MODEL.
export const DEFAULT_OPENAI_MODEL = "gpt-6-luna";

// Fails at startup on a bad configuration. A missing OPENAI_API_KEY is not one: the
// server must still start, and only scoring answers 503 (see OpenAiProvider.checkReady).
export function createLlmProvider(env: NodeJS.ProcessEnv = process.env): LlmProvider {
  const name = (env.LLM_PROVIDER ?? "openai").trim().toLowerCase();
  if (name === "fake") {
    if (env.NODE_ENV === "production") {
      throw new Error("LLM_PROVIDER=fake is not allowed when NODE_ENV=production");
    }
    return new FakeLlmProvider();
  }
  if (name === "openai") {
    return new OpenAiProvider(env.OPENAI_API_KEY?.trim() || undefined, env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL);
  }
  throw new Error(`LLM_PROVIDER must be "openai" or "fake", got "${name}"`);
}

@Module({
  providers: [{ provide: LLM_PROVIDER, useFactory: () => createLlmProvider() }],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
