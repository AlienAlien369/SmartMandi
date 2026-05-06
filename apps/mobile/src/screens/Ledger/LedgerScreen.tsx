import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api/endpoints';
import type { LedgerEntry } from '../../types';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { LedgerType } from '../../types';

const LEDGER_TYPES: LedgerType[] = ['CUSTOMER', 'TRUCK', 'FIRM_CASH', 'USER_SALARY'];

export function LedgerScreen() {
  const [selectedType, setSelectedType] = useState<LedgerType>('FIRM_CASH');

  const { data, isLoading } = useQuery({
    queryKey: ['ledger', selectedType],
    queryFn: async () => {
      const { data } = await reportsApi.ledger({ type: selectedType, page: 1, limit: 100 });
      return data;
    },
  });

  const entries: LedgerEntry[] = data?.entries ?? [];

  return (
    <View style={styles.container}>
      {/* Type Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow} contentContainerStyle={{ gap: spacing[2], paddingHorizontal: spacing[4] }}>
        {LEDGER_TYPES.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, selectedType === t && styles.chipActive]}
            onPress={() => setSelectedType(t)}
          >
            <Text style={[styles.chipText, selectedType === t && styles.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Balance Summary */}
      {data && (
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>Opening</Text>
              <Text style={styles.balanceValue}>₹{parseFloat(data.opening_balance || '0').toLocaleString('en-IN')}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.balanceLabel}>Credits</Text>
              <Text style={[styles.balanceValue, { color: colors.success }]}>+₹{parseFloat(data.total_credits || '0').toLocaleString('en-IN')}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.balanceLabel}>Closing</Text>
              <Text style={[styles.balanceValue, { color: colors.primary }]}>₹{parseFloat(data.closing_balance || '0').toLocaleString('en-IN')}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Entries */}
      {isLoading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={e => e.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No entries found</Text>}
          renderItem={({ item }) => (
            <View style={styles.entry}>
              <View style={styles.entryLeft}>
                <Text style={styles.entrySource}>{item.source_type}</Text>
                <Text style={styles.entryDate}>{new Date(item.created_at).toLocaleDateString('en-IN')}</Text>
                {item.description && <Text style={styles.entryDesc}>{item.description}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.entryAmount, { color: item.entry_type === 'CREDIT' ? colors.success : colors.error }]}>
                  {item.entry_type === 'CREDIT' ? '+' : '-'}₹{parseFloat(item.amount).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.entryBalance}>Bal: ₹{parseFloat(item.balance_after).toLocaleString('en-IN')}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  typeRow: { paddingVertical: spacing[3], backgroundColor: colors.surface, maxHeight: 56 },
  chip: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium },
  chipTextActive: { color: colors.textInverse },
  balanceCard: { margin: spacing[4], backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], ...shadow.sm },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  balanceLabel: { fontSize: typography.size.xs, color: colors.textTertiary, textTransform: 'uppercase' },
  balanceValue: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.textPrimary, marginTop: 2 },
  list: { paddingHorizontal: spacing[4], gap: spacing[2], paddingBottom: spacing[8] },
  entry: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing[3], flexDirection: 'row', justifyContent: 'space-between', ...shadow.sm },
  entryLeft: { flex: 1 },
  entrySource: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textPrimary },
  entryDate: { fontSize: typography.size.xs, color: colors.textTertiary, marginTop: 1 },
  entryDesc: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 1 },
  entryAmount: { fontSize: typography.size.base, fontWeight: typography.weight.bold },
  entryBalance: { fontSize: typography.size.xs, color: colors.textTertiary, marginTop: 1 },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingTop: 40 },
});
