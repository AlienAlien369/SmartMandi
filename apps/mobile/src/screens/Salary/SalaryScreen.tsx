import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salaryApi, usersApi, trucksApi } from '../../api/endpoints';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { extractApiError } from '../../utils/errorUtils';
import { usePermissions } from '../../hooks/usePermissions';

// ─── Freight type config ────────────────────────────────────────────────────
const FREIGHT_TYPES = [
  { key: 'SALARY',  label: 'Salary',  icon: '💼', color: '#6366F1', bg: '#6366F115', recipient: 'employee' },
  { key: 'INAM',    label: 'Inam',    icon: '🎁', color: '#F59E0B', bg: '#F59E0B15', recipient: 'driver' },
  { key: 'KIRAYA',  label: 'Kiraya',  icon: '🚛', color: '#10B981', bg: '#10B98115', recipient: 'driver' },
  { key: 'PARCHI',  label: 'Parchi',  icon: '📄', color: '#8B5CF6', bg: '#8B5CF615', recipient: 'driver' },
] as const;
type FreightKey = typeof FREIGHT_TYPES[number]['key'];

const FREIGHT_MAP = Object.fromEntries(FREIGHT_TYPES.map(t => [t.key, t])) as Record<FreightKey, typeof FREIGHT_TYPES[number]>;
const PAYMENT_MODES = ['CASH', 'BANK', 'UPI'] as const;

/** Returns true when the freight type is paid to a truck driver (not an employee). */
const isDriverType = (type: FreightKey) => FREIGHT_MAP[type].recipient === 'driver';

function today() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function SalaryScreen() {
  const queryClient = useQueryClient();
  const perms = usePermissions('SALARY');

  // ── Filters ──────────────────────────────────────────────────────────────
  const [filterType, setFilterType] = useState<FreightKey | 'ALL'>('ALL');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // ── Add modal state ────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [freightType, setFreightType] = useState<FreightKey>('SALARY');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMode, setPaymentMode] = useState<string>('CASH');
  const [salaryDate, setSalaryDate] = useState(today());

  // Employee state (SALARY type)
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserName, setSelectedUserName] = useState('');
  const [showUserPicker, setShowUserPicker] = useState(false);

  // Truck/driver state (INAM/KIRAYA/PARCHI types)
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [selectedTruckLabel, setSelectedTruckLabel] = useState('');
  const [showTruckPicker, setShowTruckPicker] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['freight', filterType, filterFrom, filterTo],
    queryFn: async () => {
      const params: Record<string, string> = { page: '1', limit: '100' };
      if (filterType !== 'ALL') params.freight_type = filterType;
      if (filterFrom) params.from = filterFrom;
      if (filterTo) params.to = filterTo;
      const { data } = await salaryApi.list(params);
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

  const { data: trucksData } = useQuery({
    queryKey: ['trucks-for-freight'],
    queryFn: async () => {
      const { data } = await trucksApi.list({ limit: 200 });
      return data;
    },
    enabled: showModal && isDriverType(freightType),
  });

  const users: Array<{ id: string; name: string; role: string; phone: string }> = usersData?.data ?? [];
  const trucks: Array<{ id: string; truck_number: string; driver_name: string; driver_phone?: string }> = trucksData?.data ?? [];
  const entries: any[] = data?.data ?? [];

  const totalAmount = useMemo(
    () => entries.reduce((s, e) => s + parseFloat(e.amount || '0'), 0),
    [entries],
  );

  // ── Form helpers ────────────────────────────────────────────────────────
  const resetForm = () => {
    setAmount(''); setNotes(''); setPaymentMode('CASH');
    setSalaryDate(today()); setFreightType('SALARY');
    setSelectedUserId(''); setSelectedUserName(''); setShowUserPicker(false);
    setSelectedTruckId(''); setSelectedTruckLabel(''); setShowTruckPicker(false);
  };

  const handleFreightTypeChange = (key: FreightKey) => {
    setFreightType(key);
    // Reset the recipient when switching between employee ↔ driver modes
    if (isDriverType(key) !== isDriverType(freightType)) {
      setSelectedUserId(''); setSelectedUserName(''); setShowUserPicker(false);
      setSelectedTruckId(''); setSelectedTruckLabel(''); setShowTruckPicker(false);
    }
  };

  const isFormValid = () => {
    if (!amount || isNaN(parseFloat(amount))) return false;
    if (isDriverType(freightType)) return !!selectedTruckId;
    return !!selectedUserId;
  };

  // ── Mutations ────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () => {
      if (!amount || isNaN(parseFloat(amount))) throw new Error('Please enter a valid amount');
      const basePayload = {
        amount,
        freight_type: freightType,
        notes: [paymentMode, notes].filter(Boolean).join(' — ') || undefined,
        salary_date: salaryDate,
      };
      if (isDriverType(freightType)) {
        if (!selectedTruckId) throw new Error('Please select a truck / driver');
        return salaryApi.create({ ...basePayload, truck_id: selectedTruckId });
      } else {
        if (!selectedUserId) throw new Error('Please select an employee');
        return salaryApi.create({ ...basePayload, user_id: selectedUserId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['freight'] });
      setShowModal(false);
      resetForm();
      Alert.alert('Success ✅', 'Freight entry recorded');
    },
    onError: (e: any) => Alert.alert('Error', e?.message ?? extractApiError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => salaryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['freight'] });
      Alert.alert('Deleted', 'Freight entry deleted with reversal ledger entries');
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const handleDelete = (id: string, type: string) => {
    const t = FREIGHT_MAP[type as FreightKey];
    Alert.alert(
      `Delete ${t?.label ?? 'Freight'} Entry`,
      'This will write reversal ledger entries. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
      ],
    );
  };

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Freight</Text>
          <Text style={styles.subtitle}>{entries.length} records · ₹{totalAmount.toLocaleString('en-IN')}</Text>
        </View>
        {perms.can_create && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Type filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
        <TouchableOpacity
          style={[styles.filterChip, filterType === 'ALL' && styles.filterChipActive]}
          onPress={() => setFilterType('ALL')}
        >
          <Text style={[styles.filterChipText, filterType === 'ALL' && styles.filterChipTextActive]}>All</Text>
        </TouchableOpacity>
        {FREIGHT_TYPES.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.filterChip, filterType === t.key && { backgroundColor: t.color, borderColor: t.color }]}
            onPress={() => setFilterType(t.key)}
          >
            <Text style={{ fontSize: 12, marginRight: 4 }}>{t.icon}</Text>
            <Text style={[styles.filterChipText, filterType === t.key && styles.filterChipTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Date range filter */}
      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <Text style={styles.dateLabel}>From</Text>
          <TextInput
            style={styles.dateInput}
            value={filterFrom}
            onChangeText={setFilterFrom}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
        <View style={styles.dateSep} />
        <View style={styles.dateField}>
          <Text style={styles.dateLabel}>To</Text>
          <TextInput
            style={styles.dateInput}
            value={filterTo}
            onChangeText={setFilterTo}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
        {(filterFrom || filterTo) && (
          <TouchableOpacity style={styles.clearDateBtn} onPress={() => { setFilterFrom(''); setFilterTo(''); }}>
            <Text style={styles.clearDateText}>✕</Text>
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
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🚛</Text>
              <Text style={styles.emptyText}>No freight records yet</Text>
              <Text style={styles.emptySubText}>Record inam, kiraya, parchi & salary payments</Text>
            </View>
          }
          renderItem={({ item }) => {
            const ft = FREIGHT_MAP[item.freight_type as FreightKey] ?? FREIGHT_MAP['SALARY'];
            const recipientLine = item.driver_name
              ? `${item.driver_name}${item.driver_phone ? ' · ' + item.driver_phone : ''}`
              : null;
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.typeBadge, { backgroundColor: ft.bg, borderColor: ft.color + '40' }]}>
                    <Text style={styles.typeBadgeIcon}>{ft.icon}</Text>
                    <Text style={[styles.typeBadgeText, { color: ft.color }]}>{ft.label}</Text>
                  </View>
                  <Text style={styles.cardAmount}>₹{parseFloat(item.amount).toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.cardBottom}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardDate}>{fmtDate(item.salary_date)}</Text>
                    {recipientLine ? (
                      <Text style={styles.cardRecipient} numberOfLines={1}>🧑‍✈️ {recipientLine}</Text>
                    ) : null}
                    {item.notes ? <Text style={styles.cardNotes} numberOfLines={1}>{item.notes}</Text> : null}
                  </View>
                  {perms.can_delete && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id, item.freight_type)}>
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ── Add Modal ─────────────────────────────────────────────────────── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => { setShowModal(false); resetForm(); }}>
        <View style={styles.overlay}>
          <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Record Freight Payment</Text>

            {/* Freight type selector */}
            <Text style={styles.label}>Type *</Text>
            <View style={styles.typeGrid}>
              {FREIGHT_TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeCard, freightType === t.key && { borderColor: t.color, backgroundColor: t.bg }]}
                  onPress={() => handleFreightTypeChange(t.key)}
                >
                  <Text style={styles.typeCardIcon}>{t.icon}</Text>
                  <Text style={[styles.typeCardLabel, freightType === t.key && { color: t.color, fontWeight: typography.weight.bold }]}>{t.label}</Text>
                  <Text style={styles.typeCardRecipient}>{t.recipient === 'driver' ? 'Truck Driver' : 'Employee'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Recipient section — conditionally shows Employee or Truck ── */}
            {isDriverType(freightType) ? (
              <>
                {/* Truck / Driver picker */}
                <Text style={styles.label}>Truck / Driver *</Text>
                {selectedTruckId ? (
                  <View style={styles.selectedRow}>
                    <Text style={styles.selectedName}>{selectedTruckLabel}</Text>
                    <TouchableOpacity onPress={() => { setSelectedTruckId(''); setSelectedTruckLabel(''); }}>
                      <Text style={styles.clearBtn}>✕ Change</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTruckPicker(!showTruckPicker)}>
                      <Text style={styles.pickerPlaceholder}>Select truck / driver...</Text>
                      <Text style={styles.arrow}>{showTruckPicker ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {showTruckPicker && (
                      <View style={styles.dropdown}>
                        {trucks.length === 0 ? (
                          <View style={styles.dropdownItem}>
                            <Text style={styles.dropdownRole}>No trucks found</Text>
                          </View>
                        ) : trucks.map(truck => (
                          <TouchableOpacity key={truck.id} style={styles.dropdownItem} onPress={() => {
                            setSelectedTruckId(truck.id);
                            setSelectedTruckLabel(`${truck.truck_number} — ${truck.driver_name}`);
                            setShowTruckPicker(false);
                          }}>
                            <Text style={styles.dropdownName}>{truck.truck_number}</Text>
                            <Text style={styles.dropdownRole}>🧑‍✈️ {truck.driver_name}{truck.driver_phone ? ` · ${truck.driver_phone}` : ''}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                {/* Employee picker */}
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
                      <Text style={styles.arrow}>{showUserPicker ? '▲' : '▼'}</Text>
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
                            <Text style={styles.dropdownRole}>{u.role.replace('_', ' ')}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </>
            )}

            {/* Amount */}
            <Text style={styles.label}>Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholder="e.g. 5000"
              placeholderTextColor={colors.textTertiary}
            />

            {/* Date */}
            <Text style={styles.label}>Date *</Text>
            <TextInput
              style={styles.input}
              value={salaryDate}
              onChangeText={setSalaryDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
            />

            {/* Notes */}
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Monthly salary Oct"
              placeholderTextColor={colors.textTertiary}
            />

            {/* Payment Mode */}
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
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowModal(false); resetForm(); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, (!isFormValid() || createMutation.isPending) && styles.submitBtnDisabled]}
                onPress={() => createMutation.mutate()}
                disabled={!isFormValid() || createMutation.isPending}
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
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    backgroundColor: colors.surfaceRaised, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  subtitle: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.md },
  addBtnText: { color: colors.textInverse, fontWeight: typography.weight.semibold, fontSize: typography.size.sm },
  // ── Chip filter
  chipScroll: { flexGrow: 0, backgroundColor: colors.surfaceRaised, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  chipRow: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[2], flexDirection: 'row' },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: typography.size.xs, color: colors.textSecondary, fontWeight: typography.weight.medium },
  filterChipTextActive: { color: colors.textInverse },
  // ── Date range
  dateRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    backgroundColor: colors.surfaceRaised, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: spacing[3],
  },
  dateField: { flex: 1 },
  dateLabel: { fontSize: typography.size.xs, color: colors.textMuted, marginBottom: 2 },
  dateInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: typography.size.sm, color: colors.textPrimary, backgroundColor: colors.surfaceMuted },
  dateSep: { width: 1, height: 24, backgroundColor: colors.border },
  clearDateBtn: { paddingHorizontal: spacing[2] },
  clearDateText: { color: colors.textMuted, fontSize: typography.size.base },
  // ── List
  list: { padding: spacing[4], gap: spacing[3] },
  flex1: { flex: 1 },
  card: {
    backgroundColor: colors.surfaceRaised, borderRadius: radius.xl,
    padding: spacing[4], borderWidth: 0.5, borderColor: colors.border, ...shadow.sm,
    gap: spacing[3],
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, borderWidth: 0.5, gap: spacing[1] },
  typeBadgeIcon: { fontSize: 12 },
  typeBadgeText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  cardAmount: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.textPrimary },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardDate: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium },
  cardRecipient: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  cardNotes: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  deleteBtn: { backgroundColor: colors.error + '18', borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 2 },
  deleteBtnText: { fontSize: typography.size.xs, color: colors.error, fontWeight: typography.weight.bold },
  // ── Empty state
  emptyState: { paddingTop: 80, alignItems: 'center', gap: spacing[2] },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: typography.size.base, color: colors.textSecondary, fontWeight: typography.weight.medium },
  emptySubText: { fontSize: typography.size.sm, color: colors.textMuted, textAlign: 'center' },
  // ── Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surfaceRaised, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'], maxHeight: '92%' },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: spacing[3] },
  modalContent: { padding: spacing[6], gap: spacing[4], paddingBottom: spacing[10] },
  modalTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  label: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.textSecondary, marginBottom: -spacing[2] },
  // ── Type grid
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  typeCard: { width: '47%', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing[3], paddingHorizontal: spacing[3], alignItems: 'center', gap: spacing[1] },
  typeCardIcon: { fontSize: 22 },
  typeCardLabel: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium },
  typeCardRecipient: { fontSize: typography.size.xs, color: colors.textMuted },
  // ── Form inputs
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
  modalActions: { flexDirection: 'row', gap: spacing[3] },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing[4], alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontWeight: typography.weight.medium },
  submitBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing[4], alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: colors.textInverse, fontWeight: typography.weight.semibold },
});

