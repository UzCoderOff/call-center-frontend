// A quick action (a tick, a delete, a note) that didn't reach the server
// must say so — otherwise the spinner just stops and people tap again, or
// think it saved. Session expiry (401) already sends people to sign in.
export function saveFailed(err, t) {
  if (err?.status === 401) return;
  window.alert(err?.code === "network_error" || err?.code === "timeout" ? t("common.offlineAlert") : t("common.saveFailedAlert"));
}
