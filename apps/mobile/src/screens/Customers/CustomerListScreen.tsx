import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, TextInput, Modal, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { customersApi } from '../../api/endpoints';
import type { Customer, CustomerStackParamList } from '../../types';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { EmptyState, CardSkeleton } from '../../components/ui';
import { usePermissions } from '../../hooks/usePermissions';

type Nav = NativeStackNavigationProp<CustomerStackParamList, 'CustomerList'>;
type SortKey = 'name_asc' | 'name_desc' | 'udhar_desc' | 'udhar_asc' | 'kc_desc';

const SORT_OPTIONS: { key: SortKey; label: string; sub: string }[] = [
  { key: 'name_asc',   label: 'Name A → Z',    sub: 'Alphabetical'         },
  { key: 'name_desc',  label: 'Name Z → A',    sub: 'Reverse alphabetical' },
  { key: 'udhar_desc', label: 'Max Udhar first', sub: 'Highest outstanding'  },
  { key: 'udhar_asc',  label: 'Min Udhar first', sub: 'Lowest outstanding'   },
  { key: 'kc_desc',    label: 'Most KCs first',  sub: 'By transaction count' },
];

export function CustomerListScreen() {
  const navigation = useNavigation<Nav>();
  const perms = usePermissions('CUSTOMERS');

  const [search,    setSearch]    = useState('');
  const [sortBy,    setSortBy]    = useState<SortKey>('name_asc');
  const [showSheet, setShowSheet] = useState(false);

  const queryParams = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    sort_by: sortBy,
    limit: 100,
  }), [search, sortBy]);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['customers', queryParams],
    queryFn:  () => customersApi.list(queryParams).then(r => r.data),
  });

  const customers: Customer[] = data?.data ?? [];
  const total: number         = data?.meta?.total ?? customers.length;

  const sortLabel = SORT_OPTIONS.find(o => o.key === sortBy)?.label ?? 'Sort';
  const hasActiveFilters = search.trim().length > 0 || sortBy !== 'name_asc';

  const clearAll = useCallback(() => {
    setSearch('');
    setSortBy('name_asc');
  }, []);

  return (
    <View style={styles.container}>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>{'🔍'}</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Name, phone or address..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.inputClear}>{'✕'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter strip */}
      <View style={styles.filterStrip}>
        <Text style={styles.stripLabel}>Sort by</Text>
        <TouchableOpacity
          style={[styles.sortBtn, sortBy !== 'name_asc' && styles.sortBtnActive]}
          onPress={() => setShowSheet(true)}
        >
          <Text style={[styles.sortBtnText, sortBy !== 'name_asc' && styles.sortBtnTextActive]} numberOfLines={1}>
            {sortLabel}
          </Text>
          <Text style={[styles.sortArrow, sortBy !== 'name_asc' && styles.sortBtnTextActive]}>{'▾'}</Text>
        </TouchableOpacity>
      </View>

      {/* Active filter row */}
      {hasActiveFilters && (
        <View style={styles.activeRow}>
          <Text style={styles.resultCount}>{total} customer{total !== 1 ? 's' : ''}</Text>
          <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
            <Text style={styles.clearBtnText}>{'✕ Clear filters'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Customer list */}
      <FlatList
        data={customers}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: spacing[3], padding: spacing[4] }}>
              {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
            </View>
          ) : (
            <EmptyState
              icon="👨‍🌾"
              title="No customers found"
              subtitle={search ? 'Try a different name, phone or address' : 'Add a customer to get started'}
              actionLabel={perms.can_create ? 'Add Customer' : undefined}
              onAction={perms.can_create ? () => navigation.navigate('CustomerCreate') : undefined}
            />
          )
        }
        renderItem={({ item }) => {
          const udhar   = Number(item.outstanding_udhar ?? 0);
          const credit  = Number(item.credit_balance ?? 0);
          const kcCount = Number(item.kc_count ?? 0);
          const initials = item.name?.slice(0, 2).toUpperCase() ?? '?';
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id })}
              activeOpacity={0.82}
            >
              {/* Avatar */}
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>

              {/* Info */}
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                {item.phone   && <Text style={styles.phone}>{item.phone}</Text>}
                {item.address && (
                  <Text style={styles.address} numberOfLines={1}>{`\uD83D\uDCCD ${item.address}`}</Text>
                )}
                {kcCount > 0 && (
                  <Text style={styles.kcCount}>{`${kcCount} KC${kcCount !== 1 ? 's' : ''}`}</Text>
                )}
              </View>

              {/* Right — credit badge / udhar badge / arrow */}
              <View style={styles.right}>
                {credit > 0 ? (
                  <View style={styles.creditBadge}>
                    <Text style={styles.creditBadgeLabel}>{'Credit'}</Text>
                    <Text style={styles.creditBadgeAmt}>{`\u20B9${credit.toLocaleString('en-IN')}`}</Text>
                  </View>
                ) : udhar > 0 ? (
                  <View style={styles.udharBadge}>
                    <Text style={styles.udharLabel}>{'Udhar'}</Text>
                    <Text style={styles.udharAmount}>{`\u20B9${udhar.toLocaleString('en-IN')}`}</Text>
                  </View>
                ) : (
                  <Text style={styles.arrow}>{'›'}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* FAB */}
      {perms.can_create && (
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CustomerCreate')}>
          <Text style={styles.fabText}>+ Customer</Text>
        </TouchableOpacity>
      )}

      {/* Sort bottom sheet */}
      <Modal visible={showSheet} transparent animationType="slide" onRequestClose={() => setShowSheet(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setShowSheet(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Sort Customers</Text>

          <View style={styles.sheetOptions}>
            {SORT_OPTIONS.map(({ key, label, sub }) => (
              <TouchableOpacity
                key={key}
                style={[styles.sheetOption, sortBy === key && styles.sheetOptionActive]}
                onPress={() => { setSortBy(key); setShowSheet(false); }}
              >
                <View>
                  <Text style={[styles.sheetOptionText, sortBy === key && styles.sheetOptionTextActive]}>
                    {label}
                  </Text>
                  <Text style={styles.sheetOptionSub}>{sub}</Text>
                </View>
                {sortBy === key && <Text style={styles.sheetOptionCheck}>{'✓'}</Text>}
              </TouchableOpacity>
            ))}
          </View>
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

  filterStrip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    backgroundColor: colors.surfaceRaised,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    gap: spacing[3],
  },
  stripLabel: { fontSize: typography.size.xs, color: colors.textMuted, fontWeight: typography.weight.medium },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sortBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  sortBtnText: { fontSize: typography.size.xs, color: colors.textSecondary, fontWeight: typography.weight.medium, maxWidth: 140 },
  sortBtnTextActive: { color: colors.primary },
  sortArrow: { fontSize: 10, color: colors.textMuted },

  activeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  resultCount: { fontSize: typography.size.xs, color: colors.textMuted },
  clearBtn: { paddingHorizontal: spacing[3], paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.dangerBg },
  clearBtnText: { fontSize: typography.size.xs, color: colors.danger, fontWeight: typography.weight.medium },

  list: { padding: spacing[4], gap: spacing[2], paddingBottom: 100 },
  card: {
    backgroundColor: colors.surfaceRaised, borderRadius: radius.lg,
    padding: spacing[4], flexDirection: 'row', alignItems: 'center',
    borderWidth: 0.5, borderColor: colors.border,
    ...shadow.sm,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center',
    marginRight: spacing[3],
  },
  avatarText: { color: colors.primary, fontWeight: typography.weight.bold, fontSize: typography.size.md },
  info: { flex: 1 },
  name: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.textPrimary },
  phone: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 1 },
  address: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 1 },
  kcCount: { fontSize: typography.size.xs, color: colors.primary, marginTop: 3, fontWeight: typography.weight.medium },
  right: { alignItems: 'flex-end', justifyContent: 'center', marginLeft: spacing[2] },
  udharBadge: {
    backgroundColor: colors.dangerBg, borderRadius: radius.md,
    paddingHorizontal: spacing[2], paddingVertical: spacing[1],
    alignItems: 'flex-end',
  },
  udharLabel: { fontSize: 9, fontWeight: typography.weight.semibold, color: colors.danger, textTransform: 'uppercase', letterSpacing: 0.4 },
  udharAmount: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.danger },
  creditBadge: {
    backgroundColor: '#dbeafe', borderRadius: radius.md,
    paddingHorizontal: spacing[2], paddingVertical: spacing[1],
    alignItems: 'flex-end', borderWidth: 1, borderColor: '#93c5fd',
  },
  creditBadgeLabel: { fontSize: 9, fontWeight: typography.weight.semibold, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 0.4 },
  creditBadgeAmt: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: '#1d4ed8' },
  arrow: { fontSize: 20, color: colors.textMuted },

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
  sheetOptionSub: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 1 },
  sheetOptionCheck: { fontSize: 16, color: colors.primary },
});