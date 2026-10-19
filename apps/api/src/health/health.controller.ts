import { Controller, Get } from "@nestjs/common";
import type { HealthStatus } from "@career-agent/types";

@Controller("health")
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: "ok", service: "api" };
  }
}
