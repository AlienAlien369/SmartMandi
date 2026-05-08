import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, TextInput, ScrollView, Modal, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { trucksApi } from '../../api/endpoints';
import type { Truck, TruckStackParamList } from '../../types';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { StatusBadge, EmptyState, CardSkeleton } from '../../components/ui';
import { usePermissions } from '../../hooks/usePermissions';

type Nav = NativeStackNavigationProp<TruckStackParamList, 'TruckList'>;
type DatePreset = 'today' | 'week' | 'month' | 'all' | 'custom';

const todayStr = new Date().toISOString().slice(0, 10);

const DATE_OPTIONS: { key: DatePreset; label: string }[] = [
  { key: 'today',  label: 'Today'      },
  { key: 'week',   label: 'This Week'  },
  { key: 'month',  label: 'This Month' },
  { key: 'all',    label: 'All Time'   },
  { key: 'custom', label: 'Custom'     },
];

const STATUS_OPTIONS = [
  { key: null,          label: 'All'       },
  { key: 'SCHEDULED',   label: 'Scheduled' },
  { key: 'ARRIVED',     label: 'Arrived'   },
  { key: 'CLOSED',      label: 'Closed'    },
];

function getDateRange(preset: DatePreset, from: string, to: string) {
  switch (preset) {
    case 'today': return { date_from: todayStr, date_to: todayStr };
    case 'week': {
      const d = new Date(); const day = d.getDay();
      const mon = new Date(d); mon.setDate(d.getDate() - ((day + 6) % 7));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { date_from: mon.toISOString().slice(0, 10), date_to: sun.toISOString().slice(0, 10) };
    }
    case 'month': {
      const d = new Date();
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { date_from: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`, date_to: last.toISOString().slice(0, 10) };
    }
    case 'all':    return {};
    case 'custom': return { date_from: from, date_to: to };
  }
}

export function TruckListScreen() {
  const navigation = useNavigation<Nav>();
  const perms = usePermissions('TRUCKS');

  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState<string | null>(null);
  const [datePreset,    setDatePreset]    = useState<DatePreset>('today');
  const [customFrom,    setCustomFrom]    = useState(todayStr);
  const [customTo,      setCustomTo]      = useState(todayStr);
  const [showDateSheet, setShowDateSheet] = useState(false);

  const dateRange = useMemo(
    () => getDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  const queryParams = useMemo(() => ({
    ...(filterStatus  ? { status: filterStatus } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    ...dateRange,
    limit: 50,
  }), [filterStatus, search, dateRange]);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['trucks', queryParams],
    queryFn:  () => trucksApi.list(queryParams).then(r => r.data),
  });

  const trucks: Truck[] = data?.data ?? [];
  const total: number   = data?.meta?.total ?? 0;

  const dateLabelShort = useMemo(() => {
    if (datePreset === 'today')  return 'Today';
    if (datePreset === 'week')   return 'This Week';
    if (datePreset === 'month')  return 'This Month';
    if (datePreset === 'all')    return 'All Time';
    return `${customFrom} - ${customTo}`;
  }, [datePreset, customFrom, customTo]);

  const hasActiveFilters = filterStatus !== null || datePreset !== 'today' || search.trim().length > 0;

  const clearAll = useCallback(() => {
    setFilterStatus(null);
    setSearch('');
    setDatePreset('today');
    setCustomFrom(todayStr);
    setCustomTo(todayStr);
  }, []);

  return (
    <View style={styles.container}>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>{'🔍'}</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search truck no., driver, produce..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCapitalize="characters"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.inputClear}>{'✕'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter strip */}
      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterStripContent}
        >
          {STATUS_OPTIONS.map(({ key, label }) => (
            <TouchableOpacity
              key={String(key)}
              style={[styles.statusChip, filterStatus === key && styles.statusChipActive]}
              onPress={() => setFilterStatus(key)}
            >
              <Text style={[styles.statusChipText, filterStatus === key && styles.statusChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={styles.chipDivider} />

          <TouchableOpacity
            style={[styles.dateBtn, datePreset !== 'today' && styles.dateBtnActive]}
            onPress={() => setShowDateSheet(true)}
          >
            <Text style={styles.dateBtnIcon}>{'📅'}</Text>
            <Text
              style={[styles.dateBtnText, datePreset !== 'today' && styles.dateBtnTextActive]}
              numberOfLines={1}
            >
              {dateLabelShort}
            </Text>
            <Text style={[styles.dateBtnArrow, datePreset !== 'today' && styles.dateBtnTextActive]}>{'▾'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Active filter row */}
      {hasActiveFilters && (
        <View style={styles.activeRow}>
          <Text style={styles.resultCount}>{total} result{total !== 1 ? 's' : ''}</Text>
          <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
            <Text style={styles.clearBtnText}>{'✕ Clear filters'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Truck list */}
      <FlatList
        data={trucks}
        keyExtractor={t => t.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: spacing[3], padding: spacing[4] }}>
              {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
            </View>
          ) : (
            <EmptyState
              icon="🚛"
              title="No trucks found"
              subtitle={hasActiveFilters ? 'Try adjusting your filters' : 'Schedule a truck to get started'}
              actionLabel={perms.can_create ? 'Add Truck' : undefined}
              onAction={perms.can_create ? () => navigation.navigate('TruckCreate') : undefined}
            />
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('TruckDetail', { truckId: item.id })}
            activeOpacity={0.82}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardLeft}>
                <Text style={styles.truckNo}>{item.truck_number}</Text>
                <Text style={styles.driverLine} numberOfLines={1}>
                  {item.driver_name}{item.driver_phone ? `  \u00b7  ${item.driver_phone}` : ''}
                </Text>
              </View>
              <StatusBadge status={item.status} />
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.metaText}>{`\uD83C\uDF3E ${item.produce_name}`}</Text>
              <Text style={styles.metaText}>{`\uD83D\uDCC5 ${item.sale_date}`}</Text>
              {item.arrived_weight_kg ? (
                <Text style={styles.metaText}>{`\u2696\uFE0F ${item.arrived_weight_kg} kg`}</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
      />

      {/* FAB */}
      {perms.can_create && (
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('TruckCreate')}>
          <Text style={styles.fabText}>+ Truck</Text>
        </TouchableOpacity>
      )}

      {/* Date picker bottom sheet */}
      <Modal
        visible={showDateSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDateSheet(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setShowDateSheet(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Date Range</Text>

          <View style={styles.sheetOptions}>
            {DATE_OPTIONS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.sheetOption, datePreset === key && styles.sheetOptionActive]}
                onPress={() => {
                  setDatePreset(key);
                  if (key !== 'custom') setShowDateSheet(false);
                }}
              >
                <Text style={[styles.sheetOptionText, datePreset === key && styles.sheetOptionTextActive]}>
                  {label}
                </Text>
                {datePreset === key && <Text style={styles.sheetOptionCheck}>{'✓'}</Text>}
              </TouchableOpacity>
            ))}
          </View>

          {datePreset === 'custom' && (
            <View style={styles.customRange}>
              <View style={styles.customField}>
                <Text style={styles.customLabel}>From</Text>
                <TextInput
                  style={styles.customInput}
                  value={customFrom}
                  onChangeText={setCustomFrom}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
              <Text style={styles.customSep}>{'→'}</Text>
              <View style={styles.customField}>
                <Text style={styles.customLabel}>To</Text>
                <TextInput
                  style={styles.customInput}
                  value={customTo}
                  onChangeText={setCustomTo}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.sheetApply} onPress={() => setShowDateSheet(false)}>
            <Text style={styles.sheetApplyText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  searchRow: {
    paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[2],
    backgroundColor: colors.surfaceRaised,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg, paddingHorizontal: spacing[3],
    paddingVertical: Platform.OS === 'ios' ? spacing[2] : 0,
  },
  searchIcon: { fontSize: 15, color: colors.textMuted },
  searchInput: { flex: 1, fontSize: typography.size.sm, color: colors.textPrimary, paddingVertical: spacing[2] },
  inputClear: { fontSize: 13, color: colors.textMuted, paddingHorizontal: spacing[1] },

  filterWrap: {
    height: 46,
    backgroundColor: colors.surfaceRaised,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    overflow: 'hidden',
  },
  filterStripContent: {
    paddingHorizontal: spacing[3],
    gap: spacing[2], flexDirection: 'row', alignItems: 'center', height: 46,
  },
  chipDivider: {
    width: StyleSheet.hairlineWidth, height: 20, backgroundColor: colors.border, marginHorizontal: spacing[1],
  },
  statusChip: {
    paddingHorizontal: spacing[3], paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statusChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusChipText: { fontSize: typography.size.xs, color: colors.textSecondary, fontWeight: typography.weight.medium },
  statusChipTextActive: { color: '#fff' },

  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, flexShrink: 0,
  },
  dateBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  dateBtnIcon: { fontSize: 13 },
  dateBtnText: { fontSize: typography.size.xs, color: colors.textSecondary, fontWeight: typography.weight.medium, maxWidth: 80 },
  dateBtnTextActive: { color: colors.primary },
  dateBtnArrow: { fontSize: 10, color: colors.textMuted },

  activeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  resultCount: { fontSize: typography.size.xs, color: colors.textMuted },
  clearBtn: { paddingHorizontal: spacing[3], paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.dangerBg },
  clearBtnText: { fontSize: typography.size.xs, color: colors.danger, fontWeight: typography.weight.medium },

  list: { padding: spacing[4], gap: spacing[3], paddingBottom: 100 },
  card: {
    backgroundColor: colors.surfaceRaised, borderRadius: radius.lg,
    padding: spacing[4], borderWidth: 0.5, borderColor: colors.border,
    ...shadow.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing[2] },
  cardLeft: { flex: 1, marginRight: spacing[3] },
  truckNo: { fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.textPrimary },
  driverLine: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 2 },
  cardFooter: { flexDirection: 'row', gap: spacing[4], flexWrap: 'wrap' },
  metaText: { fontSize: typography.size.xs, color: colors.textMuted },

  fab: {
    position: 'absolute', bottom: spacing[6], right: spacing[5],
    backgroundColor: colors.primary, borderRadius: radius.xl,
    height: 52, paddingHorizontal: spacing[6],
    alignItems: 'center', justifyContent: 'center',
    ...shadow.md,
  },
  fabText: { color: '#fff', fontWeight: typography.weight.bold, fontSize: typography.size.base },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing[5], paddingBottom: spacing[8],
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: spacing[3], marginBottom: spacing[4] },
  sheetTitle: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.textPrimary, marginBottom: spacing[3] },
  sheetOptions: { gap: spacing[1] },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing[3], paddingHorizontal: spacing[4],
    borderRadius: radius.md,
  },
  sheetOptionActive: { backgroundColor: colors.primaryLight },
  sheetOptionText: { fontSize: typography.size.base, color: colors.textPrimary },
  sheetOptionTextActive: { color: colors.primary, fontWeight: typography.weight.semibold },
  sheetOptionCheck: { fontSize: 16, color: colors.primary },
  customRange: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing[3],
    marginTop: spacing[4], paddingHorizontal: spacing[4],
  },
  customField: { flex: 1 },
  customLabel: { fontSize: typography.size.xs, color: colors.textMuted, marginBottom: 4 },
  customInput: {
    backgroundColor: colors.surfaceMuted, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    fontSize: typography.size.sm, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
  },
  customSep: { fontSize: typography.size.base, color: colors.textMuted, paddingBottom: spacing[2] },
  sheetApply: {
    marginTop: spacing[5], backgroundColor: colors.primary,
    borderRadius: radius.lg, paddingVertical: spacing[4],
    alignItems: 'center',
  },
  sheetApplyText: { color: '#fff', fontWeight: typography.weight.bold, fontSize: typography.size.base },
});