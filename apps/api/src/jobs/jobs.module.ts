import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { JobsController } from "./jobs.controller.js";
import { JobsService } from "./jobs.service.js";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
