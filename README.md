# Ledger — Staff Portal

The web portal for the firm's staff system (`call-center-backend`). Uzbek by
default (English available in Profile), light/dark, built for phones first —
a tab bar on phones, a sidebar on wider screens. The Android app
(`call-center-agent`) shows this same portal inside it, so every change here
reaches the app without an app update.

## What people see

Sections appear only when they apply to the person:

- **Home** — managers: company call stats, missed-call follow-up, today's
  reports at a glance, per-employee table. Call-center staff: their call
  numbers and "needs a callback" list. Other staff: today's report.
- **Calls** (managers, and staff whose calls are collected) — filterable log,
  "needs a callback" view with one-tap call buttons, call detail with the
  recording player and the number's history.
- **Calendar** (managers, and staff with calendar access) — the lawyer's
  week, one day at a time, read like an appointment book: free times to
  book (staff), change a day / confirm the week / settings (the lawyer).
  Staff whose bookings the lawyer cancelled get a "tell the client" card on
  their home page.
- **Reports** (managers, and staff with a report form) — staff fill in
  today's report; managers see each day by office, totals, and review.
- **Team** and **Settings** (managers; editing is DEVELOPER-only) — staff,
  offices, positions, the report-form builder, phones signed in to the app.
- **Profile** — language, theme, password, sign out; inside the app also
  version, "sync now" and diagnostics.

## Setup

```bash
npm install
cp .env.example .env.local   # VITE_API_URL = your local backend (default http://localhost:4000)
npm run dev                  # http://localhost:5173
```

The browser only ever calls this app's own `/api` — in development Vite
proxies it to `VITE_API_URL`; in production `vercel.json` forwards it to the
VPS. That keeps the login cookie first-party, which phone browsers require.
If the backend's address changes, update `vercel.json`.

`npm run lint` / `npm run build` before pushing; Vercel deploys on push.

## Project layout

```
src/
  i18n/            uz.js (default), en.js, provider + formatters
  lib/             api.js (every backend call), format.js, access.js (who sees what),
                   appBridge.js (talking to the Android app), prefs.js
  hooks/           useAuth, useAsync, useBack
  styles/          tokens.css (all colours, light + dark), base.css
  components/ui/   the design system: Button, Card, List, Segmented, Sheet, fields, badges…
  components/…     charts, calls, reports, stats, team
  pages/           one file per route
```

Text lives only in `src/i18n/*.js` — to change a wording, edit it there; to
add a language, copy `en.js` and register it in `src/i18n/index.jsx`.
Colours live only in `src/styles/tokens.css`; the chart colours were checked
for colour-blind safety and contrast — re-check if you change them.
