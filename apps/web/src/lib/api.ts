// Read at build/dev-server start. No default on purpose: a missing value should
// fail loudly instead of silently talking to the wrong server.
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly messages: string[],
  ) {
    super(messages.join("; ") || `HTTP ${status}`);
  }
}

/** The server could not be reached, or answered in a way we cannot use. */
export class NetworkError extends Error {}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  token?: string;
}

function messagesFrom(payload: unknown): string[] {
  if (typeof payload !== "object" || payload === null) return [];
  const { message } = payload as { message?: unknown };
  if (typeof message === "string") return [message];
  if (Array.isArray(message)) return message.filter((m): m is string => typeof m === "string");
  return [];
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_URL) {
    throw new NetworkError("NEXT_PUBLIC_API_URL is not set (see apps/web/.env.example)");
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body !== undefined && { "Content-Type": "application/json" }),
        ...(options.token && { Authorization: `Bearer ${options.token}` }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new NetworkError("Network request failed");
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // empty or non-JSON body
  }

  if (!response.ok) {
    throw new ApiError(response.status, messagesFrom(payload));
  }
  if (payload === null) {
    throw new NetworkError("Unexpected empty response");
  }
  return payload as T;
}
