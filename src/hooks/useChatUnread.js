import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useLive } from "./useLive";

// Unread chat messages: the menu badge and the chat list.
//
// Reading is shown at once, without waiting for the server: opening a chat
// marks it read here (markReadHere) and the badge and list drop it straight
// away; the server is told in the background. If that didn't get through
// (a bad connection), the next page load simply shows it unread again —
// the server's count is the truth, this only covers the moment between.

let summary = { total: 0, byConv: {} };
// conversationId -> the newest message read here
const readHere = new Map();
const listeners = new Set();

// The server's count, less the chats read here up to their newest message.
function badgeTotal() {
  let total = 0;
  for (const [id, { n, last }] of Object.entries(summary.byConv || {})) {
    if ((readHere.get(Number(id)) || 0) < last) total += n;
  }
  return total;
}

function publish() {
  const total = badgeTotal();
  for (const l of listeners) l(total);
}

export async function refreshChatUnread() {
  try {
    summary = await api.chatUnread();
    publish();
  } catch {
    // Offline or signed out: keep the last count.
  }
}

const markListeners = new Set();

// This chat is read up to `messageId` — on screen now, on the server soon.
export function markReadHere(conversationId, messageId) {
  if (!messageId) return;
  const before = readHere.get(conversationId) || 0;
  if (messageId <= before) return;
  readHere.set(conversationId, messageId);
  publish();
  for (const l of markListeners) l((n) => n + 1);
  api.markChatRead(conversationId, messageId).catch(() => {
    // Not through: it shows as unread again after a reload — no harm.
  });
}

// What the list shows for a chat: none unread once read here up to its
// newest message.
export function unreadShown(conv) {
  const read = readHere.get(conv.id) || 0;
  return conv.lastMessage && read >= conv.lastMessage.id ? 0 : conv.unread;
}

// Redraws (the chat list) whenever a chat is read here.
export function useReadMarks() {
  const [, setMarks] = useState(0);
  useEffect(() => {
    markListeners.add(setMarks);
    return () => markListeners.delete(setMarks);
  }, []);
}

export function useChatUnread() {
  const [count, setCount] = useState(badgeTotal);
  useEffect(() => {
    listeners.add(setCount);
    refreshChatUnread();
    // A fallback check now and then; the live updates do the real work.
    const timer = setInterval(refreshChatUnread, 2 * 60 * 1000);
    return () => {
      listeners.delete(setCount);
      clearInterval(timer);
    };
  }, []);
  useLive(refreshChatUnread);
  return count;
}
