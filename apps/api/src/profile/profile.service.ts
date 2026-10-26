import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { ProfileInput, ProfileView } from "./profile.js";

// Never expose id or userId; the profile is addressed by the logged-in user only.
const SELECT = { cvText: true, lookingFor: true, updatedAt: true } as const;

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<ProfileView> {
    const profile = await this.prisma.profile.findUnique({ where: { userId }, select: SELECT });
    // No profile yet is a normal state, not an error.
    return profile ?? { cvText: "", lookingFor: "", updatedAt: null };
  }

  // Replaces the whole profile; creates it on first save.
  put(userId: string, input: ProfileInput): Promise<ProfileView> {
    return this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
      select: SELECT,
    });
  }
}
