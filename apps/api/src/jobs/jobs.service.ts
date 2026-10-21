import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CreateJobInput, JobWithPostings } from "./job.js";
import { siteFromUrl } from "./site.js";

const WITH_POSTINGS = { postings: { orderBy: { createdAt: "asc" } } } as const;

// Prisma's error code for a violated unique constraint.
const UNIQUE_VIOLATION = "P2002";

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string): Promise<JobWithPostings[]> {
    return this.prisma.job.findMany({
      where: { userId },
      include: WITH_POSTINGS,
      // id breaks ties so jobs created in the same millisecond keep a stable order.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  async findOneForUser(id: string, userId: string): Promise<JobWithPostings> {
    // Both conditions are in the query: another user's job is simply "not found".
    const job = await this.prisma.job.findUnique({
      where: { id, userId },
      include: WITH_POSTINGS,
    });
    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    return job;
  }

  async create(input: CreateJobInput, userId: string): Promise<JobWithPostings> {
    const { title, company, description, url } = input;
    try {
      // A nested create runs as a single transaction: the job and its first posting
      // are saved together or not at all.
      return await this.prisma.job.create({
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
        include: WITH_POSTINGS,
      });
    } catch (error) {
      // The only unique constraint besides the primary key is (userId, url).
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException("You already have a job with this URL");
      }
      throw error;
    }
  }
}
