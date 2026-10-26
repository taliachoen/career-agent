import { he } from "../lib/strings.he";

/** Shown while the stored session is being read, so the page is never blank. */
export function PageSkeleton() {
  return (
    <div
      role="status"
      aria-label={he.common.loading}
      className="mx-auto max-w-4xl animate-pulse space-y-3 p-4"
    >
      <div className="h-6 w-1/3 rounded bg-stone-200" />
      <div className="h-4 w-2/3 rounded bg-stone-200" />
      <div className="h-4 w-1/2 rounded bg-stone-200" />
    </div>
  );
}
