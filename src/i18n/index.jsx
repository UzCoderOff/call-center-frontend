import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import uz from "./uz";
import en from "./en";
import { readPref, writePref } from "../lib/prefs";
import * as f from "../lib/format";

// Uzbek is the default for everyone. Adding a language (e.g. Uzbek
// Cyrillic or Russian) is: copy en.js, translate it, and add it here.
export const LANGUAGES = [
  { code: "uz", label: "Oʻzbekcha", dict: uz },
  { code: "en", label: "English", dict: en },
];
const DICTS = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.dict]));
const DEFAULT_LANG = "uz";

function lookup(dict, key) {
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

function interpolate(text, vars) {
  if (!vars || typeof text !== "string") return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] !== undefined ? String(vars[name]) : match));
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = readPref("lang", DEFAULT_LANG);
    return DICTS[saved] ? saved : DEFAULT_LANG;
  });

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((code) => {
    if (!DICTS[code]) return;
    writePref("lang", code);
    setLangState(code);
  }, []);

  const value = useMemo(() => {
    const dict = DICTS[lang];
    const t = (key, vars) => {
      const text = lookup(dict, key) ?? lookup(en, key) ?? key;
      return interpolate(text, vars);
    };
    const time = dict.time;
    const fmt = {
      number: (n) => f.formatNumber(n, lang),
      duration: (s) => f.formatDuration(s, time),
      durationParts: (s) => f.durationParts(s, time),
      clock: f.formatClock,
      time: f.formatTime,
      date: (ms) => f.formatDate(ms, lang, time),
      dateTime: (ms) => f.formatDateTime(ms, lang, time),
      dayHeader: (ms) => f.formatDayHeader(ms, lang, time),
      axisDate: (iso) => f.formatAxisDate(iso, lang, time),
      isoDateLong: (iso) => f.formatIsoDateLong(iso, lang, time),
      isoDay: (iso) => f.formatIsoDay(iso, lang, time),
      weekdayShort: (iso) => time.weekdaysShort[f.isoWeekday(iso) % 7],
      dayOfMonth: (iso) => Number(iso.slice(8, 10)),
      weekRange: (weekStart) => f.formatWeekRange(weekStart, lang, time),
      minutes: f.formatMinutes,
      relative: (ms) => f.formatRelative(ms, time, t),
      phone: f.formatPhone,
    };
    return { lang, setLang, t, fmt };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
