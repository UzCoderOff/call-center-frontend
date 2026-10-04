import { useEffect, useState } from "react";
import { api } from "../lib/api";

// Unread chat messages for the menu badge: one count shared by everything on
// screen, checked every 30 s (and when the page comes back into view), and
// right away after reading a chat (refreshChatUnread).

let total = 0;
const listeners = new Set();
let timer = null;

function publish(next) {
  total = next;
  for (const l of listeners) l(total);
}

export async function refreshChatUnread() {
  try {
    publish((await api.chatUnread()).total || 0);
  } catch {
    // Offline or signed out: keep the last count.
  }
}

function onVisible() {
  if (document.visibilityState === "visible") refreshChatUnread();
}

export function useChatUnread() {
  const [count, setCount] = useState(total);
  useEffect(() => {
    listeners.add(setCount);
    if (listeners.size === 1) {
      refreshChatUnread();
      timer = setInterval(refreshChatUnread, 30 * 1000);
      document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
      listeners.delete(setCount);
      if (listeners.size === 0) {
        clearInterval(timer);
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, []);
  return count;
}
