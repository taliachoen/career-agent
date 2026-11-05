import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractNormalizedUrls,
  looksLikeNonJobLink,
  normalizeUrl,
} from "../../src/ingest/url-normalize.js";

describe("normalizeUrl", () => {
  it("LinkedIn: every shape of a job link becomes the same canonical job URL", () => {
    const canonical = "https://www.linkedin.com/jobs/view/3912345678/";
    for (const url of [
      "https://www.linkedin.com/comm/jobs/view/3912345678?trackingId=aB3x%2FqZ9&refId=9f1c&midToken=AQ&trk=eml-email_job_alert",
      "https://www.linkedin.com/jobs/view/3912345678/",
      "https://linkedin.com/jobs/view/3912345678",
      "https://il.linkedin.com/jobs/view/full-stack-developer-at-acme-3912345678?refId=x",
      "http://www.linkedin.com/comm/jobs/view/3912345678/?utm_source=x#frag",
    ]) {
      assert.equal(normalizeUrl(url), canonical, url);
    }
  });

  it("LinkedIn: two different jobs stay different", () => {
    assert.notEqual(
      normalizeUrl("https://www.linkedin.com/comm/jobs/view/3912345678?trk=a"),
      normalizeUrl("https://www.linkedin.com/comm/jobs/view/3912345999?trk=a"),
    );
  });

  it("LinkedIn: a link that is not a job page only loses its tracking parameters", () => {
    assert.equal(
      normalizeUrl("https://www.linkedin.com/jobs/search/?keywords=react&trk=email"),
      "https://www.linkedin.com/jobs/search?keywords=react",
    );
  });

  it("Indeed: keeps only the job key", () => {
    assert.equal(
      normalizeUrl("https://il.indeed.com/rc/clk?jk=abc123def456&fccid=1&vjs=3&from=ja&tk=zz"),
      "https://il.indeed.com/viewjob?jk=abc123def456",
    );
    assert.equal(
      normalizeUrl("https://www.indeed.com/viewjob?jk=abc123def456&utm_source=x"),
      "https://www.indeed.com/viewjob?jk=abc123def456",
    );
  });

  it("Glassdoor: keeps only the listing id (jl)", () => {
    const url =
      "https://www.glassdoor.com/partner/jobListing.htm?pos=101&ao=1136043&s=58&guid=0000018c&src=GD_JOB_AD&t=JA&jobListingId=1009123456&jl=1009123456&utm_source=email";
    assert.equal(
      normalizeUrl(url),
      "https://www.glassdoor.com/partner/jobListing.htm?jl=1009123456",
    );
    assert.notEqual(normalizeUrl(url), normalizeUrl(url.replaceAll("1009123456", "1009123457")));
  });

  it("AllJobs and alljob: keeps the path and JobID only", () => {
    assert.equal(
      normalizeUrl(
        "https://www.alljobs.co.il/Search/UploadSingle.aspx?JobID=7771001&utm_source=jobalert&utm_campaign=daily",
      ),
      "https://www.alljobs.co.il/Search/UploadSingle.aspx?JobID=7771001",
    );
    assert.equal(
      normalizeUrl("https://www.alljob.co.il/Search/UploadSingle.aspx?jobid=7771001&x=1"),
      "https://www.alljob.co.il/Search/UploadSingle.aspx?JobID=7771001",
    );
  });

  it("Drushim: keeps the job path, drops the query", () => {
    assert.equal(
      normalizeUrl(
        "https://www.drushim.co.il/job/55501/vsdrdrb/?utm_campaign=daily&utm_source=email",
      ),
      "https://www.drushim.co.il/job/55501/vsdrdrb",
    );
  });

  it("an unknown site only loses known tracking parameters; the others stay, sorted", () => {
    assert.equal(
      normalizeUrl(
        "https://careers.example.com/jobs/42/?utm_source=a&Utm_Medium=b&gclid=1&fbclid=2&mc_cid=3&b=2&a=1#apply",
      ),
      "https://careers.example.com/jobs/42?a=1&b=2",
    );
    // A parameter that may be the job id is never dropped.
    assert.equal(
      normalizeUrl("https://careers.example.com/job?id=7&utm_source=a"),
      "https://careers.example.com/job?id=7",
    );
    assert.equal(
      normalizeUrl("https://careers.example.com/job?id=7"),
      "https://careers.example.com/job?id=7",
    );
    assert.notEqual(
      normalizeUrl("https://careers.example.com/job?id=7"),
      normalizeUrl("https://careers.example.com/job?id=8"),
    );
  });

  it("uses https, the lowercase host, no credentials, no fragment, no default port", () => {
    assert.equal(
      normalizeUrl("HTTP://User:Pass@Careers.Example.COM:80/Jobs/Big?x=1#top"),
      "https://careers.example.com/Jobs/Big?x=1",
    );
    assert.equal(normalizeUrl("https://example.com:443/a/"), "https://example.com/a");
    assert.equal(normalizeUrl("https://example.com/"), "https://example.com/");
  });

  it("returns null for anything that is not an http(s) URL", () => {
    for (const value of [
      "",
      "not a url",
      "javascript:alert(1)",
      "mailto:a@b.com",
      "ftp://example.com/a",
      "//example.com/a",
      "data:text/html,x",
    ]) {
      assert.equal(normalizeUrl(value), null, value);
    }
  });

  it("is idempotent", () => {
    for (const url of [
      "https://www.linkedin.com/comm/jobs/view/3912345678?trk=a",
      "https://www.drushim.co.il/job/55501/vsdrdrb/?utm_source=x",
      "https://careers.example.com/jobs/42/?b=2&a=1&utm_source=x",
    ]) {
      const once = normalizeUrl(url)!;
      assert.equal(normalizeUrl(once), once, url);
    }
  });
});

describe("looksLikeNonJobLink", () => {
  it("recognises unsubscribe, preference, settings and login links", () => {
    for (const url of [
      "https://alerts.example.com/unsubscribe?token=abc",
      "https://www.glassdoor.com/member/email/OptOut.htm?x=1",
      "https://www.linkedin.com/e/v2?e=1&t=unsubscribe",
      "https://example.com/email-preferences/1",
      "https://example.com/manage-subscription",
      "https://example.com/settings?token=abc",
      "https://example.com/login?next=/jobs",
      "https://example.com/view-in-browser/123",
    ]) {
      assert.equal(looksLikeNonJobLink(url), true, url);
    }
  });

  it("leaves real job links alone", () => {
    for (const url of [
      "https://www.linkedin.com/jobs/view/3912345678/",
      "https://www.drushim.co.il/job/55501/vsdrdrb",
      "https://www.glassdoor.com/partner/jobListing.htm?jl=1009123456",
      "https://careers.example.com/jobs/42?a=1",
    ]) {
      assert.equal(looksLikeNonJobLink(url), false, url);
    }
  });
});

describe("extractNormalizedUrls", () => {
  it("finds the links written as text (url), bare URLs, and drops trailing punctuation", () => {
    const urls = extractNormalizedUrls(
      [
        "Full Stack Developer (https://www.linkedin.com/comm/jobs/view/3912345678?trk=a)",
        "See https://www.drushim.co.il/job/55501/x/?utm_source=a, and more.",
        "Unsubscribe: https://example-alerts.invalid/unsubscribe?token=1.",
      ].join("\n"),
    );
    assert.deepEqual(
      [...urls].sort(),
      [
        "https://example-alerts.invalid/unsubscribe?token=1",
        "https://www.drushim.co.il/job/55501/x",
        "https://www.linkedin.com/jobs/view/3912345678/",
      ].sort(),
    );
  });

  it("does not find a URL the text does not contain, even a similar one", () => {
    const urls = extractNormalizedUrls(
      "Job (https://www.linkedin.com/comm/jobs/view/3912345678?trk=a)",
    );
    assert.equal(urls.has("https://www.linkedin.com/jobs/view/3912345678/"), true);
    assert.equal(urls.has("https://www.linkedin.com/jobs/view/3912345679/"), false);
    assert.equal(urls.has("https://evil.example/jobs/view/3912345678/"), false);
  });

  it("returns an empty set for text with no links", () => {
    assert.equal(extractNormalizedUrls("no links here, just www.example.com").size, 0);
    assert.equal(extractNormalizedUrls("").size, 0);
  });
});
