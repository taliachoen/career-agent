// The only way feature code talks to an AI model. Nothing outside src/llm imports an AI SDK.

export interface JsonCompletionRequest {
  /** Instructions from us. Never contains untrusted text. */
  system: string;
  /** The task data, including untrusted text (clearly marked as data by the caller). */
  user: string;
  /** Name of the JSON schema (a-z, A-Z, 0-9, "_" and "-" only). */
  schemaName: string;
  schema: Record<string, unknown>;
}

export interface JsonCompletion {
  /** The model's answer as text. Untrusted: the caller must parse and validate it. */
  text: string;
  /** The model that actually answered. */
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmProvider {
  readonly name: "openai" | "fake";
  /** Throws LlmNotConfiguredError when the provider cannot be used (e.g. a missing API key). */
  checkReady(): void;
  completeJson(request: JsonCompletionRequest): Promise<JsonCompletion>;
}

/** Nest injection token for the configured LlmProvider. */
export const LLM_PROVIDER = Symbol("LLM_PROVIDER");

export class LlmNotConfiguredError extends Error {}

/**
 * A request to the model failed (timeout, API error, refusal, cut-off answer).
 * The message never contains the prompt, the answer or the SDK's own error text,
 * because those can quote the CV or the job description.
 */
export class LlmError extends Error {}
