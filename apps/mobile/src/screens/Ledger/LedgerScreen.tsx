import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api/endpoints';
import type { LedgerEntry } from '../../types';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { LedgerType } from '../../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<LedgerType, string> = {
  CUSTOMER: 'Customer',
  TRUCK: 'Truck',
  FIRM_CASH: 'Firm Cash',
  USER_SALARY: 'Freight',
};

const SOURCE_LABELS: Record<string, string> = {
  KC_AUTHORIZATION: 'KC Authorization',
  PAYMENT_RECEIVED: 'Payment Received',
  SALARY_PAID: 'Freight',
  INAM_PAID: 'Inam',
  REVERSAL: 'Reversal',
  MANUAL_ADJUSTMENT: 'Adjustment',
  PURCHASE_ENTRY: 'Purchase',
};

type DateRange = { label: string; from: string | null; to: string | null };

function buildPresets(): DateRange[] {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = fmt(now);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return [
    { label: 'Today', from: today, to: today },
    { label: 'Week', from: fmt(weekStart), to: today },
    { label: 'Month', from: fmt(monthStart), to: today },
    { label: 'All Time', from: null, to: null },
  ];
}

const PRESETS = buildPresets();
const LEDGER_TYPES: LedgerType[] = ['FIRM_CASH', 'CUSTOMER', 'TRUCK', 'USER_SALARY'];

// ─── Component ───────────────────────────────────────────────────────────────

export function LedgerScreen() {
  const [selectedType, setSelectedType] = useState<LedgerType>('FIRM_CASH');
  const [presetIdx, setPresetIdx] = useState(3); // All Time default

  const range = PRESETS[presetIdx];

  const queryParams = useMemo(() => {
    const p: Record<string, any> = { type: selectedType, page: 1, limit: 200 };
    if (range.from) p.from = range.from;
    if (range.to) p.to = range.to;
    return p;
  }, [selectedType, range]);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['ledger', selectedType, range.from, range.to],
    queryFn: async () => {
      const { data } = await reportsApi.ledger(queryParams);
      return data;
    },
  });

  const entries: LedgerEntry[] = data?.entries ?? [];

  return (
    <View style={styles.container}>
      {/* Type Chips */}
      <View style={styles.chipBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipBarContent}>
          {LEDGER_TYPES.map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, selectedType === t && styles.chipActive]}
              onPress={() => setSelectedType(t)}
            >
              <Text style={[styles.chipText, selectedType === t && styles.chipTextActive]}>
                {TYPE_LABELS[t]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Date Preset Chips */}
      <View style={styles.dateBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateBarContent}>
          {PRESETS.map((p, i) => (
            <TouchableOpacity
              key={p.label}
              style={[styles.dateChip, presetIdx === i && styles.dateChipActive]}
              onPress={() => setPresetIdx(i)}
            >
              <Text style={[styles.dateChipText, presetIdx === i && styles.dateChipTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Balance Summary Card */}
      {data && (
        <View style={styles.summaryCard}>
          {/* Top divider label */}
          <Text style={styles.summaryTitle}>Summary</Text>
          {/* 2×2 grid — each cell gets 50% width, no overflow */}
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCell, styles.summaryCellBorderRight, styles.summaryCellBorderBottom]}>
              <Text style={styles.summaryLabel}>Opening Balance</Text>
              <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
                ₹{parseFloat(data.opening_balance || '0').toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={[styles.summaryCell, styles.summaryCellBorderBottom]}>
              <Text style={styles.summaryLabel}>Total Credits</Text>
              <Text style={[styles.summaryValue, styles.summaryCredit]} numberOfLines={1} adjustsFontSizeToFit>
                +₹{parseFloat(data.total_credits || '0').toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={[styles.summaryCell, styles.summaryCellBorderRight]}>
              <Text style={styles.summaryLabel}>Total Debits</Text>
              <Text style={[styles.summaryValue, styles.summaryDebit]} numberOfLines={1} adjustsFontSizeToFit>
                -₹{parseFloat(data.total_debits || '0').toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Closing Balance</Text>
              <Text style={[styles.summaryValue, styles.summaryClosing]} numberOfLines={1} adjustsFontSizeToFit>
                ₹{parseFloat(data.closing_balance || '0').toLocaleString('en-IN')}
              </Text>
              <View style={styles.closingPill}>
                <Text style={styles.closingPillText}>
                  {parseFloat(data.closing_balance || '0') >= 0 ? '▲ Net +' : '▼ Net '}
                  ₹{Math.abs(parseFloat(data.closing_balance || '0') - parseFloat(data.opening_balance || '0')).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Entry List */}
      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={e => e.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>📒</Text>
              <Text style={styles.emptyTitle}>No entries</Text>
              <Text style={styles.emptySubtitle}>No ledger entries for this period</Text>
            </View>
          }
          renderItem={({ item }) => <LedgerEntryCard entry={item} />}
        />
      )}
    </View>
  );
}

// ─── Entry Card ──────────────────────────────────────────────────────────────

function LedgerEntryCard({ entry }: { entry: LedgerEntry }) {
  const isCredit = entry.entry_type === 'CREDIT';
  const label = SOURCE_LABELS[entry.source_type] ?? entry.source_type;
  const bal = parseFloat(entry.balance_after ?? '0');
  const amt = parseFloat(entry.amount ?? '0');

  return (
    <View style={entryStyles.card}>
      {/* Left accent bar */}
      <View style={[entryStyles.accent, { backgroundColor: isCredit ? colors.success : colors.danger }]} />

      <View style={entryStyles.body}>
        <View style={entryStyles.topRow}>
          <View style={entryStyles.badge}>
            <Text style={entryStyles.badgeText}>{label}</Text>
          </View>
          <Text style={[entryStyles.amount, { color: isCredit ? colors.success : colors.danger }]}>
            {isCredit ? '+' : '-'}₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
        </View>

        {entry.description ? (
          <Text style={entryStyles.desc} numberOfLines={1}>{entry.description}</Text>
        ) : null}

        <View style={entryStyles.bottomRow}>
          <Text style={entryStyles.date}>
            {new Date(entry.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>
          <Text style={entryStyles.balance}>
            Bal: ₹{bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  chipBar: {
    backgroundColor: colors.surfaceRaised,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    height: 52,
    justifyContent: 'center',
  },
  chipBarContent: { paddingHorizontal: spacing[4], gap: spacing[2], alignItems: 'center' },
  chip: {
    height: 34, paddingHorizontal: spacing[4],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceMuted, justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium },
  chipTextActive: { color: colors.textInverse },

  dateBar: {
    backgroundColor: colors.surfaceRaised,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    height: 44,
    justifyContent: 'center',
  },
  dateBarContent: { paddingHorizontal: spacing[4], gap: spacing[2], alignItems: 'center' },
  dateChip: {
    height: 30, paddingHorizontal: spacing[3],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: 'transparent', justifyContent: 'center',
  },
  dateChipActive: { backgroundColor: colors.primaryLight ?? colors.primary + '20', borderColor: colors.primary },
  dateChipText: { fontSize: typography.size.xs, color: colors.textSecondary, fontWeight: typography.weight.medium },
  dateChipTextActive: { color: colors.primary, fontWeight: typography.weight.semibold ?? typography.weight.bold },

  summaryCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    marginBottom: spacing[1],
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  summaryTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  summaryCell: { width: '50%', padding: spacing[4] },
  summaryCellBorderRight: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  summaryCellBorderBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  summaryLabel: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginBottom: spacing[1],
    letterSpacing: 0.2,
  },
  summaryValue: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    minWidth: 0,
  },
  summaryCredit: { color: colors.success },
  summaryDebit: { color: colors.danger },
  summaryClosing: { color: colors.primary },
  closingPill: {
    marginTop: spacing[1],
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  closingPillText: {
    fontSize: typography.size.xs,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },

  loader: { flex: 1 },
  list: { paddingHorizontal: spacing[4], gap: spacing[2], paddingTop: spacing[2], paddingBottom: spacing[10] },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: spacing[2] },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: typography.size.base, fontWeight: typography.weight.semibold ?? typography.weight.bold, color: colors.textSecondary },
  emptySubtitle: { fontSize: typography.size.sm, color: colors.textMuted },
});

const entryStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: colors.border,
    ...shadow.sm,
  },
  accent: { width: 4 },
  body: { flex: 1, padding: spacing[3] },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[1] },
  badge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  badgeText: { fontSize: typography.size.xs, color: colors.textSecondary, fontWeight: typography.weight.medium },
  amount: { fontSize: typography.size.base, fontWeight: typography.weight.bold },
  desc: { fontSize: typography.size.xs, color: colors.textSecondary, marginBottom: spacing[1] },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[1] },
  date: { fontSize: typography.size.xs, color: colors.textMuted },
  balance: { fontSize: typography.size.xs, color: colors.textMuted },
});
