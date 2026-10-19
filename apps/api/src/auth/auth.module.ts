import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

const MIN_SECRET_LENGTH = 32;

@Module({
  imports: [
    PrismaModule,
    // Read lazily (not at import time) so the secret is available after .env is loaded.
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || secret.length < MIN_SECRET_LENGTH) {
          throw new Error(`JWT_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters`);
        }
        return {
          secret,
          signOptions: { expiresIn: "1h", algorithm: "HS256" },
          verifyOptions: { algorithms: ["HS256"] },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
