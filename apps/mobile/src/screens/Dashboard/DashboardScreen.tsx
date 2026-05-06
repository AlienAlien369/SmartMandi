import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { dashboardApi } from '../../api/endpoints';
import type { DashboardMetrics } from '../../types';
import type { RootState } from '../../store';
import { colors, typography, spacing, radius, shadow } from '../../theme';

export function DashboardScreen() {
  const user = useSelector((s: RootState) => s.auth.user);
  const today = new Date().toISOString().slice(0, 10);

  const { data, isLoading, refetch, isRefetching } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard', today],
    queryFn: async () => {
      const { data } = await dashboardApi.get(today);
      return data;
    },
    refetchInterval: 60000, // Auto-refresh every 60s
  });

  const fmt = (n: string | number | undefined) => {
    if (n === undefined || n === null) return '₹0';
    return '₹' + parseFloat(String(n)).toLocaleString('en-IN');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning 🌾</Text>
          <Text style={styles.firmName}>{user?.name ?? 'Firm'}</Text>
          <Text style={styles.dateText}>{today}</Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role}</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Alerts removed - field not in current DB schema */}

          {/* Truck Panel */}
          <SectionTitle title="Today's Trucks" />
          <View style={styles.truckRow}>
            <StatCard
              label="Scheduled"
              value={data?.trucks_scheduled ?? 0}
              color={colors.statusScheduled}
              emoji="🕐"
            />
            <StatCard
              label="Arrived"
              value={data?.trucks_arrived ?? 0}
              color={colors.statusArrived}
              emoji="🚛"
            />
            <StatCard
              label="Closed"
              value={data?.trucks_closed ?? 0}
              color={colors.statusClosed}
              emoji="✅"
            />
          </View>

          {/* KC Panel */}
          <SectionTitle title="Kaccha Chittha" />
          <View style={styles.truckRow}>
            <StatCard label="Total" value={data?.total_kc_count ?? 0} color={colors.statusDraft} emoji="📝" />
            <StatCard label="Authorized" value={data?.total_kc_authorized ?? 0} color={colors.statusAuthorized} emoji="✅" />
          </View>

          {/* Financial Panel */}
          <SectionTitle title="Today's Financials" />
          <View style={styles.financialCard}>
            <FinancialRow label="Gross Sales" value={fmt(data?.total_sales_amount)} accent />
            <Divider />
            <FinancialRow label="Commission Earned" value={fmt(data?.total_commission_earned)} color={colors.success} />
            <Divider />
            <FinancialRow label="Udhar Outstanding" value={fmt(data?.total_udhar_outstanding)} color={colors.warning} />
          </View>

          {data?.computed_at && (
            <Text style={styles.refreshHint}>
              Last updated: {new Date(data.computed_at).toLocaleTimeString('en-IN')}
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function StatCard({ label, value, color, emoji }: { label: string; value: number; color: string; emoji: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FinancialRow({ label, value, accent, bold, color }: {
  label: string; value: string; accent?: boolean; bold?: boolean; color?: string;
}) {
  return (
    <View style={styles.financialRow}>
      <Text style={styles.financialLabel}>{label}</Text>
      <Text style={[
        styles.financialValue,
        accent && { color: colors.primary },
        bold && { fontWeight: typography.weight.bold },
        color ? { color } : {},
      ]}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing[5], paddingBottom: spacing[8] },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: spacing[5],
  },
  greeting: { fontSize: typography.size.sm, color: colors.textSecondary },
  firmName: {
    fontSize: typography.size.xl, fontWeight: typography.weight.bold,
    color: colors.textPrimary, marginTop: 2,
  },
  dateText: { fontSize: typography.size.sm, color: colors.textTertiary, marginTop: 2 },
  roleBadge: {
    backgroundColor: colors.primaryLight, paddingHorizontal: spacing[3],
    paddingVertical: spacing[1], borderRadius: radius.full,
  },
  roleText: { fontSize: typography.size.xs, color: colors.primary, fontWeight: typography.weight.semibold },
  alertBanner: {
    backgroundColor: '#FEF9C3', borderLeftWidth: 4, borderLeftColor: colors.warning,
    borderRadius: radius.md, padding: spacing[3], marginBottom: spacing[4],
  },
  alertText: { color: '#92400E', fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  sectionTitle: {
    fontSize: typography.size.base, fontWeight: typography.weight.semibold,
    color: colors.textSecondary, marginBottom: spacing[3], marginTop: spacing[5],
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  truckRow: { flexDirection: 'row', gap: spacing[3] },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing[4], alignItems: 'center', ...shadow.sm,
  },
  statEmoji: { fontSize: 24, marginBottom: spacing[1] },
  statValue: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold },
  statLabel: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  financialCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing[5], ...shadow.sm,
  },
  financialRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[2] },
  financialLabel: { fontSize: typography.size.base, color: colors.textSecondary },
  financialValue: { fontSize: typography.size.base, color: colors.textPrimary, fontWeight: typography.weight.medium },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing[1] },
  refreshHint: {
    textAlign: 'center', color: colors.textTertiary,
    fontSize: typography.size.xs, marginTop: spacing[4],
  },
});
