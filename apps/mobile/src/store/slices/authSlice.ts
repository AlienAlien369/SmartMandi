import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { authApi, superAdminApi, rbacApi } from '../../api/endpoints';
import { API_BASE_URL } from '../../api/constants';
import type { User, AuthState } from '../../types';

// All module IDs — used as fallback when RBAC fetch fails (FIRM_HEAD gets all)
const ALL_MODULE_IDS = [
  'DASHBOARD', 'TRUCKS', 'KC', 'CUSTOMERS', 'LEDGER',
  'SUMMARY_SHEETS', 'REPORTS', 'SALARY', 'USERS', 'SETTINGS', 'ROLE_PERMISSIONS', 'NOTIFICATIONS',
];

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  isSuperAdmin: false,
  saToken: null,
  accessibleModuleIds: ALL_MODULE_IDS,
  permissions: {},
  loginError: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async (
    { phone, otp, firmId, deviceId }: { phone: string; otp: string; firmId: string; deviceId: string },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await authApi.login(phone, otp, firmId, deviceId);
      await AsyncStorage.multiSet([
        ['access_token', data.access_token],
        ['refresh_token', data.refresh_token],
        ['user', JSON.stringify(data.user)],
      ]);
      // Fetch accessible modules with fresh token immediately after login
      let moduleIds: string[] = ALL_MODULE_IDS;
      try {
        const modsRes = await axios.get(`${API_BASE_URL}/rbac/my-modules`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        moduleIds = (modsRes.data as Array<{ id: string }>).map(m => m.id);
      } catch {
        if (data.user?.role === 'FIRM_HEAD') moduleIds = ALL_MODULE_IDS;
        else moduleIds = ['DASHBOARD'];
      }
      let permissions: Record<string, { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }> = {};
      try {
        const permsRes = await axios.get(`${API_BASE_URL}/rbac/my-permissions`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        permissions = permsRes.data;
      } catch {}
      return { ...data, accessibleModuleIds: moduleIds, permissions };
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Login failed';
      return rejectWithValue(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  },
);

export const loginSuperAdmin = createAsyncThunk(
  'auth/loginSuperAdmin',
  async ({ phone, otp }: { phone: string; otp: string }) => {
    const res = await superAdminApi.login(phone, otp);
    const { access_token, admin } = res.data;
    await AsyncStorage.multiSet([
      ['sa_token', access_token],
      ['sa_admin', JSON.stringify(admin)],
    ]);
    return { access_token, admin };
  },
);

export const restoreSession = createAsyncThunk('auth/restoreSession', async () => {
  const [token, userStr, saToken, saAdminStr, moduleIdsStr, permissionsStr] = await Promise.all([
    AsyncStorage.getItem('access_token'),
    AsyncStorage.getItem('user'),
    AsyncStorage.getItem('sa_token'),
    AsyncStorage.getItem('sa_admin'),
    AsyncStorage.getItem('accessible_module_ids'),
    AsyncStorage.getItem('permissions'),
  ]);
  if (saToken && saAdminStr) {
    return { type: 'superadmin' as const, sa_token: saToken, admin: JSON.parse(saAdminStr) };
  }
  if (!token || !userStr) throw new Error('No session');
  let moduleIds: string[] = moduleIdsStr ? JSON.parse(moduleIdsStr) : ALL_MODULE_IDS;
  let permissions: Record<string, { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }> =
    permissionsStr ? JSON.parse(permissionsStr) : {};
  try {
    const modsRes = await axios.get(`${API_BASE_URL}/rbac/my-modules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    moduleIds = (modsRes.data as Array<{ id: string }>).map(m => m.id);
    await AsyncStorage.setItem('accessible_module_ids', JSON.stringify(moduleIds));
  } catch {}
  try {
    const permsRes = await axios.get(`${API_BASE_URL}/rbac/my-permissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    permissions = permsRes.data;
    await AsyncStorage.setItem('permissions', JSON.stringify(permissions));
  } catch {}
  return { type: 'user' as const, access_token: token, user: JSON.parse(userStr) as User, accessibleModuleIds: moduleIds, permissions };
});

export const logout = createAsyncThunk('auth/logout', async () => {
  await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user', 'sa_token', 'sa_admin', 'accessible_module_ids', 'permissions']);
});

export const logoutSuperAdmin = createAsyncThunk('auth/logoutSuperAdmin', async () => {
  await AsyncStorage.multiRemove(['sa_token', 'sa_admin']);
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(login.pending, state => { state.isLoading = true; })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.access_token;
        state.isAuthenticated = true;
        state.isSuperAdmin = false;
        state.accessibleModuleIds = action.payload.accessibleModuleIds;
        state.permissions = action.payload.permissions;
        // Persist module IDs and permissions for offline session restore
        AsyncStorage.setItem('accessible_module_ids', JSON.stringify(action.payload.accessibleModuleIds));
        AsyncStorage.setItem('permissions', JSON.stringify(action.payload.permissions));
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.loginError = (action.payload as string) ?? action.error.message ?? 'Login failed';
      })
      .addCase(loginSuperAdmin.pending, state => { state.isLoading = true; })
      .addCase(loginSuperAdmin.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuperAdmin = true;
        state.saToken = action.payload.access_token;
        state.isAuthenticated = true;
      })
      .addCase(loginSuperAdmin.rejected, state => { state.isLoading = false; })
      .addCase(restoreSession.fulfilled, (state, action) => {
        if (action.payload.type === 'superadmin') {
          state.isSuperAdmin = true;
          state.saToken = action.payload.sa_token;
          state.isAuthenticated = true;
        } else {
          state.user = action.payload.user;
          state.accessToken = action.payload.access_token;
          state.isAuthenticated = true;
          state.isSuperAdmin = false;
          state.accessibleModuleIds = action.payload.accessibleModuleIds;
          state.permissions = action.payload.permissions;
        }
      })
      .addCase(restoreSession.rejected, state => {
        state.isAuthenticated = false;
        state.user = null;
        state.isSuperAdmin = false;
      })
      .addCase(logout.fulfilled, state => {
        state.user = null;
        state.accessToken = null;
        state.isAuthenticated = false;
        state.isSuperAdmin = false;
        state.saToken = null;
        state.accessibleModuleIds = ALL_MODULE_IDS;
        state.permissions = {};
      })
      .addCase(logoutSuperAdmin.fulfilled, state => {
        state.isSuperAdmin = false;
        state.saToken = null;
        state.isAuthenticated = false;
      });
  },
});

export const { setUser } = authSlice.actions;
export default authSlice.reducer;
