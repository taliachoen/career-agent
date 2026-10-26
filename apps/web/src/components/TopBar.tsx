"use client";

import Link from "next/link";
import { useAuth } from "../lib/auth";
import { he } from "../lib/strings.he";

export function TopBar() {
  const { state, logout } = useAuth();
  const email = state.status === "authenticated" ? state.session.user.email : "";

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
        <Link href="/jobs" className="shrink-0 font-semibold text-accent-700">
          {he.appName}
        </Link>
        <nav className="flex shrink-0 items-center gap-1">
          <Link
            href="/jobs"
            className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            {he.nav.jobs}
          </Link>
          <Link
            href="/profile"
            className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            {he.nav.profile}
          </Link>
        </nav>
        <div className="flex min-w-0 items-center gap-3">
          <span dir="ltr" className="truncate text-sm text-stone-600" title={email}>
            {email}
          </span>
          <button
            type="button"
            onClick={logout}
            className="min-h-11 shrink-0 rounded-md border border-stone-300 px-3 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            {he.nav.logout}
          </button>
        </div>
      </div>
    </header>
  );
}
