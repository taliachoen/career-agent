"use client";

import { he } from "../lib/strings.he";

// Replaces the root layout when it itself fails, so it has to bring its own <html>.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "4rem 1rem" }}>
        <h1>{he.crash.title}</h1>
        <p>{he.crash.body}</p>
        <button type="button" onClick={reset} style={{ minHeight: 44, padding: "0 1rem" }}>
          {he.common.retry}
        </button>
      </body>
    </html>
  );
}
