import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  Redirect,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { GmailConnectResult, GmailDisconnectResult, GmailStatus } from "@career-agent/types";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard.js";
import { config } from "../config.js";
import { GmailService, type CallbackQuery } from "./gmail.service.js";

const STATE_MAX_LENGTH = 1024;
const CODE_MAX_LENGTH = 2048;
const ERROR_MAX_LENGTH = 128;

// The callback is a browser navigation from Google, so a bad request must end in a redirect
// with a message, not a JSON error page. This therefore returns null instead of throwing.
// Values are only read, never echoed: they are one-time secrets.
export function parseCallbackQuery(query: unknown): CallbackQuery | null {
  if (typeof query !== "object" || query === null) {
    return null;
  }
  const raw = query as Record<string, unknown>;
  const result: CallbackQuery = {};
  for (const [field, maxLength] of [
    ["state", STATE_MAX_LENGTH],
    ["code", CODE_MAX_LENGTH],
    ["error", ERROR_MAX_LENGTH],
  ] as const) {
    const value = raw[field];
    if (value === undefined) {
      continue;
    }
    // Repeated parameters arrive as arrays; those and over-long values are rejected.
    if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
      return null;
    }
    result[field] = value;
  }
  return result;
}

@Controller("gmail")
export class GmailController {
  constructor(private readonly gmailService: GmailService) {}

  @Get("status")
  @UseGuards(JwtAuthGuard)
  status(@Req() request: AuthenticatedRequest): Promise<GmailStatus> {
    return this.gmailService.getStatus(request.user.id);
  }

  @Post("connect")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  connect(@Req() request: AuthenticatedRequest): Promise<GmailConnectResult> {
    return this.gmailService.startConnect(request.user.id);
  }

  @Delete("connection")
  @UseGuards(JwtAuthGuard)
  disconnect(@Req() request: AuthenticatedRequest): Promise<GmailDisconnectResult> {
    return this.gmailService.disconnect(request.user.id);
  }

  // Public on purpose: Google sends the browser here without our bearer token. The user is
  // identified by the signed state alone.
  @Get("oauth/callback")
  @Header("Cache-Control", "no-store")
  @Header("Referrer-Policy", "no-referrer")
  @Redirect()
  async callback(@Query() query: unknown): Promise<{ url: string; statusCode: number }> {
    const outcome = await this.gmailService.handleCallback(parseCallbackQuery(query));
    return { url: `${config.webOrigin}/profile?gmail=${outcome}`, statusCode: 302 };
  }
}
