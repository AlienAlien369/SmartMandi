import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Switch,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rbacApi } from '../../api/endpoints';
import { colors, typography, spacing, radius, shadow } from '../../theme';

const ROLES = ['AUTHORIZER', 'OPERATOR', 'VIEWER'];
const ACTIONS: Array<{ key: 'can_create' | 'can_read' | 'can_update' | 'can_delete'; label: string; icon: string }> = [
  { key: 'can_create', label: 'Create', icon: '+' },
  { key: 'can_read', label: 'Read', icon: 'R' },
  { key: 'can_update', label: 'Update', icon: 'U' },
  { key: 'can_delete', label: 'Delete', icon: 'X' },
];

type Permission = {
  module_id: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
};
type Module = { id: string; name: string; label: string; description: string; sort_order: number };

export function RolePermissionsScreen() {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [pendingPerms, setPendingPerms] = useState<Record<string, Permission>>({});
  const [isDirty, setIsDirty] = useState(false);

  const { data: modulesData, isLoading: modLoading } = useQuery({
    queryKey: ['rbac', 'firm-modules'],
    queryFn: () => rbacApi.getMyModules().then(r => r.data as Module[]),
  });

  const { data: permsData, isLoading: permLoading } = useQuery({
    queryKey: ['rbac', 'permissions', selectedRole],
    queryFn: () => rbacApi.getPermissionsForRole(selectedRole).then(r => r.data as Permission[]),
  });

  useEffect(() => {
    if (permsData) {
      const map: Record<string, Permission> = {};
      for (const p of permsData) map[p.module_id] = { ...p };
      setPendingPerms(map);
      setIsDirty(false);
    }
  }, [permsData]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const permissions = Object.values(pendingPerms);
      return rbacApi.setRolePermissions(selectedRole, permissions);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac', 'permissions', selectedRole] });
      setIsDirty(false);
      Alert.alert('Saved', `Permissions for ${selectedRole} updated`);
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to save');
    },
  });

  const togglePerm = (moduleId: string, action: keyof Omit<Permission, 'module_id'>) => {
    setPendingPerms(prev => {
      const current = prev[moduleId] ?? {
        module_id: moduleId, can_create: false, can_read: true, can_update: false, can_delete: false,
      };
      return { ...prev, [moduleId]: { ...current, [action]: !current[action] } };
    });
    setIsDirty(true);
  };

  const isLoading = modLoading || permLoading;

  return (
    <View style={styles.container}>
      <View style={styles.roleBar}>
        {ROLES.map(role => (
          <TouchableOpacity
            key={role}
            style={[styles.roleChip, selectedRole === role && styles.roleChipActive]}
            onPress={() => { setSelectedRole(role); setIsDirty(false); }}
          >
            <Text style={[styles.roleChipText, selectedRole === role && styles.roleChipTextActive]}>
              {role}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loaderTop} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.hint}>
            Set CRUD permissions for {selectedRole} — only modules enabled for this firm are shown.
          </Text>
          {(modulesData ?? []).length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No Modules Assigned</Text>
              <Text style={styles.emptyText}>
                Ask your Super Admin to enable modules for this firm before setting role permissions.
              </Text>
            </View>
          )}
          {(modulesData ?? []).map(mod => {
            const perm: Permission = pendingPerms[mod.id] ?? {
              module_id: mod.id, can_create: false, can_read: true, can_update: false, can_delete: false,
            };
            return (
              <View key={mod.id} style={styles.card}>
                <Text style={styles.moduleName}>{mod.label ?? mod.name}</Text>
                <Text style={styles.moduleDesc}>{mod.description}</Text>
                <View style={styles.actionsRow}>
                  {ACTIONS.map(action => (
                    <View key={action.key} style={styles.actionItem}>
                      <Text style={styles.actionLabel}>{action.icon} {action.label}</Text>
                      <Switch
                        value={Boolean(perm[action.key])}
                        onValueChange={() => togglePerm(mod.id, action.key)}
                        trackColor={{ false: colors.divider, true: colors.primary }}
                        thumbColor={perm[action.key] ? '#fff' : '#f4f4f4'}
                        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                      />
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {isDirty && (
        <View style={styles.saveBar}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Permissions</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  roleBar: {
    flexDirection: 'row', gap: spacing[2], padding: spacing[4],
    backgroundColor: colors.surfaceRaised, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  roleChip: {
    flex: 1, paddingVertical: spacing[2], borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  roleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleChipText: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium },
  roleChipTextActive: { color: colors.textInverse },
  hint: { fontSize: typography.size.sm, color: colors.textMuted, marginBottom: spacing[3] },
  emptyBox: { backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, padding: spacing[6], alignItems: 'center', borderWidth: 0.5, borderColor: colors.border, ...shadow.sm },
  emptyTitle: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.textPrimary, marginBottom: spacing[2] },
  emptyText: { fontSize: typography.size.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[10] },
  card: { backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, padding: spacing[4], borderWidth: 0.5, borderColor: colors.border, ...shadow.sm },
  moduleName: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.textPrimary },
  moduleDesc: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2, marginBottom: spacing[3] },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing[2] },
  actionItem: { alignItems: 'center', minWidth: '22%' },
  actionLabel: { fontSize: 10, color: colors.textSecondary, marginBottom: 2 },
  saveBar: {
    padding: spacing[4], backgroundColor: colors.surfaceRaised,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing[4], alignItems: 'center',
  },
  saveBtnText: { color: colors.textInverse, fontSize: typography.size.base, fontWeight: typography.weight.bold },
  flex1: { flex: 1 },
  loaderTop: { marginTop: 40 },
});
