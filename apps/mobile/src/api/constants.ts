/** Single source of truth for the API base URL. Update only this file when IP changes. */
export const API_BASE_URL = __DEV__
  ? 'http://10.10.7.32:3000/api/v1'
  : 'https://api.smartmandi.app/api/v1';
