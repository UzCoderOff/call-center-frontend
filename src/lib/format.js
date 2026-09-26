// Formatting for dates, durations, numbers and phone numbers. Every function
// takes the active language's `time` dictionary (from i18n) rather than
// relying on the browser's Intl data, whose Uzbek coverage varies by phone —
// this way "26-sentabr, 14:30" looks the same on every device.

const pad2 = (n) => String(n).padStart(2, "0");

function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isSameDay(a, b) {
  return startOfDay(a) === startOfDay(b);
}

export function formatNumber(n, lang) {
  const value = Math.round(n || 0);
  const grouped = String(Math.abs(value)).replace(/\B(?=(\d{3})+(?!\d))/g, lang === "uz" ? " " : ",");
  return value < 0 ? `−${grouped}` : grouped;
}

export function formatPercent(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

// 3725 -> [{n:1,unit:"soat"},{n:2,unit:"daq"}]. Only the two largest units,
// and seconds only under 10 minutes — precision nobody reads is noise.
export function durationParts(totalSeconds, time) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return m > 0 ? [{ n: h, unit: time.hours }, { n: m, unit: time.minutesShort }] : [{ n: h, unit: time.hours }];
  if (m > 0) {
    return sec > 0 && m < 10
      ? [{ n: m, unit: time.minutesShort }, { n: sec, unit: time.secondsShort }]
      : [{ n: m, unit: time.minutesShort }];
  }
  return [{ n: sec, unit: time.secondsShort }];
}

// 3725 -> "1 soat 2 daq" / "1h 2m"; 312 -> "5 daq 12 son" / "5m 12s"
export function formatDuration(totalSeconds, time) {
  const sep = time.hours.length > 1 ? " " : "";
  return durationParts(totalSeconds, time)
    .map((p) => `${p.n}${sep}${p.unit}`)
    .join(" ");
}

// Audio player clock: 83 -> "1:23"
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

export function formatTime(ms) {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// "26-sentabr" / "Sep 26" (+ year when it isn't the current one)
export function formatDate(ms, lang, time) {
  if (!ms) return "—";
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const month = time.months[d.getMonth()];
  if (lang === "uz") return `${d.getDate()}-${month}${sameYear ? "" : ` ${d.getFullYear()}-yil`}`;
  return `${month} ${d.getDate()}${sameYear ? "" : `, ${d.getFullYear()}`}`;
}

// "Bugun, 14:30" · "Kecha, 09:05" · "24-sentabr, 16:12"
export function formatDateTime(ms, lang, time) {
  if (!ms) return "—";
  const now = Date.now();
  let day;
  if (isSameDay(ms, now)) day = time.today;
  else if (isSameDay(ms, now - 86400000)) day = time.yesterday;
  else day = formatDate(ms, lang, time);
  return `${day}, ${formatTime(ms)}`;
}

// Section headers in the call list: "Bugun" · "Kecha" · "Payshanba, 24-sentabr"
export function formatDayHeader(ms, lang, time) {
  const now = Date.now();
  if (isSameDay(ms, now)) return time.today;
  if (isSameDay(ms, now - 86400000)) return time.yesterday;
  return `${time.weekdays[new Date(ms).getDay()]}, ${formatDate(ms, lang, time)}`;
}

// Chart axis: "2026-09-24" -> "24.09" / "Sep 24"
export function formatAxisDate(isoDate, lang, time) {
  const [, m, d] = isoDate.split("-").map(Number);
  return lang === "uz" ? `${pad2(d)}.${pad2(m)}` : `${time.months[m - 1]} ${d}`;
}

export function formatIsoDateLong(isoDate, lang, time) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return formatDate(new Date(y, m - 1, d).getTime(), lang, time);
}

export function formatRelative(ms, time, t) {
  if (!ms) return "—";
  const diff = Date.now() - new Date(ms).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return time.justNow;
  if (minutes < 60) return t("time.minutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hoursAgo", { n: hours });
  return t("time.daysAgo", { n: Math.floor(hours / 24) });
}

// "+998901234567" -> "+998 90 123 45 67"; "901234567" -> "90 123 45 67";
// anything else is shown as the phone logged it.
export function formatPhone(raw) {
  if (!raw) return "—";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("998")) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  }
  if (digits.length === 9) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
  }
  return String(raw);
}

// A tel: link that works from a phone browser — the whole point of showing
// "needs a callback" on the phone employees already hold.
export function telHref(raw) {
  const digits = String(raw || "").replace(/[^\d+]/g, "");
  return digits.replace(/\D/g, "").length >= 5 ? `tel:${digits}` : null;
}

// Minutes from midnight -> "09:30" (calendar times).
export function formatMinutes(minutes) {
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

// "YYYY-MM-DD" arithmetic, independent of the viewer's timezone.
export function shiftIso(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86400000).toISOString().slice(0, 10);
}

// 1 = Monday … 7 = Sunday
export function isoWeekday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function weekStartOf(iso) {
  return shiftIso(iso, 1 - isoWeekday(iso));
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// "Dushanba, 28-sentabr" for a "YYYY-MM-DD"
export function formatIsoDay(iso, lang, time) {
  return `${time.weekdays[isoWeekday(iso) % 7]}, ${formatIsoDateLong(iso, lang, time)}`;
}

// "28-sentabr – 4-oktabr" / "Sep 28 – Oct 4"
export function formatWeekRange(weekStart, lang, time) {
  return `${formatIsoDateLong(weekStart, lang, time)} – ${formatIsoDateLong(shiftIso(weekStart, 6), lang, time)}`;
}

// Epoch-ms range for a dashboard preset, in the viewer's local time.
export function rangeFor(key) {
  const now = Date.now();
  if (key === "today") return { from: startOfDay(now), to: now };
  const days = { "7d": 7, "30d": 30, "90d": 90 }[key] || 7;
  return { from: startOfDay(now - (days - 1) * 86400000), to: now };
}
