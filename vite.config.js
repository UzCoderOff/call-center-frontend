import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// The browser only ever calls this app's own origin at /api — never the
// backend's domain directly. That keeps the session cookie first-party,
// which phone browsers require (a cross-site cookie is silently dropped on
// iPhones and many Android browsers — the old "Couldn't load stats" bug).
//
//   dev:        Vite proxies /api to VITE_API_URL (default localhost:4000)
//   production: vercel.json rewrites /api to the VPS
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_URL || 'http://localhost:4000'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target, changeOrigin: true },
      },
    },
  }
})
