"use client";

import type { JobWithPostings, Profile } from "@career-agent/types";
import { useCallback, useEffect, useState } from "react";
import { JobRow } from "../../../components/JobRow";
import { Notice } from "../../../components/Notice";
import { ScoringBar } from "../../../components/ScoringBar";
import { ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { he } from "../../../lib/strings.he";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; jobs: JobWithPostings[]; hasProfile: boolean };

function JobListSkeleton() {
  return (
    <ul
      role="status"
      aria-label={he.common.loading}
      className="animate-pulse divide-y divide-stone-200 rounded-md border border-stone-200 bg-white"
    >
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="space-y-2 px-4 py-4">
          <div className="h-4 w-1/2 rounded bg-stone-200" />
          <div className="h-3 w-1/3 rounded bg-stone-200" />
          <div className="h-6 w-2/3 rounded bg-stone-100" />
        </li>
      ))}
    </ul>
  );
}

export default function JobsPage() {
  const { authedGet } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  // `quiet` reloads the list without replacing it by the skeleton (used after scoring).
  const fetchJobs = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoad({ status: "loading" });
      try {
        const [jobs, profile] = await Promise.all([
          authedGet<JobWithPostings[]>("/jobs"),
          // The list matters more than the scoring bar: if only the profile request fails,
          // assume a profile exists. POST /jobs/score answers 400 if it does not.
          authedGet<Profile>("/profile").catch((error: unknown) => {
            if (error instanceof ApiError && error.status === 401) throw error;
            return null;
          }),
        ]);
        // No saved profile yet: `updatedAt` is null.
        setLoad({ status: "done", jobs, hasProfile: profile === null || profile.updatedAt !== null });
      } catch (error) {
        // A 401 is already handled by authedGet (redirect to the login screen).
        if (!(error instanceof ApiError && error.status === 401) && !quiet) {
          setLoad({ status: "error" });
        }
      }
    },
    [authedGet],
  );

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">{he.jobs.title}</h1>

      {load.status === "loading" && <JobListSkeleton />}

      {load.status === "error" && (
        <Notice tone="error">
          <p>{he.jobs.loadFailed}</p>
          <button
            type="button"
            onClick={() => void fetchJobs()}
            className="mt-1 min-h-11 font-medium underline"
          >
            {he.common.retry}
          </button>
        </Notice>
      )}

      {load.status === "done" && load.jobs.length === 0 && (
        <div className="rounded-md border border-dashed border-stone-300 bg-white px-4 py-10 text-center">
          <p className="font-medium">{he.jobs.emptyTitle}</p>
          <p className="mt-1 text-sm text-stone-600">{he.jobs.emptyBody}</p>
        </div>
      )}

      {load.status === "done" && load.jobs.length > 0 && (
        <div className="space-y-4">
          <ScoringBar
            hasProfile={load.hasProfile}
            pendingCount={load.jobs.filter((job) => !job.score || job.score.stale).length}
            onScored={() => fetchJobs(true)}
            onProfileMissing={() => setLoad({ ...load, hasProfile: false })}
          />
          <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
            {load.jobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
