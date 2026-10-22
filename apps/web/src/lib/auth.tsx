"use client";

import type { AuthResult, SafeUser } from "@career-agent/types";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, apiRequest } from "./api";
import {
  clearSession,
  readSession,
  sessionFromAuthResult,
  writeSession,
  type Session,
} from "./session";
import type { Credentials } from "./validation";

// "loading" exists because sessionStorage can only be read after mount; reading
// it during the first render would not match the server-rendered HTML.
type AuthState =
  | { status: "loading" }
  | { status: "anonymous"; expired?: boolean }
  | { status: "authenticated"; session: Session };

interface AuthContextValue {
  state: AuthState;
  login: (credentials: Credentials) => Promise<void>;
  /** Registers, then logs in. Throws `RegisteredButLoginFailed` if only the second step failed. */
  register: (credentials: Credentials) => Promise<void>;
  logout: () => void;
  /** Authenticated GET. A 401 clears the session and sends the user to the login screen. */
  authedGet: <T>(path: string) => Promise<T>;
}

export class RegisteredButLoginFailed extends Error {}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    const session = readSession();
    setState(session ? { status: "authenticated", session } : { status: "anonymous" });
  }, []);

  const startSession = useCallback((result: AuthResult) => {
    const session = sessionFromAuthResult(result);
    writeSession(session);
    setState({ status: "authenticated", session });
  }, []);

  const login = useCallback(
    async ({ email, password }: Credentials) => {
      const result = await apiRequest<AuthResult>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      startSession(result);
    },
    [startSession],
  );

  const register = useCallback(
    async (credentials: Credentials) => {
      await apiRequest<SafeUser>("/auth/register", { method: "POST", body: credentials });
      try {
        await login(credentials);
      } catch {
        throw new RegisteredButLoginFailed();
      }
    },
    [login],
  );

  const logout = useCallback(() => {
    clearSession();
    setState({ status: "anonymous" });
    router.replace("/login");
  }, [router]);

  const token = state.status === "authenticated" ? state.session.token : null;

  const authedGet = useCallback(
    async <T,>(path: string): Promise<T> => {
      try {
        return await apiRequest<T>(path, { token: token ?? undefined });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          // The (app) layout sees `expired` and redirects with the explanation.
          clearSession();
          setState({ status: "anonymous", expired: true });
        }
        throw error;
      }
    },
    [token],
  );

  const value = useMemo(
    () => ({ state, login, register, logout, authedGet }),
    [state, login, register, logout, authedGet],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
