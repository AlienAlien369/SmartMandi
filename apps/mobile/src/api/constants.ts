/**
 * Single source of truth for the API base URL.
 *
 * ─── DEV SETUP ────────────────────────────────────────────────────────────────
 * 1. Copy apps/mobile/.env.example → apps/mobile/.env
 * 2. Set API_BASE_URL_DEV to your machine's LAN IP
 *    Find it: ipconfig (Windows) | ifconfig (Mac/Linux)
 * 3. Update the URL below to match your .env:
 *
 *   Option A — WiFi (recommended):
 *     'http://192.168.x.x:3000/api/v1'   ← your machine's local IP
 *
 *   Option B — USB ADB reverse:
 *     'http://localhost:3000/api/v1'
 *     Run first: npm run adb:setup  (re-run after every cable reconnect)
 *
 * ─── PROD SETUP ───────────────────────────────────────────────────────────────
 * Set API_BASE_URL_PROD in apps/mobile/.env to your server IP/domain.
 * ⚠️  Never hardcode a production IP directly here — use the .env file.
 */
export const API_BASE_URL = __DEV__
  ? 'http://192.168.1.36:3000/api/v1'       // ← update to match your .env API_BASE_URL_DEV
  : 'http://13.205.154.123:3000/api/v1';    // ← update to match your .env API_BASE_URL_PROD
