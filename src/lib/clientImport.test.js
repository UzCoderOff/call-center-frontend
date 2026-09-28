// Reading client spreadsheets: `npm test`. All names and numbers here are
// made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { findHeader, guessField, guessLawyer, guessMapping, parseAmount, parseDate, parsePhones, parseStage, searchable, splitName, toClientRow } from "./clientImport.js";

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

test("one column per field; other columns and second copies are kept as notes", () => {
  assert.deepEqual(guessMapping(["Mijoz", "Telefon", "Summa", "Shartnoma summasi", "Shartnoma summasi"]), ["name", "phones", "note", "contractAmount", "note"]);
  // The row number and columns worked out from the rest are left out.
  assert.deepEqual(guessMapping(["№", "Ф.И.Ш.", "Телефон", "Тўлашга қолган сумма, сўм", "Тўлов ҳолати", "Финал", "финал"]), ["", "name", "phones", "", "", "final", "note"]);
});

test("an email column used for something else is read as what it holds", () => {
  const header = ["Ф.И.Ш.", "Телефон", "Электрон почта"];
  const rows = [["A", "901234567", "restoran muammosi"], ["B", "901234568", "kripto boʻyicha"], ["C", "901234569", "a@b.uz"], ["D", "901234560", "ish joyida muammo"]];
  assert.deepEqual(guessMapping(header, rows), ["name", "phones", "matter"]);
  // With a matter column already: notes.
  assert.deepEqual(guessMapping([...header, "Мурожаат мазмуни"], rows), ["name", "phones", "note", "matter"]);
  // Mostly real addresses: still the email.
  assert.deepEqual(guessMapping(header, [["A", "1", "a@b.uz"], ["B", "2", "c@d.uz"], ["C", "3", "x"]]), ["name", "phones", "email"]);
});

test("nothing that doesn't fit its column is lost", () => {
  const titles = ["Ф.И.Ш.", "Телефон", "Электрон почта", "Иш бошланган сана", "Тўланган, сўм", "Финал", "Шартнома суммаси", "Изоҳ 2"];
  const mapping = ["name", "phones", "email", "startDate", "paid", "final", "contractAmount", "note"];
  const row = toClientRow(
    ["Ali Valiyev", "@ demo_user01 998901234567", "Toshkentda ofisda", "8,09,2026 9,09,2026", "5 mln (qolgani keyin)", "46254.6041666667", "15 млн", "46271"],
    mapping,
    titles
  );
  assert.deepEqual(row.phones, ["998901234567"]);
  assert.equal(row.startDate, "2026-09-08");
  assert.equal(row.paid, 5000000);
  assert.equal(row.contractAmount, 15000000);
  assert.equal(row.email, null);
  assert.deepEqual(row.notes, [
    "Telegram: @demo_user01",
    "Электрон почта: Toshkentda ofisda",
    "Финал: 2026-08-20 14:30",
    "Иш бошланган сана: 8,09,2026 9,09,2026",
    "Тўланган, сўм: 5 mln (qolgani keyin)",
    "Изоҳ 2: 2026-09-06",
  ]);
  // Words in the phone column; noise ("-", "0", "?") is dropped.
  const other = toClientRow(["Olim", "Хорватия", "-", "", "?", "-", "0", ""], mapping, titles);
  assert.deepEqual(other.notes, ["Телефон: Хорватия"]);
});

test("what it's about: from the name and its column, both kept", () => {
  const titles = ["Ф.И.Ш.", "Телефон", "Мурожаат"];
  const mapping = ["name", "phones", "matter"];
  assert.equal(toClientRow(["Ali Valiyev. Toshkent. Ajrim", "901234567", "Toshkentda ofisda ofline"], mapping, titles).matter, "Ajrim. Toshkentda ofisda ofline");
  assert.equal(toClientRow(["Ali Valiyev. Ajrim", "901234567", "ajrim"], mapping, titles).matter, "Ajrim");
  assert.equal(toClientRow(["Ali Valiyev", "901234567", "ali@mail.uz"], mapping, titles).email, "ali@mail.uz");
});

test("amounts written with millions or thousands", () => {
  assert.equal(parseAmount("15 млн"), 15000000);
  assert.equal(parseAmount("1,5 mln"), 1500000);
  assert.equal(parseAmount("450 минг"), 450000);
  assert.equal(parseAmount("72 000 000 сўм"), 72000000);
});

test("dates: Excel serials, dotted, ISO, with time", () => {
  assert.deepEqual(parseDate("46293"), { date: "2026-09-28", time: null });
  assert.deepEqual(parseDate("12.09.2026"), { date: "2026-09-12", time: null });
  assert.deepEqual(parseDate("2026-09-28 14:30"), { date: "2026-09-28", time: "14:30" });
  assert.deepEqual(parseDate("8,09,2026"), { date: "2026-09-08", time: null });
  assert.deepEqual(parseDate("02.09/2026 16:58"), { date: "2026-09-02", time: "16:58" });
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
  // Excel's scientific form for a long number.
  assert.deepEqual(parsePhones("9.98909284848E+11"), ["998909284848"]);
});

test("a name cell with a city and what it's about", () => {
  assert.deepEqual(splitName("Qodirova Aziza. Toshkent. Meros"), { name: "Qodirova Aziza", city: "Toshkent", matter: "Meros" });
  assert.deepEqual(splitName("Олимов Бекзод Самарқанд"), { name: "Олимов Бекзод", city: "Самарқанд", matter: null });
  // Districts, a number after the city, "-lik" (from there).
  assert.equal(splitName("Ali Valiyev. Chilonzor. Ajrim").city, "Chilonzor");
  assert.equal(splitName("Ali Valiyev. Farg'ona 278. Meros").city, "Farg'ona 278");
  assert.equal(splitName("Ali Valiyev. Asli Namanganlik").city, "Asli Namanganlik");
  assert.deepEqual(splitName("Ali Valiyev. karta ochish"), { name: "Ali Valiyev", city: null, matter: "karta ochish" });
});

test("stage words become a status and a legal stage", () => {
  assert.deepEqual(parseStage("Shartnoma · Birinchi instansiya"), { status: "contract", legalStage: "first_instance" });
  assert.deepEqual(parseStage("Апелляция"), { status: "contract", legalStage: "appeal" });
  assert.deepEqual(parseStage("Qayta qoʻngʻiroq"), { status: "call_again" });
  assert.deepEqual(parseStage(""), {});
});

test("a lawyer written in the sheet finds their account, whatever the script", () => {
  const accounts = [
    { id: 1, name: "Aliyev Jahongir" },
    { id: 2, name: "Qoʻchqorov Baxtiyor" },
    { id: 3, name: "Advokat Saidova" },
    { id: 4, name: "Saidov Umid" },
  ];
  assert.equal(guessLawyer("Алиев Жаҳонгир Азизович", accounts)?.id, 1);
  assert.equal(guessLawyer("Қўчқоров Бахтиёр", accounts)?.id, 2);
  assert.equal(guessLawyer("Саидова Малика", accounts)?.id, 3);
  assert.equal(guessLawyer("Tursunov B.", accounts), null);
  assert.equal(guessLawyer("", accounts), null);
  // Two accounts fit: don't guess.
  assert.equal(guessLawyer("Karimov", [{ id: 5, name: "Karimov Akmal" }, { id: 6, name: "Karimov Jasur" }]), null);
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
  // The sheet's example row isn't a client.
  assert.equal(toClientRow(["1", "Каримов Карим (мисол)", "+998 90 123 45 67", "", "", "", ""], mapping, titles), null);
  // A "name" of "0" or "-" with no phone is an empty row, not a client.
  assert.equal(toClientRow(["5", "0", "", "", "", "", ""], mapping, titles), null);
  assert.equal(toClientRow(["", "-", "+998 90 123 45 67", "", "", "", ""], mapping, titles).name, "");
  assert.equal(toClientRow(["x7", "Ali Vali", "", "", "", "", ""], mapping, titles).clientId, null);
});
