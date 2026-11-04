import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module.js";
import { GmailModule } from "./gmail/gmail.module.js";
import { HealthModule } from "./health/health.module.js";
import { JobsModule } from "./jobs/jobs.module.js";
import { ProfileModule } from "./profile/profile.module.js";

@Module({
  imports: [HealthModule, JobsModule, ProfileModule, GmailModule, AuthModule],
})
export class AppModule {}
