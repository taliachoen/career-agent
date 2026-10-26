import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { AuthService, type AuthResult, type SafeUser } from "./auth.service.js";
import { JwtAuthGuard, type AuthenticatedRequest } from "./jwt-auth.guard.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
// bcrypt only uses the first 72 bytes of a password.
const MAX_PASSWORD_BYTES = 72;

interface Credentials {
  email: string;
  password: string;
}

function parseCredentials(
  body: unknown,
  { strictPassword }: { strictPassword: boolean },
): Credentials {
  if (typeof body !== "object" || body === null) {
    throw new BadRequestException("Request body must be a JSON object");
  }
  const { email, password } = body as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
    errors.push("email must be a valid email address");
  }
  if (typeof password !== "string" || password === "") {
    errors.push("password must be a non-empty string");
  } else if (strictPassword) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.push(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
      errors.push(`password must be at most ${MAX_PASSWORD_BYTES} bytes`);
    }
  }

  if (errors.length > 0) {
    throw new BadRequestException(errors);
  }
  return {
    email: (email as string).trim().toLowerCase(),
    password: password as string,
  };
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() body: unknown): Promise<SafeUser> {
    const { email, password } = parseCredentials(body, { strictPassword: true });
    return this.authService.register(email, password);
  }

  @Post("login")
  @HttpCode(200)
  login(@Body() body: unknown): Promise<AuthResult> {
    const { email, password } = parseCredentials(body, { strictPassword: false });
    return this.authService.login(email, password);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Req() request: AuthenticatedRequest): Promise<SafeUser> {
    const user = await this.authService.findSafeUserById(request.user.id);
    if (!user) {
      // Valid token but the account no longer exists.
      throw new UnauthorizedException("Invalid or expired token");
    }
    return user;
  }
}
