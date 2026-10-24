import test from "node:test";
import assert from "node:assert/strict";
import { formatPhone, telHref, uzE164 } from "./format.js";

test("Uzbek numbers always show with +998, however they were logged", () => {
  for (const raw of ["+998901234567", "998901234567", "901234567", "8 90 123 45 67", "+998 (90) 123-45-67"]) {
    assert.equal(formatPhone(raw), "+998 90 123 45 67", raw);
    assert.equal(uzE164(raw), "+998901234567", raw);
  }
  assert.equal(formatPhone("781139001"), "+998 78 113 90 01");
  assert.equal(formatPhone("+7 916 123 45 67"), "+7 916 123 45 67");
  assert.equal(formatPhone(""), "—");
  assert.equal(telHref("901234567"), "tel:+998901234567");
  assert.equal(telHref("12"), null);
});
