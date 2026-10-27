import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { CreateJobInput, JobWithPostingsAndScore } from "../../src/jobs/job.js";
import { JobsService } from "../../src/jobs/jobs.service.js";
import { siteFromUrl } from "../../src/jobs/site.js";
import type { PrismaService } from "../../src/prisma/prisma.service.js";

const input: CreateJobInput = {
  title: "Backend Developer",
  company: "Example",
  description: "Role",
  url: "https://www.Example.com/job",
};

function setup(options: { findUniqueResult?: JobWithPostingsAndScore | null; createError?: unknown } = {}) {
  const calls: { method: string; args: any }[] = [];
  const prisma = {
    job: {
      findMany: async (args: unknown) => (calls.push({ method: "findMany", args }), []),
      findUnique: async (args: unknown) => (
        calls.push({ method: "findUnique", args }),
        options.findUniqueResult ?? null
      ),
      create: async (args: { data: object }) => {
        calls.push({ method: "create", args });
        if (options.createError) throw options.createError;
        return { id: "job-1", ...args.data };
      },
    },
    profile: {
      findUnique: async () => ({ updatedAt: null }),
    },
  } as unknown as PrismaService;
  return { service: new JobsService(prisma), calls };
}

describe("JobsService", () => {
  it("findAllForUser filters by owner, includes postings, newest first", async () => {
    const { service, calls } = setup();
    await service.findAllForUser("user-1");
    assert.equal(calls[0].method, "findMany");
    assert.deepEqual(calls[0].args.where, { userId: "user-1" });
    assert.deepEqual(calls[0].args.include, {
      postings: { orderBy: { createdAt: "asc" } },
      score: true,
    });
    assert.deepEqual(calls[0].args.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("findOneForUser queries by id AND owner and includes postings", async () => {
    const job = {
      id: "job-1",
      userId: "user-1",
      postings: [],
      score: null,
    } as unknown as JobWithPostingsAndScore;
    const { service, calls } = setup({ findUniqueResult: job });
    assert.deepEqual(await service.findOneForUser("job-1", "user-1"), job);
    assert.deepEqual(calls[0].args.where, { id: "job-1", userId: "user-1" });
    assert.deepEqual(calls[0].args.include, {
      postings: { orderBy: { createdAt: "asc" } },
      score: true,
    });
  });

  it("findOneForUser throws NotFoundException when nothing matches", async () => {
    const { service } = setup();
    await assert.rejects(() => service.findOneForUser("job-1", "user-1"), NotFoundException);
  });

  it("create saves the job and its first MANUAL posting in one nested create", async () => {
    const { service, calls } = setup();
    await service.create(input, "user-1");
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].args.data, {
      title: input.title,
      company: input.company,
      description: input.description,
      userId: "user-1",
      postings: {
        create: { url: input.url, site: "example.com", source: "MANUAL" },
      },
    });
  });

  it("create always uses the supplied userId and ignores source fields in the input", async () => {
    const { service, calls } = setup();
    const sneaky = {
      ...input,
      userId: "attacker-chosen",
      source: "EMAIL",
      site: "evil.com",
      sourceMessageId: "msg-1",
    } as unknown as CreateJobInput;
    await service.create(sneaky, "user-1");
    const data = calls[0].args.data;
    assert.equal(data.userId, "user-1");
    assert.deepEqual(data.postings.create, {
      url: input.url,
      site: "example.com",
      source: "MANUAL",
    });
  });

  it("create turns a unique violation into ConflictException", async () => {
    const { service } = setup({ createError: Object.assign(new Error("dup"), { code: "P2002" }) });
    await assert.rejects(() => service.create(input, "user-1"), ConflictException);
  });

  it("create rethrows other errors unchanged", async () => {
    const boom = new Error("db down");
    const { service } = setup({ createError: boom });
    await assert.rejects(() => service.create(input, "user-1"), boom);
  });
});

describe("siteFromUrl", () => {
  it("returns the lowercased hostname without a leading www.", () => {
    assert.equal(siteFromUrl("https://www.LinkedIn.com/jobs/view/1"), "linkedin.com");
  });

  it("keeps other subdomains", () => {
    assert.equal(siteFromUrl("https://il.indeed.com/viewjob?jk=1"), "il.indeed.com");
  });

  it("ignores port, userinfo, query and fragment", () => {
    assert.equal(siteFromUrl("http://user:pw@example.com:8080/a?b=1#c"), "example.com");
  });

  it("throws on an unparseable url", () => {
    assert.throws(() => siteFromUrl("not a url"), TypeError);
  });
});
