"use client";

import type { GmailConnectResult, GmailDisconnectResult, GmailStatus } from "@career-agent/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Notice } from "../../../components/Notice";
import { ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { he } from "../../../lib/strings.he";

type LoadState =
  { status: "loading" } | { status: "error" } | { status: "done"; gmail: GmailStatus };

type Message = { tone: "error" | "info"; text: string };

const RESULT_MESSAGES: Record<string, Message> = {
  connected: { tone: "info", text: he.gmail.result.connected },
  denied: { tone: "info", text: he.gmail.result.denied },
  scope_error: { tone: "error", text: he.gmail.result.scope_error },
  error: { tone: "error", text: he.gmail.result.error },
};

const buttonClass =
  "min-h-11 rounded-md bg-accent-700 px-4 py-2 font-medium text-white hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "min-h-11 rounded-md border border-stone-300 bg-white px-4 py-2 font-medium text-stone-800 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60";

export function GmailConnectionCard() {
  const { authedGet, authedPost, authedDelete } = useAuth();
  const router = useRouter();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, setPending] = useState<"connect" | "disconnect" | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoad({ status: "loading" });
    try {
      setLoad({ status: "done", gmail: await authedGet<GmailStatus>("/gmail/status") });
    } catch (error) {
      // A 401 is already handled by authedGet (redirect to the login screen).
      if (!(error instanceof ApiError && error.status === 401)) {
        setLoad({ status: "error" });
      }
    }
  }, [authedGet]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Google sends the user back here as /profile?gmail=<outcome>. Show it once and clean the URL.
  useEffect(() => {
    const outcome = new URLSearchParams(window.location.search).get("gmail");
    if (outcome === null) return;
    setMessage(RESULT_MESSAGES[outcome] ?? RESULT_MESSAGES.error);
    router.replace("/profile");
  }, [router]);

  async function connect() {
    if (pending) return;
    setMessage(null);
    setPending("connect");
    try {
      const { authUrl } = await authedPost<GmailConnectResult>("/gmail/connect");
      // Leaves the app for Google's consent screen; the button stays disabled meanwhile.
      window.location.assign(authUrl);
    } catch (error) {
      setPending(null);
      if (error instanceof ApiError && error.status === 401) return;
      setMessage({
        tone: "error",
        text:
          error instanceof ApiError && error.status === 503
            ? he.gmail.notAvailable
            : he.gmail.connectFailed,
      });
    }
  }

  async function disconnect() {
    if (pending) return;
    setMessage(null);
    setPending("disconnect");
    try {
      const { revoked } = await authedDelete<GmailDisconnectResult>("/gmail/connection");
      setLoad({ status: "done", gmail: { state: "not_connected", email: null } });
      setMessage(
        revoked
          ? { tone: "info", text: he.gmail.disconnected }
          : { tone: "error", text: he.gmail.disconnectedNotRevoked },
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // Already gone (another tab, or the connection ended): show the real state.
        await fetchStatus();
      } else if (!(error instanceof ApiError && error.status === 401)) {
        setMessage({ tone: "error", text: he.gmail.disconnectFailed });
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      aria-labelledby="gmail-title"
      className="mt-8 space-y-3 border-t border-stone-200 pt-6"
    >
      <h2 id="gmail-title" className="text-lg font-semibold">
        {he.gmail.title}
      </h2>
      <p className="text-sm text-stone-600">{he.gmail.intro}</p>

      {message && (
        <Notice tone={message.tone}>
          <p>{message.text}</p>
        </Notice>
      )}

      {load.status === "loading" && (
        <div
          role="status"
          aria-label={he.common.loading}
          className="h-11 animate-pulse rounded bg-stone-100"
        />
      )}

      {load.status === "error" && (
        <Notice tone="error">
          <p>{he.gmail.loadFailed}</p>
          <button
            type="button"
            onClick={() => void fetchStatus()}
            className="mt-1 min-h-11 font-medium underline"
          >
            {he.common.retry}
          </button>
        </Notice>
      )}

      {load.status === "done" && load.gmail.state === "not_connected" && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">{he.gmail.notConnected}</p>
          <button
            type="button"
            onClick={() => void connect()}
            disabled={pending !== null}
            className={buttonClass}
          >
            {pending === "connect" ? he.gmail.connecting : he.gmail.connect}
          </button>
        </div>
      )}

      {load.status === "done" && load.gmail.state === "connected" && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">
            {he.gmail.connected} <span dir="ltr">{load.gmail.email}</span>
          </p>
          <button
            type="button"
            onClick={() => void disconnect()}
            disabled={pending !== null}
            className={secondaryButtonClass}
          >
            {pending === "disconnect" ? he.gmail.disconnecting : he.gmail.disconnect}
          </button>
        </div>
      )}

      {load.status === "done" && load.gmail.state === "needs_reconnect" && (
        <div className="space-y-3">
          <Notice tone="error">
            <p className="font-medium">{he.gmail.needsReconnectTitle}</p>
            <p className="mt-1">{he.gmail.needsReconnectBody}</p>
          </Notice>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void connect()}
              disabled={pending !== null}
              className={buttonClass}
            >
              {pending === "connect" ? he.gmail.connecting : he.gmail.reconnect}
            </button>
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={pending !== null}
              className={secondaryButtonClass}
            >
              {pending === "disconnect" ? he.gmail.disconnecting : he.gmail.disconnect}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
