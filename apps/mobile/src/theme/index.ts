import { Platform, Appearance } from 'react-native';

const isDark = Appearance.getColorScheme() === 'dark';

export const colors = {
  // Brand — Deep Saffron
  primary: '#E8600A',
  primaryDark: '#BF4D05',
  primaryLight: '#FDF0E8',

  // Surfaces — Warm, never cold blue-white
  surface: isDark ? '#0F0F0D' : '#FAFAF8',
  surfaceRaised: isDark ? '#1A1A18' : '#FFFFFF',
  surfaceMuted: isDark ? '#242420' : '#F2EFE9',
  surfaceOverlay: isDark ? 'rgba(240,237,232,0.04)' : 'rgba(26,26,24,0.04)',

  // Text
  textPrimary: isDark ? '#F0EDE8' : '#1A1A18',
  textSecondary: isDark ? '#9E9B96' : '#6B6860',
  textMuted: isDark ? '#6B6860' : '#A09D97',
  textInverse: '#FFFFFF',

  // Semantic
  success: '#1A7F4B',
  warning: '#B45309',
  danger: '#C0392B',
  info: '#1761B0',

  successBg: '#EAF5EE',
  warningBg: '#FEF3E2',
  dangerBg: '#FDECEA',
  infoBg: '#E8F0FB',

  // Borders
  border: isDark ? 'rgba(240,237,232,0.10)' : 'rgba(26,26,24,0.10)',
  borderStrong: isDark ? 'rgba(240,237,232,0.20)' : 'rgba(26,26,24,0.20)',

  // Status (truck/KC)
  statusScheduled: '#1761B0',
  statusArrived: '#B45309',
  statusClosed: '#1A7F4B',
  statusDraft: '#6B6860',
  statusAuthorized: '#1A7F4B',
  statusCancelled: '#C0392B',
  statusPending: '#6B6860',

  // Legacy aliases for existing screens that reference these keys
  background: isDark ? '#0F0F0D' : '#FAFAF8',
  error: '#C0392B',
  divider: isDark ? 'rgba(240,237,232,0.10)' : 'rgba(26,26,24,0.10)',
  borderLight: isDark ? 'rgba(240,237,232,0.06)' : 'rgba(26,26,24,0.06)',
  textTertiary: isDark ? '#6B6860' : '#A09D97',
  textLink: '#E8600A',
  primaryDarkLegacy: '#BF4D05',
  accent: '#E8600A',
  accentLight: '#FDF0E8',
  chartPrimary: '#E8600A',
  chartSecondary: '#B45309',
  chartTertiary: '#1761B0',
  chartQuaternary: '#C0392B',
  surfaceElevated: isDark ? '#1A1A18' : '#FFFFFF',
} as const;

export const typography = {
  display:  { fontSize: 28, fontWeight: '600' as const, letterSpacing: -0.5 },
  title:    { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.3 },
  heading:  { fontSize: 17, fontWeight: '600' as const },
  body:     { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption:  { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label:    { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.6 },
  number:   { fontSize: 22, fontWeight: '700' as const },
  mono:     { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 14 },
  // Legacy aliases so existing screens don't break
  size: { xs: 11, sm: 13, base: 15, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 },
  weight: { regular: '400' as const, medium: '500' as const, semibold: '600' as const, bold: '700' as const, extrabold: '800' as const },
  fontFamily: { regular: 'System', medium: 'System', semibold: 'System', bold: 'System' },
  lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.75 },
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
  screenPadding: 16, cardGap: 12, sectionGap: 28,
  // Legacy numeric keys
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 10: 40, 12: 48, 16: 64,
};

export const radius = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, full: 9999,
};

export const elevation = {
  card: {
    shadowColor: '#1A1A18',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  sheet: {
    shadowColor: '#1A1A18',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 8,
  },
};

// Legacy alias
export const shadow = {
  sm: elevation.card,
  md: { shadowColor: '#1A1A18', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  lg: elevation.sheet,
};

export const theme = { colors, typography, spacing, radius, elevation, shadow };
export default theme;
