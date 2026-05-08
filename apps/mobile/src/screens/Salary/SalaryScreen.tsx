import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salaryApi, usersApi } from '../../api/endpoints';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { extractApiError } from '../../utils/errorUtils';
import { usePermissions } from '../../hooks/usePermissions';

const PAYMENT_MODES = ['CASH', 'BANK', 'UPI'];

export function SalaryScreen() {
  const queryClient = useQueryClient();
  const perms = usePermissions('SALARY');
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserName, setSelectedUserName] = useState('');
  const [showUserPicker, setShowUserPicker] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['salary'],
    queryFn: async () => {
      const { data } = await salaryApi.list({ page: 1, limit: 50 });
      return data;
    },
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await usersApi.list({ page: 1, limit: 100 });
      return data;
    },
  });

  const users: Array<{ id: string; name: string; role: string; phone: string }> = usersData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedUserId) throw new Error('Please select an employee');
      if (!amount) throw new Error('Please enter an amount');
      return salaryApi.create({
        user_id: selectedUserId,
        amount,
        notes: [paymentMode, notes].filter(Boolean).join(' — ') || undefined,
        salary_date: new Date().toISOString().slice(0, 10),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary'] });
      setShowModal(false);
      setAmount('');
      setNotes('');
      setPaymentMode('CASH');
      setSelectedUserId('');
      setSelectedUserName('');
      Alert.alert('Success ✅', 'Salary entry recorded');
    },
    onError: (e: any) => Alert.alert('Error', e?.message ?? extractApiError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => salaryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary'] });
      Alert.alert('Deleted', 'Salary entry deleted with reversal entries');
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const handleDelete = (id: string) => {
    Alert.alert('Delete Salary Entry', 'This will write reversal ledger entries. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const entries: any[] = data?.data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Salary Records</Text>
        {perms.can_create && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.flex1} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={e => e.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No salary records yet</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.cardInfo}>
                  <Text style={styles.date}>{new Date(item.salary_date).toLocaleDateString('en-IN')}</Text>
                  <Text style={styles.mode}>{item.notes ?? 'Salary Payment'}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.amount}>₹{parseFloat(item.amount).toLocaleString('en-IN')}</Text>
                  {perms.can_delete && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* Add Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Record Salary Payment</Text>

            {/* Employee Picker */}
            <Text style={styles.label}>Employee *</Text>
            {selectedUserId ? (
              <View style={styles.selectedRow}>
                <Text style={styles.selectedName}>{selectedUserName}</Text>
                <TouchableOpacity onPress={() => { setSelectedUserId(''); setSelectedUserName(''); }}>
                  <Text style={styles.clearBtn}>✕ Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowUserPicker(!showUserPicker)}>
                  <Text style={styles.pickerPlaceholder}>Select employee...</Text>
                  <Text style={styles.arrow}>▼</Text>
                </TouchableOpacity>
                {showUserPicker && (
                  <View style={styles.dropdown}>
                    {users.map(u => (
                      <TouchableOpacity key={u.id} style={styles.dropdownItem} onPress={() => {
                        setSelectedUserId(u.id);
                        setSelectedUserName(u.name);
                        setShowUserPicker(false);
                      }}>
                        <Text style={styles.dropdownName}>{u.name}</Text>
                        <Text style={styles.dropdownRole}>{u.role}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            <Text style={styles.label}>Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholder="e.g. 5000"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Monthly salary"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.label}>Payment Mode</Text>
            <View style={styles.modeRow}>
              {PAYMENT_MODES.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeChip, paymentMode === m && styles.modeChipActive]}
                  onPress={() => setPaymentMode(m)}
                >
                  <Text style={[styles.modeChipText, paymentMode === m && styles.modeChipTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, (!selectedUserId || !amount || createMutation.isPending) && styles.submitBtnDisabled]}
                onPress={() => createMutation.mutate()}
                disabled={!selectedUserId || !amount || createMutation.isPending}
              >
                <Text style={styles.submitText}>{createMutation.isPending ? 'Saving...' : 'Save'}</Text>
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
  card: { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: spacing[4], borderWidth: 0.5, borderColor: colors.border, ...shadow.sm },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { flex: 1 },
  cardRight: { alignItems: 'flex-end', gap: spacing[1] },
  date: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.textPrimary },
  mode: { fontSize: typography.size.sm, color: colors.textMuted, marginTop: 2 },
  amount: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.primary },
  deleteBtn: { backgroundColor: colors.error + '18', borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 2 },
  deleteBtnText: { fontSize: typography.size.xs, color: colors.error, fontWeight: typography.weight.bold },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingTop: 60 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surfaceRaised, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[6], maxHeight: '90%' },
  modalTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.textPrimary, marginBottom: spacing[2] },
  label: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textSecondary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3], fontSize: typography.size.base, color: colors.textPrimary, backgroundColor: colors.surfaceMuted },
  selectedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing[3], borderWidth: 1, borderColor: colors.primary },
  selectedName: { fontSize: typography.size.base, fontWeight: typography.weight.medium, color: colors.primary },
  clearBtn: { fontSize: typography.size.sm, color: colors.textMuted },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3], backgroundColor: colors.surfaceMuted },
  pickerPlaceholder: { fontSize: typography.size.base, color: colors.textMuted },
  arrow: { fontSize: typography.size.sm, color: colors.textMuted },
  dropdown: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceRaised, maxHeight: 180, overflow: 'hidden' },
  dropdownItem: { padding: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  dropdownName: { fontSize: typography.size.base, color: colors.textPrimary, fontWeight: typography.weight.medium },
  dropdownRole: { fontSize: typography.size.xs, color: colors.textMuted },
  modeRow: { flexDirection: 'row', gap: spacing[2] },
  modeChip: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing[2], alignItems: 'center' },
  modeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeChipText: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium },
  modeChipTextActive: { color: colors.textInverse },
  modalActions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontWeight: typography.weight.medium },
  submitBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: colors.textInverse, fontWeight: typography.weight.semibold },
  flex1: { flex: 1 },
  modalContent: { gap: spacing[3], paddingBottom: spacing[8] },
});

