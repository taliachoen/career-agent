import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard.js";
import {
  JOB_FIELD_MAX_LENGTHS,
  type CreateJobInput,
  type JobView,
  type ScoreRunResult,
} from "./job.js";
import { JobsService } from "./jobs.service.js";
import { ScoringService } from "./scoring.service.js";

const REQUIRED_FIELDS = ["title", "company", "description", "url"] as const;

// Must be parseable, because the posting's site is derived from the url.
function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function parseCreateJobInput(body: unknown): CreateJobInput {
  if (typeof body !== "object" || body === null) {
    throw new BadRequestException("Request body must be a JSON object");
  }
  const raw = body as Record<string, unknown>;
  const errors: string[] = [];
  const input = {} as CreateJobInput;

  for (const field of REQUIRED_FIELDS) {
    const value = raw[field];
    if (typeof value !== "string" || value.trim() === "") {
      errors.push(`${field} must be a non-empty string`);
    } else if (value.trim().length > JOB_FIELD_MAX_LENGTHS[field]) {
      // The message names the field and the limit, never the value.
      errors.push(`${field} must be at most ${JOB_FIELD_MAX_LENGTHS[field]} characters`);
    } else {
      input[field] = value.trim();
    }
  }

  if (input.url && !isHttpUrl(input.url)) {
    errors.push("url must be an http(s) URL");
  }

  if (errors.length > 0) {
    throw new BadRequestException(errors);
  }
  return input;
}

@Controller("jobs")
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly scoringService: ScoringService,
  ) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest): Promise<JobView[]> {
    return this.jobsService.findAllForUser(request.user.id);
  }

  // Scores up to 10 of the user's jobs that have no score or a stale one. No body.
  // Declared before the ":id" routes so "score" is never taken for a job id.
  @Post("score")
  @HttpCode(200)
  score(@Req() request: AuthenticatedRequest): Promise<ScoreRunResult> {
    return this.scoringService.scorePending(request.user.id);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Req() request: AuthenticatedRequest): Promise<JobView> {
    return this.jobsService.findOneForUser(id, request.user.id);
  }

  @Post()
  create(@Body() body: unknown, @Req() request: AuthenticatedRequest): Promise<JobView> {
    return this.jobsService.create(parseCreateJobInput(body), request.user.id);
  }
}
