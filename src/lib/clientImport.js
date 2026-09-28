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
].map((f) => ({ ...f, words: f.words.map(searchable), not: (f.not || []).map(searchable) }));

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

export function guessMapping(headerRow) {
  const used = new Set();
  return (headerRow || []).map((title) => {
    const key = guessField(title);
    // One column per field; later duplicates (e.g. a second "summa") are left out.
    if (!key || used.has(key)) return "";
    used.add(key);
    return key;
  });
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
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\s+(\d{1,2})[:.](\d{2}))?/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    const month = Number(m[2]);
    const day = Number(m[1]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { date: `${year}-${pad(month)}-${pad(day)}`, time: m[4] ? `${pad(m[4])}:${m[5]}` : null };
  }
  return null;
}

// "15000000", "1.5E7", "450.000", "15 000 000 сўм" -> 15000000
export function parseAmount(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (/^[\d.]+e[+-]?\d+$/i.test(s) || /^\d+(\.\d+)?$/.test(s) && !/^\d{1,3}(\.\d{3})+$/.test(s)) {
    const n = Math.round(Number(s));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const digits = s.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

// Phone numbers in a cell — several may share one ("+998… +998…", or two
// 12-digit numbers run together).
export function parsePhones(value) {
  const out = [];
  for (const match of String(value ?? "").match(/\+?\d[\d\s\-()]{6,}\d/g) || []) {
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

const CITIES = [
  "toshkent", "tashkent", "andijon", "buxoro", "samarqand", "namangan", "fargona", "qoqon", "xorazm", "urganch",
  "navoiy", "qarshi", "termiz", "jizzax", "guliston", "nukus", "nurobod", "qashqadaryo", "surxondaryo", "sirdaryo",
  "margilon", "chirchiq", "angren", "olmaliq", "denov", "shahrisabz", "kattaqorgon", "xiva", "bekobod", "yangiyol",
].map(searchable);

// "Qosimova Gulnora. Toshkent. Erini …" / "Otajonova Odinaxon /Andijon/ Ajrim"
// -> the name, a city if one is named, and the rest as what it's about.
export function splitName(value) {
  const parts = String(value ?? "")
    .split(/[./]|\s{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { name: "" };
  let [name, ...rest] = parts;
  // "Искандар Тошкент": a city as the last word of the name.
  const nameWords = name.split(/\s+/);
  if (nameWords.length >= 2 && CITIES.includes(searchable(nameWords[nameWords.length - 1]))) {
    rest = [nameWords.pop(), ...rest];
    name = nameWords.join(" ");
  }
  let city = null;
  const matter = [];
  for (const part of rest) {
    if (!city && CITIES.includes(searchable(part))) city = part;
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

const NOTE_FIELDS = ["lastCall", "tasks", "work", "comments"];

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Text cells only count if they contain a letter ("0", "-" are noise).
const textOnly = (value) => (/\p{L}/u.test(value) ? value : "");

// One sheet row -> a client row for the server (or null if it's empty).
// `mapping[i]` is the field of column i; `titles[i]` its title (used to
// label notes); `extra` adds { operatorId, sheet, row }.
export function toClientRow(cells, mapping, titles, extra = {}) {
  const get = (key) => {
    const i = mapping.indexOf(key);
    return i >= 0 ? String(cells[i] ?? "").trim() : "";
  };
  // A "name" without a single letter ("0", "-", "12") is noise, not a person.
  const raw = textOnly(get("name"));
  const phones = parsePhones(get("phones"));
  if (!raw && phones.length === 0) return null;

  const { name, city, matter } = splitName(raw);
  const stage = parseStage(get("stage"));
  const final = parseStage(get("final"));
  const start = parseDate(get("startDate"));
  const contractOn = parseDate(get("contractDate"));
  const next = parseDate(get("nextCall"));

  const notes = [];
  for (const key of NOTE_FIELDS) {
    const i = mapping.indexOf(key);
    let value = get(key);
    if (!value) continue;
    if (key === "lastCall") {
      const d = parseDate(value);
      if (d) value = `${d.date}${d.time ? ` ${d.time}` : ""}`;
    }
    notes.push(`${String(titles[i] || "").trim()}: ${value}`);
  }
  // The "final" column: a result word becomes the status (above); other
  // text is kept as a note. Bare numbers and dashes are noise.
  const finalText = get("final");
  if (finalText && !final.status && !final.legalStage && !parseDate(finalText) && !/^[\d\s+.,-]*$/.test(finalText)) {
    notes.push(`${String(titles[mapping.indexOf("final")] || "").trim()}: ${finalText}`);
  }

  return {
    clientId: /^\d{1,9}$/.test(get("clientId")) ? Number(get("clientId")) : null,
    name,
    phones,
    city: capitalize(textOnly(get("city")) || city) || null,
    email: /@/.test(get("email")) ? get("email") : null,
    matter: textOnly(get("matter")) || matter || null,
    lawyer: textOnly(get("lawyer")) || null,
    number: /\d/.test(get("number")) && get("number") !== "0" ? get("number") : null,
    status: stage.status || final.status || null,
    legalStage: stage.legalStage || final.legalStage || null,
    startDate: start?.date || null,
    contractDate: contractOn?.date || null,
    contractAmount: parseAmount(get("contractAmount")),
    paid: parseAmount(get("paid")),
    nextCallAt: next ? new Date(`${next.date}T${next.time || "10:00"}:00`).toISOString() : null,
    notes,
    ...extra,
  };
}
