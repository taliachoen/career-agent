import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { SyncResult } from "@career-agent/types";
import { mapWithConcurrency } from "../concurrency.js";
import { GmailService } from "../gmail/gmail.service.js";
import { ScoringService } from "../jobs/scoring.service.js";
import { siteFromUrl } from "../jobs/site.js";
import {
  LLM_PROVIDER,
  LlmError,
  LlmNotConfiguredError,
  type LlmProvider,
} from "../llm/llm-provider.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { isDkimAligned } from "./dkim.js";
import { emailBodyText } from "./email-text.js";
import {
  InvalidExtractionError,
  parseExtractionResponse,
  type ExtractedJob,
} from "./extraction/parse-extraction.js";
import { buildExtractionRequest } from "./extraction/prompt.js";
import { jobKey, locationsCompatible, normalizeLocation } from "./job-matching.js";
import { SendersService } from "./senders.service.js";
import { buildGmailQuery, parseFromHeader, senderAllowed } from "./senders.js";
import { extractNormalizedUrls, looksLikeNonJobLink, normalizeUrl } from "./url-normalize.js";

export const MAX_EMAILS_PER_SYNC = 50;
export const LOOKBACK_DAYS = 14;
// A search page holds up to 100 ids. Two pages are enough to find 50 unprocessed mails
// among those already handled.
const LIST_PAGE_SIZE = 100;
const MAX_LIST_PAGES = 2;
// Mails fetched and sent to the model at the same time.
const CONCURRENCY = 3;
// A mail that failed this many times is given up on, so one broken mail cannot take a place
// in every sync.
export const MAX_FAILED_ATTEMPTS = 3;
// Scoring runs of up to 10 jobs each after a sync. What is left is scored by the button.
const MAX_SCORING_ROUNDS = 3;

// Prisma's error code for a violated unique constraint.
const UNIQUE_VIOLATION = "P2002";

interface Candidate {
  id: string;
  attempts: number;
}

type CheckedJob = ExtractedJob & { rawUrl: string };

type Prepared =
  | { kind: "failed"; candidate: Candidate }
  | { kind: "unauthenticated"; candidate: Candidate }
  | { kind: "ignored"; candidate: Candidate }
  | { kind: "extracted"; candidate: Candidate; jobs: CheckedJob[]; rejected: number };

interface KnownJob {
  jobId: string;
  location: string | null;
}

// What may be logged about a failed mail. LlmError and InvalidExtractionError messages are
// written to be content-free; any other error is reduced to its class name.
function failureReason(error: unknown): string {
  if (error instanceof LlmError || error instanceof InvalidExtractionError) {
    return `${error.constructor.name}: ${error.message}`;
  }
  return error instanceof Error ? error.constructor.name : "UnknownError";
}

@Injectable()
export class SyncService {
  // Privacy: this logger only ever gets numbers and error kinds. Never a subject, a sender,
  // an address, a mail body, or an error message from Google or the model.
  private readonly logger = new Logger(SyncService.name);
  // One sync per user at a time. In memory, so it holds for a single API process (see plan.md).
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gmail: GmailService,
    private readonly senders: SendersService,
    private readonly scoring: ScoringService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  async sync(userId: string): Promise<SyncResult> {
    try {
      this.llm.checkReady();
    } catch (error) {
      if (error instanceof LlmNotConfiguredError) {
        throw new ServiceUnavailableException("AI extraction is not configured on the server");
      }
      throw error;
    }

    if (this.running.has(userId)) {
      throw new ConflictException("Sync is already in progress");
    }
    this.running.add(userId);
    try {
      return await this.run(userId);
    } finally {
      this.running.delete(userId);
    }
  }

  private async run(userId: string): Promise<SyncResult> {
    // Throws 400 (not connected / needs reconnect), 502 or 503, before any mail is read.
    const accessToken = await this.gmail.getAccessToken(userId);
    const entries = await this.senders.allowedEntries(userId);
    const query = buildGmailQuery(entries, LOOKBACK_DAYS);
    const { candidates, moreAvailable } = await this.findCandidates(userId, accessToken, query);

    const result: SyncResult = {
      checked: candidates.length,
      withJobs: 0,
      added: 0,
      attached: 0,
      duplicates: 0,
      rejected: 0,
      unauthenticated: 0,
      ignored: 0,
      failedEmails: 0,
      moreAvailable,
      scored: 0,
      scoreFailed: 0,
      scoringRemaining: 0,
      scoring: "not_needed",
    };
    let inputTokens = 0;
    let outputTokens = 0;
    const failures = new Map<string, number>();

    // Reading and asking the model run a few at a time; saving is one mail after another, so
    // two mails never race to create the same job.
    const prepared = await mapWithConcurrency(candidates, CONCURRENCY, async (candidate) => {
      try {
        return await this.prepare(candidate, accessToken, entries, (input, output) => {
          inputTokens += input;
          outputTokens += output;
        });
      } catch (error) {
        const reason = failureReason(error);
        failures.set(reason, (failures.get(reason) ?? 0) + 1);
        return { kind: "failed", candidate } satisfies Prepared;
      }
    });

    const known = await this.loadKnownJobs(userId);
    for (const item of prepared) {
      // A mail that is not read (no verified signature, or not from an allowed sender after
      // all) is recorded like a failed one: looked at again in the next syncs, in case the
      // rules change, and given up on after MAX_FAILED_ATTEMPTS, so it cannot take a place in
      // every sync. It is counted separately, not as a failure.
      if (item.kind === "unauthenticated") {
        result.unauthenticated += 1;
        await this.record(userId, item.candidate, "FAILED");
      } else if (item.kind === "ignored") {
        result.ignored += 1;
        await this.record(userId, item.candidate, "FAILED");
      } else if (item.kind === "failed") {
        result.failedEmails += 1;
        await this.record(userId, item.candidate, "FAILED");
      } else {
        try {
          result.rejected += item.rejected;
          if (item.jobs.length > 0) result.withJobs += 1;
          await this.saveJobs(userId, item.candidate.id, item.jobs, known, result);
          await this.record(userId, item.candidate, "DONE");
        } catch (error) {
          const reason = failureReason(error);
          failures.set(reason, (failures.get(reason) ?? 0) + 1);
          result.failedEmails += 1;
          await this.record(userId, item.candidate, "FAILED");
        }
      }
    }

    if (result.added > 0) {
      await this.scoreNewJobs(userId, result);
    }

    const reasons = [...failures].map(([reason, count]) => `${count}x ${reason}`).join("; ");
    this.logger.log(
      `Sync: ${result.checked} mails, ${result.withJobs} with jobs, ${result.added} added, ` +
        `${result.attached} attached, ${result.duplicates} duplicates, ${result.rejected} rejected, ` +
        `${result.unauthenticated} unauthenticated, ${result.ignored} ignored, ` +
        `${result.failedEmails} failed${reasons ? ` (${reasons})` : ""}, ` +
        `${result.scored} scored, ${inputTokens} input tokens, ${outputTokens} output tokens`,
    );
    return result;
  }

  // Unprocessed mail ids, newest first: up to MAX_EMAILS_PER_SYNC, and whether more are waiting.
  private async findCandidates(
    userId: string,
    accessToken: string,
    query: string,
  ): Promise<{ candidates: Candidate[]; moreAvailable: boolean }> {
    const found: Candidate[] = [];
    let pageToken: string | undefined;
    let moreAvailable = false;

    for (let page = 0; page < MAX_LIST_PAGES; page++) {
      let listed;
      try {
        listed = await this.gmail.listMessageIds({
          accessToken,
          query,
          maxResults: LIST_PAGE_SIZE,
          pageToken,
        });
      } catch (error) {
        this.logger.warn(`Could not search Gmail (${failureReason(error)})`);
        throw new BadGatewayException("Could not read Gmail. Try again in a moment");
      }

      const handled = await this.prisma.gmailProcessedMessage.findMany({
        where: { userId, messageId: { in: listed.ids } },
        select: { messageId: true, status: true, attempts: true },
      });
      const byId = new Map(handled.map((row) => [row.messageId, row]));
      for (const id of listed.ids) {
        const row = byId.get(id);
        // Done, or failed too many times: skip.
        if (row && (row.status === "DONE" || row.attempts >= MAX_FAILED_ATTEMPTS)) continue;
        if (found.length >= MAX_EMAILS_PER_SYNC) {
          moreAvailable = true;
          break;
        }
        found.push({ id, attempts: row?.attempts ?? 0 });
      }
      if (moreAvailable) break;
      if (!listed.nextPageToken) break;
      pageToken = listed.nextPageToken;
      // Out of pages to look at while Gmail has more results: there may be more to sync.
      if (page === MAX_LIST_PAGES - 1) moreAvailable = true;
    }
    return { candidates: found, moreAvailable };
  }

  // Reads one mail and asks the model for its jobs. Only a mail from an allowed sender whose
  // DKIM signature Gmail verified for the sender's own domain is ever sent to the model.
  private async prepare(
    candidate: Candidate,
    accessToken: string,
    entries: string[],
    addTokens: (input: number, output: number) => void,
  ): Promise<Prepared> {
    const message = await this.gmail.getMessage(accessToken, candidate.id);

    const from = parseFromHeader(message.from);
    if (!from || !senderAllowed(from, entries)) {
      return { kind: "ignored", candidate };
    }
    if (!isDkimAligned(message.authResults, from.domain)) {
      return { kind: "unauthenticated", candidate };
    }

    const body = emailBodyText(message);
    if (body === "") {
      return { kind: "extracted", candidate, jobs: [], rejected: 0 };
    }

    const completion = await this.llm.completeJson(
      buildExtractionRequest({ subject: message.subject, body }),
    );
    addTokens(completion.inputTokens, completion.outputTokens);
    const parsed = parseExtractionResponse(completion.text);

    // A URL the model returns must be in the text it was given. Anything else is invented,
    // or planted by the email's text, and the job is dropped.
    const urlsInEmail = extractNormalizedUrls(body);
    const jobs: CheckedJob[] = [];
    let rejected = parsed.rejected;
    for (const job of parsed.jobs) {
      const url = normalizeUrl(job.url);
      if (url !== null && urlsInEmail.has(url) && !looksLikeNonJobLink(url)) {
        jobs.push({ ...job, url, rawUrl: job.url });
      } else {
        rejected += 1;
      }
    }
    return { kind: "extracted", candidate, jobs, rejected };
  }

  // The user's jobs by company and title, to find the same job again under another site.
  private async loadKnownJobs(userId: string): Promise<Map<string, KnownJob[]>> {
    const rows = await this.prisma.job.findMany({
      where: { userId },
      select: { id: true, title: true, company: true, location: true },
    });
    const known = new Map<string, KnownJob[]>();
    for (const row of rows) {
      const key = jobKey(row.company, row.title);
      if (key === null) continue;
      const list = known.get(key) ?? [];
      list.push({ jobId: row.id, location: normalizeLocation(row.location) });
      known.set(key, list);
    }
    return known;
  }

  private async saveJobs(
    userId: string,
    messageId: string,
    jobs: CheckedJob[],
    known: Map<string, KnownJob[]>,
    result: SyncResult,
  ): Promise<void> {
    if (jobs.length === 0) return;
    const existing = new Set(
      (
        await this.prisma.jobPosting.findMany({
          where: { userId, url: { in: jobs.flatMap((job) => [job.url, job.rawUrl]) } },
          select: { url: true },
        })
      ).map((posting) => posting.url),
    );

    for (const job of jobs) {
      if (existing.has(job.url) || existing.has(job.rawUrl)) {
        result.duplicates += 1;
        continue;
      }
      const posting = {
        url: job.url,
        site: siteFromUrl(job.url),
        source: "EMAIL" as const,
        sourceMessageId: messageId,
      };
      const key = jobKey(job.company, job.title);
      const location = normalizeLocation(job.location);
      // The same company and role, in the same place or where one of them has no place.
      const match = key
        ? known.get(key)?.find((candidate) => locationsCompatible(candidate.location, location))
        : undefined;

      try {
        if (match) {
          await this.prisma.jobPosting.create({
            data: { jobId: match.jobId, userId, ...posting },
            select: { id: true },
          });
          result.attached += 1;
        } else {
          const created = await this.prisma.job.create({
            data: {
              title: job.title,
              company: job.company,
              description: job.snippet,
              descriptionSource: "EMAIL_SNIPPET",
              location: job.location,
              userId,
              postings: { create: posting },
            },
            select: { id: true },
          });
          result.added += 1;
          if (key) {
            const list = known.get(key) ?? [];
            list.push({ jobId: created.id, location });
            known.set(key, list);
          }
        }
        existing.add(job.url);
      } catch (error) {
        // The same URL arrived by another path first: it is a duplicate, not a failure.
        if ((error as { code?: string }).code !== UNIQUE_VIOLATION) throw error;
        result.duplicates += 1;
      }
    }
  }

  private async record(userId: string, candidate: Candidate, status: "DONE" | "FAILED") {
    await this.prisma.gmailProcessedMessage.upsert({
      where: { userId_messageId: { userId, messageId: candidate.id } },
      create: {
        userId,
        messageId: candidate.id,
        status,
        attempts: status === "FAILED" ? 1 : 0,
      },
      update: status === "FAILED" ? { status, attempts: { increment: 1 } } : { status },
      select: { id: true },
    });
  }

  // Scores what the sync added (and any older unscored jobs, newest first), a few rounds of
  // up to 10. The same service and limits as the scoring button.
  private async scoreNewJobs(userId: string, result: SyncResult): Promise<void> {
    result.scoring = "done";
    for (let round = 0; round < MAX_SCORING_ROUNDS; round++) {
      try {
        const run = await this.scoring.scorePending(userId);
        result.scored += run.scored;
        result.scoreFailed += run.failed;
        result.scoringRemaining = run.remaining;
        // Done, or a round that scored nothing: another one would not do better.
        if (run.remaining === 0 || run.scored === 0) return;
      } catch (error) {
        if (error instanceof BadRequestException) {
          result.scoring = "skipped_no_profile";
        } else if (error instanceof ConflictException) {
          result.scoring = "skipped_busy";
        } else if (error instanceof ServiceUnavailableException) {
          result.scoring = "skipped_unavailable";
        } else {
          // The jobs are already saved: a scoring problem must not turn the sync into an error.
          result.scoring = "failed";
          this.logger.warn(`Scoring after the sync failed (${failureReason(error)})`);
        }
        return;
      }
    }
  }
}
