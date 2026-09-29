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

// A request that hasn't answered in this long is given up (a phone on a bad
// connection would otherwise spin forever) and reported as "timeout".
const TIMEOUT_MS = 30 * 1000;

async function request(path, { method = "GET", body, signal } = {}) {
  let res;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      credentials: "same-origin",
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (timedOut) throw new ApiError("timeout", 0, null);
    if (err.name === "AbortError") throw err;
    throw new ApiError("network_error", 0, null);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
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
  bossAccounts: () => request("/users"),
  createBossAccount: (payload) => request("/users", { method: "POST", body: payload }),
  updateBossAccount: (id, payload) => request(`/users/${id}`, { method: "PATCH", body: payload }),
  resetBossPassword: (id) => request(`/users/${id}/reset-password`, { method: "POST" }),
  deleteBossAccount: (id) => request(`/users/${id}`, { method: "DELETE" }),
  revokeBossDevice: (id, deviceId) => request(`/users/${id}/devices/${deviceId}`, { method: "DELETE" }),

  // --- money from clients (developer + accounts with "Moliya") ---
  finance: (month) => request(`/finance${qs({ month })}`),

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
  // A run of days: { from, to, officeId? } — totals per form and per person.
  reportsSummary: (params) => request(`/reports/summary${qs(params)}`),
  reportsExportUrl: (params) => `${BASE}/reports/export${qs(params)}`,
  autoReport: (params) => request(`/reports/auto${qs(params)}`),
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
  // The consultation fee, when paid after booking: { feeAmount, feeMethod }.
  appointmentFee: (id, payload) => request(`/appointments/${id}/fee`, { method: "POST", body: payload }),

  // --- tasks (the boss gives someone work with a due time) ---
  tasks: (params) => request(`/tasks${qs(params)}`),
  taskPeople: () => request("/tasks/people"),
  createTask: (payload) => request("/tasks", { method: "POST", body: payload }),
  updateTask: (id, payload) => request(`/tasks/${id}`, { method: "PATCH", body: payload }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: "DELETE" }),

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

  // --- clients database ---
  clients: (params) => request(`/clients${qs(params)}`),
  client: (id) => request(`/clients/${id}`),
  createClient: (payload) => request("/clients", { method: "POST", body: payload }),
  updateClient: (id, payload) => request(`/clients/${id}`, { method: "PATCH", body: payload }),
  // "Delete" archives; restore brings the client back.
  archiveClient: (id) => request(`/clients/${id}`, { method: "DELETE" }),
  restoreClient: (id) => request(`/clients/${id}/restore`, { method: "POST" }),
  mergeClient: (id, otherId) => request(`/clients/${id}/merge`, { method: "POST", body: { otherId } }),
  // A plain link (the browser downloads the file with the session cookie).
  clientsExportUrl: (params) => `${BASE}/clients/export${qs(params)}`,
  auditLog: () => request("/audit"),
  clientLookup: (phone) => request(`/clients/lookup${qs({ phone })}`),
  clientLawyers: () => request("/clients/lawyers"),
  clientTargets: (month) => request(`/clients/targets${qs({ month })}`),
  addCase: (clientId, payload) => request(`/clients/${clientId}/cases`, { method: "POST", body: payload }),
  updateCase: (id, payload) => request(`/client-cases/${id}`, { method: "PATCH", body: payload }),
  deleteCase: (id) => request(`/client-cases/${id}`, { method: "DELETE" }),
  addPayment: (clientId, payload) => request(`/clients/${clientId}/payments`, { method: "POST", body: payload }),
  deletePayment: (id) => request(`/client-payments/${id}`, { method: "DELETE" }),
  addNote: (clientId, text) => request(`/clients/${clientId}/notes`, { method: "POST", body: { text } }),
  deleteNote: (id) => request(`/client-notes/${id}`, { method: "DELETE" }),
  addLink: (clientId, payload) => request(`/clients/${clientId}/links`, { method: "POST", body: payload }),
  deleteLink: (id) => request(`/client-links/${id}`, { method: "DELETE" }),
  importClients: (rows) => request("/clients/import", { method: "POST", body: { rows } }),
  // Many clients at once: { ids } or { query } (the list's filters), and set:
  // { operatorId } | { lawyerId } | { status: "declined" }.
  bulkClients: (payload) => request("/clients/bulk", { method: "POST", body: payload }),
  // --- training materials ---
  materials: (params) => request(`/materials${qs(params)}`),
  material: (id) => request(`/materials/${id}`),
  materialOptions: () => request("/materials/options"),
  createMaterial: (payload) => request("/materials", { method: "POST", body: payload }),
  updateMaterial: (id, payload) => request(`/materials/${id}`, { method: "PATCH", body: payload }),
  archiveMaterial: (id) => request(`/materials/${id}`, { method: "DELETE" }),
  restoreMaterial: (id) => request(`/materials/${id}/restore`, { method: "POST" }),
  deleteMaterialForever: (id) => request(`/materials/${id}/permanent`, { method: "DELETE" }),
  markMaterialRead: (id) => request(`/materials/${id}/read`, { method: "POST" }),
  materialReaders: (id) => request(`/materials/${id}/readers`),
  deleteMaterialFile: (fileId) => request(`/materials/files/${fileId}`, { method: "DELETE" }),
  materialFileUrl: (fileId, { download = false } = {}) => `${BASE}/materials/files/${fileId}${download ? "?download=1" : ""}`,
  // Sends a file in pieces (see the backend's routes/materials.js), calling
  // onProgress(0..1). A piece that fails is sent again, up to 3 times.
  uploadMaterialFile: async (materialId, file, onProgress = () => {}) => {
    const { uploadId, chunkBytes } = await request(`/materials/${materialId}/uploads`, {
      method: "POST",
      body: { name: file.name, size: file.size },
    });
    let offset = 0;
    let failures = 0;
    while (offset < file.size) {
      const piece = file.slice(offset, offset + chunkBytes);
      let res;
      try {
        res = await fetch(`${BASE}/materials/uploads/${uploadId}?offset=${offset}`, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          credentials: "same-origin",
          body: piece,
        });
      } catch {
        res = null;
      }
      const data = res ? await res.json().catch(() => null) : null;
      if (res?.ok || res?.status === 409) {
        // 409: the server already has more (a retried piece) — go on from there.
        offset = data?.received ?? offset;
        failures = 0;
        onProgress(offset / file.size);
        continue;
      }
      if (res?.status === 401 && unauthorizedHandler) unauthorizedHandler();
      if (!res || res.status >= 500) {
        failures += 1;
        if (failures <= 3) continue;
      }
      throw new ApiError(data?.error || (res ? `http_${res.status}` : "network_error"), res?.status ?? 0, data);
    }
    return request(`/materials/uploads/${uploadId}/finish`, { method: "POST" });
  },

  // --- Telegram ---
  telegramMe: () => request("/telegram/me"),
  telegramLink: () => request("/telegram/link", { method: "POST" }),
  telegramPrefs: (prefs) => request("/telegram/me/prefs", { method: "PATCH", body: prefs }),
  telegramTest: () => request("/telegram/me/test", { method: "POST" }),
  telegramDisconnect: () => request("/telegram/me", { method: "DELETE" }),
  telegramOverview: () => request("/telegram/overview"),

  // A Google Sheets link -> the file's bytes (the server downloads it).
  googleSheet: async (url) => {
    const res = await fetch(`${BASE}/clients/import/google${qs({ url })}`, { credentials: "same-origin" });
    if (!res.ok) {
      let code = `http_${res.status}`;
      try {
        code = (await res.json()).error || code;
      } catch {
        // not JSON
      }
      throw new ApiError(code, res.status, null);
    }
    return res.arrayBuffer();
  },
};
