// Ledger's notifications in this browser (Web Push — the server encrypts
// each one for this browser: call-center-backend src/services/push/web.js).
// A click opens that page of the portal: in a Ledger tab that's already
// open, or a new one.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Ledger", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Ledger", {
      body: data.body || "",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      data: { link: typeof data.link === "string" && data.link.startsWith("/") ? data.link : "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        open.postMessage({ type: "ledger-open", link });
        return;
      }
      await self.clients.openWindow(link);
    })()
  );
});
