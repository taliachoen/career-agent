"use client";

import type { ScoreRunResult } from "@career-agent/types";
import Link from "next/link";
import { useState } from "react";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { he } from "../lib/strings.he";
import { Notice } from "./Notice";

type RunState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: ScoreRunResult }
  | { status: "error"; message: string };

interface ScoringBarProps {
  hasProfile: boolean;
  /** Jobs without a score or with a stale one. */
  pendingCount: number;
  /** Called after a run, so the list can reload with the new scores. */
  onScored: () => Promise<void>;
  /** Called when the server says there is no profile (it was not known to the page). */
  onProfileMissing: () => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 503) return he.scoring.notConfigured;
    if (error.status === 409) return he.scoring.alreadyRunning;
  }
  return he.errors.generic;
}

export function ScoringBar({
  hasProfile,
  pendingCount,
  onScored,
  onProfileMissing,
}: ScoringBarProps) {
  const { authedPost } = useAuth();
  const [run, setRun] = useState<RunState>({ status: "idle" });

  async function score() {
    setRun({ status: "running" });
    try {
      const result = await authedPost<ScoreRunResult>("/jobs/score");
      setRun({ status: "done", result });
      await onScored();
    } catch (error) {
      // A 401 is already handled by authedPost (redirect to the login screen).
      if (error instanceof ApiError && error.status === 401) return;
      if (error instanceof ApiError && error.status === 400) {
        onProfileMissing();
        setRun({ status: "idle" });
        return;
      }
      setRun({ status: "error", message: errorMessage(error) });
    }
  }

  if (!hasProfile) {
    return (
      <Notice tone="info">
        <p>{he.scoring.needProfile}</p>
        <Link
          href="/profile"
          className="mt-1 inline-flex min-h-11 items-center font-medium underline"
        >
          {he.scoring.toProfile}
        </Link>
      </Notice>
    );
  }

  const running = run.status === "running";
  const result = run.status === "done" ? run.result : null;
  const allFailed = result !== null && result.scored === 0 && result.failed > 0;

  return (
    <div className="space-y-2">
      {pendingCount > 0 && (
        <button
          type="button"
          onClick={() => void score()}
          disabled={running}
          className="min-h-11 w-full rounded-md bg-accent-700 px-4 py-2 font-medium text-white hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {running ? he.scoring.running : he.scoring.button}
        </button>
      )}
      {result && (
        <Notice tone={allFailed ? "error" : "info"}>
          <p>{he.scoring.result(result.scored, result.failed, result.remaining)}</p>
          {allFailed && <p>{he.scoring.allFailed}</p>}
          {result.remaining > 0 && !allFailed && <p>{he.scoring.pressAgain}</p>}
        </Notice>
      )}
      {run.status === "error" && <Notice tone="error">{run.message}</Notice>}
    </div>
  );
}
