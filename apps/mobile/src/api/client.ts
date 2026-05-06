// ─────────────────────────────────────────────────────────────────────────────
// Smart Mandi API Client
// Typed axios wrapper with auth injection, idempotency, and offline detection
// ─────────────────────────────────────────────────────────────────────────────
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { API_BASE_URL } from './constants';

const BASE_URL = API_BASE_URL;

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: inject auth token + firm_id ─────────────────────────
api.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Auto-attach idempotency key for state-mutating requests
  if (['post', 'put', 'patch'].includes(config.method ?? '')) {
    if (!config.headers['X-Idempotency-Key']) {
      config.headers['X-Idempotency-Key'] = uuidv4();
    }
  }

  return config;
});

// ── Response interceptor: auto-refresh token on 401 ──────────────────────────
api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
        await AsyncStorage.setItem('access_token', data.access_token);
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
        // Navigate to login — handled by auth state listener
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
