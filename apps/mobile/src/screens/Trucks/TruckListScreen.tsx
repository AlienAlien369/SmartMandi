import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { trucksApi } from '../../api/endpoints';
import type { Truck, TruckStackParamList } from '../../types';
import { colors, typography, spacing, radius, shadow } from '../../theme';

type Nav = NativeStackNavigationProp<TruckStackParamList, 'TruckList'>;

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: colors.statusScheduled,
  ARRIVED: colors.statusArrived,
  CLOSED: colors.statusClosed,
};

export function TruckListScreen() {
  const navigation = useNavigation<Nav>();
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['trucks', filterStatus, today],
    queryFn: async () => {
      const { data } = await trucksApi.list({ status: filterStatus ?? undefined, date: today });
      return data;
    },
  });

  const trucks: Truck[] = data?.data ?? [];

  return (
    <View style={styles.container}>
      {/* Filter chips */}
      <View style={styles.filterRow}>
        {[null, 'SCHEDULED', 'ARRIVED', 'CLOSED'].map(s => (
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
        data={trucks}
        keyExtractor={t => t.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🚛</Text>
            <Text style={styles.emptyText}>{isLoading ? 'Loading...' : 'No trucks today'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('TruckDetail', { truckId: item.id })}
          >
            <View style={styles.cardRow}>
              <View style={styles.cardLeft}>
                <Text style={styles.truckNumber}>{item.truck_number}</Text>
                <Text style={styles.driverName}>{item.driver_name}</Text>
                <Text style={styles.produceName}>{item.produce_name}</Text>
              </View>
              <View>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] ?? colors.textTertiary) + '20' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] ?? colors.textTertiary }]}>{item.status}</Text>
                </View>
                {item.arrived_weight_kg && (
                  <Text style={styles.weightText}>{item.arrived_weight_kg} kg</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('TruckCreate')}
      >
        <Text style={styles.fabText}>+ Truck</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filterRow: { flexDirection: 'row', padding: spacing[4], gap: spacing[2], backgroundColor: colors.surface },
  chip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium },
  chipTextActive: { color: colors.textInverse },
  list: { padding: spacing[4], gap: spacing[3], paddingBottom: 80 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing[4], ...shadow.sm,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { flex: 1 },
  truckNumber: {
    fontSize: typography.size.md, fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  driverName: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 2 },
  produceName: { fontSize: typography.size.sm, color: colors.textTertiary, marginTop: 1 },
  statusBadge: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm, alignSelf: 'flex-end' },
  statusText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  weightText: { fontSize: typography.size.xs, color: colors.textTertiary, textAlign: 'right', marginTop: spacing[1] },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: colors.textSecondary, marginTop: spacing[3], fontSize: typography.size.base },
  fab: {
    position: 'absolute', bottom: spacing[6], right: spacing[5],
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: spacing[5], paddingVertical: spacing[3], ...shadow.lg,
  },
  fabText: { color: colors.textInverse, fontWeight: typography.weight.semibold, fontSize: typography.size.base },
});
