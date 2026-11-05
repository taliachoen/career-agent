import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { GmailModule } from "../gmail/gmail.module.js";
import { JobsModule } from "../jobs/jobs.module.js";
import { LlmModule } from "../llm/llm.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { IngestController } from "./ingest.controller.js";
import { SendersService } from "./senders.service.js";
import { SyncService } from "./sync.service.js";

@Module({
  imports: [PrismaModule, AuthModule, GmailModule, JobsModule, LlmModule],
  controllers: [IngestController],
  providers: [SyncService, SendersService],
})
export class IngestModule {}
