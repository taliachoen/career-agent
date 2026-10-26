import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AuthService } from "../../src/auth/auth.service.js";
import type { PrismaService } from "../../src/prisma/prisma.service.js";

const createdAt = new Date("2026-01-01T00:00:00Z");

function setup(user: Record<string, unknown> | null = null) {
  const created: any[] = [];
  let createError: unknown;
  const prisma = {
    user: {
      create: async (args: { data: Record<string, unknown> }) => {
        if (createError) throw createError;
        created.push(args.data);
        return { id: "user-1", email: args.data.email, createdAt };
      },
      findUnique: async () => user,
    },
  } as unknown as PrismaService;
  const jwt = { signAsync: async () => "signed-token" } as unknown as JwtService;
  return {
    service: new AuthService(prisma, jwt),
    created,
    failCreateWith: (error: unknown) => (createError = error),
  };
}

describe("AuthService", () => {
  it("register stores a bcrypt hash, never the plaintext password", async () => {
    const { service, created } = setup();
    const user = await service.register("a@example.com", "plain-password-123");
    assert.notEqual(created[0].passwordHash, "plain-password-123");
    assert.ok(await bcrypt.compare("plain-password-123", created[0].passwordHash));
    assert.deepEqual(Object.keys(user).sort(), ["createdAt", "email", "id"]);
  });

  it("register maps a unique-constraint violation to ConflictException", async () => {
    const { service, failCreateWith } = setup();
    failCreateWith(
      new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" }),
    );
    await assert.rejects(
      () => service.register("a@example.com", "plain-password-123"),
      ConflictException,
    );
  });

  it("register does not swallow unexpected database errors", async () => {
    const { service, failCreateWith } = setup();
    failCreateWith(new Error("connection lost"));
    await assert.rejects(
      () => service.register("a@example.com", "plain-password-123"),
      /connection lost/,
    );
  });

  it("login rejects an unknown email with UnauthorizedException", async () => {
    const { service } = setup(null);
    await assert.rejects(
      () => service.login("nobody@example.com", "whatever"),
      UnauthorizedException,
    );
  });

  it("login rejects a wrong password with UnauthorizedException", async () => {
    const passwordHash = await bcrypt.hash("right-password", 4);
    const { service } = setup({ id: "user-1", email: "a@example.com", passwordHash, createdAt });
    await assert.rejects(
      () => service.login("a@example.com", "wrong-password"),
      UnauthorizedException,
    );
  });

  it("login returns a token and a user without passwordHash", async () => {
    const passwordHash = await bcrypt.hash("right-password", 4);
    const { service } = setup({ id: "user-1", email: "a@example.com", passwordHash, createdAt });
    const result = await service.login("a@example.com", "right-password");
    assert.equal(result.accessToken, "signed-token");
    assert.deepEqual(result.user, { id: "user-1", email: "a@example.com", createdAt });
  });
});
