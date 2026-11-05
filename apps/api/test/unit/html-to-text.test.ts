import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeEntities, htmlToText } from "../../src/ingest/html-to-text.js";

describe("htmlToText", () => {
  it("writes a link as its text followed by the URL in parentheses", () => {
    assert.equal(
      htmlToText(
        '<a href="https://example.com/jobs/1?a=1&amp;b=2" style="x">Full Stack Developer</a>',
      ),
      "Full Stack Developer (https://example.com/jobs/1?a=1&b=2)",
    );
  });

  it("writes only the URL when the link text is empty or is the URL itself", () => {
    assert.equal(
      htmlToText('<a href="https://example.com/a"><img src="x.png"></a>'),
      "https://example.com/a",
    );
    assert.equal(
      htmlToText('<a href="https://example.com/a">https://example.com/a</a>'),
      "https://example.com/a",
    );
  });

  it("keeps only the text of a link whose target is not http(s)", () => {
    assert.equal(htmlToText('<a href="javascript:alert(1)">Click</a>'), "Click");
    assert.equal(htmlToText('<a href="mailto:a@b.com">Write</a>'), "Write");
    assert.equal(htmlToText("<a>No target</a>"), "No target");
  });

  it("reads single-quoted and unquoted href values", () => {
    assert.equal(htmlToText("<a href='https://e.com/x'>One</a>"), "One (https://e.com/x)");
    assert.equal(htmlToText("<a href=https://e.com/y>Two</a>"), "Two (https://e.com/y)");
  });

  it("puts block elements, table cells and line breaks on their own lines", () => {
    const text = htmlToText(
      "<table><tr><td>Title</td></tr><tr><td>Company</td></tr></table><p>One</p><p>Two<br>Three</p>",
    );
    assert.deepEqual(
      text.split("\n").filter((line) => line !== ""),
      ["Title", "Company", "One", "Two", "Three"],
    );
  });

  it("drops head, style, script, title, noscript and comments, with their content", () => {
    const text = htmlToText(
      "<html><head><title>T</title><style>td{color:red}</style></head><body><!-- hidden comment --><script>var x = 'secret';</script><noscript>no js</noscript>Hello</body></html>",
    );
    assert.equal(text, "Hello");
  });

  it("decodes entities, including numeric ones and Hebrew quotes", () => {
    assert.equal(
      htmlToText("Initech בע&quot;מ &amp; Co &lt;b&gt; caf&#233; &#x5D0;"),
      'Initech בע"מ & Co <b> café א',
    );
  });

  it("does not turn an escaped tag into a real one (entities are decoded after tags are removed)", () => {
    assert.equal(htmlToText("&lt;script&gt;alert(1)&lt;/script&gt;"), "<script>alert(1)</script>");
  });

  it("removes invisible characters, NUL and extra blank space", () => {
    const text = htmlToText("A​‌  B\u0000  C<p></p><p></p><p></p><p></p>D");
    assert.equal(text.includes("\u0000"), false);
    assert.equal(text.includes("​"), false);
    assert.match(text, /^A B C/);
    assert.equal(/\n{3,}/.test(text), false);
  });

  it("is safe on odd input", () => {
    assert.equal(htmlToText(""), "");
    assert.equal(htmlToText("plain text, no tags"), "plain text, no tags");
    assert.equal(htmlToText("<div><p>unclosed <b>tags"), "unclosed tags");
    assert.doesNotThrow(() => htmlToText('<a href="https://x.com">'.repeat(1000)));
  });
});

describe("decodeEntities", () => {
  it("leaves an unknown entity alone and drops an invalid code point", () => {
    assert.equal(decodeEntities("&unknownentity; &amp;"), "&unknownentity; &");
    assert.equal(decodeEntities("a&#0;b&#1114112;c&#xD800;d"), "abcd");
  });
});
