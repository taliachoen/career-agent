import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { GmailConnectResult, GmailDisconnectResult, GmailStatus } from "@career-agent/types";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  GMAIL_PROVIDER,
  GMAIL_READONLY_SCOPE,
  GmailNotConfiguredError,
  GmailProviderError,
  type GmailProvider,
} from "./gmail-provider.js";
import {
  STATE_TTL_MS,
  codeChallengeFor,
  deriveStateKey,
  newCodeVerifier,
  newNonce,
  signState,
  verifyState,
} from "./oauth-state.js";
import { decryptToken, encryptToken, parseEncryptionKey } from "./token-crypto.js";

// How the callback ended; becomes `?gmail=<outcome>` on the redirect back to the web app.
export type CallbackOutcome = "connected" | "denied" | "scope_error" | "error";

export interface CallbackQuery {
  state?: string;
  code?: string;
  error?: string;
}

// A connection is checked against Google at most this often when its status is read.
export const VERIFY_INTERVAL_MS = 60 * 60 * 1000;
// A check that fails for another reason (no network) is not retried for this long, and no
// check waits longer than the timeout.
export const VERIFY_RETRY_MS = 5 * 60 * 1000;
export const VERIFY_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new GmailProviderError("request_failed")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

@Injectable()
export class GmailService {
  // Only error names and codes are logged: never tokens, codes, state or e-mail addresses.
  private readonly logger = new Logger(GmailService.name);
  // userId -> when the last check failed for a reason other than a dead token. In memory of
  // this process only; it just spares Google (and the user's request) a retry on every read.
  private readonly failedVerifications = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(GMAIL_PROVIDER) private readonly provider: GmailProvider,
  ) {}

  async getStatus(userId: string): Promise<GmailStatus> {
    let connection = await this.prisma.gmailConnection.findUnique({
      where: { userId },
      select: { status: true, googleEmail: true, lastVerifiedAt: true },
    });
    if (
      connection?.status === "CONNECTED" &&
      isStale(connection.lastVerifiedAt) &&
      !this.recentlyFailed(userId)
    ) {
      await this.verifyConnection(userId);
      connection = await this.prisma.gmailConnection.findUnique({
        where: { userId },
        select: { status: true, googleEmail: true, lastVerifiedAt: true },
      });
    }
    if (!connection || connection.status === "PENDING") {
      return { state: "not_connected", email: null };
    }
    return {
      state: connection.status === "CONNECTED" ? "connected" : "needs_reconnect",
      email: connection.googleEmail,
    };
  }

  // Asks Google whether the refresh token still works. A dead one (Testing mode expires them
  // after 7 days) marks the connection NEEDS_RECONNECT and deletes the token. Any other
  // failure, such as no network, changes nothing: it says nothing about the token.
  async verifyConnection(userId: string): Promise<void> {
    const connection = await this.prisma.gmailConnection.findUnique({
      where: { userId },
      select: { status: true, encryptedRefreshToken: true },
    });
    if (connection?.status !== "CONNECTED" || !connection.encryptedRefreshToken) {
      return;
    }
    try {
      const refreshToken = decryptToken(
        connection.encryptedRefreshToken,
        userId,
        parseEncryptionKey(),
      );
      await withTimeout(this.provider.refreshAccessToken(refreshToken), VERIFY_TIMEOUT_MS);
      this.failedVerifications.delete(userId);
      await this.prisma.gmailConnection.updateMany({
        where: { userId, encryptedRefreshToken: connection.encryptedRefreshToken },
        data: { lastVerifiedAt: new Date() },
      });
    } catch (error) {
      if (error instanceof GmailProviderError && error.code === "invalid_grant") {
        this.logger.warn(
          "Gmail refresh token is no longer valid; marking the connection as needing reconnect",
        );
        // Only the token that was checked is cleared: a reconnect finished meanwhile stays.
        await this.prisma.gmailConnection.updateMany({
          where: {
            userId,
            status: "CONNECTED",
            encryptedRefreshToken: connection.encryptedRefreshToken,
          },
          data: {
            status: "NEEDS_RECONNECT",
            encryptedRefreshToken: null,
            scope: null,
            lastVerifiedAt: new Date(),
          },
        });
        return;
      }
      // Remember the failure so status reads do not each wait on an unreachable Google.
      this.failedVerifications.set(userId, Date.now());
      this.logger.warn(`Could not verify the Gmail connection (${errorName(error)})`);
    }
  }

  async startConnect(userId: string): Promise<GmailConnectResult> {
    let key: Buffer;
    try {
      this.provider.checkReady();
      key = parseEncryptionKey();
    } catch (error) {
      throw this.unavailable(error);
    }

    const nonce = newNonce();
    const codeVerifier = newCodeVerifier();
    const expiresAt = Date.now() + STATE_TTL_MS;
    const pending = {
      oauthNonce: nonce,
      oauthCodeVerifier: encryptToken(codeVerifier, userId, key),
      oauthExpiresAt: new Date(expiresAt),
    };
    // A new attempt replaces an older pending one. The connection itself is left as it is.
    await this.prisma.gmailConnection.upsert({
      where: { userId },
      create: { userId, ...pending },
      update: pending,
      select: { id: true },
    });

    const state = signState({ uid: userId, nonce, exp: expiresAt }, stateKey());
    return {
      authUrl: this.provider.buildAuthUrl({ state, codeChallenge: codeChallengeFor(codeVerifier) }),
    };
  }

  // The public callback. The user is known only from the signed state. Never throws: every
  // failure is an outcome the web app turns into a message.
  async handleCallback(query: CallbackQuery | null): Promise<CallbackOutcome> {
    if (!query?.state) {
      return "error";
    }
    const state = verifyState(query.state, stateKey(), Date.now());
    if (!state) {
      return "error";
    }
    const userId = state.uid;

    const pending = await this.prisma.gmailConnection.findUnique({
      where: { userId },
      select: { oauthNonce: true, oauthCodeVerifier: true, oauthExpiresAt: true },
    });
    if (
      !pending?.oauthNonce ||
      !pending.oauthCodeVerifier ||
      !pending.oauthExpiresAt ||
      pending.oauthNonce !== state.nonce ||
      pending.oauthExpiresAt.getTime() <= Date.now()
    ) {
      return "error";
    }
    // Single use: the first request to clear the nonce wins, a replay finds it gone.
    const claimed = await this.prisma.gmailConnection.updateMany({
      where: { userId, oauthNonce: state.nonce },
      data: { oauthNonce: null, oauthCodeVerifier: null, oauthExpiresAt: null },
    });
    if (claimed.count !== 1) {
      return "error";
    }

    if (query.error) {
      return query.error === "access_denied" ? "denied" : "error";
    }
    if (!query.code) {
      return "error";
    }

    try {
      const key = parseEncryptionKey();
      const codeVerifier = decryptToken(pending.oauthCodeVerifier, userId, key);
      const tokens = await this.provider.exchangeCode({ code: query.code, codeVerifier });

      if (!hasExactlyReadonlyScope(tokens.scopes)) {
        await this.revokeQuietly(tokens.refreshToken ?? tokens.accessToken);
        return "scope_error";
      }
      if (!tokens.refreshToken || !tokens.accessToken) {
        await this.revokeQuietly(tokens.refreshToken ?? tokens.accessToken);
        return "error";
      }

      let email: string;
      try {
        email = await this.provider.getEmail(tokens.accessToken);
      } catch (error) {
        await this.revokeQuietly(tokens.refreshToken);
        throw error;
      }

      const now = new Date();
      await this.prisma.gmailConnection.update({
        where: { userId },
        data: {
          status: "CONNECTED",
          googleEmail: email,
          encryptedRefreshToken: encryptToken(tokens.refreshToken, userId, key),
          scope: GMAIL_READONLY_SCOPE,
          connectedAt: now,
          lastVerifiedAt: now,
        },
        select: { id: true },
      });
      return "connected";
    } catch (error) {
      this.logger.warn(`Gmail connect failed (${errorName(error)})`);
      return "error";
    }
  }

  // Deletes the tokens here always; revoking at Google is best effort and reported.
  async disconnect(userId: string): Promise<GmailDisconnectResult> {
    const connection = await this.prisma.gmailConnection.findUnique({
      where: { userId },
      select: { status: true, encryptedRefreshToken: true },
    });
    // A pending attempt without a token is not a connection.
    if (!connection || connection.status === "PENDING") {
      await this.prisma.gmailConnection.deleteMany({ where: { userId } });
      throw new NotFoundException("Gmail is not connected");
    }

    // Nothing to revoke when the token is already gone (NEEDS_RECONNECT).
    let revoked = true;
    if (connection.encryptedRefreshToken) {
      try {
        const refreshToken = decryptToken(
          connection.encryptedRefreshToken,
          userId,
          parseEncryptionKey(),
        );
        await this.provider.revokeToken(refreshToken);
      } catch (error) {
        // Google saying the token is invalid means it was already revoked.
        revoked = error instanceof GmailProviderError && error.code === "invalid_grant";
        if (!revoked) {
          this.logger.warn(`Could not revoke the Gmail token at Google (${errorName(error)})`);
        }
      }
    }
    await this.prisma.gmailConnection.deleteMany({ where: { userId } });
    return { revoked };
  }

  private recentlyFailed(userId: string): boolean {
    const failedAt = this.failedVerifications.get(userId);
    return failedAt !== undefined && Date.now() - failedAt < VERIFY_RETRY_MS;
  }

  private async revokeQuietly(token: string | null): Promise<void> {
    if (!token) {
      return;
    }
    try {
      await this.provider.revokeToken(token);
    } catch (error) {
      this.logger.warn(`Could not revoke a rejected Gmail token (${errorName(error)})`);
    }
  }

  private unavailable(error: unknown): unknown {
    if (error instanceof GmailNotConfiguredError) {
      return new ServiceUnavailableException("Gmail connection is not configured on the server");
    }
    return error;
  }
}

// The granted scope must be exactly gmail.readonly: nothing more, nothing less.
export function hasExactlyReadonlyScope(scopes: string[]): boolean {
  const granted = new Set(scopes);
  return granted.size === 1 && granted.has(GMAIL_READONLY_SCOPE);
}

function isStale(lastVerifiedAt: Date | null): boolean {
  return !lastVerifiedAt || Date.now() - lastVerifiedAt.getTime() > VERIFY_INTERVAL_MS;
}

function stateKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // AuthModule refuses to start without it; never sign with a guessable default.
    throw new Error("JWT_SECRET is not set");
  }
  return deriveStateKey(secret);
}

function errorName(error: unknown): string {
  if (error instanceof GmailProviderError) {
    return error.message;
  }
  return error instanceof Error ? error.name : "unknown error";
}
