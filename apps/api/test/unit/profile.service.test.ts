import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaService } from "../../src/prisma/prisma.service.js";
import { ProfileService } from "../../src/profile/profile.service.js";

const saved = { cvText: "cv", lookingFor: "junior", updatedAt: new Date("2026-01-01T00:00:00Z") };

function setup(options: { found?: typeof saved | null } = {}) {
  const calls: { method: string; args: any }[] = [];
  const prisma = {
    profile: {
      findUnique: async (args: unknown) => (
        calls.push({ method: "findUnique", args }),
        options.found ?? null
      ),
      upsert: async (args: unknown) => (calls.push({ method: "upsert", args }), saved),
    },
  } as unknown as PrismaService;
  return { service: new ProfileService(prisma), calls };
}

describe("ProfileService", () => {
  it("get looks up by the user id and selects only the public fields", async () => {
    const { service, calls } = setup({ found: saved });
    assert.deepEqual(await service.get("user-1"), saved);
    assert.deepEqual(calls[0].args.where, { userId: "user-1" });
    assert.deepEqual(calls[0].args.select, { cvText: true, lookingFor: true, updatedAt: true });
  });

  it("get returns an empty profile with updatedAt null when none exists", async () => {
    const { service } = setup();
    assert.deepEqual(await service.get("user-1"), { cvText: "", lookingFor: "", updatedAt: null });
  });

  it("put upserts by the user id and replaces both fields", async () => {
    const { service, calls } = setup();
    await service.put("user-1", { cvText: "new cv", lookingFor: "" });
    const { where, create, update } = calls[0].args;
    assert.deepEqual(where, { userId: "user-1" });
    assert.deepEqual(create, { userId: "user-1", cvText: "new cv", lookingFor: "" });
    assert.deepEqual(update, { cvText: "new cv", lookingFor: "" });
  });
});
