import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard.js";
import type { CreateJobInput, Job } from "./job.js";
import { JobsService } from "./jobs.service.js";

const REQUIRED_FIELDS = ["title", "company", "description", "url"] as const;

function parseCreateJobInput(body: unknown): CreateJobInput {
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
    } else {
      input[field] = value.trim();
    }
  }

  if (input.url && !/^https?:\/\//i.test(input.url)) {
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
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest): Promise<Job[]> {
    return this.jobsService.findAllForUser(request.user.id);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Req() request: AuthenticatedRequest): Promise<Job> {
    return this.jobsService.findOneForUser(id, request.user.id);
  }

  @Post()
  create(@Body() body: unknown, @Req() request: AuthenticatedRequest): Promise<Job> {
    return this.jobsService.create(parseCreateJobInput(body), request.user.id);
  }
}
