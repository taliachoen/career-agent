import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const STATE_TTL_MS = 10 * 60 * 1000;

export interface OAuthStatePayload {
  // The user who started the flow. This is how the public callback knows who it is for.
  uid: string;
  // Single use: also stored on the user's GmailConnection row and cleared by the callback.
  nonce: string;
  // Expiry, ms since epoch.
  exp: number;
}

// The state is signed with a key derived from JWT_SECRET for this purpose only. Signing it
// as a JWT would make it a valid access token (the guard only checks `sub`).
export function deriveStateKey(jwtSecret: string): Buffer {
  return createHmac("sha256", jwtSecret).update("gmail-oauth-state").digest();
}

export function signState(payload: OAuthStatePayload, key: Buffer): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body, key)}`;
}

// Returns null for anything that is not a valid, unexpired state. Never throws.
export function verifyState(state: string, key: Buffer, now: number): OAuthStatePayload | null {
  const parts = state.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [body, signature] = parts as [string, string];
  const expected = Buffer.from(sign(body, key));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload !== "object" || payload === null) {
      return null;
    }
    const { uid, nonce, exp } = payload as Record<string, unknown>;
    if (typeof uid !== "string" || typeof nonce !== "string" || typeof exp !== "number") {
      return null;
    }
    if (exp <= now) {
      return null;
    }
    return { uid, nonce, exp };
  } catch {
    return null;
  }
}

function sign(body: string, key: Buffer): string {
  return createHmac("sha256", key).update(body).digest("base64url");
}

export function newNonce(): string {
  return randomBytes(16).toString("base64url");
}

// PKCE (RFC 7636), method S256.
export function newCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function codeChallengeFor(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}
