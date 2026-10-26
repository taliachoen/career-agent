import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../src/auth/jwt-auth.guard.js";

function contextFor(request: object): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

function guardWith(verify: (token: string) => Promise<{ sub: string }>) {
  return new JwtAuthGuard({ verifyAsync: verify } as unknown as JwtService);
}

describe("JwtAuthGuard", () => {
  it("rejects a request without an Authorization header", async () => {
    const guard = guardWith(async () => ({ sub: "user-1" }));
    await assert.rejects(
      () => guard.canActivate(contextFor({ headers: {} })),
      UnauthorizedException,
    );
  });

  it("rejects a non-Bearer scheme", async () => {
    const guard = guardWith(async () => ({ sub: "user-1" }));
    const request = { headers: { authorization: "Basic abc" } };
    await assert.rejects(() => guard.canActivate(contextFor(request)), UnauthorizedException);
  });

  it("rejects a token that fails verification", async () => {
    const guard = guardWith(async () => {
      throw new Error("jwt expired");
    });
    const request = { headers: { authorization: "Bearer abc" } };
    await assert.rejects(() => guard.canActivate(contextFor(request)), UnauthorizedException);
  });

  it("accepts a valid token and exposes the user id as request.user.id", async () => {
    const guard = guardWith(async () => ({ sub: "user-1" }));
    const request: { headers: { authorization: string }; user?: { id: string } } = {
      headers: { authorization: "Bearer abc" },
    };
    assert.equal(await guard.canActivate(contextFor(request)), true);
    assert.deepEqual(request.user, { id: "user-1" });
  });
});
