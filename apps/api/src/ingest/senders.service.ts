import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { GmailSender, GmailSendersView } from "@career-agent/types";
import { PrismaService } from "../prisma/prisma.service.js";
import { DEFAULT_SENDERS } from "./default-senders.js";
import { MAX_USER_SENDERS } from "./senders.js";

// Prisma's error code for a violated unique constraint.
const UNIQUE_VIOLATION = "P2002";

// Never expose userId; a sender is addressed by its id and the logged-in user together.
const SELECT = { id: true, value: true } as const;

@Injectable()
export class SendersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<GmailSendersView> {
    const mine = await this.prisma.gmailSender.findMany({
      where: { userId },
      select: SELECT,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return { defaults: [...DEFAULT_SENDERS], mine };
  }

  // Every address or domain this user's mail may come from: the built-in list and their own.
  async allowedEntries(userId: string): Promise<string[]> {
    const mine = await this.prisma.gmailSender.findMany({
      where: { userId },
      select: { value: true },
    });
    return [...DEFAULT_SENDERS, ...mine.map((sender) => sender.value)];
  }

  async add(userId: string, value: string): Promise<GmailSender> {
    if (DEFAULT_SENDERS.includes(value)) {
      throw new ConflictException("This sender is already in the built-in list");
    }
    const count = await this.prisma.gmailSender.count({ where: { userId } });
    if (count >= MAX_USER_SENDERS) {
      throw new BadRequestException(`You can add at most ${MAX_USER_SENDERS} senders`);
    }
    try {
      return await this.prisma.gmailSender.create({
        data: { userId, value },
        select: SELECT,
      });
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException("This sender is already in your list");
      }
      throw error;
    }
  }

  // Another user's sender is simply "not found".
  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.gmailSender.deleteMany({ where: { id, userId } });
    if (count === 0) {
      throw new NotFoundException(`Sender ${id} not found`);
    }
  }
}
