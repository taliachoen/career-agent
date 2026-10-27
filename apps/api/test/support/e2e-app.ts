import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../../src/app.module.js";

export const PASSWORD = "correct-horse-battery";

export interface TestApp {
  prisma: PrismaClient;
  /** Calls the API and returns the HTTP status plus parsed JSON body. */
  request: (
    method: string,
    path: string,
    options?: { body?: unknown; token?: string },
  ) => Promise<{ status: number; body: any }>;
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
      headers: {
        ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
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
