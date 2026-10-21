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

export async function startTestApp(): Promise<TestApp> {
  const app = await NestFactory.create(AppModule, { logger: false });
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
