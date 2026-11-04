import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { GmailNotConfiguredError } from "./gmail-provider.js";

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

// TOKEN_ENCRYPTION_KEY is 32 random bytes, base64. Checked when used, not at startup, so the
// server still starts without Gmail configured.
export function parseEncryptionKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new GmailNotConfiguredError("TOKEN_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new GmailNotConfiguredError(
      `TOKEN_ENCRYPTION_KEY must be ${KEY_BYTES} bytes, base64-encoded`,
    );
  }
  return key;
}

// AES-256-GCM. The user id is authenticated as additional data, so a ciphertext copied to
// another user's row does not decrypt. Format: v1:<iv>:<tag>:<ciphertext>, all base64url.
export function encryptToken(plaintext: string, userId: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(userId, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ciphertext]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(":");
}

// Throws a content-free Error when the value is malformed, tampered with, or belongs to
// another user or key.
export function decryptToken(encrypted: string, userId: string, key: Buffer): string {
  const parts = encrypted.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Invalid encrypted token");
  }
  try {
    const iv = Buffer.from(parts[1]!, "base64url");
    const tag = Buffer.from(parts[2]!, "base64url");
    const ciphertext = Buffer.from(parts[3]!, "base64url");
    // Without authTagLength Node accepts truncated tags, which weakens authentication.
    if (tag.length !== TAG_BYTES) {
      throw new Error("Invalid encrypted token");
    }
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(userId, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Invalid encrypted token");
  }
}
