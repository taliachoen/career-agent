import { BadRequestException, Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard.js";
import {
  CV_MAX_LENGTH,
  CV_MIN_LENGTH,
  LOOKING_FOR_MAX_LENGTH,
  type ProfileInput,
  type ProfileView,
} from "./profile.js";
import { ProfileService } from "./profile.service.js";

// The CV is personal data: error messages name the field and the limit, never the value.
export function parseProfileInput(body: unknown): ProfileInput {
  if (typeof body !== "object" || body === null) {
    throw new BadRequestException("Request body must be a JSON object");
  }
  const raw = body as Record<string, unknown>;
  const errors: string[] = [];

  let cvText = "";
  if (typeof raw.cvText !== "string" || raw.cvText.trim() === "") {
    errors.push("cvText must be a non-empty string");
  } else {
    cvText = raw.cvText.trim();
    if (cvText.length < CV_MIN_LENGTH) {
      errors.push(`cvText must be at least ${CV_MIN_LENGTH} characters`);
    } else if (cvText.length > CV_MAX_LENGTH) {
      errors.push(`cvText must be at most ${CV_MAX_LENGTH} characters`);
    }
  }

  // Optional: missing or null means "nothing specified".
  let lookingFor = "";
  if (raw.lookingFor !== undefined && raw.lookingFor !== null) {
    if (typeof raw.lookingFor !== "string") {
      errors.push("lookingFor must be a string");
    } else {
      lookingFor = raw.lookingFor.trim();
      if (lookingFor.length > LOOKING_FOR_MAX_LENGTH) {
        errors.push(`lookingFor must be at most ${LOOKING_FOR_MAX_LENGTH} characters`);
      }
    }
  }

  // Postgres cannot store NUL in text. Rejecting it here avoids a database error (a 500
  // whose logged details could contain the CV).
  if (cvText.includes("\u0000") || lookingFor.includes("\u0000")) {
    errors.push("text fields must not contain null characters");
  }

  if (errors.length > 0) {
    throw new BadRequestException(errors);
  }
  return { cvText, lookingFor };
}

@Controller("profile")
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  get(@Req() request: AuthenticatedRequest): Promise<ProfileView> {
    return this.profileService.get(request.user.id);
  }

  @Put()
  put(@Body() body: unknown, @Req() request: AuthenticatedRequest): Promise<ProfileView> {
    return this.profileService.put(request.user.id, parseProfileInput(body));
  }
}
