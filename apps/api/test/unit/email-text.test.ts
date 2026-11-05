import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_EMAIL_CHARS, emailBodyText } from "../../src/ingest/email-text.js";
import { parseGmailMessage } from "../../src/gmail/gmail-message.js";

const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64url");

describe("emailBodyText", () => {
  const longPlain = `Jobs for you\n\nFull Stack Developer\nAcme - Tel Aviv\nhttps://example.com/jobs/1\n${"x".repeat(200)}`;

  it("uses the plain text when it is a real body: long enough and with a link", () => {
    assert.equal(emailBodyText({ text: longPlain, html: "<p>HTML version</p>" }), longPlain.trim());
  });

  it("uses the HTML when the plain text is only a stub or has no link", () => {
    const html = '<a href="https://example.com/jobs/1">Dev</a>';
    assert.equal(
      emailBodyText({ text: "View this email in your browser", html }),
      "Dev (https://example.com/jobs/1)",
    );
    assert.equal(
      emailBodyText({ text: `${"no link here ".repeat(30)}`, html }),
      "Dev (https://example.com/jobs/1)",
    );
  });

  it("falls back to the plain text when there is no HTML, and to empty when there is nothing", () => {
    assert.equal(emailBodyText({ text: "short", html: null }), "short");
    assert.equal(emailBodyText({ text: null, html: "<p>Only html</p>" }), "Only html");
    assert.equal(emailBodyText({ text: null, html: null }), "");
    assert.equal(emailBodyText({ text: "short", html: "<style>x{}</style>" }), "short");
  });

  it("cuts the text to the limit", () => {
    const body = emailBodyText({ text: null, html: `<p>${"a".repeat(MAX_EMAIL_CHARS + 100)}</p>` });
    assert.equal(body.length, MAX_EMAIL_CHARS);
  });

  it("removes NUL characters from plain text", () => {
    assert.equal(emailBodyText({ text: "a\u0000b", html: null }), "ab");
  });
});

describe("parseGmailMessage", () => {
  const headers = [
    { name: "From", value: "Jobs <jobs@example.com>" },
    { name: "Subject", value: "New jobs" },
    { name: "authentication-results", value: "mx.google.com; dkim=pass header.i=@example.com" },
    { name: "Authentication-Results", value: "other.example; dkim=pass header.i=@example.com" },
  ];

  it("reads headers and the plain and HTML bodies of a multipart message", () => {
    const message = parseGmailMessage("m1", {
      payload: {
        mimeType: "multipart/alternative",
        headers,
        body: { size: 0 },
        parts: [
          { mimeType: "text/plain", body: { size: 5, data: b64("plain") } },
          { mimeType: "text/html", body: { size: 7, data: b64("<b>x</b>") } },
        ],
      },
    });
    assert.equal(message.id, "m1");
    assert.equal(message.from, "Jobs <jobs@example.com>");
    assert.equal(message.subject, "New jobs");
    assert.equal(message.authResults.length, 2);
    assert.equal(message.text, "plain");
    assert.equal(message.html, "<b>x</b>");
  });

  it("finds bodies in nested parts and reads a single-part message", () => {
    const nested = parseGmailMessage("m2", {
      payload: {
        mimeType: "multipart/mixed",
        headers,
        parts: [
          {
            mimeType: "multipart/related",
            parts: [{ mimeType: "text/html", body: { size: 4, data: b64("deep") } }],
          },
        ],
      },
    });
    assert.equal(nested.html, "deep");
    assert.equal(nested.text, null);

    const single = parseGmailMessage("m3", {
      payload: { mimeType: "text/plain", headers, body: { size: 6, data: b64("single") } },
    });
    assert.equal(single.text, "single");
  });

  it("ignores attachments, even text ones", () => {
    const message = parseGmailMessage("m4", {
      payload: {
        mimeType: "multipart/mixed",
        headers,
        parts: [
          { mimeType: "text/plain", filename: "notes.txt", body: { size: 4, data: b64("file") } },
          { mimeType: "text/plain", filename: "", body: { size: 4, data: b64("body") } },
        ],
      },
    });
    assert.equal(message.text, "body");
  });

  it("decodes the charset the part declares", () => {
    // "שלום" in windows-1255.
    const bytes = Buffer.from([0xf9, 0xec, 0xe5, 0xed]);
    const message = parseGmailMessage("m5", {
      payload: {
        mimeType: "text/plain",
        headers,
        body: { size: 4, data: bytes.toString("base64url") },
        parts: undefined,
      },
    });
    assert.notEqual(message.text, "שלום");
    const declared = parseGmailMessage("m6", {
      payload: {
        mimeType: "multipart/alternative",
        headers,
        parts: [
          {
            mimeType: "text/plain",
            headers: [{ name: "Content-Type", value: 'text/plain; charset="windows-1255"' }],
            body: { size: 4, data: bytes.toString("base64url") },
          },
        ],
      },
    });
    assert.equal(declared.text, "שלום");
  });

  it("skips an oversized body and falls back to UTF-8 for an unknown charset", () => {
    const big = parseGmailMessage("m7", {
      payload: { mimeType: "text/plain", headers, body: { size: 5_000_000, data: b64("big") } },
    });
    assert.equal(big.text, null);
    const unknown = parseGmailMessage("m8", {
      payload: {
        mimeType: "multipart/alternative",
        parts: [
          {
            mimeType: "text/plain",
            headers: [{ name: "Content-Type", value: "text/plain; charset=not-a-charset" }],
            body: { size: 2, data: b64("ok") },
          },
        ],
      },
    });
    assert.equal(unknown.text, "ok");
  });

  it("returns empty values for a message with nothing usable, and never throws", () => {
    for (const data of [
      null,
      undefined,
      {},
      { payload: null },
      { payload: { headers: "x", parts: 5 } },
      "text",
    ]) {
      const message = parseGmailMessage("m9", data);
      assert.deepEqual(
        {
          from: message.from,
          subject: message.subject,
          text: message.text,
          html: message.html,
          auth: message.authResults,
        },
        { from: "", subject: "", text: null, html: null, auth: [] },
      );
    }
  });
});
