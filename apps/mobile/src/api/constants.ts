/** Single source of truth for the API base URL. Update only this file when IP changes. */
export const API_BASE_URL = __DEV__
  // ? 'http://10.10.7.32:3000/api/v1' // office
  // ? 'http://192.168.1.36:3000/api/v1' //pg
  // ? 'http://192.168.1.6:3000/api/v1' //home (WiFi — use when ADB reverse is not set)
  ? 'http://localhost:3000/api/v1' // ADB reverse tcp:3000 tcp:3000 (preferred)
  : 'https://api.smartmandi.app/api/v1';
