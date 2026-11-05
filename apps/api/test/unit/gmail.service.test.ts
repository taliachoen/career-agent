import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { BadGatewayException, BadRequestException, NotFoundException } from "@nestjs/common";
import {
  GMAIL_READONLY_SCOPE,
  GmailProviderError,
  type GmailProvider,
} from "../../src/gmail/gmail-provider.js";
import { GmailService, hasExactlyReadonlyScope } from "../../src/gmail/gmail.service.js";
import { encryptToken } from "../../src/gmail/token-crypto.js";
import type { PrismaService } from "../../src/prisma/prisma.service.js";

const key = randomBytes(32);
process.env.TOKEN_ENCRYPTION_KEY = key.toString("base64");

interface Row {
  status: "PENDING" | "CONNECTED" | "NEEDS_RECONNECT";
  googleEmail: string | null;
  encryptedRefreshToken: string | null;
  scope: string | null;
  lastVerifiedAt: Date | null;
}

// A one-row stand-in for the gmailConnection table, keyed by userId.
function setup(initial: Row | null, provider: Partial<GmailProvider>) {
  let row = initial;
  const calls: { method: string; args: any }[] = [];
  const prisma = {
    gmailConnection: {
      findUnique: async (args: any) => (calls.push({ method: "findUnique", args }), row),
      update: async (args: any) => (
        calls.push({ method: "update", args }),
        (row = { ...row!, ...args.data })
      ),
      updateMany: async (args: any) => {
        calls.push({ method: "updateMany", args });
        const expected = args.where.encryptedRefreshToken;
        if (expected !== undefined && row?.encryptedRefreshToken !== expected) {
          return { count: 0 };
        }
        row = { ...row!, ...args.data };
        return { count: 1 };
      },
      deleteMany: async (args: any) => (
        calls.push({ method: "deleteMany", args }),
        (row = null),
        { count: 1 }
      ),
    },
  } as unknown as PrismaService;
  const service = new GmailService(prisma, { checkReady() {}, ...provider } as GmailProvider);
  return { service, calls, row: () => row, setRow: (next: Row | null) => (row = next) };
}

function connected(userId: string, overrides: Partial<Row> = {}): Row {
  return {
    status: "CONNECTED",
    googleEmail: "me@example.com",
    encryptedRefreshToken: encryptToken("1//refresh", userId, key),
    scope: GMAIL_READONLY_SCOPE,
    lastVerifiedAt: new Date(),
    ...overrides,
  };
}

describe("hasExactlyReadonlyScope", () => {
  it("accepts only gmail.readonly", () => {
    assert.equal(hasExactlyReadonlyScope([GMAIL_READONLY_SCOPE]), true);
    assert.equal(hasExactlyReadonlyScope([GMAIL_READONLY_SCOPE, GMAIL_READONLY_SCOPE]), true);
  });

  it("rejects extra, different or no scopes", () => {
    assert.equal(hasExactlyReadonlyScope([]), false);
    assert.equal(hasExactlyReadonlyScope(["https://www.googleapis.com/auth/gmail.modify"]), false);
    assert.equal(hasExactlyReadonlyScope([GMAIL_READONLY_SCOPE, "openid"]), false);
    assert.equal(hasExactlyReadonlyScope([GMAIL_READONLY_SCOPE + "x"]), false);
  });
});

describe("GmailService", () => {
  it("getStatus has no row -> not connected, and never calls Google", async () => {
    const { service } = setup(null, {});
    assert.deepEqual(await service.getStatus("user-1"), { state: "not_connected", email: null });
  });

  it("getStatus returns only the state and the e-mail, no token field", async () => {
    const { service } = setup(connected("user-1"), {});
    const status = await service.getStatus("user-1");
    assert.deepEqual(status, { state: "connected", email: "me@example.com" });
  });

  it("getStatus treats a pending attempt as not connected", async () => {
    const { service } = setup(
      {
        status: "PENDING",
        googleEmail: null,
        encryptedRefreshToken: null,
        scope: null,
        lastVerifiedAt: null,
      },
      {},
    );
    assert.deepEqual(await service.getStatus("user-1"), { state: "not_connected", email: null });
  });

  it("verifies a stale connection and remembers the time", async () => {
    let refreshed = 0;
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const { service, row } = setup(connected("user-1", { lastVerifiedAt: old }), {
      refreshAccessToken: async (token) => (
        assert.equal(token, "1//refresh"),
        refreshed++,
        "access"
      ),
    });
    assert.equal((await service.getStatus("user-1")).state, "connected");
    assert.equal(refreshed, 1);
    assert.ok(row()!.lastVerifiedAt!.getTime() > old.getTime());
  });

  it("does not call Google for a recently verified connection", async () => {
    const { service } = setup(connected("user-1"), {
      refreshAccessToken: async () => assert.fail("should not refresh"),
    });
    assert.equal((await service.getStatus("user-1")).state, "connected");
  });

  it("an invalid_grant marks the connection as needing reconnect and deletes the token", async () => {
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const { service, row } = setup(connected("user-1", { lastVerifiedAt: old }), {
      refreshAccessToken: async () => {
        throw new GmailProviderError("invalid_grant");
      },
    });
    assert.deepEqual(await service.getStatus("user-1"), {
      state: "needs_reconnect",
      email: "me@example.com",
    });
    assert.equal(row()!.encryptedRefreshToken, null);
    assert.equal(row()!.status, "NEEDS_RECONNECT");
  });

  it("another failure (no network) leaves the connection untouched", async () => {
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const { service, row } = setup(connected("user-1", { lastVerifiedAt: old }), {
      refreshAccessToken: async () => {
        throw new GmailProviderError("request_failed");
      },
    });
    assert.equal((await service.getStatus("user-1")).state, "connected");
    assert.equal(row()!.status, "CONNECTED");
    assert.notEqual(row()!.encryptedRefreshToken, null);
  });

  it("after a failed check Google is not asked again on every status read", async () => {
    let calls = 0;
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const { service } = setup(connected("user-1", { lastVerifiedAt: old }), {
      refreshAccessToken: async () => {
        calls++;
        throw new GmailProviderError("request_failed");
      },
    });
    await service.getStatus("user-1");
    await service.getStatus("user-1");
    await service.getStatus("user-1");
    assert.equal(calls, 1);
  });

  it("a dead token does not wipe a token that was reconnected during the check", async () => {
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const harness = setup(connected("user-1", { lastVerifiedAt: old }), {
      refreshAccessToken: async () => {
        // The user finishes reconnecting while Google is being asked about the old token.
        harness.setRow(
          connected("user-1", { encryptedRefreshToken: encryptToken("1//new", "user-1", key) }),
        );
        throw new GmailProviderError("invalid_grant");
      },
    });
    await harness.service.verifyConnection("user-1");
    assert.equal(harness.row()!.status, "CONNECTED");
    assert.notEqual(harness.row()!.encryptedRefreshToken, null);
  });

  it("disconnect revokes the decrypted token at Google and deletes the row", async () => {
    const revoked: string[] = [];
    const { service, row } = setup(connected("user-1"), {
      revokeToken: async (token) => void revoked.push(token),
    });
    assert.deepEqual(await service.disconnect("user-1"), { revoked: true });
    assert.deepEqual(revoked, ["1//refresh"]);
    assert.equal(row(), null);
  });

  it("disconnect still deletes locally when Google cannot be reached, and says so", async () => {
    const { service, row } = setup(connected("user-1"), {
      revokeToken: async () => {
        throw new GmailProviderError("request_failed");
      },
    });
    assert.deepEqual(await service.disconnect("user-1"), { revoked: false });
    assert.equal(row(), null);
  });

  it("disconnect of an already revoked token counts as revoked", async () => {
    const { service } = setup(connected("user-1"), {
      revokeToken: async () => {
        throw new GmailProviderError("invalid_grant");
      },
    });
    assert.deepEqual(await service.disconnect("user-1"), { revoked: true });
  });

  it("disconnect from needs_reconnect has nothing to revoke", async () => {
    const { service, row } = setup(
      connected("user-1", { status: "NEEDS_RECONNECT", encryptedRefreshToken: null }),
      {
        revokeToken: async () => assert.fail("nothing to revoke"),
      },
    );
    assert.deepEqual(await service.disconnect("user-1"), { revoked: true });
    assert.equal(row(), null);
  });

  it("disconnect without a connection is a 404", async () => {
    const { service } = setup(null, {});
    await assert.rejects(() => service.disconnect("user-1"), NotFoundException);
  });

  it("getAccessToken: not connected and pending are 400s, and Google is not asked", async () => {
    const provider = { refreshAccessToken: async () => assert.fail("should not refresh") };
    for (const row of [
      null,
      {
        status: "PENDING",
        googleEmail: null,
        encryptedRefreshToken: null,
        scope: null,
        lastVerifiedAt: null,
      } as Row,
    ]) {
      const { service } = setup(row, provider);
      await assert.rejects(
        () => service.getAccessToken("user-1"),
        (error: unknown) =>
          error instanceof BadRequestException && /not connected/.test(error.message),
      );
    }
  });

  it("getAccessToken: a connection that needs reconnecting is a clear 400", async () => {
    const { service } = setup(
      connected("user-1", { status: "NEEDS_RECONNECT", encryptedRefreshToken: null }),
      {
        refreshAccessToken: async () => assert.fail("should not refresh"),
      },
    );
    await assert.rejects(
      () => service.getAccessToken("user-1"),
      (error: unknown) => error instanceof BadRequestException && /reconnected/.test(error.message),
    );
  });

  it("getAccessToken: makes an access token from the stored refresh token", async () => {
    const { service } = setup(connected("user-1"), {
      refreshAccessToken: async (token) => (assert.equal(token, "1//refresh"), "access-123"),
    });
    assert.equal(await service.getAccessToken("user-1"), "access-123");
  });

  it("getAccessToken: a dead refresh token marks the connection as needing reconnect", async () => {
    const { service, row } = setup(connected("user-1"), {
      refreshAccessToken: async () => {
        throw new GmailProviderError("invalid_grant");
      },
    });
    await assert.rejects(
      () => service.getAccessToken("user-1"),
      (error: unknown) => error instanceof BadRequestException && /reconnected/.test(error.message),
    );
    assert.equal(row()!.status, "NEEDS_RECONNECT");
    assert.equal(row()!.encryptedRefreshToken, null);
  });

  it("getAccessToken: another failure is a 502 and leaves the connection alone", async () => {
    const { service, row } = setup(connected("user-1"), {
      refreshAccessToken: async () => {
        throw new GmailProviderError("request_failed");
      },
    });
    await assert.rejects(() => service.getAccessToken("user-1"), BadGatewayException);
    assert.equal(row()!.status, "CONNECTED");
    assert.notEqual(row()!.encryptedRefreshToken, null);
  });

  it("looks up every row by the given user id", async () => {
    const { service, calls } = setup(connected("user-9"), { revokeToken: async () => {} });
    await service.getStatus("user-9");
    await service.disconnect("user-9");
    for (const call of calls) {
      assert.equal(call.args.where.userId, "user-9");
    }
  });
});
