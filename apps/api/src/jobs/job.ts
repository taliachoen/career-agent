import type { Job, JobPosting, Prisma } from "@prisma/client";

// The Prisma models are the single source of truth for the Job and JobPosting shapes.
export type { Job, JobPosting };

// A job together with every place it was posted.
export type JobWithPostings = Prisma.JobGetPayload<{ include: { postings: true } }>;

// The same, as read from the database together with its stored score.
export type JobWithPostingsAndScore = Prisma.JobGetPayload<{
  include: { postings: true; score: true };
}>;

// What the API returns about a score: no ids, and `stale` computed from the profile.
export interface JobScoreView {
  score: number;
  summary: string;
  matches: string[];
  gaps: string[];
  model: string;
  scoredAt: Date;
  /** The profile was saved after this score was made. */
  stale: boolean;
}

// What the jobs endpoints return.
export type JobView = JobWithPostings & { score: JobScoreView | null };

// What a client may send. The owner (userId) always comes from the authenticated user;
// the posting's source and site are set by the server.
export interface CreateJobInput {
  title: string;
  company: string;
  description: string;
  url: string;
}

// The result of one POST /jobs/score call.
export interface ScoreRunResult {
  scored: number;
  /** Jobs that could not be scored in this call (they stay pending). */
  failed: number;
  /** Jobs that still need a score, failed ones included. */
  remaining: number;
}
