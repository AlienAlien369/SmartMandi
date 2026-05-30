import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
//  Smart Mandi — Premium Emerald Green Theme
//  Philosophy: clean white surfaces, rich botanical greens, life-giving shadows
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  // ── Brand — Botanical Emerald ───────────────────────────────────────────────
  primary:        '#16a34a',   // Green-600  · main CTAs, active states
  primaryDark:    '#15803d',   // Green-700  · pressed / hover states
  primaryDarker:  '#14532d',   // Green-900  · deep forest accents
  primaryLight:   '#dcfce7',   // Green-100  · light badges, active chip bg
  primaryMid:     '#4ade80',   // Green-400  · glow accents, shimmer highlights
  primaryGlow:    'rgba(22,163,74,0.18)',   // translucent glow overlay

  // ── Accent — Emerald (teal-green companion) ─────────────────────────────────
  accent:         '#059669',   // Emerald-600 · secondary brand moments
  accentLight:    '#d1fae5',   // Emerald-100

  // ── Surfaces — Crisp white with botanical undertone ────────────────────────
  surface:        '#f5fdf7',   // Main screen bg — white kissed by green
  surfaceRaised:  '#ffffff',   // Cards, modals — pure white
  surfaceMuted:   '#f0fdf4',   // Green-50   · muted sections, input bg
  surfaceOverlay: 'rgba(22,163,74,0.05)',

  // ── Text ───────────────────────────────────────────────────────────────────
  textPrimary:   '#0d1f14',    // Near-black with deep green soul
  textSecondary: '#4b5e54',    // Muted green-gray
  textMuted:     '#94a3a0',    // Soft gray-green for hints
  textInverse:   '#ffffff',

  // ── Semantic ───────────────────────────────────────────────────────────────
  success:    '#16a34a',       // = primary (green IS success here)
  warning:    '#d97706',       // Amber-600
  danger:     '#dc2626',       // Red-600
  info:       '#0891b2',       // Cyan-600

  successBg:  '#dcfce7',
  warningBg:  '#fef3c7',
  dangerBg:   '#fee2e2',
  infoBg:     '#e0f2fe',

  // ── Borders — green-tinted hairlines ───────────────────────────────────────
  border:       'rgba(22,163,74,0.14)',
  borderStrong: 'rgba(22,163,74,0.28)',

  // ── Status chips ───────────────────────────────────────────────────────────
  statusScheduled:  '#0891b2',  // Cyan
  statusArrived:    '#d97706',  // Amber
  statusClosed:     '#16a34a',  // Green
  statusDraft:      '#94a3a0',  // Muted
  statusAuthorized: '#16a34a',  // Green
  statusCancelled:  '#dc2626',  // Red
  statusPending:    '#94a3a0',  // Muted

  // ── Legacy aliases (keep backward compat) ──────────────────────────────────
  background:        '#f5fdf7',
  text:              '#0d1f14',   // alias for textPrimary
  error:             '#dc2626',
  divider:           'rgba(22,163,74,0.10)',
  borderLight:       'rgba(22,163,74,0.07)',
  textTertiary:      '#94a3a0',
  textLink:          '#16a34a',
  primaryDarkLegacy: '#15803d',
  chartPrimary:      '#16a34a',
  chartSecondary:    '#059669',
  chartTertiary:     '#0891b2',
  chartQuaternary:   '#dc2626',
  surfaceElevated:   '#ffffff',
} as const;

export const typography = {
  display:  { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.6 },
  title:    { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading:  { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.1 },
  body:     { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyMd:   { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption:  { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label:    { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.8 },
  labelSm:  { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5 },
  number:   { fontSize: 22, fontWeight: '800' as const },
  mono:     { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 14 },
  size: { xs: 11, sm: 13, base: 15, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 },
  weight: { regular: '400' as const, medium: '500' as const, semibold: '600' as const, bold: '700' as const, extrabold: '800' as const },
  fontFamily: { regular: 'System', medium: 'System', semibold: 'System', bold: 'System' },
  lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.75 },
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
  screenPadding: 16, cardGap: 12, sectionGap: 28,
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 10: 40, 12: 48, 16: 64,
};

export const radius = {
  xs: 4, sm: 8, md: 14, lg: 18, xl: 26, '2xl': 32, full: 9999,
};

// ── Green-tinted shadows — the "secret sauce" of this theme ──────────────────
// Casting green-hued light makes cards feel botanical and alive instead of flat.
export const elevation = {
  card: {
    shadowColor:   '#16a34a',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius:  10,
    elevation: 3,
  },
  modal: {
    shadowColor:   '#16a34a',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius:  20,
    elevation: 8,
  },
  sheet: {
    shadowColor:   '#16a34a',
    shadowOffset:  { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius:  18,
    elevation: 12,
  },
};

export const shadow = {
  sm: elevation.card,
  md: {
    shadowColor:   '#16a34a',
    shadowOffset:  { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius:  14,
    elevation: 5,
  },
  lg: elevation.sheet,
};

export const theme = { colors, typography, spacing, radius, elevation, shadow };
export default theme;

