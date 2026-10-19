import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service.js";

export interface SafeUser {
  id: string;
  email: string;
  createdAt: Date;
}

export interface AuthResult {
  accessToken: string;
  user: SafeUser;
}

const BCRYPT_COST = 12;

// Compared against when the email is unknown, so login takes about the same
// time whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_COST);

// Never select passwordHash unless the caller really needs it.
const safeUserSelect = { id: true, email: true, createdAt: true } as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string): Promise<SafeUser> {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    try {
      return await this.prisma.user.create({
        data: { email, passwordHash },
        select: safeUserSelect,
      });
    } catch (error) {
      // P2002 = unique constraint violation (email already registered).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Email is already registered");
      }
      throw error;
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !passwordMatches) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const accessToken = await this.jwtService.signAsync({ sub: user.id });
    return {
      accessToken,
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
    };
  }

  async findSafeUserById(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({ where: { id }, select: safeUserSelect });
  }
}
