// Turning spreadsheet rows into clients (the server then matches and merges
// them — call-center-backend/src/services/clientImport.js).
//
// 1. findHeader: which row holds the column titles (the sheets have plans
//    and goals above the table).
// 2. guessField: what each column is, from its title — Uzbek or Russian, in
//    Cyrillic or Latin ("Мижоз Ф.И.Ш.", "Telefon", "Иш босқичи"…).
// 3. toClientRow: one row -> { name, phones, city, matter, status, … }.

// Same as the backend's searchable(): lowercase Latin, Cyrillic
// transliterated, x/h/kh treated alike.
const CYR = {
  а: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y",
  к: "k", қ: "q", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ў: "o",
  ф: "f", х: "x", ҳ: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu",
  я: "ya",
};

export function searchable(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[а-яёғқўҳ]/g, (ch) => CYR[ch] ?? ch)
    .replace(/[ʻʼ'`‘’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/kh/g, "x")
    .replace(/h/g, "x")
    // Ц is written ts or s ("instantsiya", "instansiya").
    .replace(/ts/g, "s")
    .trim();
}

// Fields a column can hold, in the order the mapping list shows them. Each
// has title words (any match wins; `not` words veto).
export const FIELDS = [
  // The ID column of a file exported from here (matched on "ID" exactly).
  { key: "clientId", words: [] },
  { key: "name", words: ["mijoz", "fish", "fio", "ism", "klient", "familiya"] },
  { key: "phones", words: ["telefon", "tel"] },
  { key: "city", words: ["shaxar", "viloyat", "gorod", "manzil"] },
  { key: "email", words: ["pochta", "email", "e mail"] },
  { key: "matter", words: ["murojaat", "mazmun", "masala"] },
  { key: "lawyer", words: ["advokat", "yurist"] },
  { key: "number", words: ["raqami", "nomer dela", "ish shartnoma"] },
  { key: "startDate", words: ["boshlangan sana", "boshlan"] },
  { key: "stage", words: ["bosqich", "etap"] },
  { key: "final", words: ["final", "natija"] },
  { key: "contractAmount", words: ["shartnoma summa", "shartnoma tuzilgan summa"] },
  { key: "contractDate", words: ["shartnoma tuzilgan sana"] },
  { key: "paid", words: ["tolangan", "oplacheno"], not: ["qolgan", "xolati"] },
  { key: "lastCall", words: ["songgi qongiroq"] },
  { key: "nextCall", words: ["keyingi qongiroq"] },
  { key: "tasks", words: ["vazifa"] },
  { key: "work", words: ["bajarilgan ish"] },
  { key: "comments", words: ["izox", "kommentariy", "primechanie"] },
  // Any other column: its text goes onto the client's history, labelled
  // with the column's title.
  { key: "note", words: [] },
].map((f) => ({ ...f, words: f.words.map(searchable), not: (f.not || []).map(searchable) }));

// Columns that are only worked out from the others (what's left to pay,
// whether it's paid, who the operator is) — recalculated here, so left out.
const DERIVED = ["qolgan", "qoldi", "tolov xolati", "operator", "qayerdan"].map(searchable);

const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

export function guessField(title) {
  const t = searchable(title);
  if (!t) return "";
  if (t === "id") return "clientId";
  // Also without spaces, so "Ф.И.Ш." ("f i sx") matches "fish".
  const tight = t.replace(/ /g, "");
  const has = (w) => t.includes(w) || (w.length >= 4 && tight.includes(w.replace(/ /g, "")));
  // Longest matching word wins ("shartnoma tuzilgan sana" beats "sana").
  let best = { key: "", length: 0 };
  for (const f of FIELDS) {
    if (f.not.some(has)) continue;
    for (const w of f.words) if (has(w) && w.length > best.length) best = { key: f.key, length: w.length };
  }
  return best.key;
}

// The header row: among the first 12, the one where the most columns are
// recognised — at least 3, one of them the client's name or phone (so an
// instructions sheet that merely mentions "phone" isn't taken for data).
export function findHeader(rows) {
  let best = { index: -1, score: 0 };
  rows.slice(0, 12).forEach((row, index) => {
    const fields = (row || []).map(guessField).filter(Boolean);
    const score = new Set(fields).size;
    if ((fields.includes("name") || fields.includes("phones")) && score >= 3 && score > best.score) best = { index, score };
  });
  return best.index;
}

// What each column holds, from its title — and, given the rows under it,
// from what's actually written there.
export function guessMapping(headerRow, dataRows = []) {
  const used = new Set();
  const mapping = (headerRow || []).map((title) => {
    const key = guessField(title);
    if (key && !used.has(key)) {
      used.add(key);
      return key;
    }
    // Not a field of its own, or a second copy of one (a second "финал"):
    // kept as notes — unless it's the row number or worked out from the rest.
    const t = searchable(title);
    if (t.length < 2 || DERIVED.some((w) => t.includes(w))) return "";
    return "note";
  });
  // An "email" column that mostly holds other text (what the client came
  // about, where they met) is read as what it's about — or as notes if the
  // sheet has that column already.
  const at = mapping.indexOf("email");
  if (at >= 0) {
    const values = dataRows.map((r) => String(r?.[at] ?? "").trim()).filter(Boolean);
    if (values.length >= 3 && values.filter(looksLikeEmail).length * 2 < values.length) {
      mapping[at] = mapping.includes("matter") ? "note" : "matter";
    }
  }
  return mapping;
}

// ------------------------------------------------------------- values

// Excel stores dates as day counts from 1899-12-30 (fractions = time of day).
function fromSerial(n) {
  const ms = Math.round((n - 25569) * 86400000);
  return new Date(ms);
}

const pad = (n) => String(n).padStart(2, "0");
const isoDay = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// "46255", "12.09.2026", "12/09/2026 14:30", "2026-09-12" -> { date, time? }
export function parseDate(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n < 20000 || n > 80000) return null;
    const d = fromSerial(n);
    const hasTime = n % 1 > 0.0001;
    return { date: isoDay(d), time: hasTime ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : null };
  }
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: m[4] ? `${pad(m[4])}:${m[5]}` : null };
  // Dots, slashes, dashes or commas ("8,09,2026"), even mixed ("02.09/2026").
  m = s.match(/^(\d{1,2})[./,-](\d{1,2})[./,-](\d{2,4})(?:\s+(\d{1,2})[:.](\d{2}))?/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    const month = Number(m[2]);
    const day = Number(m[1]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { date: `${year}-${pad(month)}-${pad(day)}`, time: m[4] ? `${pad(m[4])}:${m[5]}` : null };
  }
  return null;
}

// "15000000", "1.5E7", "450.000", "15 000 000 сўм" -> 15000000;
// "15 млн", "1,5 mln" -> 15000000 / 1500000; "450 минг" -> 450000.
export function parseAmount(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const scaled = s.match(/^(\d+(?:[.,]\d+)?)\s*(млн|mln|million|миллион|минг|ming|тыс|k)\b/i) || s.match(/^(\d+(?:[.,]\d+)?)\s*(млн|минг|тыс)/i);
  if (scaled) {
    const unit = scaled[2].toLowerCase();
    const factor = /^(млн|mln|million|миллион)/.test(unit) ? 1e6 : 1e3;
    const n = Math.round(Number(scaled[1].replace(",", ".")) * factor);
    return n > 0 ? n : null;
  }
  if (/^[\d.]+e[+-]?\d+$/i.test(s) || /^\d+(\.\d+)?$/.test(s) && !/^\d{1,3}(\.\d{3})+$/.test(s)) {
    const n = Math.round(Number(s));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const digits = s.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

// "9.98909284848E+11" -> "998909284848" (numbers only; other text as is).
export function fullNumbers(value) {
  return String(value ?? "").replace(/\b\d(?:\.\d+)?E\+?\d{1,2}\b/gi, (m) => {
    const n = Number(m);
    return Number.isSafeInteger(Math.round(n)) ? String(Math.round(n)) : m;
  });
}

// Phone numbers in a cell — several may share one ("+998… +998…", or two
// 12-digit numbers run together).
export function parsePhones(value) {
  const out = [];
  // A number Excel stored in scientific form ("9.98909284848E+11") is the
  // phone written out in full.
  const cell = fullNumbers(value);
  for (const match of cell.match(/\+?\d[\d\s\-()]{6,}\d/g) || []) {
    // "14040 998993273934": a stray number glued to a phone by a space —
    // keep just the parts that are phone-length on their own.
    const tokens = match.split(/\s+/);
    if (tokens.length > 1 && tokens.some((tok) => tok.replace(/\D/g, "").length >= 9)) {
      for (const tok of tokens) if (tok.replace(/\D/g, "").length >= 9) out.push(tok);
      continue;
    }
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 18 && digits.startsWith("998")) {
      for (let i = 0; i + 12 <= digits.length; i += 12) out.push(`+${digits.slice(i, i + 12)}`);
    } else if (digits.length >= 7) out.push(match.trim());
  }
  return out.slice(0, 5);
}

// Regions, cities, towns and Tashkent's districts, as they're written in the
// sheets (either script; searchable() makes them meet).
const CITIES = [
  // regions and region centres
  "toshkent", "tashkent", "andijon", "buxoro", "samarqand", "namangan", "fargona", "qoqon", "xorazm", "urganch",
  "navoiy", "qarshi", "termiz", "jizzax", "guliston", "nukus", "qashqadaryo", "surxondaryo", "sirdaryo",
  "qoraqalpogiston", "qoraqalpoq", "qoraqalpoqiston", "karakalpakstan",
  // towns
  "nurobod", "margilon", "chirchiq", "angren", "olmaliq", "denov", "shahrisabz", "kattaqorgon", "xiva", "bekobod",
  "yangiyol", "parkent", "zangiota", "qibray", "ohangaron", "nurafshon", "chinoz", "piskent", "boka", "gazalkent",
  "bostonliq", "kosonsoy", "chust", "uchqorgon", "asaka", "xonobod", "shahrixon", "rishton", "quva", "marhamat",
  "kogon", "gijduvon", "zarafshon", "uchquduq", "kitob", "guzor", "muborak", "boysun", "sherobod", "urgut", "beruniy",
  "xojayli", "kungrad", "qongirot", "turtkul", "yangiyer", "gallaorol", "zomin", "paxtakor",
  // (Towns that are also everyday words — Baxt, Shirin, Pop — are left out.)
  // Tashkent's districts
  "chilonzor", "yunusobod", "yakkasaroy", "mirobod", "mirzo ulugbek", "shayxontoxur", "olmazor", "uchtepa",
  "yashnobod", "sergeli", "bektemir", "yangixayot",
].map(searchable);

// "Toshkent", "Farg'ona 278", "Asli Namanganlik" (from Namangan): a part
// that names a place — a word of it is one, perhaps with "-lik".
function isCity(part) {
  const t = searchable(part);
  if (!t) return false;
  if (CITIES.includes(t)) return true;
  const words = t.split(" ").filter((w) => !/^\d+$/.test(w));
  return words.length <= 3 && words.some((w) => CITIES.includes(w) || CITIES.includes(w.replace(/li[kq]$/, "")));
}

// "Karimova Dilnoza. Toshkent. Meros …" / "Ergashev Anvar /Andijon/ Ajrim"
// -> the name, a city if one is named, and the rest as what it's about.
export function splitName(value) {
  const parts = String(value ?? "")
    .split(/[./]|\s{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { name: "" };
  let [name, ...rest] = parts;
  // "Анвар Тошкент": a city as the last word of the name.
  const nameWords = name.split(/\s+/);
  if (nameWords.length >= 2 && CITIES.includes(searchable(nameWords[nameWords.length - 1]))) {
    rest = [nameWords.pop(), ...rest];
    name = nameWords.join(" ");
  }
  let city = null;
  const matter = [];
  for (const part of rest) {
    if (!city && isCity(part)) city = part;
    else matter.push(part);
  }
  return { name, city, matter: matter.join(". ") || null };
}

// Stage / result words -> the case's status and legal stage.
const STAGE_RULES = [
  ["oliy sud", { legalStage: "supreme_review" }],
  ["taftish", { legalStage: "review" }],
  ["kassatsiya", { legalStage: "cassation" }],
  ["apel", { legalStage: "appeal" }],
  ["birinchi instansiya", { legalStage: "first_instance" }],
  ["sudga yuborildi", { legalStage: "sent_to_court" }],
  ["tergov", { legalStage: "investigation" }],
  ["surishtiruv", { legalStage: "inquiry" }],
  ["xujjatlarni tayyorlash", { status: "contract" }],
  ["ish tugallandi", { status: "done" }],
  ["tugallandi", { status: "done" }],
  ["shartnoma", { status: "contract" }],
  ["qayta qongiroq", { status: "call_again" }],
  ["rad etdi", { status: "declined" }],
  ["davom etmadi", { status: "declined" }],
  ["konsul", { status: "consultation" }],
  ["maslaxat", { status: "consultation" }],
  ["yozildi", { status: "consultation" }],
].map(([word, result]) => [searchable(word), result]);

export function parseStage(value) {
  const t = searchable(value);
  if (!t) return {};
  const out = {};
  for (const [word, result] of STAGE_RULES) {
    if (!t.includes(word)) continue;
    if (result.legalStage && !out.legalStage) out.legalStage = result.legalStage;
    if (result.status && !out.status) out.status = result.status;
  }
  if (out.legalStage && !out.status) out.status = "contract";
  return out;
}

// ------------------------------------------------------------- lawyers

// The words that identify a person, spelled so Cyrillic and Latin meet:
// "Алиев" and "Aliyev" (иев / iyev), "Ерназаров" and "Yernazarov".
// Titles and initials don't count.
const TITLE_WORDS = new Set(["advokat", "yurist", "adv"]);
function personWords(name) {
  return searchable(name)
    .split(" ")
    .map((w) => w.replace(/iye/g, "ie").replace(/^ye/, "e"))
    .filter((w) => w.length >= 3 && !TITLE_WORDS.has(w));
}

// The lawyer account a name in the sheet means ("Алиев Жаҳонгир
// Азизович" -> the account "Aliyev Jahongir"): every identifying word of
// one name is in the other. None, or more than one: null — the importer
// then asks.
export function guessLawyer(name, accounts) {
  const words = personWords(name);
  if (words.length === 0) return null;
  const hits = (accounts || []).filter((a) => {
    const theirs = personWords(a.name);
    return theirs.length > 0 && (words.every((w) => theirs.includes(w)) || theirs.every((w) => words.includes(w)));
  });
  return hits.length === 1 ? hits[0] : null;
}

const NOTE_FIELDS = ["lastCall", "tasks", "work", "comments"];

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Text cells only count if they contain a letter ("0", "-" are noise).
const textOnly = (value) => (/\p{L}/u.test(value) ? value : "");
// Same as the server's: a row marked as the example.
const EXAMPLE_ROW = /\((мисол|misol|пример|example)\)/i;

// Dashes, zeros, question marks: nothing to keep.
const noise = (v) => /^[\s\-–—.,?0]*$/.test(v);
const DATE_TOKEN = /\d{1,2}[./,-]\d{1,2}[./,-]\d{2,4}/g;
const CURRENCY = /(сўм|сум|so['ʻ’`]?m|sum|uzs|\$)/gi;
const shownDate = (d) => `${d.date}${d.time ? ` ${d.time}` : ""}`;

// One sheet row -> a client row for the server (or null if it's empty).
// `mapping[i]` is the field of column i; `titles[i]` its title (used to
// label notes); `extra` adds { operatorId, sheet, row }.
//
// Nothing written in the sheet is lost: whatever doesn't fit its column (a
// Telegram username in the phone column, words in a date or amount, a second
// date) goes onto the client's history, labelled with the column's title.
export function toClientRow(cells, mapping, titles, extra = {}) {
  const get = (key) => {
    const i = mapping.indexOf(key);
    return i >= 0 ? String(cells[i] ?? "").trim() : "";
  };
  const title = (key) => String(titles[mapping.indexOf(key)] || "").trim();
  const notes = [];
  const keep = (label, value) => notes.push(`${label}: ${value}`);

  // A "name" without a single letter ("0", "-", "12") is noise, not a person.
  const raw = textOnly(get("name"));
  const phoneCell = fullNumbers(get("phones"));
  const phones = parsePhones(phoneCell);
  if (!raw && phones.length === 0) return null;
  // The sheet's filled-in example ("Каримов Карим (мисол)") isn't a client.
  if (EXAMPLE_ROW.test(raw)) return null;

  const { name, city, matter: matterInName } = splitName(raw);

  // Phone column: Telegram usernames and any words are kept.
  for (const [handle] of phoneCell.matchAll(/@\s?[A-Za-z0-9_.]{3,}/g)) keep("Telegram", handle.replace(/\s/g, ""));
  const phoneWords = phoneCell.replace(/@\s?[A-Za-z0-9_.]{3,}/g, "").replace(/[\d\s+()-]/g, "");
  if (/\p{L}/u.test(phoneWords)) keep(title("phones"), phoneCell);

  // Email: an address, or (written there instead) a note.
  let email = null;
  const emailCell = get("email");
  if (looksLikeEmail(emailCell)) email = emailCell;
  else if (emailCell && !noise(emailCell)) keep(title("email"), emailCell);

  // What it's about: written after the name and/or in its own column — both
  // kept when they differ ("Ajrim. Toshkentda ofisda"). An address written
  // there is the email.
  let columnMatter = textOnly(get("matter"));
  if (columnMatter && looksLikeEmail(columnMatter)) {
    if (!email) email = columnMatter.trim();
    columnMatter = "";
  }
  const matter =
    [matterInName, columnMatter]
      .filter(Boolean)
      .filter((m, i, all) => all.findIndex((o) => searchable(o) === searchable(m)) === i)
      .join(". ") || null;

  const numberCell = get("number");
  const number = /\d/.test(numberCell) && numberCell !== "0" ? numberCell : null;
  if (!number && textOnly(numberCell)) keep(title("number"), numberCell);

  // Stage and result words -> status; other text kept.
  const stageCell = get("stage");
  const stage = parseStage(stageCell);
  if (stageCell && !stage.status && !stage.legalStage && !noise(stageCell)) keep(title("stage"), stageCell);
  const finalCell = get("final");
  const final = parseStage(finalCell);
  if (finalCell && !final.status && !final.legalStage && !noise(finalCell)) {
    const d = parseDate(finalCell);
    keep(title("final"), d && !/\p{L}/u.test(finalCell) ? shownDate(d) : finalCell);
  }

  // Dates: the first one is used; a cell with more (or with words) is kept.
  const dateOf = (key) => {
    const cell = get(key);
    const d = parseDate(cell);
    if (cell && !noise(cell) && (!d || (cell.match(DATE_TOKEN) || []).length > 1 || /\p{L}/u.test(cell))) keep(title(key), cell);
    return d;
  };
  const start = dateOf("startDate");
  const contractOn = dateOf("contractDate");
  const next = dateOf("nextCall");

  // Amounts: a number (words like "сўм" are fine); anything else is kept.
  const amountOf = (key) => {
    const cell = get(key);
    const n = parseAmount(cell);
    const words = cell.replace(CURRENCY, "").replace(/млн|mln|million|миллион|минг|ming|тыс/gi, "");
    if (cell && !noise(cell) && (n == null || /\p{L}/u.test(words))) keep(title(key), cell);
    return n;
  };
  const contractAmount = amountOf("contractAmount");
  const paid = amountOf("paid");

  for (const key of NOTE_FIELDS) {
    let value = get(key);
    if (!value) continue;
    if (key === "lastCall") {
      const d = parseDate(value);
      if (d) value = shownDate(d);
    }
    keep(title(key), value);
  }
  // Any other column the importer keeps as notes.
  mapping.forEach((key, i) => {
    if (key !== "note") return;
    const value = String(cells[i] ?? "").trim();
    if (!value || noise(value)) return;
    const serial = /^\d{5}(\.\d+)?$/.test(value) ? parseDate(value) : null;
    keep(String(titles[i] || "").trim(), serial ? shownDate(serial) : value);
  });

  return {
    clientId: /^\d{1,9}$/.test(get("clientId")) ? Number(get("clientId")) : null,
    name,
    phones,
    city: capitalize(textOnly(get("city")) || city) || null,
    email,
    matter,
    lawyer: textOnly(get("lawyer")) || null,
    number,
    status: stage.status || final.status || null,
    legalStage: stage.legalStage || final.legalStage || null,
    startDate: start?.date || null,
    contractDate: contractOn?.date || null,
    contractAmount,
    paid,
    nextCallAt: next ? new Date(`${next.date}T${next.time || "10:00"}:00`).toISOString() : null,
    notes,
    ...extra,
  };
}
