import { he } from "./strings.he";

// Mirrors the rules in apps/api/src/auth/auth.controller.ts so most mistakes are
// caught before a request is sent. The server stays the source of truth.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

// Mirrors apps/api/src/profile/profile.ts. Lengths are counted after trim(), as on the server.
export const CV_MIN_LENGTH = 200;
export const CV_MAX_LENGTH = 20_000;
export const LOOKING_FOR_MAX_LENGTH = 2_000;

export interface ProfileFieldErrors {
  cvText?: string;
  lookingFor?: string;
}

export function parseProfile(
  cvText: string,
  lookingFor: string,
):
  | { ok: true; value: { cvText: string; lookingFor: string } }
  | { ok: false; errors: ProfileFieldErrors } {
  const cv = cvText.trim();
  const looking = lookingFor.trim();
  const errors: ProfileFieldErrors = {};

  if (cv === "") {
    errors.cvText = he.errors.cvRequired;
  } else if (cv.length < CV_MIN_LENGTH) {
    errors.cvText = he.errors.cvTooShort;
  } else if (cv.length > CV_MAX_LENGTH) {
    errors.cvText = he.errors.cvTooLong;
  }
  if (looking.length > LOOKING_FOR_MAX_LENGTH) {
    errors.lookingFor = he.errors.lookingForTooLong;
  }

  if (errors.cvText || errors.lookingFor) return { ok: false, errors };
  return { ok: true, value: { cvText: cv, lookingFor: looking } };
}

export interface FieldErrors {
  email?: string;
  password?: string;
}

export interface Credentials {
  email: string;
  password: string;
}

type ParseResult = { ok: true; value: Credentials } | { ok: false; errors: FieldErrors };

function parseCredentials(
  email: string,
  password: string,
  { strictPassword }: { strictPassword: boolean },
): ParseResult {
  const errors: FieldErrors = {};

  if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = he.errors.emailInvalid;
  }
  if (password === "") {
    errors.password = he.errors.passwordRequired;
  } else if (strictPassword) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = he.errors.passwordTooShort;
    } else if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
      errors.password = he.errors.passwordTooLong;
    }
  }

  if (errors.email || errors.password) return { ok: false, errors };
  return { ok: true, value: { email: email.trim().toLowerCase(), password } };
}

export function parseLogin(email: string, password: string): ParseResult {
  return parseCredentials(email, password, { strictPassword: false });
}

export function parseRegister(email: string, password: string): ParseResult {
  return parseCredentials(email, password, { strictPassword: true });
}
