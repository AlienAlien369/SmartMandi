import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, reportsApi } from '../../api/endpoints';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { extractApiError } from '../../utils/errorUtils';

export function ReportsScreen() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);

  const { data: sheets } = useQuery({
    queryKey: ['summary-sheets'],
    queryFn: async () => {
      const { data } = await dashboardApi.listSummaries({ page: 1, limit: 50 });
      return data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => dashboardApi.generateSummary(selectedDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summary-sheets'] });
      Alert.alert('Generated', `Summary sheet for ${selectedDate} created!`);
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const exportKcs = async () => {
    try {
      await reportsApi.exportKcs(selectedDate);
      Alert.alert('Export Ready', `KCs for ${selectedDate} exported`);
    } catch (e: any) {
      Alert.alert('Error', extractApiError(e));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Reports & Exports</Text>

      {/* Date Picker */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Select Date</Text>
        <TextInput
          style={styles.dateInput}
          value={selectedDate}
          onChangeText={text => {
            // Accept YYYY-MM-DD format
            if (/^\d{0,4}-?\d{0,2}-?\d{0,2}$/.test(text)) setSelectedDate(text);
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
        <Text style={styles.dateHint}>Format: YYYY-MM-DD (e.g. {today})</Text>
      </View>

      {/* Actions */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>For: {selectedDate}</Text>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          <Text style={styles.actionBtnText}>
            {generateMutation.isPending ? 'Generating...' : '📄 Generate Summary Sheet'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, styles.secondaryBtn]} onPress={exportKcs}>
          <Text style={styles.secondaryBtnText}>📥 Export KCs CSV</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Sheets List */}
      <Text style={styles.sectionTitle}>Summary Sheets</Text>
      {(sheets?.data ?? []).map((sheet: any) => (
        <View key={sheet.id} style={styles.sheetCard}>
          <Text style={styles.sheetDate}>{sheet.sale_date}</Text>
          <View style={styles.sheetMetrics}>
            <SheetMetric label="Trucks" value={sheet.total_trucks} />
            <SheetMetric label="Gross" value={`₹${parseFloat(sheet.total_gross_sales ?? '0').toLocaleString('en-IN')}`} />
            <SheetMetric label="Net Payable" value={`₹${parseFloat(sheet.total_net_payable ?? '0').toLocaleString('en-IN')}`} />
          </View>
          <Text style={styles.sheetGenAt}>
            Generated {new Date(sheet.generated_at ?? sheet.created_at).toLocaleDateString('en-IN')}
          </Text>
        </View>
      ))}

      {(!sheets?.data?.length) && (
        <Text style={styles.empty}>No summary sheets yet</Text>
      )}
    </ScrollView>
  );
}

function SheetMetric({ label, value }: { label: string; value: any }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[10] },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[5], gap: spacing[3], ...shadow.sm },
  sectionLabel: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium },
  dateInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3], fontSize: typography.size.base, color: colors.textPrimary, backgroundColor: colors.background },
  dateHint: { fontSize: typography.size.xs, color: colors.textTertiary },
  actionBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  actionBtnText: { color: colors.textInverse, fontWeight: typography.weight.semibold },
  secondaryBtn: { backgroundColor: colors.primaryLight },
  secondaryBtnText: { color: colors.primary, fontWeight: typography.weight.semibold },
  sectionTitle: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sheetCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[5], ...shadow.sm },
  sheetDate: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.textPrimary, marginBottom: spacing[3] },
  sheetMetrics: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing[3] },
  metricValue: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.primary },
  metricLabel: { fontSize: typography.size.xs, color: colors.textTertiary },
  sheetGenAt: { fontSize: typography.size.xs, color: colors.textTertiary, textAlign: 'right' },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingTop: 20 },
});
