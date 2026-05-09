/**
 * Single source of truth for the API base URL.
 *
 * DEV SETUP (choose one):
 *   Option A — WiFi (recommended, no ADB setup needed):
 *     Uncomment your machine's local IP below. App talks to your PC over WiFi.
 *     Find your IP: ipconfig (Windows) | ifconfig (Mac/Linux)
 *
 *   Option B — USB ADB reverse:
 *     Run: npm run adb:setup
 *     Then uncomment the localhost line.
 *     Must re-run after every cable reconnect.
 */
export const API_BASE_URL = __DEV__
  ? 'http://192.168.1.6:3000/api/v1'   // ← home WiFi (change IP if your network changes)
  // ? 'http://10.10.7.32:3000/api/v1' // ← office WiFi
  // ? 'http://localhost:3000/api/v1'   // ← USB only (needs: npm run adb:setup)
  : 'https://api.smartmandi.app/api/v1';
