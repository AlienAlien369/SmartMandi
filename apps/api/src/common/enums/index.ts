export enum UserRole {
  FIRM_HEAD = 'FIRM_HEAD',
  AUTHORIZER = 'AUTHORIZER',
  OPERATOR = 'OPERATOR',
  VIEWER = 'VIEWER',
}

export enum TruckStatus {
  SCHEDULED = 'SCHEDULED',
  ARRIVED = 'ARRIVED',
  CLOSED = 'CLOSED',
}

export enum KCStatus {
  DRAFT = 'DRAFT',
  AUTHORIZED = 'AUTHORIZED',
  CANCELLED = 'CANCELLED',
}

export enum LedgerType {
  CUSTOMER = 'CUSTOMER',
  TRUCK = 'TRUCK',
  FIRM_CASH = 'FIRM_CASH',
  USER_SALARY = 'USER_SALARY',
}

export enum EntryType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export enum SourceType {
  KC_AUTHORIZATION = 'KC_AUTHORIZATION',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  SALARY_PAID = 'SALARY_PAID',
  INAM_PAID = 'INAM_PAID',
  REVERSAL = 'REVERSAL',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
  PURCHASE_ENTRY = 'PURCHASE_ENTRY',
}

export enum EventStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  AUTHORIZE = 'AUTHORIZE',
  CANCEL = 'CANCEL',
}

export enum CommissionType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_PER_KG = 'FIXED_PER_KG',
  FIXED_PER_TRANSACTION = 'FIXED_PER_TRANSACTION',
}

export enum FeeType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_PER_KG = 'FIXED_PER_KG',
  FIXED_PER_TRANSACTION = 'FIXED_PER_TRANSACTION',
}

export enum RoundingStrategy {
  ROUND_HALF_UP = 'ROUND_HALF_UP',
  FLOOR = 'FLOOR',
  CEIL = 'CEIL',
  NONE = 'NONE',
}

export enum BaardanaSource {
  FIRM = 'FIRM',
  CUSTOMER = 'CUSTOMER',
}

export enum ConfigScope {
  FIRM = 'FIRM',
  TRUCK = 'TRUCK',
}

export enum EntityType {
  KC = 'KC',
  TRUCK = 'TRUCK',
  CUSTOMER = 'CUSTOMER',
  PURCHASE = 'PURCHASE',
}

export enum CustomFieldType {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  BOOLEAN = 'BOOLEAN',
  SELECT = 'SELECT',
}
