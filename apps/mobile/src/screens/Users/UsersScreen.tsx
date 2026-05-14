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
import { usePermissions } from '../../hooks/usePermissions';
import { useNetworkState } from '../../hooks/useNetworkState';
import { offlineQueue } from '../../offline/queue';

const ROLES: UserRole[] = ['FIRM_HEAD', 'AUTHORIZER', 'OPERATOR', 'VIEWER'];

const ROLE_COLORS: Record<UserRole, string> = {
  FIRM_HEAD: colors.primary,
  AUTHORIZER: colors.info,
  OPERATOR: colors.warning,
  VIEWER: colors.textTertiary,
};

export function UsersScreen() {
  const queryClient = useQueryClient();
  const perms = usePermissions('USERS');
  const { isOnline } = useNetworkState();
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('OPERATOR');

  const openCreate = () => {
    setEditingUser(null);
    setName('');
    setPhone('');
    setRole('OPERATOR');
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setName(u.name);
    setPhone(u.phone);
    setRole(u.role);
    setShowModal(true);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await usersApi.list({ page: 1, limit: 100 });
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!isOnline) {
        await offlineQueue.enqueue('POST', '/users', { name, phone, role });
        return null;
      }
      return usersApi.create({ name, phone, role });
    },
    onSuccess: (data) => {
      if (!data) {
        setShowModal(false);
        Alert.alert('Saved Offline 📶', 'User will be created when you reconnect.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
      Alert.alert('Success', 'User created');
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!isOnline) {
        await offlineQueue.enqueue('PATCH', `/users/${editingUser!.id}`, { name, role });
        return null;
      }
      return usersApi.update(editingUser!.id, { name, role });
    },
    onSuccess: (data) => {
      if (!data) {
        setShowModal(false);
        Alert.alert('Saved Offline 📶', 'User will be updated when you reconnect.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
      Alert.alert('Success', 'User updated');
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline) {
        await offlineQueue.enqueue('DELETE', `/users/${id}`, null);
        return null;
      }
      return usersApi.delete(id);
    },
    onSuccess: (data) => {
      if (!data) {
        Alert.alert('Queued 📶', 'User will be removed when you reconnect.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['users'] });
      Alert.alert('Deleted', 'Team member removed');
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const handleDelete = (u: User) => {
    Alert.alert('Delete Team Member', `Permanently remove ${u.name} from the team?\n\nThis cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(u.id) },
    ]);
  };

  const handleSubmit = () => {
    if (editingUser) updateMutation.mutate();
    else createMutation.mutate();
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const users: User[] = data?.data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Team Members</Text>
        {perms.can_create && (
          <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.flex1} size="large" color={colors.primary} />
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
              <View style={styles.cardRight}>
                <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[item.role] + '20' }]}>
                  <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] }]}>
                    {item.role.replace('_', ' ')}
                  </Text>
                </View>
                <View style={styles.actionRow}>
                  {perms.can_update && (
                    <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                  )}
                  {perms.can_delete && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{editingUser ? 'Edit Team Member' : 'Add Team Member'}</Text>

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Ramesh Kumar"
              placeholderTextColor={colors.textTertiary}
            />

            {!editingUser && (
              <>
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
              </>
            )}

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
                style={[styles.submitBtn, (!name || (!editingUser && !phone)) && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={!name || (!editingUser && !phone) || isPending}
              >
                <Text style={styles.submitText}>{isPending ? 'Saving...' : editingUser ? 'Update' : 'Add User'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing[5], backgroundColor: colors.surfaceRaised, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.md },
  addBtnText: { color: colors.textInverse, fontWeight: typography.weight.semibold },
  list: { padding: spacing[4], gap: spacing[3] },
  card: { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderWidth: 0.5, borderColor: colors.border, ...shadow.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.primary },
  info: { flex: 1 },
  name: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.textPrimary },
  phone: { fontSize: typography.size.sm, color: colors.textMuted, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: spacing[1] },
  roleBadge: { paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.sm },
  roleText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  actionRow: { flexDirection: 'row', gap: spacing[1] },
  editBtn: { backgroundColor: colors.info + '18', borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 2 },
  editBtnText: { fontSize: typography.size.xs, color: colors.info, fontWeight: typography.weight.semibold },
  deleteBtn: { backgroundColor: colors.error + '18', borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 2 },
  deleteBtnText: { fontSize: typography.size.xs, color: colors.error, fontWeight: typography.weight.bold },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingTop: 60, fontSize: typography.size.base },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surfaceRaised, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[6], maxHeight: '90%' },
  modalTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.textPrimary, marginBottom: spacing[2] },
  label: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textSecondary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3], fontSize: typography.size.base, color: colors.textPrimary, backgroundColor: colors.surfaceMuted },
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
  flex1: { flex: 1 },
  modalContent: { gap: spacing[3], paddingBottom: spacing[8] },
});
