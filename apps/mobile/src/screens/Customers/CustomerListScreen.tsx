import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { customersApi } from '../../api/endpoints';
import type { Customer, CustomerStackParamList } from '../../types';
import { colors, typography, spacing, radius, shadow } from '../../theme';

type Nav = NativeStackNavigationProp<CustomerStackParamList, 'CustomerList'>;

export function CustomerListScreen() {
  const navigation = useNavigation<Nav>();
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['customers', search],
    queryFn: async () => {
      const { data } = await customersApi.list({ search: search || undefined, limit: 50 });
      return data;
    },
  });

  const customers: Customer[] = data?.data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={customers}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👨‍🌾</Text>
            <Text style={styles.emptyText}>{isLoading ? 'Loading...' : 'No customers'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              {item.phone && <Text style={styles.phone}>{item.phone}</Text>}
              {item.address && <Text style={styles.village}>📍 {item.address}</Text>}
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CustomerCreate')}>
        <Text style={styles.fabText}>+ Customer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchRow: { padding: spacing[4], backgroundColor: colors.surface },
  searchInput: {
    backgroundColor: colors.background, borderRadius: radius.md,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: typography.size.base, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
  },
  list: { padding: spacing[4], gap: spacing[2], paddingBottom: 80 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing[4], flexDirection: 'row', alignItems: 'center',
    ...shadow.sm,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center',
    marginRight: spacing[3],
  },
  avatarText: { color: colors.primary, fontWeight: typography.weight.bold, fontSize: typography.size.lg },
  info: { flex: 1 },
  name: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.textPrimary },
  phone: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 1 },
  village: { fontSize: typography.size.xs, color: colors.textTertiary, marginTop: 1 },
  arrow: { fontSize: 20, color: colors.textTertiary },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: colors.textSecondary, marginTop: spacing[3] },
  fab: { position: 'absolute', bottom: spacing[6], right: spacing[5], backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing[5], paddingVertical: spacing[3], ...shadow.lg },
  fabText: { color: colors.textInverse, fontWeight: typography.weight.semibold, fontSize: typography.size.base },
});
