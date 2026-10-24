import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useLive } from "./useLive";

// The bell's number: notifications not seen yet (routes/notices.js on the
// server). One count for every bell on screen; the live updates refresh it
// the moment something new comes, and seeing the list clears it at once.

let count = 0;
const listeners = new Set();

function publish(next) {
  count = next;
  for (const l of listeners) l(count);
}

export async function refreshNoticeUnread() {
  try {
    const { unread } = await api.noticesUnread();
    publish(unread);
  } catch {
    // Offline or signed out: keep the last count.
  }
}

// The list was seen: no wait for the server.
export function clearNoticeUnread() {
  publish(0);
}

export function useNoticeUnread() {
  const [value, setValue] = useState(count);
  useEffect(() => {
    listeners.add(setValue);
    refreshNoticeUnread();
    const timer = setInterval(refreshNoticeUnread, 2 * 60 * 1000);
    return () => {
      listeners.delete(setValue);
      clearInterval(timer);
    };
  }, []);
  useLive(refreshNoticeUnread);
  return value;
}
