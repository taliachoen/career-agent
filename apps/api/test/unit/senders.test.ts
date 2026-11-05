import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SENDERS } from "../../src/ingest/default-senders.js";
import {
  buildGmailQuery,
  parseFromHeader,
  parseSenderValue,
  senderAllowed,
} from "../../src/ingest/senders.js";

describe("parseSenderValue", () => {
  it("accepts an address or a domain, trimmed and lowercased", () => {
    assert.deepEqual(parseSenderValue("  TheNextJob23@Gmail.com "), {
      ok: true,
      value: "thenextjob23@gmail.com",
    });
    assert.deepEqual(parseSenderValue("Jobs2Web.com"), { ok: true, value: "jobs2web.com" });
    assert.deepEqual(parseSenderValue("mail.jobs.co.il"), { ok: true, value: "mail.jobs.co.il" });
  });

  it("does not allow a whole general mail provider, only a full address on it", () => {
    for (const domain of [
      "gmail.com",
      "Outlook.com",
      "yahoo.com",
      "mail.yahoo.com",
      "walla.co.il",
    ]) {
      assert.equal(parseSenderValue(domain).ok, false, domain);
    }
    assert.equal(parseSenderValue("someone@gmail.com").ok, true);
    assert.equal(parseSenderValue("someone@outlook.com").ok, true);
  });

  it("rejects anything that could change a Gmail search or is not an address or domain", () => {
    const bad = [
      "",
      "   ",
      "a b.com",
      "x.com OR from:y.com",
      "x.com)",
      "(x.com",
      "-x.com",
      "in:anywhere",
      "from:x.com",
      'x.com"',
      "nodot",
      "a@b",
      "a@@b.com",
      "@b.com",
      "a@b.com extra",
      ".com",
      "a..com",
      "-a.com",
      "a-.com",
      "*.x.com",
      "-x@y.com",
      "-x@gmail.com",
    ];
    for (const value of bad) {
      assert.equal(parseSenderValue(value).ok, false, JSON.stringify(value));
    }
    for (const value of [undefined, null, 5, {}, ["a.com"]]) {
      assert.equal(parseSenderValue(value).ok, false);
    }
  });

  it("rejects an over-long value, and its error does not repeat the value", () => {
    const result = parseSenderValue(`${"a".repeat(260)}.com`);
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result).includes("aaaa"), false);
    const secret = parseSenderValue("SECRET-VALUE!!");
    assert.equal(JSON.stringify(secret).toLowerCase().includes("secret"), false);
  });
});

describe("parseFromHeader", () => {
  it("reads the address from a header with a name, or a bare address", () => {
    assert.deepEqual(parseFromHeader("LinkedIn Job Alerts <JobAlerts-NoReply@LinkedIn.com>"), {
      address: "jobalerts-noreply@linkedin.com",
      domain: "linkedin.com",
    });
    assert.deepEqual(parseFromHeader("noreply@alljob.co.il"), {
      address: "noreply@alljob.co.il",
      domain: "alljob.co.il",
    });
    assert.equal(
      parseFromHeader("דרושים <alerts@mail.drushim.co.il>")?.domain,
      "mail.drushim.co.il",
    );
  });

  it("a display name that looks like an address does not count; the real address is the last one", () => {
    assert.equal(
      parseFromHeader('"jobs <jobs@drushim.co.il>" <someone@evil.com>')?.address,
      "someone@evil.com",
    );
    assert.equal(
      parseFromHeader('"Acme \\"Jobs\\" <hr@drushim.co.il>" <x@evil.com>')?.address,
      "x@evil.com",
    );
    assert.equal(parseFromHeader('"jobs@drushim.co.il"')?.address ?? null, null);
    assert.equal(parseFromHeader("<a@one.com> <b@two.com>")?.address, "b@two.com");
  });

  it("returns null when there is no usable address", () => {
    for (const header of [
      "",
      "Someone",
      "<>",
      "a@b",
      "Name <not an address>",
      "x@y.com, z@w.com",
    ]) {
      assert.equal(parseFromHeader(header), null, JSON.stringify(header));
    }
  });
});

describe("senderAllowed", () => {
  const from = (address: string) => parseFromHeader(address)!;

  it("a domain entry matches the domain and its subdomains, never a lookalike", () => {
    const entries = ["drushim.co.il"];
    assert.equal(senderAllowed(from("a@drushim.co.il"), entries), true);
    assert.equal(senderAllowed(from("a@mail.drushim.co.il"), entries), true);
    assert.equal(senderAllowed(from("a@evildrushim.co.il"), entries), false);
    assert.equal(senderAllowed(from("a@drushim.co.il.evil.com"), entries), false);
    assert.equal(senderAllowed(from("a@co.il"), entries), false);
  });

  it("an address entry matches only that exact address", () => {
    const entries = ["jobalerts-noreply@linkedin.com"];
    assert.equal(senderAllowed(from("jobalerts-noreply@linkedin.com"), entries), true);
    assert.equal(senderAllowed(from("messages-noreply@linkedin.com"), entries), false);
    assert.equal(senderAllowed(from("x.jobalerts-noreply@linkedin.com"), entries), false);
  });

  it("the built-in list reads LinkedIn alerts but not personal LinkedIn mail, and not Indeed", () => {
    assert.equal(senderAllowed(from("jobalerts-noreply@linkedin.com"), DEFAULT_SENDERS), true);
    assert.equal(senderAllowed(from("jobs-noreply@linkedin.com"), DEFAULT_SENDERS), true);
    assert.equal(senderAllowed(from("messages-noreply@linkedin.com"), DEFAULT_SENDERS), false);
    assert.equal(senderAllowed(from("indeedapply@indeed.com"), DEFAULT_SENDERS), false);
    assert.equal(senderAllowed(from("noreply@alljob.co.il"), DEFAULT_SENDERS), true);
    assert.equal(senderAllowed(from("noreply@alljobs.co.il"), DEFAULT_SENDERS), true);
  });
});

describe("buildGmailQuery", () => {
  it("asks for unread mail from the last N days from any allowed sender", () => {
    assert.equal(
      buildGmailQuery(["alljob.co.il", "jobalerts-noreply@linkedin.com"], 14),
      "is:unread newer_than:14d (from:alljob.co.il OR from:jobalerts-noreply@linkedin.com)",
    );
  });

  it("leaves out an entry that is not a plain address or domain, and refuses an empty search", () => {
    const query = buildGmailQuery(["ok.com", "x.com) OR (in:anywhere", "bad entry"], 14);
    assert.equal(query, "is:unread newer_than:14d (from:ok.com)");
    assert.throws(() => buildGmailQuery(["bad entry"], 14));
    assert.throws(() => buildGmailQuery([], 14));
  });

  it("every built-in sender makes it into the query", () => {
    const query = buildGmailQuery(DEFAULT_SENDERS, 14);
    for (const sender of DEFAULT_SENDERS) {
      assert.ok(query.includes(`from:${sender}`), sender);
    }
  });
});
