# Ledger — Call Center Portal

Frontend for `call-center-backend`. Three roles:

- **EMPLOYEE** — sees their own call stats and call history.
- **BOSS** / **DEVELOPER** — see company-wide stats, a per-employee
  breakdown with charts, the full call log, and can add/deactivate
  employees and rotate an employee's device ID.

Mobile-first and responsive: a bottom tab bar on phones, a top bar on
wider screens, so employees can check their stats without opening a laptop.

## Stack

React + Vite, `react-router-dom` for routing, `recharts` for the charts.
No UI kit — hand-built components styled to match the rest of the app.

## Setup

```bash
npm install
cp .env.example .env.local
# edit .env.local: point VITE_API_URL at your backend
npm run dev
```

`VITE_API_URL` must point at a running `call-center-backend` instance. The
backend's own `.env` needs two things set for this to work once the
frontend is deployed on its own domain (see that repo's `.env.example`):

- `CORS_ORIGIN` — this app's deployed URL (e.g. `https://portal.vercel.app`)
- `COOKIE_SAME_SITE=none` and `COOKIE_SECURE=true` — required for the
  login cookie to survive a cross-site request once frontend and backend
  are on different domains. Both must be HTTPS for this to work at all;
  browsers refuse `SameSite=None` cookies over plain HTTP.

Without both of those set correctly on the backend, login will appear to
succeed (the API call returns 200) but every subsequent request will look
logged-out, because the browser silently drops the session cookie.

## Deploying (Vercel / Netlify / similar)

1. Push this repo, connect it to Vercel/Netlify.
2. Set the `VITE_API_URL` environment variable in the host's dashboard to
   your backend's public URL.
3. Set `CORS_ORIGIN` on the backend to the exact URL the host gives you
   (including `https://`, no trailing slash). If you get a preview URL
   per branch/PR, add it as a second comma-separated origin.
4. Redeploy the backend after changing its env vars.

## Project layout

```
src/
  lib/api.js        — all backend calls; the only place that knows API routes
  lib/format.js      — date/duration formatting helpers
  hooks/useAuth.jsx  — session state (who's logged in)
  components/        — shared UI: AppShell (nav), StatCard, PageHeader
  pages/             — one file per route
```

There is no local mock data or fake API — every page calls the real
backend. If a page looks empty, check the Network tab: a 401 means the
cookie isn't attaching (see CORS/cookie notes above), a CORS error means
`CORS_ORIGIN` doesn't match this app's origin exactly.
