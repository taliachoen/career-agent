import type { JobScore } from "@prisma/client";
import type { JobScoreView } from "../job.js";

// A score is stale when the profile was saved after the scoring run read it.
// (ScoringService stamps `scoredAt` with the time just before it reads the profile,
// so a profile saved while a run is in progress also makes that run's scores stale.)
export function isStale(scoredAt: Date, profileUpdatedAt: Date | null): boolean {
  return profileUpdatedAt !== null && profileUpdatedAt.getTime() > scoredAt.getTime();
}

export function toScoreView(
  row: JobScore | null,
  profileUpdatedAt: Date | null,
): JobScoreView | null {
  if (!row) return null;
  return {
    score: row.score,
    summary: row.summary,
    matches: row.matches,
    gaps: row.gaps,
    model: row.model,
    scoredAt: row.scoredAt,
    stale: isStale(row.scoredAt, profileUpdatedAt),
  };
}

interface Sortable {
  id: string;
  createdAt: Date;
  score: { score: number } | null;
}

// Score high to low, unscored jobs last; within a group, newest first.
export function compareJobs(a: Sortable, b: Sortable): number {
  if (a.score && !b.score) return -1;
  if (!a.score && b.score) return 1;
  if (a.score && b.score && a.score.score !== b.score.score) {
    return b.score.score - a.score.score;
  }
  const byDate = b.createdAt.getTime() - a.createdAt.getTime();
  if (byDate !== 0) return byDate;
  // Same tie-break as the database query: jobs created in the same millisecond keep a stable order.
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}
