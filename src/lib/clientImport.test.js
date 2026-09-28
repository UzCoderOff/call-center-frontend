// Reading client spreadsheets: `npm test`. All names and numbers here are
// made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { findHeader, guessField, guessMapping, parseAmount, parseDate, parsePhones, parseStage, searchable, splitName, toClientRow } from "./clientImport.js";

test("search text: either script, apostrophes and h/x alike", () => {
  assert.equal(searchable("Ғулом Ўроқов"), searchable("G'ulom O'roqov"));
  assert.equal(searchable("Раҳимов"), searchable("Rahimov"));
  assert.equal(searchable("Инстанция"), searchable("instansiya"));
});

test("column titles in Uzbek or Russian, Cyrillic or Latin", () => {
  assert.equal(guessField("Мижоз Ф.И.Ш."), "name");
  assert.equal(guessField("Telefon raqami"), "phones");
  assert.equal(guessField("Иш босқичи"), "stage");
  assert.equal(guessField("Шартнома тузилган сана"), "contractDate");
  assert.equal(guessField("Шартнома суммаси"), "contractAmount");
  assert.equal(guessField("Тўланган"), "paid");
  assert.equal(guessField("Тўлов қолган"), "");
  assert.equal(guessField("ID"), "clientId");
  assert.equal(guessField("Kredit"), "");
});

test("the header row is found below plans and goals, never on an instructions sheet", () => {
  const rows = [
    ["Oylik reja", "", "60 ta konsultatsiya"],
    [],
    ["№", "Мижоз Ф.И.Ш.", "Телефон", "Иш босқичи", "Изоҳлар"],
    ["1", "Каримов Жасур", "+998 90 123 45 67", "Консультация", ""],
  ];
  assert.equal(findHeader(rows), 2);
  assert.equal(findHeader([["Telefon raqamini toʻliq yozing"], ["Mijoz ismini yozing"]]), -1);
});

test("one column per field", () => {
  assert.deepEqual(guessMapping(["Mijoz", "Telefon", "Summa", "Shartnoma summasi", "Shartnoma summasi"]), ["name", "phones", "", "contractAmount", ""]);
});

test("dates: Excel serials, dotted, ISO, with time", () => {
  assert.deepEqual(parseDate("46293"), { date: "2026-09-28", time: null });
  assert.deepEqual(parseDate("12.09.2026"), { date: "2026-09-12", time: null });
  assert.deepEqual(parseDate("2026-09-28 14:30"), { date: "2026-09-28", time: "14:30" });
  assert.equal(parseDate("31.13.2026"), null);
  assert.equal(parseDate("keyin"), null);
});

test("amounts: plain, scientific, thousands separators, with currency", () => {
  assert.equal(parseAmount("15000000"), 15000000);
  assert.equal(parseAmount("1.5E7"), 15000000);
  assert.equal(parseAmount("450.000"), 450000);
  assert.equal(parseAmount("15 000 000 сўм"), 15000000);
  assert.equal(parseAmount(""), null);
});

test("phones: several in a cell, glued together, or next to a stray number", () => {
  assert.deepEqual(parsePhones("+998 90 123 45 67, +998 91 765 43 21"), ["+998 90 123 45 67", "+998 91 765 43 21"]);
  assert.deepEqual(parsePhones("998901234567998917654321"), ["+998901234567", "+998917654321"]);
  assert.deepEqual(parsePhones("14040 998901234567"), ["998901234567"]);
  assert.deepEqual(parsePhones("yoʻq"), []);
});

test("a name cell with a city and what it's about", () => {
  assert.deepEqual(splitName("Qodirova Aziza. Toshkent. Meros"), { name: "Qodirova Aziza", city: "Toshkent", matter: "Meros" });
  assert.deepEqual(splitName("Олимов Бекзод Самарқанд"), { name: "Олимов Бекзод", city: "Самарқанд", matter: null });
});

test("stage words become a status and a legal stage", () => {
  assert.deepEqual(parseStage("Shartnoma · Birinchi instansiya"), { status: "contract", legalStage: "first_instance" });
  assert.deepEqual(parseStage("Апелляция"), { status: "contract", legalStage: "appeal" });
  assert.deepEqual(parseStage("Qayta qoʻngʻiroq"), { status: "call_again" });
  assert.deepEqual(parseStage(""), {});
});

test("a whole row", () => {
  const titles = ["ID", "Мижоз Ф.И.Ш.", "Телефон", "Иш босқичи", "Шартнома суммаси", "Тўланган", "Изоҳлар"];
  const mapping = guessMapping(titles);
  const row = toClientRow(["17", "Каримов Жасур", "+998 90 123 45 67", "Шартнома", "15 000 000", "5000000", "Hujjat olib keladi"], mapping, titles, { sheet: "Aziz", row: 4 });
  assert.equal(row.clientId, 17);
  assert.equal(row.name, "Каримов Жасур");
  assert.deepEqual(row.phones, ["+998 90 123 45 67"]);
  assert.equal(row.status, "contract");
  assert.equal(row.contractAmount, 15000000);
  assert.equal(row.paid, 5000000);
  assert.deepEqual(row.notes, ["Изоҳлар: Hujjat olib keladi"]);
  assert.equal(row.sheet, "Aziz");
  assert.equal(toClientRow(["", "", "", "", "", "", ""], mapping, titles), null);
  // A "name" of "0" or "-" with no phone is an empty row, not a client.
  assert.equal(toClientRow(["5", "0", "", "", "", "", ""], mapping, titles), null);
  assert.equal(toClientRow(["", "-", "+998 90 123 45 67", "", "", "", ""], mapping, titles).name, "");
  assert.equal(toClientRow(["x7", "Ali Vali", "", "", "", "", ""], mapping, titles).clientId, null);
});
