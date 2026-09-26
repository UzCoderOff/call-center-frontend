// When the portal runs inside the Android app, the app injects
// `window.LedgerApp` (see PortalActivity.kt / AppBridge.kt). Through it the
// portal hands off things only the app can do:
//
//   logout()            sign this phone out (revokes its device token) and
//                       return to the app's own sign-in screen
//   sessionExpired()    the portal got a 401 — the app renews the session
//                       with its device token and reloads (or, if the phone
//                       was signed out remotely, shows its sign-in screen)
//   syncNow()           run a call sync right away
//   shareDiagnostics()  share the app's sync log (Telegram, email…)
//   openSetup()         the phone-setup guide (permissions, battery, auto-launch)
//   appVersion()        e.g. "2.0.0"
//   isCollectingCalls() whether this phone syncs calls
//
// In a normal browser none of this exists and the portal behaves as a website.
const bridge = typeof window !== "undefined" ? window.LedgerApp : undefined;

export const inApp = Boolean(bridge);

// Whether this version of the app has `method` (older versions lack newer ones).
export function hasBridge(method) {
  return Boolean(bridge) && typeof bridge[method] === "function";
}

export function callBridge(method, ...args) {
  try {
    if (bridge && typeof bridge[method] === "function") return bridge[method](...args);
  } catch {
    // A failing bridge call must never break the page.
  }
  return undefined;
}
