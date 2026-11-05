// A small HTML-to-text converter for alert emails. The text is only ever sent to the model and
// checked for URLs, it is never shown or rendered, so it favours keeping the job text and every
// link over a faithful layout. A link becomes `text (url)`, which is what the URL check reads.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  bull: "•",
  middot: "·",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  rlm: "",
  lrm: "",
  zwnj: "",
  zwj: "",
  shy: "",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1]?.toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isInteger(code) &&
        code > 0 &&
        code <= 0x10ffff &&
        !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : "";
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

function hrefOf(attributes: string): string | null {
  const match = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attributes);
  const href = decodeEntities((match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim());
  return /^https?:\/\//i.test(href) ? href : null;
}

export function htmlToText(html: string): string {
  let text = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(head|script|style|title|noscript)\b[\s\S]*?<\/\1\s*>/gi, "");

  // Links first, while their tags are still there: `<a href="u">label</a>` -> `label (u)`.
  text = text.replace(
    /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi,
    (_match, attributes: string, inner: string) => {
      const href = hrefOf(attributes);
      const label = decodeEntities(stripTags(inner)).replace(/\s+/g, " ").trim();
      if (!href) return ` ${label} `;
      return label === "" || label === href ? ` ${href} ` : ` ${label} (${href}) `;
    },
  );

  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/(p|div|tr|td|th|li|ul|ol|table|h[1-6]|section|article|header|footer|blockquote)\s*>/gi,
      "\n",
    );

  text = decodeEntities(stripTags(text));

  return (
    text
      // Invisible characters senders use for spacing and preheaders, and NUL (not storable).
      .replace(/[\u0000​-‏‪-‮⁠-⁩﻿­]/g, "")
      .replace(/[ \t  - 　]+/g, " ")
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
