// Per-device preferences (language, theme). localStorage can be unavailable
// (private mode, blocked site data) — every access is guarded and the app
// works with the defaults when it is.
const PREFIX = "ledger.";

export function readPref(key, fallback) {
  try {
    return window.localStorage.getItem(PREFIX + key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // Not persisted — the choice still applies for this visit.
  }
}

// "auto" follows the device; "light"/"dark" pin it (see styles/tokens.css).
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "light" || theme === "dark") root.setAttribute("data-theme", theme);
  else root.removeAttribute("data-theme");
}
