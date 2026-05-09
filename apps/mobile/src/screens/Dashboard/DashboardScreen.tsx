import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { dashboardApi } from '../../api/endpoints';
import type { DashboardMetrics } from '../../types';
import type { RootState } from '../../store';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { CardSkeleton } from '../../components/ui';

// ─── Date preset helpers ────────────────────────────────────────────
type Preset = 'today' | 'week' | 'month' | 'all';

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all',   label: 'All Time' },
];

function getDateRange(preset: Preset): { date_from?: string; date_to?: string; date?: string } {
  const today = new Date();
  const fmt   = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === 'today') return { date: fmt(today) };
  if (preset === 'week') {
    const from = new Date(today);
    from.setDate(today.getDate() - today.getDay());
    return { date_from: fmt(from), date_to: fmt(today) };
  }
  if (preset === 'month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { date_from: fmt(from), date_to: fmt(today) };
  }
  // all — last 365 days
  const from = new Date(today);
  from.setFullYear(today.getFullYear() - 1);
  return { date_from: fmt(from), date_to: fmt(today) };
}

function presetLabel(p: Preset) {
  const LABEL: Record<Preset, string> = { today: 'Today', week: 'This Week', month: 'This Month', all: 'All Time' };
  return LABEL[p];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning 🌾';
  if (h < 17) return 'Good afternoon ☀️';
  return 'Good evening 🌙';
}

// ─── Live indicator component ──────────────────────────────────────
function LiveDot({ fetching }: { fetching: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    );
    if (fetching) { anim.start(); }
    else { anim.stop(); pulse.setValue(1); }
    return () => anim.stop();
  }, [fetching]);

  return (
    <View style={liveDotStyles.wrap}>
      <Animated.View style={[liveDotStyles.dot, { opacity: pulse, backgroundColor: fetching ? '#F59E0B' : '#10B981' }]} />
      <Text style={[liveDotStyles.text, { color: fetching ? '#F59E0B' : '#10B981' }]}>
        {fetching ? 'Updating…' : 'Live'}
      </Text>
    </View>
  );
}
const liveDotStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:  { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 11, fontWeight: '600' },
});

// ─── Screen ────────────────────────────────────────────────────────
export function DashboardScreen() {
  const user = useSelector((s: RootState) => s.auth.user);
  const insets = useSafeAreaInsets();
  const [preset, setPreset] = useState<Preset>('today');
  const [sheetOpen, setSheetOpen] = useState(false);

  const params = useMemo(() => getDateRange(preset), [preset]);

  const { data, isLoading, refetch, isRefetching, isFetching } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard', params],
    queryFn: async () => {
      const { data } = await dashboardApi.get(params);
      return data;
    },
    refetchInterval: 15_000,              // poll every 15s on all presets
    refetchIntervalInBackground: false,   // pause when app is backgrounded
    staleTime: 10_000,
  });

  const fmt = (n: string | number | undefined) => {
    if (n === undefined || n === null) return '₹0';
    const num = parseFloat(String(n));
    if (num >= 1_00_000) return '₹' + (num / 1_00_000).toFixed(2) + 'L';
    if (num >= 1000) return '₹' + (num / 1000).toFixed(1) + 'K';
    return '₹' + num.toLocaleString('en-IN');
  };

  const fmtFull = (n: string | number | undefined) => {
    if (n === undefined || n === null) return '₹0';
    return '₹' + parseFloat(String(n)).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[5] }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting()}, {user?.name?.split(' ')[0] ?? 'Welcome'}</Text>
            <Text style={styles.firmName}>{user?.firm_name ?? 'Smart Mandi'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user?.role?.replace('_', ' ')}</Text>
            </View>
            <LiveDot fetching={isFetching && !isLoading} />
          </View>
        </View>

        {/* ── Date filter strip ── */}
        <View style={styles.filterWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {PRESETS.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.chip, preset === p.id && styles.chipActive]}
                onPress={() => setPreset(p.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, preset === p.id && styles.chipTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Period label ── */}
        <Text style={styles.periodLabel}>
          Showing: <Text style={{ color: colors.primary, fontWeight: typography.weight.semibold }}>{presetLabel(preset)}</Text>
        </Text>

        {isLoading ? (
          <View style={styles.skeletonWrapper}>
            <CardSkeleton /><CardSkeleton /><CardSkeleton />
          </View>
        ) : (
          <>
            {/* ── Hero card: Gross Sales ── */}
            <View style={styles.heroCard}>
              <View style={styles.heroLeft}>
                <Text style={styles.heroLabel}>Total Gross Sales</Text>
                <Text style={styles.heroValue}>{fmtFull(data?.total_sales_amount)}</Text>
                <Text style={styles.heroSub}>Authorized KCs only</Text>
              </View>
              <View style={styles.heroIconBg}>
                <Text style={styles.heroIcon}>��</Text>
              </View>
            </View>

            {/* ── Trucks section ── */}
            <SectionTitle title="Trucks" />
            <View style={styles.statRow}>
              <StatCard label="Scheduled" value={data?.trucks_scheduled ?? 0} emoji="🕐" accent={colors.info} bg={colors.infoBg} />
              <StatCard label="Arrived"   value={data?.trucks_arrived   ?? 0} emoji="🚛" accent={colors.warning} bg={colors.warningBg} />
              <StatCard label="Closed"    value={data?.trucks_closed    ?? 0} emoji="✅" accent={colors.success} bg={colors.successBg} />
            </View>

            {/* ── KC section ── */}
            <SectionTitle title="Kaccha Chittha" />
            <View style={styles.statRow}>
              <StatCard label="Total"      value={data?.total_kc_count      ?? 0} emoji="📝" accent={colors.textSecondary} bg={colors.surfaceMuted} flex={1} />
              <StatCard label="Authorized" value={data?.total_kc_authorized ?? 0} emoji="🔖" accent={colors.success} bg={colors.successBg} flex={1} />
            </View>

            {/* ── Financials section ── */}
            <SectionTitle title="Financials" />
            <View style={styles.finCard}>
              <FinRow icon="🤝" label="Commission Earned"  value={fmtFull(data?.total_commission_earned)}  color={colors.success} />
              <View style={styles.finDivider} />
              <FinRow icon="⚠️" label="Udhar Outstanding"  value={fmtFull(data?.total_udhar_outstanding)}  color={colors.warning} />
              <View style={styles.finDivider} />
              <FinRow icon="⚖️" label="Weight Sold"
                value={(() => {
                  const w = parseFloat(String(data?.total_weight_sold_kg ?? '0'));
                  return w >= 1000 ? `${(w / 1000).toFixed(2)} T` : `${w.toFixed(1)} kg`;
                })()}
                color={colors.textPrimary}
              />
            </View>

            {data?.computed_at && (
              <Text style={styles.refreshHint}>
                🕐 Updated {new Date(data.computed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · auto-refreshes every 15s
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ────────────────────────────────────────────────
function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function StatCard({ label, value, emoji, accent, bg, flex = 1 }: {
  label: string; value: number; emoji: string; accent: string; bg: string; flex?: number;
}) {
  return (
    <View style={[styles.statCard, { flex }]}>
      <View style={[styles.statIconBg, { backgroundColor: bg }]}>
        <Text style={styles.statEmoji}>{emoji}</Text>
      </View>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FinRow({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={styles.finRow}>
      <View style={styles.finLeft}>
        <Text style={styles.finIcon}>{icon}</Text>
        <Text style={styles.finLabel}>{label}</Text>
      </View>
      <Text style={[styles.finValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[5], paddingBottom: spacing[10] },

  // header
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing[4] },
  greeting: { fontSize: typography.size.sm, color: colors.textSecondary },
  firmName: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: colors.textPrimary, marginTop: 2 },
  roleBadge: {
    backgroundColor: colors.primaryLight, paddingHorizontal: spacing[3],
    paddingVertical: 5, borderRadius: radius.full, marginTop: 2,
  },
  roleText: { fontSize: typography.size.xs, color: colors.primary, fontWeight: typography.weight.semibold },

  // filter
  filterWrap: { height: 42, overflow: 'hidden', marginBottom: spacing[2] },
  filterRow: { flexDirection: 'row', alignItems: 'center', height: 42, paddingRight: spacing[2] },
  chip: {
    height: 32, paddingHorizontal: spacing[3], borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing[2],
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: typography.size.xs, color: colors.textSecondary, fontWeight: typography.weight.medium },
  chipTextActive: { color: '#fff', fontWeight: typography.weight.semibold },

  // period label
  periodLabel: { fontSize: typography.size.xs, color: colors.textMuted, marginBottom: spacing[4] },

  // hero
  heroCard: {
    borderRadius: radius.xl, backgroundColor: colors.primary,
    padding: spacing[5], flexDirection: 'row', alignItems: 'center',
    marginBottom: spacing[1], ...shadow.md,
  },
  heroLeft: { flex: 1 },
  heroLabel: { fontSize: typography.size.xs, color: 'rgba(255,255,255,0.75)', fontWeight: typography.weight.medium, textTransform: 'uppercase', letterSpacing: 0.8 },
  heroValue: { fontSize: 28, fontWeight: typography.weight.extrabold, color: '#fff', marginTop: 4 },
  heroSub: { fontSize: typography.size.xs, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  heroIconBg: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  heroIcon: { fontSize: 26 },

  // section
  sectionTitle: {
    fontSize: typography.size.xs, fontWeight: typography.weight.semibold as '600',
    color: colors.textMuted, marginTop: spacing[5], marginBottom: spacing[3],
    textTransform: 'uppercase', letterSpacing: 0.6,
  },

  // stat cards
  statRow: { flexDirection: 'row', gap: spacing[3] },
  statCard: {
    borderRadius: radius.lg, backgroundColor: colors.surfaceRaised,
    padding: spacing[3], alignItems: 'center',
    borderWidth: 0.5, borderColor: colors.border, ...shadow.sm,
  },
  statIconBg: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[2] },
  statEmoji: { fontSize: 20 },
  statValue: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold },
  statLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },

  // financial card
  finCard: {
    backgroundColor: colors.surfaceRaised, borderRadius: radius.xl,
    borderWidth: 0.5, borderColor: colors.border, ...shadow.sm, overflow: 'hidden',
  },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[4] },
  finLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  finIcon: { fontSize: 18 },
  finLabel: { fontSize: typography.size.sm, color: colors.textSecondary },
  finValue: { fontSize: typography.size.base, fontWeight: typography.weight.bold },
  finDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: spacing[4] },

  refreshHint: { textAlign: 'center', color: colors.textMuted, fontSize: typography.size.xs, marginTop: spacing[5] },
  skeletonWrapper: { marginTop: spacing[4] },
});