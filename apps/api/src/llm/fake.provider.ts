import {
  LlmError,
  type JsonCompletion,
  type JsonCompletionRequest,
  type LlmProvider,
} from "./llm-provider.js";

// Deterministic stand-in for tests and local development. It never leaves the process.
// Markers in the prompt steer it, so tests can ask for a specific result:
//   [[fake:score=NN]]  answer with this score (default: derived from a hash of the prompt)
//   [[fake:fail]]      throw, like a timeout or an API error
//   [[fake:badjson]]   answer with text that is not JSON
export class FakeLlmProvider implements LlmProvider {
  readonly name = "fake";

  checkReady(): void {}

  async completeJson(request: JsonCompletionRequest): Promise<JsonCompletion> {
    const { user } = request;
    const inputTokens = Math.ceil((request.system.length + user.length) / 4);

    if (user.includes("[[fake:fail]]")) {
      throw new LlmError("Fake provider: simulated failure");
    }
    if (user.includes("[[fake:badjson]]")) {
      return { text: "this is not json", model: "fake-model", inputTokens, outputTokens: 4 };
    }

    const marker = /\[\[fake:score=(-?\d+)\]\]/.exec(user);
    const score = marker ? Number(marker[1]) : hashScore(user);
    const text = JSON.stringify({
      score,
      summary: "סיכום לדוגמה מהספק המדומה.",
      matches: ["התאמה לדוגמה"],
      gaps: ["פער לדוגמה"],
    });
    return { text, model: "fake-model", inputTokens, outputTokens: Math.ceil(text.length / 4) };
  }
}

function hashScore(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) % 101;
  }
  return hash;
}
