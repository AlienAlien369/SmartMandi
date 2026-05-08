import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Share, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, reportsApi } from '../../api/endpoints';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { extractApiError } from '../../utils/errorUtils';

// ─── Date preset helpers ─────────────────────────────────────────────
type Preset = 'today' | 'week' | 'month' | 'all';

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all',   label: 'All Time' },
];

function getRange(preset: Preset): { date_from: string; date_to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === 'today') return { date_from: fmt(today), date_to: fmt(today) };
  if (preset === 'week') {
    const from = new Date(today); from.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return { date_from: fmt(from), date_to: fmt(today) };
  }
  if (preset === 'month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { date_from: fmt(from), date_to: fmt(today) };
  }
  // all — last 365 days
  const from = new Date(today); from.setFullYear(today.getFullYear() - 1);
  return { date_from: fmt(from), date_to: fmt(today) };
}

function rangeLabel(preset: Preset, range: { date_from: string; date_to: string }) {
  if (preset === 'today') return range.date_from;
  return `${range.date_from} → ${range.date_to}`;
}

// ─── Screen ─────────────────────────────────────────────────────────
export function ReportsScreen() {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<Preset>('today');
  const [exportingKcs, setExportingKcs] = useState(false);
  const [exportingTrucks, setExportingTrucks] = useState(false);

  const range = useMemo(() => getRange(preset), [preset]);

  // ── Summary sheets list ──
  const { data: sheets, isLoading: sheetsLoading } = useQuery({
    queryKey: ['summary-sheets'],
    queryFn: async () => {
      const { data } = await dashboardApi.listSummaries({ page: 1, limit: 50 });
      return data;
    },
  });

  // ── Generate summary for the "from" date of selected preset ──
  const generateMutation = useMutation({
    mutationFn: () => dashboardApi.generateSummary(range.date_from),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summary-sheets'] });
      Alert.alert('✅ Generated', `Summary sheet for ${range.date_from} created!`);
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  // ── Export KCs CSV and share ──
  const handleExportKcs = async () => {
    try {
      setExportingKcs(true);
      const { data: csv } = await reportsApi.exportKcs(range);
      if (!csv || csv.trim().split('\n').length < 2) {
        Alert.alert('No Data', `No authorized KCs found for ${rangeLabel(preset, range)}`);
        return;
      }
      await Share.share({
        title: `KCs ${rangeLabel(preset, range)}`,
        message: csv,
      });
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Error', extractApiError(e));
      }
    } finally {
      setExportingKcs(false);
    }
  };

  // ── Export Trucks CSV and share ──
  const handleExportTrucks = async () => {
    try {
      setExportingTrucks(true);
      const { data: csv } = await reportsApi.exportTrucks(range);
      if (!csv || csv.trim().split('\n').length < 2) {
        Alert.alert('No Data', `No trucks found for ${rangeLabel(preset, range)}`);
        return;
      }
      await Share.share({
        title: `Trucks ${rangeLabel(preset, range)}`,
        message: csv,
      });
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Error', extractApiError(e));
      }
    } finally {
      setExportingTrucks(false);
    }
  };

  const sheetList: any[] = sheets?.data ?? sheets ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Date filter strip ── */}
      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {PRESETS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, preset === p.id && styles.chipActive]}
              onPress={() => setPreset(p.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, preset === p.id && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <Text style={styles.rangeLabel}>
        Period: <Text style={styles.rangeLabelBold}>{rangeLabel(preset, range)}</Text>
      </Text>

      {/* ── Export section ── */}
      <SectionTitle title="Export Data" />
      <View style={styles.card}>
        <Text style={styles.cardSubtitle}>Share data as CSV — opens your share sheet</Text>

        <ActionRow
          icon="📋"
          label="Export KCs (CSV)"
          sublabel="Authorized KCs with amounts"
          loading={exportingKcs}
          onPress={handleExportKcs}
          color={colors.primary}
        />
        <View style={styles.rowDivider} />
        <ActionRow
          icon="🚛"
          label="Export Trucks (CSV)"
          sublabel="All trucks with weights & status"
          loading={exportingTrucks}
          onPress={handleExportTrucks}
          color={colors.info}
        />
      </View>

      {/* ── Summary sheet section ── */}
      <SectionTitle title="Summary Sheets" />
      <View style={styles.card}>
        <Text style={styles.cardSubtitle}>
          Immutable snapshot for <Text style={{ color: colors.primary, fontWeight: typography.weight.semibold }}>{range.date_from}</Text>
        </Text>
        <TouchableOpacity
          style={[styles.genBtn, generateMutation.isPending && styles.genBtnDisabled]}
          onPress={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          activeOpacity={0.8}
        >
          {generateMutation.isPending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.genBtnText}>📄  Generate Summary Sheet</Text>
          }
        </TouchableOpacity>
      </View>

      {/* ── Past summary sheets list ── */}
      {sheetsLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing[6] }} />
      ) : sheetList.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📄</Text>
          <Text style={styles.emptyText}>No summary sheets yet</Text>
        </View>
      ) : (
        sheetList.map((sheet: any) => (
          <SheetCard key={sheet.id} sheet={sheet} />
        ))
      )}

    </ScrollView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────
function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function ActionRow({ icon, label, sublabel, loading, onPress, color }: {
  icon: string; label: string; sublabel: string; loading: boolean; onPress: () => void; color: string;
}) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.7} disabled={loading}>
      <View style={[styles.actionIconBg, { backgroundColor: color + '18' }]}>
        <Text style={styles.actionIcon}>{icon}</Text>
      </View>
      <View style={styles.actionText}>
        <Text style={[styles.actionLabel, { color }]}>{label}</Text>
        <Text style={styles.actionSublabel}>{sublabel}</Text>
      </View>
      {loading
        ? <ActivityIndicator size="small" color={color} />
        : <Text style={[styles.actionArrow, { color }]}>↗</Text>
      }
    </TouchableOpacity>
  );
}

function SheetCard({ sheet }: { sheet: any }) {
  const fmt = (n: any) => '₹' + parseFloat(String(n ?? '0')).toLocaleString('en-IN');
  return (
    <View style={styles.sheetCard}>
      <View style={styles.sheetHeader}>
        <View>
          <Text style={styles.sheetDate}>{sheet.sale_date}</Text>
          <Text style={styles.sheetGenAt}>
            Generated {new Date(sheet.generated_at ?? sheet.created_at).toLocaleDateString('en-IN')}
          </Text>
        </View>
        <View style={styles.truckBadge}>
          <Text style={styles.truckBadgeText}>{sheet.total_trucks ?? 0} trucks</Text>
        </View>
      </View>
      <View style={styles.sheetMetrics}>
        <SheetMetric label="Gross Sales"   value={fmt(sheet.total_gross_sales)} />
        <View style={styles.metricDivider} />
        <SheetMetric label="Commission"    value={fmt(sheet.total_commission)} />
        <View style={styles.metricDivider} />
        <SheetMetric label="Net Payable"   value={fmt(sheet.total_net_payable)} />
      </View>
    </View>
  );
}

function SheetMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.sheetMetric}>
      <Text style={styles.sheetMetricValue}>{value}</Text>
      <Text style={styles.sheetMetricLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing[4], paddingBottom: spacing[12], gap: spacing[1] },

  // filter
  filterWrap: { height: 46, overflow: 'hidden', marginBottom: spacing[1] },
  filterRow: { flexDirection: 'row', alignItems: 'center', height: 46, paddingRight: spacing[2] },
  chip: {
    height: 32, paddingHorizontal: spacing[3], borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing[2],
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: typography.size.xs, color: colors.textSecondary, fontWeight: typography.weight.medium },
  chipTextActive: { color: '#fff', fontWeight: typography.weight.semibold },

  rangeLabel: { fontSize: typography.size.xs, color: colors.textMuted, marginBottom: spacing[3] },
  rangeLabelBold: { color: colors.primary, fontWeight: typography.weight.semibold },

  sectionTitle: {
    fontSize: typography.size.xs, fontWeight: typography.weight.semibold as '600',
    color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
    marginTop: spacing[4], marginBottom: spacing[2],
  },

  // card
  card: {
    backgroundColor: colors.surfaceRaised, borderRadius: radius.xl,
    borderWidth: 0.5, borderColor: colors.border, ...shadow.sm,
    overflow: 'hidden', padding: spacing[4], gap: spacing[3],
  },
  cardSubtitle: { fontSize: typography.size.xs, color: colors.textMuted },

  // action rows inside export card
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[1] },
  actionIconBg: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { fontSize: 18 },
  actionText: { flex: 1 },
  actionLabel: { fontSize: typography.size.base, fontWeight: typography.weight.semibold },
  actionSublabel: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 1 },
  actionArrow: { fontSize: 18, fontWeight: typography.weight.bold },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },

  // generate button
  genBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing[3], alignItems: 'center', justifyContent: 'center',
    minHeight: 44,
  },
  genBtnDisabled: { opacity: 0.6 },
  genBtnText: { color: '#fff', fontWeight: typography.weight.semibold, fontSize: typography.size.base },

  // sheet cards
  sheetCard: {
    backgroundColor: colors.surfaceRaised, borderRadius: radius.xl,
    borderWidth: 0.5, borderColor: colors.border, ...shadow.sm,
    padding: spacing[4], marginTop: spacing[3],
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing[3] },
  sheetDate: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.textPrimary },
  sheetGenAt: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  truckBadge: { backgroundColor: colors.infoBg, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 4 },
  truckBadgeText: { fontSize: typography.size.xs, color: colors.info, fontWeight: typography.weight.semibold },
  sheetMetrics: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: colors.border },
  sheetMetric: { flex: 1, alignItems: 'center' },
  sheetMetricValue: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.primary },
  sheetMetricLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },

  emptyBox: { alignItems: 'center', paddingTop: spacing[8], gap: spacing[2] },
  emptyIcon: { fontSize: 44 },
  emptyText: { fontSize: typography.size.base, color: colors.textSecondary },
});