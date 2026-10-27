import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  LLM_PROVIDER,
  LlmError,
  LlmNotConfiguredError,
  type LlmProvider,
} from "../llm/llm-provider.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { ScoreRunResult } from "./job.js";
import { InvalidScoreError, parseScoreResponse } from "./scoring/parse-score.js";
import { buildScoringRequest } from "./scoring/prompt.js";

// Jobs scored per call, and how many model requests run at the same time.
export const MAX_JOBS_PER_RUN = 10;
const CONCURRENCY = 3;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// What may be logged about a failed job. LlmError and InvalidScoreError messages are written
// to be content-free (a kind, a status, a field name). Any other error (for example a database
// error, whose message can quote data) is reduced to its class name.
function failureReason(error: unknown): string {
  if (error instanceof LlmError || error instanceof InvalidScoreError) {
    return `${error.constructor.name}: ${error.message}`;
  }
  return error instanceof Error ? error.constructor.name : "UnknownError";
}

@Injectable()
export class ScoringService {
  // Privacy: this logger only ever gets numbers. Never a CV, a job text, or an error message
  // from the model or the SDK (they can quote the request).
  private readonly logger = new Logger(ScoringService.name);
  // One run per user at a time. In memory, so it holds for a single API process (see plan.md).
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  async scorePending(userId: string): Promise<ScoreRunResult> {
    // Taken before the profile is read: a profile saved after this moment makes the scores
    // of this run stale, which is correct because they were made from the older profile.
    const startedAt = new Date();

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { cvText: true, lookingFor: true, updatedAt: true },
    });
    if (!profile || profile.cvText.trim() === "") {
      throw new BadRequestException("Save your CV in your profile before scoring jobs");
    }

    try {
      this.llm.checkReady();
    } catch (error) {
      if (error instanceof LlmNotConfiguredError) {
        throw new ServiceUnavailableException("AI scoring is not configured on the server");
      }
      throw error;
    }

    if (this.running.has(userId)) {
      throw new ConflictException("Scoring is already in progress");
    }
    this.running.add(userId);
    try {
      return await this.run(userId, profile, startedAt);
    } finally {
      this.running.delete(userId);
    }
  }

  private async run(
    userId: string,
    profile: { cvText: string; lookingFor: string; updatedAt: Date },
    startedAt: Date,
  ): Promise<ScoreRunResult> {
    // Pending: no score yet, or a score made before the profile was last saved.
    const pending = {
      userId,
      OR: [{ score: { is: null } }, { score: { is: { scoredAt: { lt: profile.updatedAt } } } }],
    };
    const [jobs, pendingTotal] = await Promise.all([
      this.prisma.job.findMany({
        where: pending,
        select: { id: true, title: true, company: true, description: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: MAX_JOBS_PER_RUN,
      }),
      this.prisma.job.count({ where: pending }),
    ]);

    let inputTokens = 0;
    let outputTokens = 0;
    const failures = new Map<string, number>();
    const outcomes = await mapWithConcurrency(jobs, CONCURRENCY, async (job) => {
      try {
        const completion = await this.llm.completeJson(buildScoringRequest(profile, job));
        inputTokens += completion.inputTokens;
        outputTokens += completion.outputTokens;
        // Throws on an unusable answer: that job fails, nothing is saved for it.
        const result = parseScoreResponse(completion.text);
        const data = { ...result, model: completion.model, scoredAt: startedAt };
        await this.prisma.jobScore.upsert({
          where: { jobId: job.id },
          create: { jobId: job.id, userId, ...data },
          update: data,
        });
        return true;
      } catch (error) {
        // The job stays pending. Only the reason is counted, see failureReason.
        const reason = failureReason(error);
        failures.set(reason, (failures.get(reason) ?? 0) + 1);
        return false;
      }
    });

    const scored = outcomes.filter(Boolean).length;
    const failed = outcomes.length - scored;
    const reasons = [...failures].map(([reason, count]) => `${count}x ${reason}`).join("; ");
    this.logger.log(
      `Scoring run: ${jobs.length} jobs, ${scored} scored, ${failed} failed` +
        `${reasons ? ` (${reasons})` : ""}, ` +
        `${inputTokens} input tokens, ${outputTokens} output tokens`,
    );
    return { scored, failed, remaining: pendingTotal - scored };
  }
}
