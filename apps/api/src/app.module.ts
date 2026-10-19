import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module.js";
import { HealthModule } from "./health/health.module.js";
import { JobsModule } from "./jobs/jobs.module.js";

@Module({
  imports: [HealthModule, JobsModule, AuthModule],
})
export class AppModule {}
