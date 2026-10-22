import type { Job, JobPosting, Prisma } from "@prisma/client";

// The Prisma models are the single source of truth for the Job and JobPosting shapes.
export type { Job, JobPosting };

// A job together with every place it was posted.
export type JobWithPostings = Prisma.JobGetPayload<{ include: { postings: true } }>;

// What a client may send. The owner (userId) always comes from the authenticated user;
// the posting's source and site are set by the server.
export interface CreateJobInput {
  title: string;
  company: string;
  description: string;
  url: string;
}
