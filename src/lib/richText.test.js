import test from "node:test";
import assert from "node:assert/strict";
import { parseBlocks, parseInline, plainText } from "./richText.js";

test("a call script turns into headings, say-this lines, warnings and lists", () => {
  const blocks = parseBlocks(
    [
      "# Salomlashish",
      "> Assalomu alaykum, advokatlik firmasi.",
      "> Ismingiz nima?",
      "",
      "Keyin masalani soʻrang.",
      "Qisqa yozib oling.",
      "- Ismi",
      "- Telefoni",
      "1. Konsultatsiya narxini ayting",
      "2) Vaqt taklif qiling",
      "! Hech qachon natijani vaʼda qilmang",
      "## Yakun",
    ].join("\n")
  );
  assert.deepEqual(
    blocks.map((b) => b.type),
    ["h1", "say", "p", "ul", "ol", "note", "h2"]
  );
  assert.deepEqual(blocks[1].lines, ["Assalomu alaykum, advokatlik firmasi.", "Ismingiz nima?"]);
  assert.deepEqual(blocks[2].lines, ["Keyin masalani soʻrang.", "Qisqa yozib oling."]);
  assert.deepEqual(blocks[4].items, ["Konsultatsiya narxini ayting", "Vaqt taklif qiling"]);
});

test("Windows line endings and stray spaces don't matter; a blank line splits", () => {
  const blocks = parseBlocks("  - bir\r\n- ikki\r\n\r\n- uch  ");
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0].items, ["bir", "ikki"]);
});

test("bold and links inside a line; nothing else is treated as markup", () => {
  assert.deepEqual(parseInline("Narx **450 000 soʻm**, batafsil: https://example.com/narx."), [
    { type: "text", text: "Narx " },
    { type: "bold", text: "450 000 soʻm" },
    { type: "text", text: ", batafsil: " },
    { type: "link", href: "https://example.com/narx", text: "https://example.com/narx" },
    { type: "text", text: "." },
  ]);
  assert.deepEqual(parseInline("<b>not html</b> javascript:alert(1)"), [{ type: "text", text: "<b>not html</b> javascript:alert(1)" }]);
});

test("a preview line without the formatting marks", () => {
  assert.equal(plainText("# Salom\n> **Assalomu** alaykum\n- bir"), "Salom Assalomu alaykum bir");
  assert.equal(plainText("a".repeat(200), 10).length, 10);
});
