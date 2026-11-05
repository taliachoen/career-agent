"use client";

import type { GmailStatus, SyncResult } from "@career-agent/types";
import Link from "next/link";
import { useState } from "react";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { he } from "../lib/strings.he";
import { Notice } from "./Notice";

type RunState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: SyncResult }
  | { status: "error"; message: string };

interface SyncBarProps {
  gmail: GmailStatus;
  /** Called after a run, so the list (and the Gmail state) can reload. */
  onSynced: () => Promise<void>;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return he.sync.notConnected;
    if (error.status === 409) return he.sync.alreadyRunning;
    if (error.status === 502) return he.sync.googleFailed;
    if (error.status === 503) return he.sync.notConfigured;
  }
  return he.errors.generic;
}

// What the run did, one sentence per thing worth knowing. All numbers: no mail content.
function SyncSummary({ result }: { result: SyncResult }) {
  if (result.checked === 0) {
    return <p>{he.sync.nothingNew}</p>;
  }
  const scoring =
    result.scoring === "skipped_no_profile"
      ? he.sync.scoringSkippedNoProfile
      : result.scoring === "skipped_busy"
        ? he.sync.scoringSkippedBusy
        : result.scoring === "skipped_unavailable"
          ? he.sync.scoringSkippedUnavailable
          : result.scoring === "failed"
            ? he.sync.scoringFailed
            : null;
  return (
    <>
      <p>{he.sync.summary(result.checked, result.added, result.attached, result.scored)}</p>
      {result.duplicates > 0 && <p>{he.sync.duplicates(result.duplicates)}</p>}
      {result.rejected > 0 && <p>{he.sync.rejected(result.rejected)}</p>}
      {result.unauthenticated > 0 && <p>{he.sync.unauthenticated(result.unauthenticated)}</p>}
      {result.failedEmails > 0 && <p>{he.sync.failedEmails(result.failedEmails)}</p>}
      {result.scoreFailed > 0 && <p>{he.sync.scoreFailed(result.scoreFailed)}</p>}
      {result.scoringRemaining > 0 && result.scoring === "done" && (
        <p>{he.sync.scoringRemaining(result.scoringRemaining)}</p>
      )}
      {scoring && <p>{scoring}</p>}
      {result.moreAvailable && <p>{he.sync.moreAvailable}</p>}
    </>
  );
}

export function SyncBar({ gmail, onSynced }: SyncBarProps) {
  const { authedPost } = useAuth();
  const [run, setRun] = useState<RunState>({ status: "idle" });

  async function sync() {
    setRun({ status: "running" });
    try {
      const result = await authedPost<SyncResult>("/gmail/sync");
      setRun({ status: "done", result });
      await onSynced();
    } catch (error) {
      // A 401 is already handled by authedPost (redirect to the login screen).
      if (error instanceof ApiError && error.status === 401) return;
      setRun({ status: "error", message: errorMessage(error) });
      // A 400 means the connection changed: reload so the bar shows the real state.
      if (error instanceof ApiError && error.status === 400) await onSynced();
    }
  }

  const running = run.status === "running";
  const result = run.status === "done" ? run.result : null;
  const allFailed = result !== null && result.checked > 0 && result.failedEmails === result.checked;

  return (
    <div className="space-y-2">
      {gmail.state === "connected" ? (
        <button
          type="button"
          onClick={() => void sync()}
          disabled={running}
          className="min-h-11 w-full rounded-md bg-accent-700 px-4 py-2 font-medium text-white hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {running ? he.sync.running : he.sync.button}
        </button>
      ) : (
        <Notice tone="info">
          <p>
            {gmail.state === "needs_reconnect"
              ? he.sync.needsReconnection
              : he.sync.needsConnection}
          </p>
          <Link
            href="/profile"
            className="mt-1 inline-flex min-h-11 items-center font-medium underline"
          >
            {he.sync.toProfile}
          </Link>
        </Notice>
      )}
      {result && (
        <Notice tone={allFailed ? "error" : "info"}>
          <SyncSummary result={result} />
          {allFailed && <p>{he.sync.allFailed}</p>}
        </Notice>
      )}
      {run.status === "error" && <Notice tone="error">{run.message}</Notice>}
    </div>
  );
}
