import type { AuthResult, SafeUser } from "@career-agent/types";

// MVP compromise (see "Known gaps" in docs/plan.md): the token lives in
// sessionStorage. Storage can throw (blocked, private mode), so every access is
// wrapped and the app keeps working in memory only.
const STORAGE_KEY = "career-agent.session";

export interface Session {
  token: string;
  user: SafeUser;
}

export function sessionFromAuthResult(result: AuthResult): Session {
  return { token: result.accessToken, user: result.user };
}

export function readSession(): Session | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Session).token === "string" &&
      typeof (parsed as Session).user?.email === "string"
    ) {
      return parsed as Session;
    }
  } catch {
    // fall through: unreadable storage or corrupt value
  }
  return null;
}

export function writeSession(session: Session): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // in-memory session only
  }
}

export function clearSession(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}
