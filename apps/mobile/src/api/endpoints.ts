import api from './client';
import { API_BASE_URL } from './constants';

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (phone: string, otp: string, firmId: string, deviceId: string) =>
    api.post('/auth/login', { phone, otp, firm_id: firmId, device_id: deviceId }),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refresh_token: refreshToken }),
};

// ─── Trucks ──────────────────────────────────────────────────────────────────
export const trucksApi = {
  list: (params?: object) => api.get('/trucks', { params }),
  get: (id: string) => api.get(`/trucks/${id}`),
  create: (data: object) => api.post('/trucks', data),
  arrive: (id: string, data: object) => api.post(`/trucks/${id}/arrive`, data),
  close: (id: string, data: object) => api.post(`/trucks/${id}/close`, data),
  delete: (id: string) => api.delete(`/trucks/${id}`),
};

// ─── KCs ─────────────────────────────────────────────────────────────────────
export const kcsApi = {
  list: (params?: object) => api.get('/kcs', { params }),
  get: (id: string) => api.get(`/kcs/${id}`),
  create: (data: object) => api.post('/kcs', data),
  updateItems: (id: string, data: object) => api.patch(`/kcs/${id}/items`, data),
  addPayment: (id: string, data: object) => api.post(`/kcs/${id}/payments`, data),
  authorize: (id: string, data: object) => api.post(`/kcs/${id}/authorize`, data),
  cancel: (id: string, data: object) => api.post(`/kcs/${id}/cancel`, data),
  /** Returns URL for Linking.openURL — KC receipt PDF */
  getPdfUrl: (id: string, accessToken: string): string =>
    `${API_BASE_URL}/kcs/${id}/pdf?token=${encodeURIComponent(accessToken)}`,
  /** Returns URL for Linking.openURL — buyer summary PDF for a date */
  getBuyerSummaryPdfUrl: (dateFrom: string, dateTo: string, accessToken: string): string =>
    `${API_BASE_URL}/reports/buyer-summary/pdf?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}&token=${encodeURIComponent(accessToken)}`,
  getDaybookPdfUrl: (dateFrom: string, dateTo: string, accessToken: string): string =>
    `${API_BASE_URL}/reports/daybook/pdf?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}&token=${encodeURIComponent(accessToken)}`,
};

// ─── Customers ───────────────────────────────────────────────────────────────
export const customersApi = {
  list: (params?: object) => api.get('/customers', { params }),
  get: (id: string) => api.get(`/customers/${id}`),
  getHistory: (id: string) => api.get(`/customers/${id}/history`),
  create: (data: object) => api.post('/customers', data),
  update: (id: string, data: object) => api.patch(`/customers/${id}`, data),
  delete: (id: string) => api.delete(`/customers/${id}`),
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const dashboardApi = {
  get: (params?: { date?: string; date_from?: string; date_to?: string }) =>
    api.get('/dashboard', { params }),
  generateSummary: (sale_date: string) => api.post('/dashboard/summary-sheets', { sale_date }),
  listSummaries: (params?: object) => api.get('/dashboard/summary-sheets', { params }),
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reportsApi = {
  ledger: (params: object) => api.get('/reports/ledger', { params }),
  cashFlow: (from: string, to: string) => api.get('/reports/cash-flow', { params: { from, to } }),
  exportKcs: (params: { date_from: string; date_to: string }) =>
    api.get('/reports/export/kcs', { params, responseType: 'text' }),
  exportTrucks: (params: { date_from: string; date_to: string }) =>
    api.get('/reports/export/trucks', { params, responseType: 'text' }),
};

// ─── Salary ──────────────────────────────────────────────────────────────────
export const salaryApi = {
  list: (params?: object) => api.get('/salary', { params }),
  create: (data: object) => api.post('/salary', data),
  update: (id: string, notes: string) => api.patch(`/salary/${id}`, { notes }),
  delete: (id: string) => api.delete(`/salary/${id}`),
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const usersApi = {
  list: (params?: object) => api.get('/users', { params }),
  create: (data: object) => api.post('/users', data),
  update: (id: string, data: object) => api.patch(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  updateFcmToken: (fcmToken: string) => api.post('/users/fcm-token', { fcm_token: fcmToken }),
};

// ─── Config ──────────────────────────────────────────────────────────────────
export const configApi = {
  getVersion: (date: string) => api.get('/config/version', { params: { date } }),
  listVersions: () => api.get('/config/versions'),
  getGrades: () => api.get('/config/grades'),
  getPaymentModes: () => api.get('/config/payment-modes'),
  getBaardanaConfig: () => api.get('/config/baardana'),
};

// ─── RBAC ─────────────────────────────────────────────────────────────────────
export const rbacApi = {
  getMyModules: () => api.get('/rbac/my-modules'),
  getMyPermissions: () => api.get('/rbac/my-permissions'),
  getAllModules: () => api.get('/rbac/modules'),
  getFirmModules: () => api.get('/rbac/firm-modules'),
  getAllPermissions: () => api.get('/rbac/permissions'),
  getPermissionsForRole: (role: string) => api.get(`/rbac/permissions/${role}`),
  setRolePermissions: (role: string, permissions: object[]) =>
    api.put(`/rbac/permissions/${role}`, { permissions }),
};

// ─── Super Admin ─────────────────────────────────────────────────────────────
import axios from 'axios';
const SA_BASE = API_BASE_URL;

type CreateFirmPayload = {
  name: string;
  apmc_name?: string;
  contact_phone?: string;
  address?: string;
  head_name?: string;
  head_phone?: string;
};

export const superAdminApi = {
  login: (phone: string, otp: string) =>
    axios.post(`${SA_BASE}/super-admin/login`, { phone, otp }),
  getAllModules: (token: string) =>
    axios.get(`${SA_BASE}/super-admin/modules`, { headers: { Authorization: `Bearer ${token}` } }),
  listFirms: (token: string) =>
    axios.get(`${SA_BASE}/super-admin/firms?admin_token=${token}`, { headers: { Authorization: `Bearer ${token}` } }),
  createFirm: (data: CreateFirmPayload, token: string) =>
    axios.post(`${SA_BASE}/super-admin/firms?admin_token=${token}`, data, { headers: { Authorization: `Bearer ${token}` } }),
  updateFirm: (firmId: string, data: Partial<CreateFirmPayload & { is_active: boolean }>, token: string) =>
    axios.put(`${SA_BASE}/super-admin/firms/${firmId}?admin_token=${token}`, data, { headers: { Authorization: `Bearer ${token}` } }),
  deleteFirm: (firmId: string, token: string) =>
    axios.delete(`${SA_BASE}/super-admin/firms/${firmId}?admin_token=${token}`, { headers: { Authorization: `Bearer ${token}` } }),
  getFirmModules: (firmId: string, token: string) =>
    axios.get(`${SA_BASE}/super-admin/firms/${firmId}/modules`, { headers: { Authorization: `Bearer ${token}` } }),
  setFirmModules: (firmId: string, module_ids: string[], token: string) =>
    axios.put(
      `${SA_BASE}/super-admin/firms/${firmId}/modules?admin_token=${token}`,
      { module_ids },
      { headers: { Authorization: `Bearer ${token}` } }
    ),
  getApmcFeeConfig: (firmId: string, token: string) =>
    axios.get(`${SA_BASE}/super-admin/firms/${firmId}/config/apmc-fee?admin_token=${token}`),
  setApmcFeeConfig: (firmId: string, data: object, token: string) =>
    axios.put(`${SA_BASE}/super-admin/firms/${firmId}/config/apmc-fee?admin_token=${token}`, data),
  getCommissionConfig: (firmId: string, token: string) =>
    axios.get(`${SA_BASE}/super-admin/firms/${firmId}/config/commission?admin_token=${token}`),
  setCommissionConfig: (firmId: string, data: object, token: string) =>
    axios.put(`${SA_BASE}/super-admin/firms/${firmId}/config/commission?admin_token=${token}`, data),
  getRolePermissions: (firmId: string, token: string) =>
    axios.get(`${SA_BASE}/super-admin/firms/${firmId}/role-permissions?admin_token=${token}`),
  setRolePermissions: (firmId: string, role: string, permissions: object[], token: string) =>
    axios.put(`${SA_BASE}/super-admin/firms/${firmId}/role-permissions/${role}?admin_token=${token}`, { permissions }),
  getBaardanaConfig: (firmId: string, token: string) =>
    axios.get(`${SA_BASE}/super-admin/firms/${firmId}/config/baardana?admin_token=${token}`),
  setBaardanaConfig: (firmId: string, data: object, token: string) =>
    axios.put(`${SA_BASE}/super-admin/firms/${firmId}/config/baardana?admin_token=${token}`, data),
  getGrades: (firmId: string, token: string) =>
    axios.get(`${SA_BASE}/super-admin/firms/${firmId}/config/grades?admin_token=${token}`),
  createGrade: (firmId: string, data: object, token: string) =>
    axios.post(`${SA_BASE}/super-admin/firms/${firmId}/config/grades?admin_token=${token}`, data),
  updateGrade: (firmId: string, gradeId: string, data: object, token: string) =>
    axios.put(`${SA_BASE}/super-admin/firms/${firmId}/config/grades/${gradeId}?admin_token=${token}`, data),
  toggleGrade: (firmId: string, gradeId: string, token: string) =>
    axios.delete(`${SA_BASE}/super-admin/firms/${firmId}/config/grades/${gradeId}?admin_token=${token}`),
  getPdfConfig: (firmId: string, token: string) =>
    axios.get(`${SA_BASE}/super-admin/firms/${firmId}/config/pdf?admin_token=${token}`),
  setPdfConfig: (firmId: string, data: object, token: string) =>
    axios.put(`${SA_BASE}/super-admin/firms/${firmId}/config/pdf?admin_token=${token}`, data),
};
