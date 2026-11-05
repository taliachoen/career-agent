import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dkimPassDomains, isDkimAligned } from "../../src/ingest/dkim.js";

const gmail = (body: string) => `mx.google.com; ${body}`;

describe("dkimPassDomains", () => {
  it("reads the signing domain from header.i or header.d of a dkim=pass result", () => {
    assert.deepEqual(
      dkimPassDomains([
        gmail(
          "dkim=pass header.i=@LinkedIn.com header.s=prod header.b=AbC; spf=pass smtp.mailfrom=x@linkedin.com",
        ),
      ]),
      ["linkedin.com"],
    );
    assert.deepEqual(dkimPassDomains([gmail("dkim=pass header.d=alljob.co.il header.s=k1")]), [
      "alljob.co.il",
    ]);
    assert.deepEqual(dkimPassDomains([gmail("dkim=pass header.i=news@mail.drushim.co.il")]), [
      "mail.drushim.co.il",
    ]);
  });

  it("collects every passing signature and ignores failing ones", () => {
    assert.deepEqual(
      dkimPassDomains([
        gmail(
          "dkim=pass header.i=@a.com header.s=1; dkim=fail header.i=@b.com header.s=2; dkim=pass header.i=@c.com",
        ),
      ]),
      ["a.com", "c.com"],
    );
    assert.deepEqual(
      dkimPassDomains([gmail("dkim=fail header.i=@a.com"), gmail("dkim=neutral header.i=@a.com")]),
      [],
    );
    assert.deepEqual(
      dkimPassDomains([gmail("spf=pass smtp.mailfrom=a.com; dmarc=pass header.from=a.com")]),
      [],
    );
  });

  it("ignores a header that did not come from Gmail's own server", () => {
    assert.deepEqual(dkimPassDomains(["evil.example; dkim=pass header.i=@linkedin.com"]), []);
    assert.deepEqual(
      dkimPassDomains(["mx.google.com.evil.example; dkim=pass header.i=@linkedin.com"]),
      [],
    );
    assert.deepEqual(dkimPassDomains(["dkim=pass header.i=@linkedin.com"]), []);
    assert.deepEqual(dkimPassDomains([""]), []);
  });

  it("copes with extra spaces, case, and a pass without a domain", () => {
    assert.deepEqual(dkimPassDomains(["MX.GOOGLE.COM ;  DKIM = pass   header.i=@Example.COM"]), [
      "example.com",
    ]);
    assert.deepEqual(dkimPassDomains([gmail("dkim=pass")]), []);
  });
});

describe("isDkimAligned", () => {
  const signed = (domain: string) => [gmail(`dkim=pass header.i=@${domain} header.s=s`)];

  it("passes when the signer is the sender's domain or one of its subdomains", () => {
    assert.equal(isDkimAligned(signed("linkedin.com"), "linkedin.com"), true);
    assert.equal(isDkimAligned(signed("em.linkedin.com"), "linkedin.com"), true);
    assert.equal(isDkimAligned(signed("LinkedIn.com"), "LINKEDIN.COM"), true);
  });

  it("fails when someone else signed it, or a lookalike", () => {
    assert.equal(isDkimAligned(signed("sendgrid.net"), "linkedin.com"), false);
    assert.equal(isDkimAligned(signed("evillinkedin.com"), "linkedin.com"), false);
    assert.equal(isDkimAligned(signed("linkedin.com.evil.com"), "linkedin.com"), false);
    // The sender is a subdomain of the signer: not accepted (the signer must not be wider).
    assert.equal(isDkimAligned(signed("linkedin.com"), "mail.linkedin.com"), false);
  });

  it("fails with no authentication results, a failed signature, or only a forged header", () => {
    assert.equal(isDkimAligned([], "linkedin.com"), false);
    assert.equal(isDkimAligned([gmail("dkim=fail header.i=@linkedin.com")], "linkedin.com"), false);
    assert.equal(
      isDkimAligned(["evil.example; dkim=pass header.i=@linkedin.com"], "linkedin.com"),
      false,
    );
  });

  it("trusts only the first Authentication-Results header: a later one that also says mx.google.com is the sender's", () => {
    // Gmail's own header is on top and says the signature failed. The sender added a second
    // header below it that copies Gmail's server id and claims a pass.
    const real = gmail("dkim=fail header.i=@linkedin.com header.s=x");
    const forged = gmail("dkim=pass header.i=@linkedin.com header.s=x");
    assert.equal(isDkimAligned([real, forged], "linkedin.com"), false);
    assert.deepEqual(dkimPassDomains([real, forged]), []);
    // And a forged header with no real one above it does not count either, unless it is first.
    assert.equal(
      isDkimAligned(["evil.example; dkim=pass header.i=@linkedin.com", forged], "linkedin.com"),
      false,
    );
    // Whatever is first is the one Gmail wrote.
    const pass = gmail("dkim=pass header.i=@linkedin.com header.s=x");
    assert.equal(isDkimAligned([pass, real], "linkedin.com"), true);
  });

  it("passes when one of several signatures is aligned", () => {
    const header = gmail(
      "dkim=pass header.i=@sendgrid.net header.s=a; dkim=pass header.i=@linkedin.com header.s=b",
    );
    assert.equal(isDkimAligned([header], "linkedin.com"), true);
  });
});
