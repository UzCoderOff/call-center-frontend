// Which sections a signed-in person can use — shared by the navigation and
// the route guards so the two never disagree. The server enforces the same
// rules independently; this only decides what to show.
const isManager = (user) => user.role === "BOSS" || user.role === "DEVELOPER";
// The firm's other lawyers: their own calendar and their own clients' cases.
export const isLawyer = (user) => user.role === "LAWYER";

export function canSeeCalls(user) {
  return isManager(user) || Boolean(user.employee?.collectCalls);
}

export function canSeeReports(user) {
  return isManager(user) || Boolean(user.employee?.hasReport);
}

export function canSeeTeam(user) {
  return isManager(user);
}

// The lawyers' calendars: managers always; staff per their calendar access;
// a lawyer their own.
export function canSeeCalendar(user) {
  return isManager(user) || isLawyer(user) || (user.employee?.calendarAccess ?? "none") !== "none";
}

export function canBookAppointments(user) {
  return isManager(user) || user.employee?.calendarAccess === "book";
}

// What a staff member does (Employee.job): "call_center" | "coordinator" |
// "office" | "other". Their home page and tools follow it.
export const jobOf = (user) => user?.employee?.job || "other";
export const isCoordinator = (user) => jobOf(user) === "coordinator";
export const isCallCenter = (user) => jobOf(user) === "call_center";

// The clients database: managers, and staff who deal with clients
// (call-center staff, anyone who books appointments, coordinators); a lawyer
// sees their own clients.
export function canSeeClients(user) {
  return isManager(user) || isLawyer(user) || Boolean(user.employee?.collectCalls) || user.employee?.calendarAccess === "book" || isCoordinator(user);
}

// Money from clients — contract amounts, payments, debts: the developer, and
// boss/lawyer accounts the developer gave the "Moliya" switch (the server
// decides and leaves money out for everyone else).
export function canSeeFinance(user) {
  return Boolean(user?.finance);
}

// Natijalar (performance): managers see everyone; a staff member their own.
export function canSeePerformance(user) {
  return isManager(user) || Boolean(user.employee);
}

// Days off: staff ask for theirs; managers approve and see everyone's.
export function canSeeDaysOff(user) {
  return isManager(user) || Boolean(user.employee);
}

export function canManageClients(user) {
  return isManager(user);
}

// Training materials: everyone reads the ones meant for them; the boss and
// the developer write them and choose who sees each.
export function canManageMaterials(user) {
  return isManager(user);
}
