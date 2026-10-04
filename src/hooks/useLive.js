import { useEffect, useRef } from "react";
import { api } from "../lib/api";

// "Something changed for me" from the server the moment it happens (a chat
// message, a chat read on another screen…): one question at a time,
// GET /api/live?v=…, which the server answers as soon as there's news (or
// after ~20 s). Every screen that cares listens here (useLive) and fetches
// what it needs. Only while the tab is open and in view; coming back to it
// counts as "something changed".

const listeners = new Set();
let version = null;
let running = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const visible = () => document.visibilityState === "visible";
const tell = () => {
  for (const listener of listeners) listener();
};

async function loop() {
  if (running) return;
  running = true;
  try {
    while (listeners.size > 0 && visible()) {
      try {
        const { v } = await api.live(version ?? undefined);
        if (version !== null && v !== version) tell();
        version = v;
      } catch {
        // Offline or the server restarting: try again shortly.
        await sleep(3000);
      }
    }
  } finally {
    running = false;
  }
}

function onVisibility() {
  if (!visible()) return;
  tell();
  loop();
}

// Calls `onChange` whenever something of mine changed on the server.
export function useLive(onChange) {
  const ref = useRef(onChange);
  useEffect(() => {
    ref.current = onChange;
  });
  useEffect(() => {
    const listener = () => ref.current();
    listeners.add(listener);
    if (listeners.size === 1) document.addEventListener("visibilitychange", onVisibility);
    loop();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
