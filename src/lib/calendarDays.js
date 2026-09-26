// Helpers for one day of the lawyer's plan. Blocks are
// { date, start, end, kind, note? } — kind "available" (reception), "busy"
// (court, a trip…) or "break" (lunch); times in minutes from midnight.
// Mirrors src/services/calendar.js on the backend.

export const KINDS = ["available", "busy", "break"];
export const WHOLE_DAY = { start: 0, end: 24 * 60 };
export const STEP = 15;

export const byStart = (a, b) => a.start - b.start;

export function blocksOn(blocks, date) {
  return blocks.filter((b) => b.date === date).sort(byStart);
}

// An ordinary working day from the calendar's settings (the usual week).
export function usualDay(usual, date) {
  const { dayStart, dayEnd, lunch } = usual;
  if (!lunch) return [{ date, start: dayStart, end: dayEnd, kind: "available" }];
  return [
    { date, start: dayStart, end: lunch.start, kind: "available" },
    { date, start: lunch.start, end: lunch.end, kind: "break", note: "Tushlik" },
    { date, start: lunch.end, end: dayEnd, kind: "available" },
  ].filter((b) => b.end - b.start >= STEP);
}

export const isWholeDay = (b) => b.start === WHOLE_DAY.start && b.end === WHOLE_DAY.end;

const sameBlocks = (a, b) =>
  a.length === b.length &&
  a.every((x, i) => x.start === b[i].start && x.end === b[i].end && x.kind === b[i].kind && (x.note || "") === (b[i].note || ""));

// Which of the day-editor's choices a day's blocks match.
export function dayMode(dayBlocks, usual, date) {
  if (dayBlocks.length === 0) return "off";
  if (dayBlocks.length === 1 && dayBlocks[0].kind === "busy" && isWholeDay(dayBlocks[0])) return "busy";
  if (usual && sameBlocks(dayBlocks, usualDay(usual, date))) return "usual";
  return "custom";
}

export function replaceDay(blocks, date, dayBlocks) {
  return [...blocks.filter((b) => b.date !== date), ...dayBlocks].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start - b.start
  );
}

// Problems with a hand-made day, or null.
export function checkDay(dayBlocks) {
  const sorted = [...dayBlocks].sort(byStart);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].end - sorted[i].start < STEP) return "invalidRange";
    if (i > 0 && sorted[i].start < sorted[i - 1].end) return "overlap";
  }
  return null;
}
