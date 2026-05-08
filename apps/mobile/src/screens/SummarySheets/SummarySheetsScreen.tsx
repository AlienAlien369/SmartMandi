import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '../../api/endpoints';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { extractApiError } from '../../utils/errorUtils';

export function SummarySheetsScreen() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    queryKey: ['summary-sheets'],
    queryFn: async () => {
      const { data } = await dashboardApi.listSummaries({ page: 1, limit: 50 });
      return data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => dashboardApi.generateSummary(today),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summary-sheets'] });
      Alert.alert('Generated', `Summary sheet for ${today} created!`);
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const sheets: any[] = data?.data ?? data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Summary Sheets</Text>
        <TouchableOpacity
          style={styles.genBtn}
          onPress={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          <Text style={styles.genBtnText}>
            {generateMutation.isPending ? 'Generating...' : '+ Today'}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.flex1} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={sheets}
          keyExtractor={s => s.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📄</Text>
              <Text style={styles.empty}>No summary sheets yet</Text>
              <Text style={styles.emptyHint}>Tap "+ Today" to generate today's summary</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.date}>{item.sale_date}</Text>
                <Text style={styles.genAt}>
                  {new Date(item.generated_at ?? item.created_at).toLocaleDateString('en-IN')}
                </Text>
              </View>
              <View style={styles.metrics}>
                <Metric label="Trucks" value={item.total_trucks ?? 0} />
                <Metric label="Gross Sales" value={`₹${parseFloat(item.total_gross_sales ?? '0').toLocaleString('en-IN')}`} />
                <Metric label="Commission" value={`₹${parseFloat(item.total_commission ?? '0').toLocaleString('en-IN')}`} />
                <Metric label="Net Payable" value={`₹${parseFloat(item.total_net_payable ?? '0').toLocaleString('en-IN')}`} />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <View style={metricStyles.container}>
      <Text style={metricStyles.value}>{value}</Text>
      <Text style={metricStyles.label}>{label}</Text>
    </View>
  );
}

const metricStyles = StyleSheet.create({
  container: { alignItems: 'center', flex: 1 },
  value: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.primary },
  label: { fontSize: typography.size.xs, color: colors.textTertiary, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing[5], backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  genBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.md },
  genBtnText: { color: colors.textInverse, fontWeight: typography.weight.semibold },
  list: { padding: spacing[4], gap: spacing[3] },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], ...shadow.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  date: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.textPrimary },
  genAt: { fontSize: typography.size.xs, color: colors.textTertiary },
  metrics: { flexDirection: 'row', justifyContent: 'space-between' },
  emptyContainer: { alignItems: 'center', paddingTop: 80, gap: spacing[2] },
  emptyIcon: { fontSize: 48 },
  empty: { fontSize: typography.size.base, color: colors.textSecondary, fontWeight: typography.weight.medium },
  emptyHint: { fontSize: typography.size.sm, color: colors.textTertiary },
  flex1: { flex: 1 },
});
