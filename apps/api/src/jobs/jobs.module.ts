import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { LlmModule } from "../llm/llm.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { JobsController } from "./jobs.controller.js";
import { JobsService } from "./jobs.service.js";
import { ScoringService } from "./scoring.service.js";

@Module({
  imports: [PrismaModule, AuthModule, LlmModule],
  controllers: [JobsController],
  providers: [JobsService, ScoringService],
})
export class JobsModule {}
