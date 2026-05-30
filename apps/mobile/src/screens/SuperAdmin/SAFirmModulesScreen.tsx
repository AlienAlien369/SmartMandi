import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { superAdminApi } from '../../api/endpoints';
import type { SuperAdminStackParamList } from '../../types';
import { colors, spacing, typography, radius } from '../../theme';

type RouteT = RouteProp<SuperAdminStackParamList, 'SAFirmModules'>;
type NavT = NativeStackNavigationProp<SuperAdminStackParamList, 'SAFirmModules'>;

const ALL_MODULES = [
  'DASHBOARD', 'TRUCKS', 'KC', 'CUSTOMERS', 'LEDGER',
  'SUMMARY_SHEETS', 'REPORTS', 'SALARY', 'USERS', 'SETTINGS',
  'ROLE_PERMISSIONS', 'NOTIFICATIONS',
];

export function SAFirmModulesScreen() {
  const { params } = useRoute<RouteT>();
  const navigation = useNavigation<NavT>();
  const qc = useQueryClient();

  const { data: firmModules, isLoading } = useQuery<string[]>({
    queryKey: ['sa-firm-modules', params.firmId],
    queryFn: async () => {
      const res = await superAdminApi.getFirmModules(params.firmId);
      return (res.data as any)?.module_ids ?? [];
    },
  });

  const [selected, setSelected] = React.useState<string[]>([]);
  React.useEffect(() => { if (firmModules) setSelected(firmModules); }, [firmModules]);

  const saveMutation = useMutation({
    mutationFn: () => superAdminApi.setFirmModules(params.firmId, selected),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-firm-modules', params.firmId] });
      navigation.goBack();
    },
  });

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{params.firmName}</Text>
        <Text style={styles.subtitle}>Module Access</Text>
      </View>
      <View style={styles.list}>
        {ALL_MODULES.map(mod => {
          const active = selected.includes(mod);
          return (
            <TouchableOpacity
              key={mod}
              style={[styles.row, active && styles.rowActive]}
              onPress={() => setSelected(s => active ? s.filter(m => m !== mod) : [...s, mod])}
              activeOpacity={0.8}
            >
              <Text style={[styles.modLabel, active && styles.modLabelActive]}>{mod}</Text>
              <Text style={styles.check}>{active ? '✅' : '⬜'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        style={[styles.saveBtn, saveMutation.isPending && { opacity: 0.6 }]}
        onPress={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      >
        <Text style={styles.saveBtnText}>{saveMutation.isPending ? 'Saving…' : 'Save Changes'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f0c', padding: spacing.md },
  header: { marginBottom: spacing.lg },
  back: { color: colors.primary, fontSize: typography.size.sm, marginBottom: spacing.sm },
  title: { color: '#ffffff', fontSize: typography.size.xl, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: typography.size.sm, marginTop: 4 },
  list: { flex: 1, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: radius.md, backgroundColor: '#1a2620' },
  rowActive: { backgroundColor: '#1f3d2a', borderWidth: 1, borderColor: colors.primary },
  modLabel: { color: '#9cbba8', fontSize: typography.size.base, fontWeight: '600' },
  modLabelActive: { color: '#ffffff' },
  check: { fontSize: 18 },
  saveBtn: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.lg, alignItems: 'center', marginTop: spacing.md },
  saveBtnText: { color: '#ffffff', fontWeight: '700', fontSize: typography.size.base },
});
