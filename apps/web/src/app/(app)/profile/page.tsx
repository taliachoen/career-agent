"use client";

import type { Profile } from "@career-agent/types";
import { useCallback, useEffect, useState } from "react";
import { Notice } from "../../../components/Notice";
import { ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { he } from "../../../lib/strings.he";
import { ProfileForm } from "./ProfileForm";

type LoadState = { status: "loading" } | { status: "error" } | { status: "done"; profile: Profile };

export default function ProfilePage() {
  const { authedGet } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  const fetchProfile = useCallback(async () => {
    setLoad({ status: "loading" });
    try {
      const profile = await authedGet<Profile>("/profile");
      setLoad({ status: "done", profile });
    } catch (error) {
      // A 401 is already handled by authedGet (redirect to the login screen).
      if (!(error instanceof ApiError && error.status === 401)) {
        setLoad({ status: "error" });
      }
    }
  }, [authedGet]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">{he.profile.title}</h1>

      {load.status === "loading" && (
        <div
          role="status"
          aria-label={he.common.loading}
          className="animate-pulse space-y-3 rounded-md border border-stone-200 bg-white p-4"
        >
          <div className="h-4 w-1/3 rounded bg-stone-200" />
          <div className="h-48 rounded bg-stone-100" />
        </div>
      )}

      {load.status === "error" && (
        <Notice tone="error">
          <p>{he.profile.loadFailed}</p>
          <button
            type="button"
            onClick={() => void fetchProfile()}
            className="mt-1 min-h-11 font-medium underline"
          >
            {he.common.retry}
          </button>
        </Notice>
      )}

      {load.status === "done" && <ProfileForm initial={load.profile} />}
    </>
  );
}
