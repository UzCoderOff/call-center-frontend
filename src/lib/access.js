// Which sections a signed-in person can use — shared by the navigation and
// the route guards so the two never disagree. The server enforces the same
// rules independently; this only decides what to show.
const isManager = (user) => user.role === "BOSS" || user.role === "DEVELOPER";

export function canSeeCalls(user) {
  return isManager(user) || Boolean(user.employee?.collectCalls);
}

export function canSeeReports(user) {
  return isManager(user) || Boolean(user.employee?.hasReport);
}

export function canSeeTeam(user) {
  return isManager(user);
}

// The lawyer's calendar: managers always; staff per their calendar access.
export function canSeeCalendar(user) {
  return isManager(user) || (user.employee?.calendarAccess ?? "none") !== "none";
}

export function canBookAppointments(user) {
  return isManager(user) || user.employee?.calendarAccess === "book";
}
