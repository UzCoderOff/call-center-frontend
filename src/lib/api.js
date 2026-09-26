// Thin wrapper around fetch for the call-center-backend API.
//
// Every request goes to this app's OWN origin at /api — the dev server
// (vite.config.js) or Vercel (vercel.json) forwards it to the backend. The
// browser therefore never talks to the backend's domain directly, and the
// httpOnly session cookie the backend sets is a first-party cookie.
//
// That is the fix for "Couldn't load stats" on phones: the portal used to
// call the backend cross-site, which made the session cookie a third-party
// cookie — and iPhones (every browser) and many Android browsers silently
// refuse those. Login "succeeded", then every later request came back 401.
const BASE = "/api";

export class ApiError extends Error {
  constructor(code, status, body) {
    super(code);
    this.code = code;
    this.status = status;
    this.body = body;
  }
}

// Called on any 401 outside of the auth endpoints — the session expired or
// the account was deactivated. The auth layer uses it to return to login.
let unauthorizedHandler = null;
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

async function request(path, { method = "GET", body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      credentials: "same-origin",
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError("network_error", 0, null);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/") && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(data?.error || `http_${res.status}`, res.status, data);
  }
  return data;
}

function qs(params = {}) {
  const clean = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return clean.length ? `?${new URLSearchParams(clean)}` : "";
}

const tzOffset = () => -new Date().getTimezoneOffset();

export const api = {
  // --- auth ---
  login: (username, password) => request("/auth/login", { method: "POST", body: { username, password } }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  changePassword: (currentPassword, newPassword) =>
    request("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } }),

  // --- dashboard ---
  dashboard: ({ from, to, employeeId } = {}) =>
    request(`/dashboard${qs({ from, to, employeeId, tzOffset: tzOffset() })}`),

  // --- employees ---
  employees: () => request("/employees"),
  employee: (id) => request(`/employees/${id}`),
  createEmployee: (payload) => request("/employees", { method: "POST", body: payload }),
  updateEmployee: (id, payload) => request(`/employees/${id}`, { method: "PATCH", body: payload }),
  deleteEmployee: (id) => request(`/employees/${id}`, { method: "DELETE" }),
  regenerateDeviceId: (id) => request(`/employees/${id}/regenerate-device-id`, { method: "POST" }),
  resetEmployeePassword: (id) => request(`/employees/${id}/reset-password`, { method: "POST" }),

  // --- boss accounts (standalone portal logins, no Employee record) ---
  bossAccounts: () => request("/users?role=BOSS"),
  createBossAccount: (payload) => request("/users", { method: "POST", body: payload }),
  updateBossAccount: (id, payload) => request(`/users/${id}`, { method: "PATCH", body: payload }),
  resetBossPassword: (id) => request(`/users/${id}/reset-password`, { method: "POST" }),
  deleteBossAccount: (id) => request(`/users/${id}`, { method: "DELETE" }),

  revokeDevice: (employeeId, deviceId) => request(`/employees/${employeeId}/devices/${deviceId}`, { method: "DELETE" }),

  // --- calls ---
  calls: (params) => request(`/calls${qs(params)}`),
  call: (id) => request(`/calls/${id}`),
  setFollowUpHandled: (id, handled) => request(`/calls/${id}/follow-up`, { method: "PATCH", body: { handled } }),
  recordingUrl: (id) => `${BASE}/calls/${id}/recording`,

  // --- daily reports ---
  todayReport: () => request("/reports/today"),
  submitTodayReport: (answers) => request("/reports/today", { method: "PUT", body: { answers } }),
  reportsDay: (params) => request(`/reports/day${qs(params)}`),
  reports: (params) => request(`/reports${qs(params)}`),
  report: (id) => request(`/reports/${id}`),
  reviewReport: (id, comment) => request(`/reports/${id}/review`, { method: "POST", body: { comment } }),

  // --- the lawyer's calendar ---
  calendars: () => request("/calendars"),
  updateCalendar: (id, payload) => request(`/calendars/${id}`, { method: "PATCH", body: payload }),
  calendarWeek: (id, weekStart) => request(`/calendars/${id}/weeks/${weekStart}`),
  // options: { cancelAppointments, cancelReason } — see the backend route.
  saveCalendarWeek: (id, weekStart, blocks, options = {}) =>
    request(`/calendars/${id}/weeks/${weekStart}`, { method: "PUT", body: { blocks, ...options } }),
  publishCalendarWeek: (id, weekStart) => request(`/calendars/${id}/weeks/${weekStart}/publish`, { method: "POST" }),
  bookAppointment: (calendarId, payload) => request(`/calendars/${calendarId}/appointments`, { method: "POST", body: payload }),
  appointments: (params) => request(`/appointments${qs(params)}`),
  updateAppointment: (id, payload) => request(`/appointments/${id}`, { method: "PATCH", body: payload }),

  // --- organisation settings ---
  offices: () => request("/offices"),
  createOffice: (payload) => request("/offices", { method: "POST", body: payload }),
  updateOffice: (id, payload) => request(`/offices/${id}`, { method: "PATCH", body: payload }),
  deleteOffice: (id) => request(`/offices/${id}`, { method: "DELETE" }),
  positions: () => request("/positions"),
  createPosition: (payload) => request("/positions", { method: "POST", body: payload }),
  updatePosition: (id, payload) => request(`/positions/${id}`, { method: "PATCH", body: payload }),
  deletePosition: (id) => request(`/positions/${id}`, { method: "DELETE" }),
  reportTemplates: () => request("/report-templates"),
  reportTemplate: (id) => request(`/report-templates/${id}`),
  createReportTemplate: (payload) => request("/report-templates", { method: "POST", body: payload }),
  updateReportTemplate: (id, payload) => request(`/report-templates/${id}`, { method: "PATCH", body: payload }),
  deleteReportTemplate: (id) => request(`/report-templates/${id}`, { method: "DELETE" }),
};
