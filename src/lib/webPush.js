import { api } from "./api";
import { inApp } from "./appBridge";

// Ledger's notifications in the browser (public/sw.js shows them). Inside
// the Android app the app's own notifications do this instead.

export const webPushSupported = () =>
  !inApp && typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const webPushPermission = () => (webPushSupported() ? Notification.permission : "unsupported");

function keyBytes(base64) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

const sameKey = (a, b) => a && b && a.byteLength === b.byteLength && new Uint8Array(a).every((x, i) => x === b[i]);

// This browser's subscription, made or refreshed, and told to the server.
// Quietly does nothing without permission or when the server has no keys.
export async function syncWebPush() {
  if (webPushPermission() !== "granted") return false;
  const { publicKey } = await api.webPushKey();
  if (!publicKey) return false;
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const key = keyBytes(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  // Made for another server key (a reinstalled server): start again.
  if (subscription && !sameKey(subscription.options?.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await api.webPushSubscribe(subscription.toJSON());
  return true;
}

// Asks the browser (it must come from a tap or click), then subscribes.
export async function enableWebPush() {
  if (!webPushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;
  await syncWebPush();
  return "granted";
}

// Signing out here: this browser gets nobody's notifications any more.
export async function dropWebPush() {
  if (!webPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await api.webPushUnsubscribe(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe();
  } catch {
    // Nothing to undo.
  }
}
