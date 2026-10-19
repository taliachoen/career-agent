import type { Job } from "@prisma/client";

// The Prisma model is the single source of truth for the Job shape.
export type { Job };

// What a client may send. The owner (userId) always comes from the authenticated user.
export type CreateJobInput = Omit<Job, "id" | "userId">;
