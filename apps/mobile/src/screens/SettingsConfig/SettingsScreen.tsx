import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Linking,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { configApi } from '../../api/endpoints';
import { API_BASE_URL } from '../../api/constants';
import { colors, typography, spacing, radius, shadow } from '../../theme';

export function SettingsScreen() {
  const today = new Date().toISOString().slice(0, 10);

  const { data: configData, isLoading } = useQuery({
    queryKey: ['config', today],
    queryFn: async () => {
      const { data } = await configApi.getVersion(today);
      return data;
    },
  });

  const config = configData?.config ?? configData;

  const settingsGroups = [
    {
      title: 'Business Config',
      items: config ? [
        { label: 'Commission Rate', value: `${config.commission_rate_pct ?? '-'}%` },
        { label: 'APMC Fee Rate', value: `${config.apmc_fee_rate_pct ?? '-'}%` },
        { label: 'Default Produce', value: config.default_produce ?? '-' },
        { label: 'Effective From', value: config.effective_from ?? '-' },
      ] : [],
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Settings & Config</Text>

      {isLoading && <Text style={styles.loading}>Loading config...</Text>}

      {settingsGroups.map(group => (
        <View key={group.title} style={styles.group}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <View style={styles.card}>
            {group.items.length === 0 ? (
              <Text style={styles.noConfig}>No config found for today. Configure via admin panel.</Text>
            ) : (
              group.items.map((item, i) => (
                <React.Fragment key={item.label}>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Text style={styles.rowValue}>{item.value}</Text>
                  </View>
                  {i < group.items.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))
            )}
          </View>
        </View>
      ))}

      {/* App Info */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>App Info</Text>
        <View style={styles.card}>
          {[
            { label: 'Version', value: '2.0.0' },
            { label: 'Environment', value: __DEV__ ? 'Development' : 'Production' },
            { label: 'API', value: API_BASE_URL },
          ].map((item, i, arr) => (
            <React.Fragment key={item.label}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowValue}>{item.value}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={styles.supportBtn}
        onPress={() => Alert.alert('Support', 'Contact: support@smartmandi.app')}
      >
        <Text style={styles.supportText}>📞 Contact Support</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[10] },
  pageTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  loading: { color: colors.textSecondary, textAlign: 'center', padding: spacing[4] },
  group: { gap: spacing[2] },
  groupTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', ...shadow.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing[4] },
  rowLabel: { fontSize: typography.size.base, color: colors.textPrimary },
  rowValue: { fontSize: typography.size.base, color: colors.textSecondary, fontWeight: typography.weight.medium },
  divider: { height: 1, backgroundColor: colors.divider, marginHorizontal: spacing[4] },
  noConfig: { padding: spacing[4], color: colors.textSecondary, textAlign: 'center' },
  supportBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing[4], alignItems: 'center' },
  supportText: { color: colors.textSecondary, fontSize: typography.size.base, fontWeight: typography.weight.medium },
});
