// ─────────────────────────────────────────────────────────────────────────────
// Smart Mandi Design Tokens
// Premium, clean aesthetic — inspired by Linear/Stripe quality
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  // Brand
  primary: '#1A6B3A',       // Deep mandi green
  primaryLight: '#E8F5EE',
  primaryDark: '#0F4424',
  accent: '#F59E0B',        // Amber — highlights, CTAs
  accentLight: '#FEF3C7',

  // Semantic
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',

  // Status colors (truck/KC states)
  statusScheduled: '#6366F1',    // Indigo
  statusArrived: '#F59E0B',      // Amber
  statusClosed: '#16A34A',       // Green
  statusDraft: '#64748B',        // Slate
  statusAuthorized: '#16A34A',   // Green
  statusCancelled: '#DC2626',    // Red

  // Neutral palette
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  divider: '#E2E8F0',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',
  textLink: '#1A6B3A',

  // Charts
  chartPrimary: '#1A6B3A',
  chartSecondary: '#F59E0B',
  chartTertiary: '#6366F1',
  chartQuaternary: '#EC4899',
};

export const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  } as const,
};

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const theme = { colors, typography, spacing, radius, shadow };
export default theme;
