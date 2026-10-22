"use client";

import { he } from "../lib/strings.he";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-xl font-semibold">{he.crash.title}</h1>
      <p className="mt-2 text-stone-600">{he.crash.body}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 min-h-11 rounded-md bg-accent-700 px-4 font-medium text-white hover:bg-accent-800"
      >
        {he.common.retry}
      </button>
    </main>
  );
}
