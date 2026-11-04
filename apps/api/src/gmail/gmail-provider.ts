// The only scope the app ever asks for. Gmail access is read-only (see docs/plan.md).
export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export const GMAIL_PROVIDER = Symbol("GMAIL_PROVIDER");

export interface ExchangedTokens {
  accessToken: string | null;
  refreshToken: string | null;
  // The scopes Google says were granted, which can differ from the ones requested.
  scopes: string[];
}

// Everything that talks to Google goes through this interface, so tests use a fake.
// Implementations must never put a token, code or secret in an error message.
export interface GmailProvider {
  readonly name: "google" | "fake";
  // Throws GmailNotConfiguredError when the client id/secret/redirect are missing.
  checkReady(): void;
  buildAuthUrl(input: { state: string; codeChallenge: string }): string;
  exchangeCode(input: { code: string; codeVerifier: string }): Promise<ExchangedTokens>;
  // Gmail address of the account the access token belongs to.
  getEmail(accessToken: string): Promise<string>;
  // Throws GmailProviderError("invalid_grant") when the refresh token is no longer valid.
  refreshAccessToken(refreshToken: string): Promise<string>;
  // Accepts a refresh or an access token. Throws GmailProviderError("invalid_grant") when
  // it was already revoked.
  revokeToken(token: string): Promise<void>;
}

export class GmailNotConfiguredError extends Error {
  constructor(message = "Gmail connection is not configured") {
    super(message);
    this.name = "GmailNotConfiguredError";
  }
}

export type GmailProviderErrorCode = "invalid_grant" | "request_failed";

export class GmailProviderError extends Error {
  constructor(readonly code: GmailProviderErrorCode) {
    super(`Gmail provider error: ${code}`);
    this.name = "GmailProviderError";
  }
}
