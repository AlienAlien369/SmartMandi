import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/endpoints';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import type { User, UserRole } from '../../types';
import { extractApiError } from '../../utils/errorUtils';

const ROLES: UserRole[] = ['FIRM_HEAD', 'AUTHORIZER', 'OPERATOR', 'VIEWER'];

const ROLE_COLORS: Record<UserRole, string> = {
  FIRM_HEAD: colors.primary,
  AUTHORIZER: colors.info,
  OPERATOR: colors.warning,
  VIEWER: colors.textTertiary,
};

export function UsersScreen() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('OPERATOR');

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await usersApi.list({ page: 1, limit: 100 });
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => usersApi.create({ name, phone, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
      setName('');
      setPhone('');
      setRole('OPERATOR');
      Alert.alert('Success', 'User created');
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const users: User[] = data?.data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Team Members</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No team members yet</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.phone}>{item.phone}</Text>
              </View>
              <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[item.role] + '20' }]}>
                <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] }]}>
                  {item.role.replace('_', ' ')}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ gap: spacing[3], paddingBottom: spacing[8] }} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Add Team Member</Text>

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Ramesh Kumar"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              placeholder="10-digit mobile number"
              placeholderTextColor={colors.textTertiary}
              maxLength={10}
            />

            <Text style={styles.label}>Role</Text>
            <View style={styles.roleGrid}>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, role === r && { backgroundColor: ROLE_COLORS[r], borderColor: ROLE_COLORS[r] }]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
                    {r.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, (!name || !phone) && styles.submitBtnDisabled]}
                onPress={() => createMutation.mutate()}
                disabled={!name || !phone || createMutation.isPending}
              >
                <Text style={styles.submitText}>{createMutation.isPending ? 'Saving...' : 'Add User'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing[5], backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.md },
  addBtnText: { color: colors.textInverse, fontWeight: typography.weight.semibold },
  list: { padding: spacing[4], gap: spacing[3] },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3], ...shadow.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.primary },
  info: { flex: 1 },
  name: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.textPrimary },
  phone: { fontSize: typography.size.sm, color: colors.textTertiary, marginTop: 2 },
  roleBadge: { paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.sm },
  roleText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingTop: 60, fontSize: typography.size.base },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[6], maxHeight: '90%' },
  modalTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.textPrimary, marginBottom: spacing[2] },
  label: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textSecondary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3], fontSize: typography.size.base, color: colors.textPrimary, backgroundColor: colors.background },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  roleChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  roleChipText: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium },
  roleChipTextActive: { color: colors.textInverse },
  modalActions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontWeight: typography.weight.medium },
  submitBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: colors.textInverse, fontWeight: typography.weight.semibold },
});
