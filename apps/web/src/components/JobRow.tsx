"use client";

import type { JobScore, JobWithPostings } from "@career-agent/types";
import { useId, useState } from "react";
import { formatDate } from "../lib/format";
import { he } from "../lib/strings.he";
import { ScoreBadge } from "./ScoreBadge";

function PointList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-stone-700">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-stone-500">{he.scoring.none}</p>
      ) : (
        <ul className="list-disc space-y-0.5 ps-5 text-sm text-stone-800">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The score row is one button: the badge and the summary open the matches and gaps.
function ScoreSection({ score }: { score: JobScore }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-start gap-2 rounded-md text-start hover:bg-stone-50"
      >
        <ScoreBadge score={score.score} />
        <span className="min-w-0 flex-1 text-sm text-stone-800">{score.summary}</span>
        <span aria-hidden="true" className="shrink-0 text-xs text-stone-500">
          {open ? "▲" : "▼"}
        </span>
        <span className="sr-only">{he.scoring.details}</span>
      </button>
      {score.stale && <p className="mt-1 text-xs text-amber-800">{he.scoring.stale}</p>}
      {open && (
        <div id={detailsId} className="mt-2 space-y-3 rounded-md bg-stone-50 px-3 py-2">
          <PointList title={he.scoring.matches} items={score.matches} />
          <PointList title={he.scoring.gaps} items={score.gaps} />
        </div>
      )}
    </div>
  );
}

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
      {job.score && <ScoreSection score={job.score} />}
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
