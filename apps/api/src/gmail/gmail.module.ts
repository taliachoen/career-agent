import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { FakeGmailProvider } from "./fake.provider.js";
import { GMAIL_PROVIDER, type GmailProvider } from "./gmail-provider.js";
import { GmailController } from "./gmail.controller.js";
import { GmailService } from "./gmail.service.js";
import { GoogleGmailProvider } from "./google.provider.js";

// Fails at startup on a bad GMAIL_PROVIDER. Missing Google settings are not an error here:
// the server must still start, and only connecting answers 503.
export function createGmailProvider(env: NodeJS.ProcessEnv = process.env): GmailProvider {
  const name = (env.GMAIL_PROVIDER ?? "google").trim().toLowerCase();
  const redirectUri = env.GOOGLE_REDIRECT_URI?.trim() || undefined;
  if (name === "fake") {
    if (env.NODE_ENV === "production") {
      throw new Error("GMAIL_PROVIDER=fake is not allowed when NODE_ENV=production");
    }
    return new FakeGmailProvider(
      redirectUri ?? `http://localhost:${env.PORT ?? 3001}/gmail/oauth/callback`,
    );
  }
  if (name === "google") {
    return new GoogleGmailProvider({
      clientId: env.GOOGLE_CLIENT_ID?.trim() || undefined,
      clientSecret: env.GOOGLE_CLIENT_SECRET?.trim() || undefined,
      redirectUri,
    });
  }
  throw new Error(`GMAIL_PROVIDER must be "google" or "fake", got "${name}"`);
}

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [GmailController],
  providers: [GmailService, { provide: GMAIL_PROVIDER, useFactory: () => createGmailProvider() }],
  exports: [GmailService],
})
export class GmailModule {}
