import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NotFoundException } from "@nestjs/common";
import type { CreateJobInput, Job } from "../../src/jobs/job.js";
import { JobsService } from "../../src/jobs/jobs.service.js";
import type { PrismaService } from "../../src/prisma/prisma.service.js";

const input: CreateJobInput = {
  title: "Backend Developer",
  company: "Example",
  description: "Role",
  url: "https://example.com/job",
};

function setup(findUniqueResult: Job | null = null) {
  const calls: { method: string; args: any }[] = [];
  const prisma = {
    job: {
      findMany: async (args: unknown) => (calls.push({ method: "findMany", args }), []),
      findUnique: async (args: unknown) => (calls.push({ method: "findUnique", args }), findUniqueResult),
      create: async (args: { data: object }) => (calls.push({ method: "create", args }), { id: "job-1", ...args.data }),
    },
  } as unknown as PrismaService;
  return { service: new JobsService(prisma), calls };
}

describe("JobsService", () => {
  it("findAllForUser filters by owner in the database query", async () => {
    const { service, calls } = setup();
    await service.findAllForUser("user-1");
    assert.deepEqual(calls[0], { method: "findMany", args: { where: { userId: "user-1" } } });
  });

  it("findOneForUser queries by id AND owner", async () => {
    const job = { id: "job-1", userId: "user-1", ...input };
    const { service, calls } = setup(job);
    assert.deepEqual(await service.findOneForUser("job-1", "user-1"), job);
    assert.deepEqual(calls[0].args, { where: { id: "job-1", userId: "user-1" } });
  });

  it("findOneForUser throws NotFoundException when nothing matches", async () => {
    const { service } = setup(null);
    await assert.rejects(() => service.findOneForUser("job-1", "user-1"), NotFoundException);
  });

  it("create always uses the supplied userId, even if input carries another", async () => {
    const { service, calls } = setup();
    const sneaky = { ...input, userId: "attacker-chosen" } as CreateJobInput;
    await service.create(sneaky, "user-1");
    assert.equal(calls[0].args.data.userId, "user-1");
  });
});
