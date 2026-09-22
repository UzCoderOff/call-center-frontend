// Thin wrapper around fetch for the call-center-backend API.
//
// The backend authenticates via an httpOnly session cookie (see
// src/routes/auth.js in the backend repo), not a bearer token — so every
// request needs credentials: "include", and the backend's CORS_ORIGIN must
// list this app's deployed origin or the browser will refuse the cookie.
const BASE_URL = import.meta.env.VITE_API_URL;

if (!BASE_URL && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn(
    "VITE_API_URL is not set. Copy .env.example to .env.local and point it at your backend."
  );
}

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

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
    const message = data?.error || `request_failed_${res.status}`;
    throw new ApiError(message, res.status, data);
  }

  return data;
}

function qs(params = {}) {
  const clean = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (clean.length === 0) return "";
  return "?" + new URLSearchParams(clean).toString();
}

export const api = {
  ApiError,

  // --- auth ---
  login: (username, password) => request("/api/auth/login", { method: "POST", body: { username, password } }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),
  changePassword: (currentPassword, newPassword) =>
    request("/api/auth/change-password", { method: "POST", body: { currentPassword, newPassword } }),

  // --- dashboard ---
  dashboard: (params) => request(`/api/dashboard${qs(params)}`),

  // --- employees ---
  employees: () => request("/api/employees"),
  employee: (id) => request(`/api/employees/${id}`),
  createEmployee: (payload) => request("/api/employees", { method: "POST", body: payload }),
  updateEmployee: (id, payload) => request(`/api/employees/${id}`, { method: "PATCH", body: payload }),
  deleteEmployee: (id) => request(`/api/employees/${id}`, { method: "DELETE" }),
  regenerateDeviceId: (id) => request(`/api/employees/${id}/regenerate-device-id`, { method: "POST" }),
  resetEmployeePassword: (id) => request(`/api/employees/${id}/reset-password`, { method: "POST" }),

  // --- boss accounts (standalone portal logins, no Employee record) ---
  bossAccounts: () => request("/api/users?role=BOSS"),
  createBossAccount: (payload) => request("/api/users", { method: "POST", body: payload }),
  updateBossAccount: (id, payload) => request(`/api/users/${id}`, { method: "PATCH", body: payload }),
  resetBossPassword: (id) => request(`/api/users/${id}/reset-password`, { method: "POST" }),
  deleteBossAccount: (id) => request(`/api/users/${id}`, { method: "DELETE" }),

  // --- calls ---
  calls: (params) => request(`/api/calls${qs(params)}`),
  call: (id) => request(`/api/calls/${id}`),
  recordingUrl: (id) => `${BASE_URL}/api/calls/${id}/recording`,
};
