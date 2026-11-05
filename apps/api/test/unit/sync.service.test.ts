import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import type { GmailMessage } from "../../src/gmail/gmail-provider.js";
import { SAMPLE_JOBS, jobCardsEmail, type SampleJob } from "../../src/gmail/fake-mailbox.js";
import type { GmailService } from "../../src/gmail/gmail.service.js";
import { MAX_EMAILS_PER_SYNC, SyncService } from "../../src/ingest/sync.service.js";
import type { SendersService } from "../../src/ingest/senders.service.js";
import type { ScoringService } from "../../src/jobs/scoring.service.js";
import { FakeLlmProvider } from "../../src/llm/fake.provider.js";
import type { LlmProvider } from "../../src/llm/llm-provider.js";
import type { PrismaService } from "../../src/prisma/prisma.service.js";

const USER = "user-1";

function toMessage(message: ReturnType<typeof jobCardsEmail>): GmailMessage {
  return {
    id: message.id,
    from: message.from,
    subject: message.subject,
    authResults: message.authResults,
    text: message.text ?? null,
    html: message.html ?? null,
  };
}

const linkedin = (id: string, ...jobs: SampleJob[]) =>
  toMessage(
    jobCardsEmail(
      id,
      "LinkedIn <jobalerts-noreply@linkedin.com>",
      "Jobs for you",
      "linkedin.com",
      jobs,
    ),
  );
const glassdoor = (id: string, ...jobs: SampleJob[]) =>
  toMessage(
    jobCardsEmail(id, "Glassdoor <noreply@glassdoor.com>", "Jobs near you", "glassdoor.com", jobs),
  );

interface Options {
  messages: GmailMessage[];
  jobs?: { id: string; title: string; company: string; location: string | null }[];
  postingUrls?: string[];
  handled?: { messageId: string; status: "DONE" | "FAILED"; attempts: number }[];
  llm?: LlmProvider;
  scoring?: () => Promise<{ scored: number; failed: number; remaining: number }>;
}

// An in-memory stand-in for the tables and for Gmail; the model is the real fake provider,
// so the extraction prompt and the answer parsing run as they do in the app.
function setup(options: Options) {
  const jobs = [...(options.jobs ?? [])];
  const postingUrls = new Set(options.postingUrls ?? []);
  const createdJobs: any[] = [];
  const createdPostings: any[] = [];
  const records: any[] = [];
  const fetched: string[] = [];
  let scoringCalls = 0;
  let counter = 0;

  const prisma = {
    gmailProcessedMessage: {
      findMany: async () => options.handled ?? [],
      upsert: async (args: any) => (records.push(args), { id: "r" }),
    },
    job: {
      findMany: async () => jobs,
      create: async ({ data }: any) => {
        createdJobs.push(data);
        postingUrls.add(data.postings.create.url);
        const id = `new-${++counter}`;
        jobs.push({ id, title: data.title, company: data.company, location: data.location });
        return { id };
      },
    },
    jobPosting: {
      findMany: async ({ where }: any) =>
        [...postingUrls].filter((url) => where.url.in.includes(url)).map((url) => ({ url })),
      create: async ({ data }: any) => (
        createdPostings.push(data),
        postingUrls.add(data.url),
        { id: "p" }
      ),
    },
  } as unknown as PrismaService;

  const gmail = {
    getAccessToken: async () => "access",
    listMessageIds: async () => ({
      ids: options.messages.map((message) => message.id),
      nextPageToken: null,
    }),
    getMessage: async (_token: string, id: string) => {
      fetched.push(id);
      return options.messages.find((message) => message.id === id)!;
    },
  } as unknown as GmailService;

  const senders = {
    allowedEntries: async () => ["glassdoor.com", "jobalerts-noreply@linkedin.com"],
  } as unknown as SendersService;

  const scoring = {
    scorePending: async () => {
      scoringCalls += 1;
      return (options.scoring ?? (async () => ({ scored: 0, failed: 0, remaining: 0 })))();
    },
  } as unknown as ScoringService;

  const llm = options.llm ?? new FakeLlmProvider();
  const service = new SyncService(prisma, gmail, senders, scoring, llm);
  return {
    service,
    createdJobs,
    createdPostings,
    records,
    fetched,
    scoringCalls: () => scoringCalls,
  };
}

describe("SyncService", () => {
  it("saves a new job with the email snippet, the EMAIL source and the message id", async () => {
    const { service, createdJobs, records } = setup({
      messages: [linkedin("m1", SAMPLE_JOBS.linkedinAcme)],
    });
    const result = await service.sync(USER);

    assert.equal(result.added, 1);
    assert.equal(createdJobs.length, 1);
    const job = createdJobs[0];
    assert.equal(job.userId, USER);
    assert.equal(job.title, "Full Stack Developer");
    assert.equal(job.company, "Acme Software");
    assert.equal(job.location, "Tel Aviv-Yafo, Tel Aviv District, Israel");
    assert.equal(job.descriptionSource, "EMAIL_SNIPPET");
    assert.match(job.description, /Full Stack Developer/);
    assert.deepEqual(job.postings.create, {
      url: "https://www.linkedin.com/jobs/view/3912345678/",
      site: "linkedin.com",
      source: "EMAIL",
      sourceMessageId: "m1",
    });
    assert.equal(records[0].create.status, "DONE");
    assert.equal(records[0].create.messageId, "m1");
  });

  it("adds a posting to the existing job when the same job comes from another site", async () => {
    const { service, createdJobs, createdPostings } = setup({
      messages: [
        linkedin("m1", SAMPLE_JOBS.linkedinAcme),
        glassdoor("m2", SAMPLE_JOBS.glassdoorAcmeTlv),
      ],
    });
    const result = await service.sync(USER);

    assert.deepEqual([result.added, result.attached], [1, 1]);
    assert.equal(createdJobs.length, 1);
    assert.equal(createdPostings.length, 1);
    assert.equal(createdPostings[0].jobId, "new-1");
    assert.equal(createdPostings[0].userId, USER);
    assert.equal(createdPostings[0].source, "EMAIL");
    assert.equal(createdPostings[0].sourceMessageId, "m2");
    assert.equal(createdPostings[0].site, "glassdoor.com");
    assert.equal(
      createdPostings[0].url,
      "https://www.glassdoor.com/partner/jobListing.htm?jl=1009123456",
    );
  });

  it("the same company and role in two cities are two jobs", async () => {
    const { service, createdJobs, createdPostings } = setup({
      messages: [glassdoor("m1", SAMPLE_JOBS.glassdoorAcmeTlv, SAMPLE_JOBS.glassdoorAcmeHaifa)],
    });
    const result = await service.sync(USER);
    assert.deepEqual([result.added, result.attached], [2, 0]);
    assert.equal(createdJobs.length, 2);
    assert.equal(createdPostings.length, 0);
  });

  it("matches a job that already exists without a location, and one with the same location", async () => {
    const { service, createdJobs, createdPostings } = setup({
      messages: [glassdoor("m1", SAMPLE_JOBS.glassdoorAcmeTlv)],
      jobs: [
        { id: "existing", title: "Full Stack Developer", company: "Acme Software", location: null },
      ],
    });
    const result = await service.sync(USER);
    assert.deepEqual([result.added, result.attached], [0, 1]);
    assert.equal(createdJobs.length, 0);
    assert.equal(createdPostings[0].jobId, "existing");

    const sameCity = setup({
      messages: [glassdoor("m1", SAMPLE_JOBS.glassdoorAcmeTlv)],
      jobs: [
        {
          id: "tlv",
          title: "Full Stack Developer",
          company: "Acme Software",
          location: "Tel Aviv-Yafo, Israel",
        },
      ],
    });
    assert.equal((await sameCity.service.sync(USER)).attached, 1);

    const otherCity = setup({
      messages: [glassdoor("m1", SAMPLE_JOBS.glassdoorAcmeTlv)],
      jobs: [
        { id: "haifa", title: "Full Stack Developer", company: "Acme Software", location: "Haifa" },
      ],
    });
    const other = await otherCity.service.sync(USER);
    assert.deepEqual([other.added, other.attached], [1, 0]);
  });

  it("skips a job whose URL is already saved, normalized or as it was written in the mail", async () => {
    const normalized = setup({
      messages: [linkedin("m1", SAMPLE_JOBS.linkedinAcme)],
      postingUrls: ["https://www.linkedin.com/jobs/view/3912345678/"],
    });
    const first = await normalized.service.sync(USER);
    assert.deepEqual([first.added, first.attached, first.duplicates], [0, 0, 1]);
    assert.equal(normalized.createdJobs.length, 0);

    const raw = setup({
      messages: [linkedin("m1", SAMPLE_JOBS.linkedinAcme)],
      postingUrls: [SAMPLE_JOBS.linkedinAcme.url],
    });
    assert.equal((await raw.service.sync(USER)).duplicates, 1);
  });

  it("drops a job whose URL is not in the email, and saves the real ones", async () => {
    const message = linkedin("m1", SAMPLE_JOBS.linkedinAcme);
    message.html = `${message.html} [[fake:bad-url]]`;
    const { service, createdJobs } = setup({ messages: [message] });
    const result = await service.sync(USER);
    assert.deepEqual([result.added, result.rejected], [1, 1]);
    assert.deepEqual(
      createdJobs.map((job) => job.title),
      ["Full Stack Developer"],
    );
  });

  it("never sends a mail without a verified signature from the sender's domain to the model", async () => {
    let modelCalls = 0;
    const spoofed = {
      ...linkedin("m1", SAMPLE_JOBS.linkedinAcme),
      authResults: ["mx.google.com; dkim=fail header.i=@linkedin.com"],
    };
    const thirdParty = {
      ...linkedin("m2", SAMPLE_JOBS.linkedinGlobex),
      authResults: ["mx.google.com; dkim=pass header.i=@sendgrid.net"],
    };
    const unsigned = { ...linkedin("m3", SAMPLE_JOBS.linkedinGlobex), authResults: [] };
    const llm: LlmProvider = {
      name: "fake",
      checkReady() {},
      completeJson: async () => (
        modelCalls++,
        { text: '{"jobs":[]}', model: "m", inputTokens: 0, outputTokens: 0 }
      ),
    };
    const { service, createdJobs, records } = setup({
      messages: [spoofed, thirdParty, unsigned],
      llm,
    });
    const result = await service.sync(USER);

    assert.equal(modelCalls, 0);
    assert.equal(result.unauthenticated, 3);
    assert.equal(result.checked, 3);
    assert.equal(createdJobs.length, 0);
    // Recorded like a failed mail (not as done), so a changed rule can read them again, and
    // given up on after a few syncs. They are not counted as failures.
    assert.deepEqual(
      records.map((record) => record.create.status),
      ["FAILED", "FAILED", "FAILED"],
    );
    assert.equal(result.failedEmails, 0);
  });

  it("a forged Authentication-Results header added below Gmail's own does not pass a mail", async () => {
    let modelCalls = 0;
    const forged = {
      ...linkedin("m1", SAMPLE_JOBS.linkedinAcme),
      authResults: [
        "mx.google.com; dkim=fail header.i=@linkedin.com header.s=x",
        "mx.google.com; dkim=pass header.i=@linkedin.com header.s=x",
      ],
    };
    const llm: LlmProvider = {
      name: "fake",
      checkReady() {},
      completeJson: async () => (
        modelCalls++,
        { text: '{"jobs":[]}', model: "m", inputTokens: 0, outputTokens: 0 }
      ),
    };
    const { service } = setup({ messages: [forged], llm });
    const result = await service.sync(USER);
    assert.equal(modelCalls, 0);
    assert.equal(result.unauthenticated, 1);
  });

  it("a display name that contains an allowed address does not make a mail allowed", async () => {
    let modelCalls = 0;
    const tricky = {
      ...linkedin("m1", SAMPLE_JOBS.linkedinAcme),
      from: '"LinkedIn <jobalerts-noreply@linkedin.com>" <someone@evil.example>',
    };
    const llm: LlmProvider = {
      name: "fake",
      checkReady() {},
      completeJson: async () => (
        modelCalls++,
        { text: '{"jobs":[]}', model: "m", inputTokens: 0, outputTokens: 0 }
      ),
    };
    const { service } = setup({ messages: [tricky], llm });
    const result = await service.sync(USER);
    assert.equal(modelCalls, 0);
    assert.equal(result.ignored, 1);
  });

  it("drops an unsubscribe or settings link the model returned, even though it is in the mail", async () => {
    const message = linkedin("m1", SAMPLE_JOBS.linkedinAcme);
    const llm: LlmProvider = {
      name: "fake",
      checkReady() {},
      completeJson: async () => ({
        text: JSON.stringify({
          jobs: [
            {
              title: "Unsubscribe",
              company: "Example Alerts",
              location: null,
              url: "https://www.example-alerts.invalid/unsubscribe?token=abc123",
              snippet: "x",
            },
            {
              title: "Full Stack Developer",
              company: "Acme Software",
              location: null,
              url: SAMPLE_JOBS.linkedinAcme.url,
              snippet: "x",
            },
          ],
        }),
        model: "m",
        inputTokens: 0,
        outputTokens: 0,
      }),
    };
    const { service, createdJobs } = setup({ messages: [message], llm });
    const result = await service.sync(USER);
    assert.deepEqual([result.added, result.rejected], [1, 1]);
    assert.deepEqual(
      createdJobs.map((job) => job.title),
      ["Full Stack Developer"],
    );
  });

  it("a scoring error after the jobs are saved does not fail the sync", async () => {
    const { service, createdJobs } = setup({
      messages: [linkedin("m1", SAMPLE_JOBS.linkedinAcme)],
      scoring: async () => {
        throw new Error("database exploded");
      },
    });
    const result = await service.sync(USER);
    assert.equal(createdJobs.length, 1);
    assert.deepEqual([result.added, result.scoring], [1, "failed"]);
  });

  it("never sends a mail from a sender that is not allowed to the model", async () => {
    let modelCalls = 0;
    const other = toMessage(
      jobCardsEmail("m1", "Someone <hr@unknown-site.example>", "Jobs", "unknown-site.example", [
        SAMPLE_JOBS.linkedinAcme,
      ]),
    );
    const noAddress = { ...linkedin("m2", SAMPLE_JOBS.linkedinAcme), from: "no address here" };
    const llm: LlmProvider = {
      name: "fake",
      checkReady() {},
      completeJson: async () => (
        modelCalls++,
        { text: '{"jobs":[]}', model: "m", inputTokens: 0, outputTokens: 0 }
      ),
    };
    const { service, records } = setup({ messages: [other, noAddress], llm });
    const result = await service.sync(USER);
    assert.equal(modelCalls, 0);
    assert.equal(result.ignored, 2);
    assert.deepEqual(
      records.map((record) => record.create.status),
      ["FAILED", "FAILED"],
    );
  });

  it("one failing mail does not stop the others; it is recorded as failed", async () => {
    const bad = linkedin("m1", SAMPLE_JOBS.linkedinAcme);
    bad.html = `${bad.html} [[fake:fail]]`;
    const garbled = linkedin("m2", SAMPLE_JOBS.linkedinAcme);
    garbled.html = `${garbled.html} [[fake:badjson]]`;
    const good = glassdoor("m3", SAMPLE_JOBS.glassdoorAcmeHaifa);
    const { service, createdJobs, records } = setup({ messages: [bad, garbled, good] });
    const result = await service.sync(USER);

    assert.deepEqual([result.failedEmails, result.added], [2, 1]);
    assert.equal(createdJobs.length, 1);
    const byId = new Map(records.map((record) => [record.create.messageId, record]));
    assert.equal(byId.get("m1").create.status, "FAILED");
    assert.equal(byId.get("m1").create.attempts, 1);
    assert.deepEqual(byId.get("m1").update.attempts, { increment: 1 });
    assert.equal(byId.get("m3").create.status, "DONE");
  });

  it("a mail that cannot be fetched is a failed mail, not a failed sync", async () => {
    const { service } = setup({ messages: [linkedin("m1", SAMPLE_JOBS.linkedinAcme)] });
    (service as any).gmail.getMessage = async () => {
      throw new Error("network down");
    };
    const result = await service.sync(USER);
    assert.deepEqual([result.checked, result.failedEmails, result.added], [1, 1, 0]);
  });

  it("skips mails that are done, and mails that failed too many times; retries the others", async () => {
    const { service, fetched } = setup({
      messages: [
        linkedin("done", SAMPLE_JOBS.linkedinAcme),
        linkedin("gave-up", SAMPLE_JOBS.linkedinAcme),
        linkedin("retry", SAMPLE_JOBS.linkedinGlobex),
        linkedin("new", SAMPLE_JOBS.linkedinGlobex),
      ],
      handled: [
        { messageId: "done", status: "DONE", attempts: 0 },
        { messageId: "gave-up", status: "FAILED", attempts: 3 },
        { messageId: "retry", status: "FAILED", attempts: 2 },
      ],
    });
    const result = await service.sync(USER);
    assert.deepEqual(fetched.sort(), ["new", "retry"]);
    assert.equal(result.checked, 2);
  });

  it(`reads at most ${MAX_EMAILS_PER_SYNC} mails and says there are more`, async () => {
    const messages = Array.from({ length: MAX_EMAILS_PER_SYNC + 5 }, (_, i) => linkedin(`m${i}`));
    const { service, fetched } = setup({ messages });
    const result = await service.sync(USER);
    assert.equal(fetched.length, MAX_EMAILS_PER_SYNC);
    assert.equal(result.checked, MAX_EMAILS_PER_SYNC);
    assert.equal(result.moreAvailable, true);

    const few = await setup({ messages: messages.slice(0, 3) }).service.sync(USER);
    assert.equal(few.moreAvailable, false);
  });

  it("scores only when something was added, and reports what scoring did", async () => {
    const none = setup({ messages: [linkedin("m1")] });
    assert.equal((await none.service.sync(USER)).scoring, "not_needed");
    assert.equal(none.scoringCalls(), 0);

    const added = setup({
      messages: [linkedin("m1", SAMPLE_JOBS.linkedinAcme)],
      scoring: async () => ({ scored: 1, failed: 0, remaining: 0 }),
    });
    const result = await added.service.sync(USER);
    assert.deepEqual(
      [result.scoring, result.scored, result.scoreFailed, result.scoringRemaining],
      ["done", 1, 0, 0],
    );
  });

  it("keeps scoring in rounds while jobs remain, and stops when a round scores nothing", async () => {
    let round = 0;
    const rounds = setup({
      messages: [linkedin("m1", SAMPLE_JOBS.linkedinAcme)],
      scoring: async () => ({ scored: 10, failed: 0, remaining: 100 - 10 * ++round }),
    });
    const result = await rounds.service.sync(USER);
    assert.equal(rounds.scoringCalls(), 3);
    assert.deepEqual([result.scored, result.scoringRemaining], [30, 70]);

    const stuck = setup({
      messages: [linkedin("m1", SAMPLE_JOBS.linkedinAcme)],
      scoring: async () => ({ scored: 0, failed: 4, remaining: 4 }),
    });
    const stuckResult = await stuck.service.sync(USER);
    assert.equal(stuck.scoringCalls(), 1);
    assert.deepEqual([stuckResult.scoreFailed, stuckResult.scoringRemaining], [4, 4]);
  });

  it("jobs are still saved when scoring cannot run", async () => {
    const noProfile = setup({
      messages: [linkedin("m1", SAMPLE_JOBS.linkedinAcme)],
      scoring: async () => {
        throw new BadRequestException("Save your CV");
      },
    });
    const result = await noProfile.service.sync(USER);
    assert.deepEqual([result.added, result.scoring], [1, "skipped_no_profile"]);

    const busy = setup({
      messages: [linkedin("m1", SAMPLE_JOBS.linkedinAcme)],
      scoring: async () => {
        throw new ConflictException("busy");
      },
    });
    assert.equal((await busy.service.sync(USER)).scoring, "skipped_busy");
  });

  it("a second sync by the same user at the same time is a 409; another user is not blocked", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow: LlmProvider = {
      name: "fake",
      checkReady() {},
      completeJson: async () => (
        await gate,
        { text: '{"jobs":[]}', model: "m", inputTokens: 0, outputTokens: 0 }
      ),
    };
    const { service } = setup({ messages: [linkedin("m1", SAMPLE_JOBS.linkedinAcme)], llm: slow });
    const first = service.sync(USER);
    await new Promise((resolve) => setImmediate(resolve));
    await assert.rejects(() => service.sync(USER), ConflictException);
    const other = service.sync("user-2");
    release();
    await first;
    await other;
    // The lock is released: the user can sync again.
    assert.ok(await service.sync(USER));
  });

  it("stops before reading any mail when Gmail is not connected, and releases the lock", async () => {
    const { service, fetched } = setup({ messages: [linkedin("m1", SAMPLE_JOBS.linkedinAcme)] });
    let attempts = 0;
    (service as any).gmail.getAccessToken = async () => {
      attempts += 1;
      throw new BadRequestException("Gmail is not connected");
    };
    await assert.rejects(() => service.sync(USER), BadRequestException);
    await assert.rejects(() => service.sync(USER), BadRequestException);
    assert.equal(attempts, 2);
    assert.equal(fetched.length, 0);
  });

  it("logs nothing but numbers and error kinds", async () => {
    const lines: string[] = [];
    const { service } = setup({
      messages: [
        { ...linkedin("m1", SAMPLE_JOBS.linkedinAcme), subject: "SECRET-SUBJECT" },
        { ...glassdoor("m2", SAMPLE_JOBS.glassdoorAcmeTlv), html: "SECRET-BODY [[fake:fail]]" },
      ],
    });
    const logger = (service as any).logger;
    for (const level of ["log", "warn", "error", "debug", "verbose"]) {
      logger[level] = (message: unknown) => lines.push(String(message));
    }
    await service.sync(USER);
    const logged = lines.join("\n");
    assert.ok(logged.length > 0);
    for (const secret of ["SECRET", "linkedin", "glassdoor", "Acme", "@", "example.com"]) {
      assert.equal(logged.includes(secret), false, secret);
    }
  });
});
