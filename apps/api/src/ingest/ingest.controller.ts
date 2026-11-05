import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { GmailSender, GmailSendersView, SyncResult } from "@career-agent/types";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard.js";
import { parseSenderValue } from "./senders.js";
import { SendersService } from "./senders.service.js";
import { SyncService } from "./sync.service.js";

// The sender is an address or a domain the user typed. Error messages name the problem,
// never the value.
export function parseSenderInput(body: unknown): string {
  if (typeof body !== "object" || body === null) {
    throw new BadRequestException("Request body must be a JSON object");
  }
  const parsed = parseSenderValue((body as Record<string, unknown>).value);
  if (!parsed.ok) {
    throw new BadRequestException([parsed.error]);
  }
  return parsed.value;
}

@Controller("gmail")
@UseGuards(JwtAuthGuard)
export class IngestController {
  constructor(
    private readonly syncService: SyncService,
    private readonly sendersService: SendersService,
  ) {}

  @Post("sync")
  @HttpCode(200)
  sync(@Req() request: AuthenticatedRequest): Promise<SyncResult> {
    return this.syncService.sync(request.user.id);
  }

  @Get("senders")
  listSenders(@Req() request: AuthenticatedRequest): Promise<GmailSendersView> {
    return this.sendersService.list(request.user.id);
  }

  @Post("senders")
  addSender(@Body() body: unknown, @Req() request: AuthenticatedRequest): Promise<GmailSender> {
    return this.sendersService.add(request.user.id, parseSenderInput(body));
  }

  @Delete("senders/:id")
  @HttpCode(204)
  removeSender(@Param("id") id: string, @Req() request: AuthenticatedRequest): Promise<void> {
    return this.sendersService.remove(request.user.id, id);
  }
}
