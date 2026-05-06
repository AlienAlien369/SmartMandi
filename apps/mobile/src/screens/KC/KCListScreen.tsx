import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { kcsApi } from '../../api/endpoints';
import type { KacchaChittha, KCStackParamList } from '../../types';
import { colors, typography, spacing, radius, shadow } from '../../theme';

type Nav = NativeStackNavigationProp<KCStackParamList, 'KCList'>;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: colors.statusDraft,
  AUTHORIZED: colors.statusAuthorized,
  CANCELLED: colors.statusCancelled,
};

export function KCListScreen() {
  const navigation = useNavigation<Nav>();
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['kcs', filterStatus, today],
    queryFn: async () => {
      const { data } = await kcsApi.list({ status: filterStatus ?? undefined, date: today });
      return data;
    },
  });

  const kcs: KacchaChittha[] = data?.data ?? [];

  return (
    <View style={styles.container}>
      {/* Filters */}
      <View style={styles.filterRow}>
        {[null, 'DRAFT', 'AUTHORIZED', 'CANCELLED'].map(s => (
          <TouchableOpacity
            key={String(s)}
            style={[styles.chip, filterStatus === s && styles.chipActive]}
            onPress={() => setFilterStatus(s)}
          >
            <Text style={[styles.chipText, filterStatus === s && styles.chipTextActive]}>
              {s ?? 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={kcs}
        keyExtractor={k => k.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>{isLoading ? 'Loading...' : 'No KCs today'}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const sc = STATUS_COLORS[item.status] ?? colors.textTertiary;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('KCDetail', { kcId: item.id })}
            >
              <View style={styles.cardRow}>
                <View>
                  <Text style={styles.kcNumber}>{item.kc_number}</Text>
                  <Text style={styles.dateText}>{item.sale_date}</Text>
                </View>
                <View style={styles.rightCol}>
                  <View style={[styles.badge, { backgroundColor: sc + '20' }]}>
                    <Text style={[styles.badgeText, { color: sc }]}>{item.status}</Text>
                  </View>
                  {item.total_net_payable && (
                    <Text style={styles.amountText}>₹{parseFloat(item.total_net_payable).toLocaleString('en-IN')}</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('KCCreate')}>
        <Text style={styles.fabText}>+ New KC</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filterRow: { flexDirection: 'row', padding: spacing[4], gap: spacing[2], backgroundColor: colors.surface, flexWrap: 'wrap' },
  chip: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium },
  chipTextActive: { color: colors.textInverse },
  list: { padding: spacing[4], gap: spacing[3], paddingBottom: 80 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing[4], ...shadow.sm },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kcNumber: { fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.textPrimary },
  dateText: { fontSize: typography.size.sm, color: colors.textTertiary, marginTop: 2 },
  rightCol: { alignItems: 'flex-end' },
  badge: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm },
  badgeText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  amountText: { fontSize: typography.size.sm, color: colors.primary, fontWeight: typography.weight.semibold, marginTop: spacing[1] },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: colors.textSecondary, marginTop: spacing[3] },
  fab: { position: 'absolute', bottom: spacing[6], right: spacing[5], backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing[5], paddingVertical: spacing[3], ...shadow.lg },
  fabText: { color: colors.textInverse, fontWeight: typography.weight.semibold, fontSize: typography.size.base },
});
