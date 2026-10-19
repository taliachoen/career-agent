import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CreateJobInput, Job } from "./job.js";

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string): Promise<Job[]> {
    return this.prisma.job.findMany({ where: { userId } });
  }

  async findOneForUser(id: string, userId: string): Promise<Job> {
    // Both conditions are in the query: another user's job is simply "not found".
    const job = await this.prisma.job.findUnique({ where: { id, userId } });
    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    return job;
  }

  create(input: CreateJobInput, userId: string): Promise<Job> {
    return this.prisma.job.create({ data: { ...input, userId } });
  }
}
