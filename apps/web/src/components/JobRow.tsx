import type { JobWithPostings } from "@career-agent/types";
import { formatDate } from "../lib/format";
import { he } from "../lib/strings.he";

// Titles, companies and sites are usually English inside a Hebrew page, so each
// is wrapped in <bdi> to keep its direction from bleeding into its neighbours.
export function JobRow({ job }: { job: JobWithPostings }) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-stone-900">
            <bdi>{job.title}</bdi>
          </h2>
          <p className="text-stone-600">
            <bdi>{job.company}</bdi>
          </p>
        </div>
        <time
          dateTime={job.createdAt}
          className="shrink-0 text-sm tabular-nums text-stone-500"
          title={he.jobs.addedOn}
        >
          {formatDate(job.createdAt)}
        </time>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm text-stone-500">{he.jobs.publishedOn}</span>
        {job.postings.map((posting) => (
          <a
            key={posting.id}
            href={posting.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${posting.site} (${he.jobs.opensInNewTab})`}
            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 text-sm text-accent-700 hover:border-accent-700 hover:bg-accent-50"
          >
            <bdi>{posting.site}</bdi>
            <span aria-hidden="true" className="text-xs">
              ↖
            </span>
          </a>
        ))}
      </div>
    </li>
  );
}
