// The simple formatting materials are written in — plain text with a few
// line prefixes, so anyone can write a script in the portal (or paste one
// from Word) without a toolbar full of buttons:
//
//   # Heading            ## Smaller heading
//   - point              1. step
//   > Say this: "Assalomu alaykum…"   (a highlighted "say this" line — for call scripts)
//   ! Never promise a result.          (an important warning)
//   **bold**   and web links (https://…) inside any line
//
// A blank line starts a new paragraph. The result is a list of blocks the
// page renders as React elements — never as raw HTML.

const PREFIXES = [
  { type: "h2", re: /^##\s+(.*)$/ },
  { type: "h1", re: /^#\s+(.*)$/ },
  { type: "say", re: /^>\s?(.*)$/ },
  { type: "note", re: /^!\s+(.*)$/ },
  { type: "ul", re: /^[-*•]\s+(.*)$/ },
  { type: "ol", re: /^\d{1,3}[.)]\s+(.*)$/ },
];

const LIST_TYPES = new Set(["ul", "ol"]);

export function parseBlocks(text) {
  const blocks = [];
  let current = null;
  for (const raw of String(text || "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      current = null;
      continue;
    }
    const match = PREFIXES.map((p) => ({ type: p.type, m: line.match(p.re) })).find((x) => x.m);
    const type = match ? match.type : "p";
    const content = match ? match.m[1].trim() : line;

    if (type === "h1" || type === "h2") {
      blocks.push({ type, text: content });
      current = null;
    } else if (current && current.type === type) {
      (LIST_TYPES.has(type) ? current.items : current.lines).push(content);
    } else {
      current = LIST_TYPES.has(type) ? { type, items: [content] } : { type, lines: [content] };
      blocks.push(current);
    }
  }
  return blocks;
}

// A line's pieces: plain text, **bold**, and web links.
const INLINE = /\*\*(.+?)\*\*|(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)'])/g;

export function parseInline(text) {
  const parts = [];
  let last = 0;
  for (const m of String(text || "").matchAll(INLINE)) {
    if (m.index > last) parts.push({ type: "text", text: text.slice(last, m.index) });
    parts.push(m[1] !== undefined ? { type: "bold", text: m[1] } : { type: "link", href: m[2], text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}

// Plain text for previews ("Assalomu alaykum, …").
export function plainText(text, max = 140) {
  const flat = String(text || "")
    .replace(/^\s*(#{1,2}|>|!|[-*•]|\d{1,3}[.)])\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
