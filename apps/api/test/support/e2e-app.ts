import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../../src/app.module.js";

export const PASSWORD = "correct-horse-battery";
// 32 bytes, base64. Test only.
export const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

export interface TestApp {
  prisma: PrismaClient;
  /** Calls the API and returns the HTTP status plus parsed JSON body. */
  request: (
    method: string,
    path: string,
    options?: { body?: unknown; token?: string },
  ) => Promise<{ status: number; body: any; location: string | null }>;
  /** Registers a user with a unique email, logs in, and tracks it for cleanup. */
  createUser: () => Promise<{ id: string; email: string; token: string }>;
  /** Deletes only the users (and their jobs, whose postings cascade) created through createUser, then stops the app. */
  close: () => Promise<void>;
}

export interface StartOptions {
  /** Default "fake": tests never reach a real model. "openai" is only for the missing-key case. */
  llmProvider?: "fake" | "openai";
}

export async function startTestApp(options: StartOptions = {}): Promise<TestApp> {
  // The provider is chosen when the app is created. The key is always removed first, so a
  // key in the developer's shell can never make a test call OpenAI.
  const saved = { provider: process.env.LLM_PROVIDER, key: process.env.OPENAI_API_KEY };
  process.env.LLM_PROVIDER = options.llmProvider ?? "fake";
  delete process.env.OPENAI_API_KEY;
  // Gmail is always the fake, and encryption uses a fixed test key unless .env.test has one.
  process.env.GMAIL_PROVIDER = "fake";
  process.env.TOKEN_ENCRYPTION_KEY ||= TEST_ENCRYPTION_KEY;
  let app;
  try {
    app = await NestFactory.create(AppModule, { logger: false });
  } finally {
    if (saved.provider === undefined) delete process.env.LLM_PROVIDER;
    else process.env.LLM_PROVIDER = saved.provider;
    if (saved.key !== undefined) process.env.OPENAI_API_KEY = saved.key;
  }
  await app.listen(0, "127.0.0.1");
  const baseUrl = await app.getUrl();
  const prisma = new PrismaClient();
  const createdUserIds: string[] = [];

  const request: TestApp["request"] = async (method, path, options = {}) => {
    const response = await fetch(baseUrl + path, {
      method,
      // Redirects (the Gmail callback) are inspected, not followed.
      redirect: "manual",
      headers: {
        ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const text = await response.text();
    const isJson = response.headers.get("content-type")?.includes("application/json");
    return {
      status: response.status,
      body: text && isJson ? JSON.parse(text) : null,
      location: response.headers.get("location"),
    };
  };

  return {
    prisma,
    request,
    async createUser() {
      const email = `test-${randomUUID()}@example.com`;
      const registered = await request("POST", "/auth/register", {
        body: { email, password: PASSWORD },
      });
      createdUserIds.push(registered.body.id);
      const login = await request("POST", "/auth/login", {
        body: { email, password: PASSWORD },
      });
      return { id: registered.body.id, email, token: login.body.accessToken };
    },
    async close() {
      await prisma.job.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.$disconnect();
      await app.close();
    },
  };
}

/** Connects the user's Gmail through the real OAuth endpoints, with the fake Google. */
export async function connectGmail(app: TestApp, user: { token: string }): Promise<void> {
  const started = await app.request("POST", "/gmail/connect", { token: user.token });
  const state = new URL(started.body.authUrl).searchParams.get("state")!;
  const done = await app.request(
    "GET",
    `/gmail/oauth/callback?${new URLSearchParams({ code: "fake-ok", state })}`,
  );
  if (!done.location?.endsWith("/profile?gmail=connected")) {
    throw new Error("Could not connect Gmail in the test");
  }
}

/** A CV long enough to pass validation, so scoring can run. */
export const TEST_PROFILE = { cvText: "Full Stack developer with TypeScript, React and NestJS. ".repeat(8), lookingFor: "Full Stack, center" };
