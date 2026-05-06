import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, Switch, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppDispatch, RootState } from '../../store';
import { logoutSuperAdmin } from '../../store/slices/authSlice';
import { superAdminApi } from '../../api/endpoints';
import { spacing, typography, radius } from '../../theme';

type Firm = {
  id: string; name: string; apmc_name?: string;
  contact_phone?: string; address?: string;
  is_active: boolean; user_count: number; created_at: string;
};
type Module = { id: string; label: string; description: string; sort_order: number };

type ActiveModal = 'none' | 'modules' | 'create' | 'edit';

const EMPTY_FORM = { name: '', apmc_name: '', contact_phone: '', address: '', head_name: '', head_phone: '' };

export function SADashboardScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const qc = useQueryClient();
  const saToken = useSelector((s: RootState) => s.auth.saToken)!;

  const [activeModal, setActiveModal] = useState<ActiveModal>('none');
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null);
  const [pendingModules, setPendingModules] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [loadingModules, setLoadingModules] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const setField = (k: keyof typeof EMPTY_FORM) => (v: string) => setForm(p => ({ ...p, [k]: v }));

  const { data: firms = [], isLoading: firmsLoading, refetch: refetchFirms } = useQuery({
    queryKey: ['sa', 'firms'],
    queryFn: () => superAdminApi.listFirms(saToken).then(r => r.data as Firm[]),
  });

  const { data: allModules = [] } = useQuery({
    queryKey: ['sa', 'modules'],
    queryFn: () => superAdminApi.getAllModules(saToken).then(r => r.data as Module[]),
  });

  const openModules = async (firm: Firm) => {
    setSelectedFirm(firm);
    setIsDirty(false);
    setLoadingModules(true);
    setActiveModal('modules');
    try {
      const res = await superAdminApi.getFirmModules(firm.id, saToken);
      const data = res.data as { module_ids: string[] };
      setPendingModules(new Set<string>(data.module_ids ?? []));
    } catch { setPendingModules(new Set()); }
    finally { setLoadingModules(false); }
  };

  const openEdit = (firm: Firm) => {
    setSelectedFirm(firm);
    setForm({ name: firm.name, apmc_name: firm.apmc_name ?? '', contact_phone: firm.contact_phone ?? '', address: firm.address ?? '', head_name: '', head_phone: '' });
    setActiveModal('edit');
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setActiveModal('create');
  };

  const closeModal = () => { setActiveModal('none'); setSelectedFirm(null); };

  const saveModulesMutation = useMutation({
    mutationFn: () => superAdminApi.setFirmModules(selectedFirm!.id, Array.from(pendingModules), saToken),
    onSuccess: () => { setIsDirty(false); closeModal(); qc.invalidateQueries({ queryKey: ['sa', 'firms'] }); Alert.alert('Saved', 'Module access updated'); },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed'),
  });

  const createMutation = useMutation({
    mutationFn: () => superAdminApi.createFirm({ name: form.name, apmc_name: form.apmc_name || undefined, contact_phone: form.contact_phone || undefined, address: form.address || undefined, head_name: form.head_name || undefined, head_phone: form.head_phone || undefined }, saToken),
    onSuccess: (res: any) => {
      const d = res.data;
      closeModal();
      qc.invalidateQueries({ queryKey: ['sa', 'firms'] });
      const headMsg = d.head_user ? `\nFirm Head: ${d.head_user.name} (${d.head_user.phone})` : '';
      Alert.alert('Firm Created', `${d.firm.name} created with all modules enabled.${headMsg}`);
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to create firm'),
  });

  const updateMutation = useMutation({
    mutationFn: () => superAdminApi.updateFirm(selectedFirm!.id, { name: form.name, apmc_name: form.apmc_name || undefined, contact_phone: form.contact_phone || undefined, address: form.address || undefined }, saToken),
    onSuccess: () => { closeModal(); qc.invalidateQueries({ queryKey: ['sa', 'firms'] }); Alert.alert('Updated', 'Firm details updated'); },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to update'),
  });

  const confirmDelete = (firm: Firm) => {
    Alert.alert('Deactivate Firm', `Are you sure you want to deactivate "${firm.name}"?\n\nAll users of this firm will lose access.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: () => deleteMutation.mutate(firm.id) },
    ]);
  };

  const deleteMutation = useMutation({
    mutationFn: (firmId: string) => superAdminApi.deleteFirm(firmId, saToken),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa', 'firms'] }); Alert.alert('Done', 'Firm deactivated'); },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed'),
  });

  const activeFirms = firms.filter(f => f.is_active);
  const inactiveFirms = firms.filter(f => !f.is_active);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Super Admin Panel</Text>
          <Text style={styles.headerSub}>Smart Mandi Platform Management</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => Alert.alert('Logout', 'Sign out?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: () => dispatch(logoutSuperAdmin()) }])}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}><Text style={styles.statNum}>{activeFirms.length}</Text><Text style={styles.statLabel}>Active Firms</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}><Text style={styles.statNum}>{firms.reduce((s, f) => s + f.user_count, 0)}</Text><Text style={styles.statLabel}>Total Users</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}><Text style={styles.statNum}>{allModules.length}</Text><Text style={styles.statLabel}>Modules</Text></View>
      </View>

      {/* Add Firm button */}
      <View style={styles.topRow}>
        <Text style={styles.sectionTitle}>Registered Firms</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addBtnText}>+ New Firm</Text>
        </TouchableOpacity>
      </View>

      {firmsLoading ? (
        <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {activeFirms.map(firm => <FirmCard key={firm.id} firm={firm} onModules={() => openModules(firm)} onEdit={() => openEdit(firm)} onDelete={() => confirmDelete(firm)} />)}
          {inactiveFirms.length > 0 && (
            <>
              <Text style={styles.inactiveLabel}>Deactivated Firms</Text>
              {inactiveFirms.map(firm => <FirmCard key={firm.id} firm={firm} onModules={() => openModules(firm)} onEdit={() => openEdit(firm)} onDelete={() => confirmDelete(firm)} inactive />)}
            </>
          )}
          {firms.length === 0 && <View style={styles.emptyState}><Text style={styles.emptyText}>No firms yet. Tap "+ New Firm" to get started.</Text></View>}
        </ScrollView>
      )}

      {/* ── Module Modal ── */}
      <Modal visible={activeModal === 'modules'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Module Access</Text>
              <Text style={styles.modalSub}>{selectedFirm?.name} · {pendingModules.size} of {allModules.length} enabled</Text>
            </View>
            <TouchableOpacity onPress={closeModal} style={styles.closeBtn}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
          </View>
          <Text style={styles.modalHint}>Toggle modules this firm can access.</Text>
          {loadingModules ? <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 40 }} /> : (
            <ScrollView contentContainerStyle={styles.moduleList}>
              {allModules.map(mod => (
                <View key={mod.id} style={[styles.moduleRow, pendingModules.has(mod.id) && styles.moduleRowActive]}>
                  <View style={styles.moduleInfo}><Text style={styles.moduleName}>{mod.label}</Text><Text style={styles.moduleDesc}>{mod.description}</Text></View>
                  <Switch value={pendingModules.has(mod.id)} onValueChange={() => { setPendingModules(prev => { const n = new Set(prev); n.has(mod.id) ? n.delete(mod.id) : n.add(mod.id); return n; }); setIsDirty(true); }} trackColor={{ false: '#e2e8f0', true: '#7c3aed' }} thumbColor="#fff" />
                </View>
              ))}
            </ScrollView>
          )}
          {isDirty && (
            <View style={styles.saveBar}>
              <TouchableOpacity style={styles.saveBtn} onPress={() => saveModulesMutation.mutate()} disabled={saveModulesMutation.isPending}>
                {saveModulesMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Module Access</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* ── Create / Edit Firm Modal ── */}
      <Modal visible={activeModal === 'create' || activeModal === 'edit'} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{activeModal === 'create' ? 'New Firm' : 'Edit Firm'}</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeBtn}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.formScroll}>
              <FormField label="Firm Name *" value={form.name} onChangeText={setField('name')} placeholder="e.g. Dev Mandi Pvt Ltd" />
              <FormField label="APMC Name" value={form.apmc_name} onChangeText={setField('apmc_name')} placeholder="e.g. Kota APMC" />
              <FormField label="Contact Phone" value={form.contact_phone} onChangeText={setField('contact_phone')} placeholder="e.g. 9800000000" keyboardType="phone-pad" />
              <FormField label="Address" value={form.address} onChangeText={setField('address')} placeholder="Full address" multiline />
              {activeModal === 'create' && (
                <>
                  <Text style={styles.sectionDivider}>Initial Firm Head (Optional)</Text>
                  <FormField label="Head Name" value={form.head_name} onChangeText={setField('head_name')} placeholder="e.g. Ramesh Kumar" />
                  <FormField label="Head Phone" value={form.head_phone} onChangeText={setField('head_phone')} placeholder="10-digit mobile" keyboardType="phone-pad" />
                  <Text style={styles.formHint}>The firm head will be able to log in immediately using this phone number with any OTP (in dev mode).</Text>
                </>
              )}
              <TouchableOpacity
                style={[styles.submitBtn, !(createMutation.isPending || updateMutation.isPending) && { opacity: 1 }]}
                onPress={() => activeModal === 'create' ? createMutation.mutate() : updateMutation.mutate()}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{activeModal === 'create' ? 'Create Firm' : 'Save Changes'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FirmCard({ firm, onModules, onEdit, onDelete, inactive }: { firm: Firm; onModules: () => void; onEdit: () => void; onDelete: () => void; inactive?: boolean }) {
  return (
    <View style={[styles.firmCard, inactive && styles.firmCardInactive]}>
      <View style={styles.firmTop}>
        <View style={[styles.firmAvatar, inactive && { backgroundColor: '#94a3b8' }]}>
          <Text style={styles.firmAvatarText}>{firm.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.firmInfo}>
          <Text style={[styles.firmName, inactive && { color: '#94a3b8' }]}>{firm.name}</Text>
          {firm.apmc_name ? <Text style={styles.firmMeta}>📍 {firm.apmc_name}</Text> : null}
          {firm.contact_phone ? <Text style={styles.firmMeta}>📞 {firm.contact_phone}</Text> : null}
          <Text style={styles.firmUsers}>{firm.user_count} active users</Text>
        </View>
        {inactive && <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>Inactive</Text></View>}
      </View>
      <View style={styles.firmActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onModules}><Text style={styles.actionBtnText}>🔧 Modules</Text></TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onEdit}><Text style={styles.actionBtnText}>✏️ Edit</Text></TouchableOpacity>
        {!inactive && <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={onDelete}><Text style={[styles.actionBtnText, { color: '#ef4444' }]}>🗑️ Deactivate</Text></TouchableOpacity>}
      </View>
    </View>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType, multiline }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={[styles.fieldInput, multiline && { height: 80, textAlignVertical: 'top' }]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#94a3b8" keyboardType={keyboardType ?? 'default'} multiline={multiline} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing[5], paddingTop: 56, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: '#f8fafc' },
  headerSub: { fontSize: typography.size.sm, color: '#94a3b8', marginTop: 2 },
  logoutBtn: { borderWidth: 1, borderColor: '#ef4444', borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  logoutText: { color: '#ef4444', fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  statsBar: { flexDirection: 'row', backgroundColor: '#1e293b', margin: spacing[4], borderRadius: radius.lg, borderWidth: 1, borderColor: '#334155' },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: spacing[4] },
  statNum: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: '#7c3aed' },
  statLabel: { fontSize: typography.size.xs, color: '#94a3b8', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#334155' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], marginBottom: spacing[2] },
  sectionTitle: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#f8fafc' },
  addBtn: { backgroundColor: '#7c3aed', borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  addBtnText: { color: '#fff', fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  list: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[10] },
  inactiveLabel: { color: '#64748b', fontSize: typography.size.xs, fontWeight: typography.weight.medium, marginTop: spacing[4], marginBottom: spacing[2], paddingHorizontal: spacing[2] },
  emptyState: { padding: spacing[8], alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: typography.size.sm, textAlign: 'center' },
  firmCard: { backgroundColor: '#1e293b', borderRadius: radius.lg, padding: spacing[4], borderWidth: 1, borderColor: '#334155' },
  firmCardInactive: { borderColor: '#1e293b', opacity: 0.7 },
  firmTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing[3] },
  firmAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center', marginRight: spacing[3] },
  firmAvatarText: { color: '#fff', fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  firmInfo: { flex: 1 },
  firmName: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: '#f8fafc' },
  firmMeta: { fontSize: typography.size.xs, color: '#64748b', marginTop: 2 },
  firmUsers: { fontSize: typography.size.xs, color: '#94a3b8', marginTop: 2 },
  inactiveBadge: { backgroundColor: '#334155', borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 2 },
  inactiveBadgeText: { color: '#94a3b8', fontSize: 10 },
  firmActions: { flexDirection: 'row', gap: spacing[2], borderTopWidth: 1, borderTopColor: '#334155', paddingTop: spacing[3] },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing[2], borderRadius: radius.sm, backgroundColor: '#0f172a' },
  actionBtnDanger: { backgroundColor: '#1a0a0a' },
  actionBtnText: { fontSize: typography.size.xs, color: '#94a3b8', fontWeight: typography.weight.medium },
  modal: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing[5], backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  modalTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: '#f8fafc' },
  modalSub: { fontSize: typography.size.sm, color: '#94a3b8', marginTop: 2 },
  closeBtn: { padding: spacing[2] },
  closeText: { fontSize: 20, color: '#94a3b8' },
  modalHint: { fontSize: typography.size.sm, color: '#64748b', padding: spacing[4] },
  moduleList: { padding: spacing[4], gap: spacing[2], paddingBottom: spacing[10] },
  moduleRow: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing[4], flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  moduleRowActive: { borderColor: '#7c3aed', backgroundColor: '#faf5ff' },
  moduleInfo: { flex: 1, marginRight: spacing[3] },
  moduleName: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: '#1e293b' },
  moduleDesc: { fontSize: typography.size.xs, color: '#64748b', marginTop: 2 },
  saveBar: { padding: spacing[4], backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  saveBtn: { backgroundColor: '#7c3aed', borderRadius: radius.md, paddingVertical: spacing[4], alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: typography.size.base, fontWeight: typography.weight.bold },
  formScroll: { padding: spacing[5], paddingBottom: spacing[10] },
  field: { marginBottom: spacing[4] },
  fieldLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: '#475569', marginBottom: spacing[1] },
  fieldInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontSize: typography.size.base, color: '#1e293b' },
  sectionDivider: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: '#7c3aed', marginTop: spacing[4], marginBottom: spacing[2], paddingBottom: spacing[2], borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  formHint: { fontSize: typography.size.xs, color: '#94a3b8', marginBottom: spacing[4], fontStyle: 'italic' },
  submitBtn: { backgroundColor: '#7c3aed', borderRadius: radius.md, paddingVertical: spacing[4], alignItems: 'center', marginTop: spacing[4] },
  submitBtnText: { color: '#fff', fontSize: typography.size.base, fontWeight: typography.weight.bold },
});
