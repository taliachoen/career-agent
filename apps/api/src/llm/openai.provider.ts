import OpenAI from "openai";
import {
  LlmError,
  LlmNotConfiguredError,
  type JsonCompletion,
  type JsonCompletionRequest,
  type LlmProvider,
} from "./llm-provider.js";

// Per request. With one retry (for 429 / 5xx / connection errors) a job takes at most ~60s.
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1;
// The budget includes the model's hidden reasoning tokens, so it is far above the answer size.
const MAX_COMPLETION_TOKENS = 4_000;

export class OpenAiProvider implements LlmProvider {
  readonly name = "openai";
  private client: OpenAI | undefined;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string,
  ) {}

  checkReady(): void {
    if (!this.apiKey) {
      throw new LlmNotConfiguredError("OPENAI_API_KEY is not set");
    }
  }

  async completeJson(request: JsonCompletionRequest): Promise<JsonCompletion> {
    this.checkReady();
    this.client ??= new OpenAI({ apiKey: this.apiKey, maxRetries: MAX_RETRIES });

    let completion;
    try {
      completion = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: request.schemaName, schema: request.schema, strict: true },
          },
          reasoning_effort: "low",
          max_completion_tokens: MAX_COMPLETION_TOKENS,
        },
        { timeout: REQUEST_TIMEOUT_MS },
      );
    } catch (error) {
      // Only the kind and the HTTP status: the SDK's message can quote the request.
      const status = error instanceof OpenAI.APIError ? error.status : undefined;
      const kind = error instanceof Error ? error.constructor.name : "UnknownError";
      throw new LlmError(`OpenAI request failed (${kind}${status ? `, HTTP ${status}` : ""})`);
    }

    const choice = completion.choices[0];
    if (!choice || choice.message.refusal) {
      throw new LlmError("OpenAI refused or returned no answer");
    }
    if (choice.finish_reason === "length") {
      throw new LlmError("OpenAI answer was cut off");
    }
    const text = choice.message.content;
    if (!text) {
      throw new LlmError("OpenAI returned an empty answer");
    }
    return {
      text,
      model: completion.model || this.model,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    };
  }
}
