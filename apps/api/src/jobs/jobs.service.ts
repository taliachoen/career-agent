import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CreateJobInput, JobView, JobWithPostingsAndScore } from "./job.js";
import { compareJobs, toScoreView } from "./scoring/job-score.js";
import { siteFromUrl } from "./site.js";

const WITH_POSTINGS_AND_SCORE = {
  postings: { orderBy: { createdAt: "asc" } },
  score: true,
} as const;

// Prisma's error code for a violated unique constraint.
const UNIQUE_VIOLATION = "P2002";

function toView(row: JobWithPostingsAndScore, profileUpdatedAt: Date | null): JobView {
  const { score, ...job } = row;
  return { ...job, score: toScoreView(score, profileUpdatedAt) };
}

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  // Scored jobs first (high to low), then unscored; newest first within each group.
  async findAllForUser(userId: string): Promise<JobView[]> {
    const [rows, profileUpdatedAt] = await Promise.all([
      this.prisma.job.findMany({
        where: { userId },
        include: WITH_POSTINGS_AND_SCORE,
        // id breaks ties so jobs created in the same millisecond keep a stable order.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      this.profileUpdatedAt(userId),
    ]);
    // Sorted here rather than in SQL: one user has few jobs, and this is easy to test.
    return rows.map((row) => toView(row, profileUpdatedAt)).sort(compareJobs);
  }

  async findOneForUser(id: string, userId: string): Promise<JobView> {
    // Both conditions are in the query: another user's job is simply "not found".
    const row = await this.prisma.job.findUnique({
      where: { id, userId },
      include: WITH_POSTINGS_AND_SCORE,
    });
    if (!row) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    return toView(row, await this.profileUpdatedAt(userId));
  }

  async create(input: CreateJobInput, userId: string): Promise<JobView> {
    const { title, company, description, url } = input;
    try {
      // A nested create runs as a single transaction: the job and its first posting
      // are saved together or not at all.
      const job = await this.prisma.job.create({
        data: {
          title,
          company,
          description,
          userId,
          // The posting's jobId and userId come from the parent job.
          postings: {
            create: { url, site: siteFromUrl(url), source: "MANUAL" },
          },
        },
        include: { postings: { orderBy: { createdAt: "asc" } } },
      });
      // A new job has no score yet.
      return { ...job, score: null };
    } catch (error) {
      // The only unique constraint besides the primary key is (userId, url).
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException("You already have a job with this URL");
      }
      throw error;
    }
  }

  private async profileUpdatedAt(userId: string): Promise<Date | null> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { updatedAt: true },
    });
    return profile?.updatedAt ?? null;
  }
}
