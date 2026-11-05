import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import {
  GMAIL_READONLY_SCOPE,
  GmailNotConfiguredError,
  GmailProviderError,
  type ExchangedTokens,
  type GmailMessage,
  type GmailProvider,
} from "./gmail-provider.js";
import { parseGmailMessage } from "./gmail-message.js";

const PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
const MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
// A Gmail call that takes longer is given up, so one slow message cannot hold a sync.
const REQUEST_TIMEOUT_MS = 15_000;

export interface GoogleConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

// The real Google client. Errors from google-auth-library carry the request (client secret,
// authorization code, tokens) in their config, so every failure is reduced to a
// GmailProviderError with a fixed code, and the original error is never rethrown or logged.
export class GoogleGmailProvider implements GmailProvider {
  readonly name = "google";

  constructor(private readonly config: GoogleConfig) {}

  checkReady(): void {
    this.client();
  }

  buildAuthUrl({ state, codeChallenge }: { state: string; codeChallenge: string }): string {
    return this.client().generateAuthUrl({
      access_type: "offline",
      // Forces a refresh token even when the user connected before.
      prompt: "consent",
      scope: [GMAIL_READONLY_SCOPE],
      include_granted_scopes: false,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
    });
  }

  async exchangeCode({
    code,
    codeVerifier,
  }: {
    code: string;
    codeVerifier: string;
  }): Promise<ExchangedTokens> {
    try {
      const { tokens } = await this.client().getToken({ code, codeVerifier });
      return {
        accessToken: tokens.access_token ?? null,
        refreshToken: tokens.refresh_token ?? null,
        scopes: (tokens.scope ?? "").split(/\s+/).filter((scope) => scope !== ""),
      };
    } catch (error) {
      throw toProviderError(error);
    }
  }

  async getEmail(accessToken: string): Promise<string> {
    try {
      const client = this.client();
      client.setCredentials({ access_token: accessToken });
      const response = await client.request<{ emailAddress?: unknown }>({ url: PROFILE_URL });
      const email = response.data.emailAddress;
      if (typeof email !== "string" || email === "") {
        throw new GmailProviderError("request_failed");
      }
      return email;
    } catch (error) {
      throw toProviderError(error);
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      const client = this.client();
      client.setCredentials({ refresh_token: refreshToken });
      const { token } = await client.getAccessToken();
      if (!token) {
        throw new GmailProviderError("request_failed");
      }
      return token;
    } catch (error) {
      throw toProviderError(error);
    }
  }

  async listMessageIds(input: {
    accessToken: string;
    query: string;
    maxResults: number;
    pageToken?: string;
  }): Promise<{ ids: string[]; nextPageToken: string | null }> {
    try {
      const client = this.client();
      client.setCredentials({ access_token: input.accessToken });
      const url = new URL(MESSAGES_URL);
      url.searchParams.set("q", input.query);
      url.searchParams.set("maxResults", String(input.maxResults));
      if (input.pageToken) url.searchParams.set("pageToken", input.pageToken);
      const response = await client.request<{
        messages?: { id?: unknown }[];
        nextPageToken?: unknown;
      }>({ url: url.toString(), timeout: REQUEST_TIMEOUT_MS });
      const ids = (response.data.messages ?? [])
        .map((message) => message.id)
        .filter((id): id is string => typeof id === "string");
      const next = response.data.nextPageToken;
      return { ids, nextPageToken: typeof next === "string" && next !== "" ? next : null };
    } catch (error) {
      throw toProviderError(error);
    }
  }

  async getMessage(accessToken: string, id: string): Promise<GmailMessage> {
    try {
      const client = this.client();
      client.setCredentials({ access_token: accessToken });
      const response = await client.request<unknown>({
        url: `${MESSAGES_URL}/${encodeURIComponent(id)}?format=full`,
        timeout: REQUEST_TIMEOUT_MS,
      });
      return parseGmailMessage(id, response.data);
    } catch (error) {
      throw toProviderError(error);
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      await this.client().revokeToken(token);
    } catch (error) {
      throw toProviderError(error);
    }
  }

  private client(): OAuth2Client {
    const { clientId, clientSecret, redirectUri } = this.config;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new GmailNotConfiguredError(
        "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET or GOOGLE_REDIRECT_URI is not set",
      );
    }
    return new OAuth2Client({ clientId, clientSecret, redirectUri });
  }
}

function toProviderError(error: unknown): GmailProviderError {
  if (error instanceof GmailProviderError) {
    return error;
  }
  // Google answers a dead refresh token or a reused authorization code with 400 invalid_grant.
  // Revoking an already revoked token answers 400 invalid_token. Only the error code is read.
  const data = (error as { response?: { data?: { error?: unknown } } } | null)?.response?.data;
  if (data?.error === "invalid_grant" || data?.error === "invalid_token") {
    return new GmailProviderError("invalid_grant");
  }
  return new GmailProviderError("request_failed");
}
