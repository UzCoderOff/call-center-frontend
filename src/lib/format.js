export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatDateTime(ms) {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const CALL_TYPE_LABEL = {
  incoming: "Incoming",
  outgoing: "Outgoing",
  missed: "Missed",
  rejected: "Rejected",
  voicemail: "Voicemail",
  unknown: "Unknown",
};

export function callTypeTone(callType, missed) {
  if (missed) return "clay";
  if (callType === "outgoing") return "navy";
  return "sage";
}

// Returns [{ from, to, label }] epoch-ms ranges for the dashboard's date filter.
export function rangePreset(key) {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  switch (key) {
    case "today":
      return { from: startOfToday.getTime(), to: now, label: "Today" };
    case "7d":
      return { from: now - 7 * 86400000, to: now, label: "Last 7 days" };
    case "30d":
      return { from: now - 30 * 86400000, to: now, label: "Last 30 days" };
    default:
      return { from: undefined, to: undefined, label: "All time" };
  }
}
