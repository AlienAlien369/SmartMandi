// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types for mobile app
// Mirrors backend entities for type safety without code duplication
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'FIRM_HEAD' | 'AUTHORIZER' | 'OPERATOR' | 'VIEWER';
export type TruckStatus = 'SCHEDULED' | 'ARRIVED' | 'CLOSED';
export type KCStatus = 'DRAFT' | 'AUTHORIZED' | 'CANCELLED';
export type LedgerType = 'CUSTOMER' | 'TRUCK' | 'FIRM_CASH' | 'USER_SALARY';
export type EntryType = 'CREDIT' | 'DEBIT';

export interface User {
  id: string;
  firm_id: string;
  phone: string;
  name: string;
  firm_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSuperAdmin: boolean;
  saToken: string | null;
  accessibleModuleIds: string[];
  permissions: Record<string, { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }>;
  loginError?: string | null;
}

export interface Truck {
  id: string;
  firm_id: string;
  truck_number: string;
  driver_name: string;
  driver_phone?: string;
  produce_name: string;
  sale_date: string;
  status: TruckStatus;
  estimated_weight_kg?: string;
  arrived_weight_kg?: string;
  actual_weight_kg?: string;
  weight_variance_kg?: string;
  inam_amount: string;
  customer_id?: string;
  notes?: string;
  created_at: string;
}

export interface KcLineItem {
  id: string;
  kc_id: string;
  grade_config_id?: string;
  produce_name?: string;
  grade_code?: string;
  quantity_bags: number;
  weight_per_bag_kg?: string | null;
  weight_kg?: string;           // legacy alias
  total_weight_kg: string;
  rate_per_kg: string;          // stores rate_per_nag value when rate_mode = PER_NAG
  gross_amount: string;
  baardana_cost?: string;
  baardana_source?: string;
  baardana_quantity?: number;
  rate_mode?: 'PER_KG' | 'PER_NAG';
}

export interface KcPayment {
  id: string;
  kc_id: string;
  payment_mode_id: string;
  amount: string;
  payment_reference?: string | null;
  payment_date: string;
  is_udhar: boolean;
  notes?: string | null;
  created_at: string;
  // legacy aliases (some API versions)
  mode?: string;
  paid_at?: string;
}

export interface KacchaChittha {
  id: string;
  firm_id: string;
  kc_number: string;
  customer_id: string;
  customer_name?: string;
  truck_id?: string;
  sale_date: string;
  status: KCStatus;
  total_weight_kg?: string;
  total_gross_amount?: string;
  total_apmc_fee?: string;
  total_commission?: string;
  total_baardana_cost?: string;
  total_net_payable?: string;
  authorized_at?: string;
  authorized_by?: string;
  authorization_notes?: string;
  line_items?: KcLineItem[];
  payments?: KcPayment[];
}

export interface Customer {
  id: string;
  firm_id: string;
  name: string;
  phone?: string;
  village?: string;
  address?: string;
  is_active: boolean;
  outstanding_udhar?: number;
  kc_count?: number;
  credit_balance?: number;
}

export interface LedgerEntry {
  id: string;
  ledger_type: LedgerType;
  entry_type: EntryType;
  amount: string;
  balance_after: string;
  source_type: string;
  description?: string;
  created_at: string;
}

export interface DashboardMetrics {
  metric_date: string;
  metric_hour: number;
  trucks_scheduled: number;
  trucks_arrived: number;
  trucks_closed: number;
  trucks_in_progress: number;
  total_kc_count: number;
  total_kc_authorized: number;
  total_weight_sold_kg: string;
  total_sales_amount: string;
  total_commission_earned: string;
  total_udhar_outstanding: string;
  total_salaries_paid: string;
  total_inam_paid: string;
  computed_at: string;
}

export interface SalaryEntry {
  id: string;
  user_id: string;
  salary_date: string;
  amount: string;
  notes?: string;
  freight_type: 'SALARY' | 'INAM' | 'KIRAYA' | 'PARCHI';
}

// Navigation param types
export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: undefined;
  SuperAdmin: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  OtpVerify: { phone: string; firm_id: string };
  SuperAdminLogin: undefined;
};

export type SuperAdminStackParamList = {
  SADashboard: undefined;
  SAFirmModules: { firmId: string; firmName: string };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Trucks: undefined;
  KCs: undefined;
  Customers: undefined;
  More: undefined;
};

export type TruckStackParamList = {
  TruckList: undefined;
  TruckDetail: { truckId: string };
  TruckCreate: undefined;
};

export type KCStackParamList = {
  KCList: undefined;
  KCDetail: { kcId: string };
  KCCreate: undefined;
  KCAuthorize: { kcId: string };
};

export type CustomerStackParamList = {
  CustomerList: undefined;
  CustomerDetail: { customerId: string };
  CustomerCreate: undefined;
  CustomerEdit: { customerId: string; name: string; phone?: string; address?: string };
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  Ledger: undefined;
  Reports: undefined;
  Salary: undefined;
  Users: undefined;
  Settings: undefined;
  SummarySheets: undefined;
  RolePermissions: undefined;
  Notifications: undefined;
};
