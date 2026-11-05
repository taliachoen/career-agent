import { createHash } from "node:crypto";
import {
  GMAIL_READONLY_SCOPE,
  GmailProviderError,
  type ExchangedTokens,
  type GmailMessage,
  type GmailProvider,
} from "./gmail-provider.js";
import { sampleMailbox, type FakeMessage } from "./fake-mailbox.js";
import { parseFromHeader, senderAllowed } from "../ingest/senders.js";

// Deterministic stand-in for tests and local development. It never leaves the process.
// The authorization code steers what the "Google" side answers:
//   fake-ok            granted gmail.readonly, with a refresh token (what the auth URL points to)
//   fake-wrong-scope   granted more than gmail.readonly
//   fake-no-refresh    no refresh token in the answer
// A refresh token containing "revoked" is dead (invalid_grant), like one Google expired.
// A token containing "revoke-fails" makes revoking fail, like a network error.
export class FakeGmailProvider implements GmailProvider {
  readonly name = "fake";

  // Tokens passed to revokeToken, so tests can check that a disconnect really revoked.
  static readonly revokedTokens: string[] = [];
  // PKCE challenges handed out by buildAuthUrl; exchangeCode only accepts a matching verifier.
  private readonly challenges = new Set<string>();
  private counter = 0;

  constructor(private readonly redirectUri: string) {}

  checkReady(): void {}

  buildAuthUrl({ state, codeChallenge }: { state: string; codeChallenge: string }): string {
    this.challenges.add(codeChallenge);
    const url = new URL(this.redirectUri);
    url.searchParams.set("code", "fake-ok");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async exchangeCode({
    code,
    codeVerifier,
  }: {
    code: string;
    codeVerifier: string;
  }): Promise<ExchangedTokens> {
    const challenge = createHash("sha256").update(codeVerifier).digest("base64url");
    if (!this.challenges.has(challenge)) {
      throw new GmailProviderError("invalid_grant");
    }
    this.counter += 1;
    const accessToken = `fake-access-${this.counter}`;
    if (code === "fake-ok") {
      return {
        accessToken,
        refreshToken: `fake-refresh-${this.counter}`,
        scopes: [GMAIL_READONLY_SCOPE],
      };
    }
    if (code === "fake-wrong-scope") {
      return {
        accessToken,
        refreshToken: `fake-refresh-${this.counter}`,
        scopes: [GMAIL_READONLY_SCOPE, "https://www.googleapis.com/auth/gmail.modify"],
      };
    }
    if (code === "fake-no-refresh") {
      return { accessToken, refreshToken: null, scopes: [GMAIL_READONLY_SCOPE] };
    }
    throw new GmailProviderError("invalid_grant");
  }

  async getEmail(): Promise<string> {
    return "fake.user@example.com";
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    if (
      refreshToken.includes("revoked") ||
      FakeGmailProvider.revokedTokens.includes(refreshToken)
    ) {
      throw new GmailProviderError("invalid_grant");
    }
    return "fake-access-refreshed";
  }

  // The mailbox every fake connection reads. Tests replace it; the default is the invented
  // sample mail, so a local run with GMAIL_PROVIDER=fake has something to sync.
  static mailbox: FakeMessage[] = sampleMailbox();
  // What the sync asked for, for tests: the last search, and every message that was fetched.
  static lastQuery: string | null = null;
  static fetchedIds: string[] = [];
  // When set, fetching a message waits for it. Lets a test hold a sync in the middle.
  static holdFetch: Promise<void> | null = null;

  static resetMailbox(): void {
    FakeGmailProvider.mailbox = sampleMailbox();
    FakeGmailProvider.lastQuery = null;
    FakeGmailProvider.fetchedIds = [];
    FakeGmailProvider.holdFetch = null;
  }

  // Understands only what the sync's own query uses: is:unread, newer_than:Nd and from:x terms.
  async listMessageIds(input: {
    accessToken: string;
    query: string;
    maxResults: number;
    pageToken?: string;
  }): Promise<{ ids: string[]; nextPageToken: string | null }> {
    FakeGmailProvider.lastQuery = input.query;
    const unreadOnly = /\bis:unread\b/.test(input.query);
    const days = Number(/\bnewer_than:(\d+)d\b/.exec(input.query)?.[1] ?? Infinity);
    const senders = [...input.query.matchAll(/\bfrom:([^\s()]+)/g)].map((match) => match[1]!);
    const matching = FakeGmailProvider.mailbox.filter((message) => {
      if (unreadOnly && message.unread === false) return false;
      if ((message.ageDays ?? 1) > days) return false;
      const from = parseFromHeader(message.from);
      return senders.length === 0 || (from !== null && senderAllowed(from, senders));
    });
    const offset = Number(input.pageToken ?? 0);
    const page = matching.slice(offset, offset + input.maxResults);
    const next = offset + input.maxResults;
    return {
      ids: page.map((message) => message.id),
      nextPageToken: next < matching.length ? String(next) : null,
    };
  }

  async getMessage(_accessToken: string, id: string): Promise<GmailMessage> {
    FakeGmailProvider.fetchedIds.push(id);
    if (FakeGmailProvider.holdFetch) await FakeGmailProvider.holdFetch;
    const message = FakeGmailProvider.mailbox.find((candidate) => candidate.id === id);
    if (!message || message.failFetch) {
      throw new GmailProviderError("request_failed");
    }
    return {
      id: message.id,
      from: message.from,
      subject: message.subject,
      authResults: message.authResults,
      text: message.text ?? null,
      html: message.html ?? null,
    };
  }

  async revokeToken(token: string): Promise<void> {
    if (token.includes("revoke-fails")) {
      throw new GmailProviderError("request_failed");
    }
    if (token.includes("revoked") || FakeGmailProvider.revokedTokens.includes(token)) {
      throw new GmailProviderError("invalid_grant");
    }
    FakeGmailProvider.revokedTokens.push(token);
  }
}
