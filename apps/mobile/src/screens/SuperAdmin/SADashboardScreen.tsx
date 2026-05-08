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

type ActiveModal = 'none' | 'modules' | 'create' | 'edit' | 'config' | 'permissions' | 'grades';

const EMPTY_FORM = { name: '', apmc_name: '', contact_phone: '', address: '', head_name: '', head_phone: '' };

const CONFIGURABLE_ROLES = ['AUTHORIZER', 'OPERATOR', 'VIEWER'] as const;
type ConfigurableRole = typeof CONFIGURABLE_ROLES[number];

const FEE_TYPES = ['PERCENTAGE', 'FIXED_PER_KG', 'FIXED_PER_TRANSACTION'] as const;
const ROUNDING_OPTS = ['ROUND_HALF_UP', 'FLOOR', 'CEIL', 'NONE'] as const;

const EMPTY_CONFIG = {
  fee_type: 'PERCENTAGE' as string,
  fee_value: '',
  min_fee: '',
  max_fee: '',
  commission_type: 'PERCENTAGE' as string,
  commission_value: '',
  rounding_strategy: 'ROUND_HALF_UP' as string,
  min_commission: '',
  max_commission: '',
  baardana_provider: 'FIRM' as 'FIRM' | 'CUSTOMER',
  default_bags: '1',
  baardana_cost_per_unit: '',
  rate_mode: 'PER_KG' as 'PER_KG' | 'PER_NAG',
};

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

  // Config modal state
  const [configForm, setConfigForm] = useState(EMPTY_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const setConfigField = (k: keyof typeof EMPTY_CONFIG) => (v: string) => setConfigForm(p => ({ ...p, [k]: v }));

  // Grades modal state
  type GradeItem = { id: string; grade_code: string; grade_label: string; sort_order: number; is_active: boolean };
  const [gradeList, setGradeList] = useState<GradeItem[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [gradeForm, setGradeForm] = useState({ grade_code: '', grade_label: '' });
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null);

  // Permissions modal state
  const [selectedRole, setSelectedRole] = useState<ConfigurableRole>('AUTHORIZER');
  const [pendingPerms, setPendingPerms] = useState<Record<string, { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }>>({});
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [permsDirty, setPermsDirty] = useState(false);

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

  const openConfig = async (firm: Firm) => {
    setSelectedFirm(firm);
    setLoadingConfig(true);
    setActiveModal('config');
    try {
      const [apmcRes, commRes, baardanaRes] = await Promise.all([
        superAdminApi.getApmcFeeConfig(firm.id, saToken),
        superAdminApi.getCommissionConfig(firm.id, saToken),
        superAdminApi.getBaardanaConfig(firm.id, saToken),
      ]);
      const apmc = apmcRes.data as any;
      const comm = commRes.data as any;
      const baard = baardanaRes.data as any;
      setConfigForm({
        fee_type: apmc.fee_type ?? 'PERCENTAGE',
        fee_value: apmc.fee_value != null ? String(apmc.fee_value) : '',
        min_fee: apmc.min_fee != null ? String(apmc.min_fee) : '',
        max_fee: apmc.max_fee != null ? String(apmc.max_fee) : '',
        commission_type: comm.commission_type ?? 'PERCENTAGE',
        commission_value: comm.commission_value != null ? String(comm.commission_value) : '',
        rounding_strategy: comm.rounding_strategy ?? 'ROUND_HALF_UP',
        min_commission: comm.min_commission != null ? String(comm.min_commission) : '',
        max_commission: comm.max_commission != null ? String(comm.max_commission) : '',
        baardana_provider: baard.baardana_provider ?? 'FIRM',
        default_bags: baard.default_bags != null ? String(baard.default_bags) : '1',
        baardana_cost_per_unit: baard.cost_per_unit != null ? String(baard.cost_per_unit) : '',
        rate_mode: baard.rate_mode ?? 'PER_KG',
      });
    } catch { setConfigForm(EMPTY_CONFIG); }
    finally { setLoadingConfig(false); }
  };

  const closeModal = () => { setActiveModal('none'); setSelectedFirm(null); };

  const loadPermsForRole = async (firmId: string, role: string, existingPerms: any[]) => {
    setLoadingPerms(true);
    try {
      // Build a map of existing perms for this role
      const map: Record<string, any> = {};
      for (const p of existingPerms) {
        if (p.role === role) {
          map[p.module_id] = { can_create: p.can_create, can_read: p.can_read, can_update: p.can_update, can_delete: p.can_delete };
        }
      }
      // Default all modules not in map to read-only
      for (const mod of allModules) {
        if (!map[mod.id]) {
          map[mod.id] = { can_create: false, can_read: true, can_update: false, can_delete: false };
        }
      }
      setPendingPerms(map);
    } finally {
      setLoadingPerms(false);
    }
  };

  const openPermissions = async (firm: Firm) => {
    setSelectedFirm(firm);
    setSelectedRole('AUTHORIZER');
    setPermsDirty(false);
    setActiveModal('permissions');
    setLoadingPerms(true);
    try {
      const res = await superAdminApi.getRolePermissions(firm.id, saToken);
      const allPerms = res.data as any[];
      await loadPermsForRole(firm.id, 'AUTHORIZER', allPerms);
      // Cache all perms for role switching
      (openPermissions as any)._allPerms = allPerms;
    } catch {
      setPendingPerms({});
      setLoadingPerms(false);
    }
  };

  const openGrades = async (firm: Firm) => {
    setSelectedFirm(firm);
    setGradeForm({ grade_code: '', grade_label: '' });
    setEditingGradeId(null);
    setGradesLoading(true);
    setActiveModal('grades');
    try {
      const res = await superAdminApi.getGrades(firm.id, saToken);
      setGradeList(res.data as any[]);
    } catch { setGradeList([]); }
    finally { setGradesLoading(false); }
  };

  const handleRoleSwitch = async (role: ConfigurableRole) => {
    setSelectedRole(role);
    setPermsDirty(false);
    const allPerms = (openPermissions as any)._allPerms ?? [];
    await loadPermsForRole(selectedFirm!.id, role, allPerms);
  };

  const togglePerm = (moduleId: string, field: 'can_create' | 'can_read' | 'can_update' | 'can_delete') => {
    setPendingPerms(prev => ({
      ...prev,
      [moduleId]: { ...prev[moduleId], [field]: !prev[moduleId]?.[field] },
    }));
    setPermsDirty(true);
  };

  const savePermsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFirm) return;
      const permissions = Object.entries(pendingPerms).map(([module_id, p]) => ({ module_id, ...p }));
      await superAdminApi.setRolePermissions(selectedFirm.id, selectedRole, permissions, saToken);
      // Refresh cached perms
      const res = await superAdminApi.getRolePermissions(selectedFirm.id, saToken);
      (openPermissions as any)._allPerms = res.data;
    },
    onSuccess: () => { setPermsDirty(false); Alert.alert('Saved ✅', `${selectedRole} permissions updated for ${selectedFirm?.name}`); },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to save permissions'),
  });

  const refreshGrades = async (firmId: string) => {
    const res = await superAdminApi.getGrades(firmId, saToken);
    setGradeList(res.data as any[]);
  };

  const addGradeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFirm) return;
      if (!gradeForm.grade_code.trim()) throw new Error('Grade code is required');
      if (!gradeForm.grade_label.trim()) throw new Error('Grade label is required');
      await superAdminApi.createGrade(selectedFirm.id, gradeForm, saToken);
      await refreshGrades(selectedFirm.id);
    },
    onSuccess: () => { setGradeForm({ grade_code: '', grade_label: '' }); },
    onError: (e: any) => Alert.alert('Error', e?.message ?? e?.response?.data?.message ?? 'Failed to add grade'),
  });

  const updateGradeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFirm || !editingGradeId) return;
      if (!gradeForm.grade_code.trim()) throw new Error('Grade code is required');
      if (!gradeForm.grade_label.trim()) throw new Error('Grade label is required');
      await superAdminApi.updateGrade(selectedFirm.id, editingGradeId, gradeForm, saToken);
      await refreshGrades(selectedFirm.id);
    },
    onSuccess: () => { setGradeForm({ grade_code: '', grade_label: '' }); setEditingGradeId(null); },
    onError: (e: any) => Alert.alert('Error', e?.message ?? e?.response?.data?.message ?? 'Failed to update grade'),
  });

  const toggleGradeMutation = useMutation({
    mutationFn: async (gradeId: string) => {
      if (!selectedFirm) return;
      await superAdminApi.toggleGrade(selectedFirm.id, gradeId, saToken);
      await refreshGrades(selectedFirm.id);
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to toggle grade'),
  });

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFirm) return;
      if (!configForm.fee_value) throw new Error('APMC fee value is required');
      if (!configForm.commission_value) throw new Error('Commission value is required');
      await Promise.all([
        superAdminApi.setApmcFeeConfig(selectedFirm.id, {
          fee_type: configForm.fee_type,
          fee_value: parseFloat(configForm.fee_value),
          min_fee: configForm.min_fee ? parseFloat(configForm.min_fee) : null,
          max_fee: configForm.max_fee ? parseFloat(configForm.max_fee) : null,
        }, saToken),
        superAdminApi.setCommissionConfig(selectedFirm.id, {
          commission_type: configForm.commission_type,
          commission_value: parseFloat(configForm.commission_value),
          rounding_strategy: configForm.rounding_strategy,
          min_commission: configForm.min_commission ? parseFloat(configForm.min_commission) : null,
          max_commission: configForm.max_commission ? parseFloat(configForm.max_commission) : null,
        }, saToken),
        superAdminApi.setBaardanaConfig(selectedFirm.id, {
          baardana_provider: configForm.baardana_provider,
          default_bags: parseInt(configForm.default_bags, 10) || 1,
          cost_per_unit: configForm.baardana_cost_per_unit ? parseFloat(configForm.baardana_cost_per_unit) : 0,
          rate_mode: configForm.rate_mode,
        }, saToken),
      ]);
    },
    onSuccess: () => { closeModal(); Alert.alert('Saved', 'Rates, fees & baardana config updated.'); },
    onError: (e: any) => Alert.alert('Error', e?.message ?? e?.response?.data?.message ?? 'Failed to save config'),
  });

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
      {/* ── Premium Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoMark}><Text style={styles.logoText}>SA</Text></View>
          <View>
            <Text style={styles.headerBrand}>Smart Mandi</Text>
            <Text style={styles.headerSub}>Platform Command Center</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => Alert.alert('Sign Out', 'Sign out of Super Admin?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: () => dispatch(logoutSuperAdmin()) },
          ])}
        >
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* ── Stats Row ── */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderTopColor: '#7c3aed' }]}>
          <Text style={styles.statNum}>{activeFirms.length}</Text>
          <Text style={styles.statLabel}>Active Firms</Text>
        </View>
        <View style={[styles.statCard, { borderTopColor: '#10b981' }]}>
          <Text style={[styles.statNum, { color: '#10b981' }]}>{firms.reduce((s, f) => s + f.user_count, 0)}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={[styles.statCard, { borderTopColor: '#3b82f6' }]}>
          <Text style={[styles.statNum, { color: '#3b82f6' }]}>{allModules.length}</Text>
          <Text style={styles.statLabel}>Modules</Text>
        </View>
      </View>

      {/* ── Firms Section Header ── */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Registered Firms</Text>
          <Text style={styles.sectionSub}>{firms.length} total · {inactiveFirms.length} inactive</Text>
        </View>
        <TouchableOpacity style={styles.newFirmBtn} onPress={openCreate}>
          <Text style={styles.newFirmBtnText}>＋  New Firm</Text>
        </TouchableOpacity>
      </View>

      {firmsLoading ? (
        <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {activeFirms.map(firm => (
            <FirmCard key={firm.id} firm={firm}
              onModules={() => openModules(firm)} onConfig={() => openConfig(firm)}
              onEdit={() => openEdit(firm)} onDelete={() => confirmDelete(firm)}
              onPermissions={() => openPermissions(firm)} onGrades={() => openGrades(firm)}
            />
          ))}
          {inactiveFirms.length > 0 && (
            <>
              <Text style={styles.inactiveLabel}>— Deactivated Firms —</Text>
              {inactiveFirms.map(firm => (
                <FirmCard key={firm.id} firm={firm} inactive
                  onModules={() => openModules(firm)} onConfig={() => openConfig(firm)}
                  onEdit={() => openEdit(firm)} onDelete={() => confirmDelete(firm)}
                  onPermissions={() => openPermissions(firm)} onGrades={() => openGrades(firm)}
                />
              ))}
            </>
          )}
          {firms.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🏢</Text>
              <Text style={styles.emptyTitle}>No Firms Yet</Text>
              <Text style={styles.emptyText}>Create your first firm to get started.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Module Access Modal ── */}
      <Modal visible={activeModal === 'modules'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.flex1}>
              <Text style={styles.sheetTitle}>Module Access</Text>
              <Text style={styles.sheetSub}>{selectedFirm?.name} · {pendingModules.size}/{allModules.length} enabled</Text>
            </View>
            <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeModal}>
              <Text style={styles.sheetCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sheetHint}>Toggle which modules this firm can access from their app.</Text>
          {loadingModules ? <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 40 }} /> : (
            <ScrollView contentContainerStyle={styles.moduleList}>
              {allModules.map(mod => {
                const active = pendingModules.has(mod.id);
                return (
                  <TouchableOpacity key={mod.id}
                    style={[styles.moduleRow, active && styles.moduleRowActive]}
                    onPress={() => { setPendingModules(prev => { const n = new Set(prev); n.has(mod.id) ? n.delete(mod.id) : n.add(mod.id); return n; }); setIsDirty(true); }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.moduleIcon, active && styles.moduleIconActive]}>
                      <Text style={styles.moduleIconText}>{mod.label.charAt(0)}</Text>
                    </View>
                    <View style={styles.moduleInfo}>
                      <Text style={[styles.moduleName, active && { color: '#7c3aed' }]}>{mod.label}</Text>
                      <Text style={styles.moduleDesc}>{mod.description}</Text>
                    </View>
                    <Switch value={active}
                      onValueChange={() => { setPendingModules(prev => { const n = new Set(prev); n.has(mod.id) ? n.delete(mod.id) : n.add(mod.id); return n; }); setIsDirty(true); }}
                      trackColor={{ false: '#334155', true: '#7c3aed' }} thumbColor="#fff"
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          {isDirty && (
            <View style={styles.saveBar}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => saveModulesMutation.mutate()} disabled={saveModulesMutation.isPending}>
                {saveModulesMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save Module Access</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* ── Rates & Fees Modal ── */}
      <Modal visible={activeModal === 'config'} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {activeModal === 'config' && <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.flex1}>
                <Text style={styles.sheetTitle}>Rates & Fees</Text>
                <Text style={styles.sheetSub}>{selectedFirm?.name}</Text>
              </View>
              <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeModal}><Text style={styles.sheetCloseText}>✕</Text></TouchableOpacity>
            </View>
            {loadingConfig ? <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 40 }} /> : (
              <ScrollView contentContainerStyle={styles.formScroll}>
                {/* ── APMC Fee ── */}
                <View style={styles.configSection}>
                  <View style={styles.configSectionHeader}>
                    <Text style={styles.configSectionIcon}>{'🏛️'}</Text>
                    <View>
                      <Text style={styles.configSectionTitle}>{'APMC Fee'}</Text>
                      <Text style={styles.configHint}>{'Applied to every authorized KC'}</Text>
                    </View>
                  </View>
                  <Text style={styles.fieldLabel}>{'Fee Type'}</Text>
                  <View style={styles.chipRow}>
                    {FEE_TYPES.map(t => {
                      const feeActive = configForm.fee_type === t;
                      const feeLabel = t === 'PERCENTAGE' ? '% Rate' : t === 'FIXED_PER_KG' ? '₹/kg' : '₹/txn';
                      return (
                        <TouchableOpacity key={t} style={feeActive ? [styles.chip, styles.chipActive] : styles.chip} onPress={() => setConfigField('fee_type')(t)}>
                          <Text style={feeActive ? [styles.chipText, styles.chipTextActive] : styles.chipText}>{feeLabel}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <ConfigField
                    label={configForm.fee_type === 'PERCENTAGE' ? 'Fee Rate (%)' : configForm.fee_type === 'FIXED_PER_KG' ? 'Fee per kg (₹)' : 'Fee per transaction (₹)'}
                    value={configForm.fee_value}
                    onChangeText={setConfigField('fee_value')}
                    placeholder="e.g. 0.5"
                  />
                  <View style={styles.configRow}>
                    <View style={styles.configHalf}>
                      <ConfigField label="Min Fee (₹)" value={configForm.min_fee} onChangeText={setConfigField('min_fee')} placeholder="optional" />
                    </View>
                    <View style={styles.configHalf}>
                      <ConfigField label="Max Fee (₹)" value={configForm.max_fee} onChangeText={setConfigField('max_fee')} placeholder="optional" />
                    </View>
                  </View>
                </View>

                {/* ── Commission ── */}
                <View style={[styles.configSection, { marginTop: spacing[4] }]}>
                  <View style={styles.configSectionHeader}>
                    <Text style={styles.configSectionIcon}>{'💰'}</Text>
                    <View>
                      <Text style={styles.configSectionTitle}>{'Commission'}</Text>
                      <Text style={styles.configHint}>{'Firm commission earned per KC'}</Text>
                    </View>
                  </View>
                  <Text style={styles.fieldLabel}>{'Commission Type'}</Text>
                  <View style={styles.chipRow}>
                    {FEE_TYPES.map(t => {
                      const commActive = configForm.commission_type === t;
                      const commLabel = t === 'PERCENTAGE' ? '% Rate' : t === 'FIXED_PER_KG' ? '₹/kg' : '₹/txn';
                      return (
                        <TouchableOpacity key={t} style={commActive ? [styles.chip, styles.chipActive] : styles.chip} onPress={() => setConfigField('commission_type')(t)}>
                          <Text style={commActive ? [styles.chipText, styles.chipTextActive] : styles.chipText}>{commLabel}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <ConfigField
                    label={configForm.commission_type === 'PERCENTAGE' ? 'Commission Rate (%)' : configForm.commission_type === 'FIXED_PER_KG' ? 'Commission per kg (₹)' : 'Commission per transaction (₹)'}
                    value={configForm.commission_value}
                    onChangeText={setConfigField('commission_value')}
                    placeholder="e.g. 2.0"
                  />
                  <View style={styles.configRow}>
                    <View style={styles.configHalf}>
                      <ConfigField label="Min (₹)" value={configForm.min_commission} onChangeText={setConfigField('min_commission')} placeholder="optional" />
                    </View>
                    <View style={styles.configHalf}>
                      <ConfigField label="Max (₹)" value={configForm.max_commission} onChangeText={setConfigField('max_commission')} placeholder="optional" />
                    </View>
                  </View>
                  <Text style={styles.fieldLabel}>{'Rounding Strategy'}</Text>
                  <View style={styles.chipRow}>
                    {ROUNDING_OPTS.map(r => {
                      const rndActive = configForm.rounding_strategy === r;
                      return (
                        <TouchableOpacity key={r} style={rndActive ? [styles.chip, styles.chipActive] : styles.chip} onPress={() => setConfigField('rounding_strategy')(r)}>
                          <Text style={rndActive ? [styles.chipText, styles.chipTextActive] : styles.chipText}>{r.replace(/_/g, ' ')}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* ── Baardana (Bags) ── */}
                <View style={[styles.configSection, { marginTop: spacing[4] }]}>
                  <View style={styles.configSectionHeader}>
                    <Text style={styles.configSectionIcon}>{'🛄'}</Text>
                    <View>
                      <Text style={styles.configSectionTitle}>{'Baardana (Bags)'}</Text>
                      <Text style={styles.configHint}>{'Default bag source & count per KC line item'}</Text>
                    </View>
                  </View>
                  <Text style={styles.fieldLabel}>{'Bag Provider'}</Text>
                  <View style={styles.chipRow}>
                    {(['FIRM', 'CUSTOMER'] as const).map(p => {
                      const provActive = configForm.baardana_provider === p;
                      return (
                        <TouchableOpacity key={p} style={provActive ? [styles.chip, styles.chipActive] : styles.chip} onPress={() => setConfigForm(prev => ({ ...prev, baardana_provider: p }))}>
                          <Text style={provActive ? [styles.chipText, styles.chipTextActive] : styles.chipText}>{p === 'FIRM' ? '🏪 Firm' : '👤 Customer'}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.fieldLabel}>{'Rate Mode'}</Text>
                  <View style={styles.chipRow}>
                    {(['PER_KG', 'PER_NAG'] as const).map(m => {
                      const rateActive = configForm.rate_mode === m;
                      return (
                        <TouchableOpacity key={m} style={rateActive ? [styles.chip, styles.chipActive] : styles.chip} onPress={() => setConfigForm(prev => ({ ...prev, rate_mode: m }))}>
                          <Text style={rateActive ? [styles.chipText, styles.chipTextActive] : styles.chipText}>{m === 'PER_KG' ? '⚖️ Rate per KG' : '🎒 Rate per Nag'}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.configRow}>
                    <View style={styles.configHalf}>
                      <ConfigField label="Default Bags" value={configForm.default_bags} onChangeText={v => setConfigForm(p => ({ ...p, default_bags: v }))} placeholder="e.g. 1" keyboardType="numeric" />
                    </View>
                    <View style={styles.configHalf}>
                      <ConfigField label="Cost per Bag (₹)" value={configForm.baardana_cost_per_unit} onChangeText={setConfigField('baardana_cost_per_unit')} placeholder="e.g. 5.00" keyboardType="decimal-pad" />
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={saveConfigMutation.isPending ? [styles.primaryBtn, { marginTop: spacing[4] }, { opacity: 0.6 }] : [styles.primaryBtn, { marginTop: spacing[4] }]}
                  onPress={() => saveConfigMutation.mutate()}
                  disabled={saveConfigMutation.isPending}
                >
                  {saveConfigMutation.isPending
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.primaryBtnText}>{'Save Configuration'}</Text>
                  }
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>}
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Create / Edit Firm Modal ── */}
      <Modal visible={activeModal === 'create' || activeModal === 'edit'} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {(activeModal === 'create' || activeModal === 'edit') && <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{activeModal === 'create' ? 'New Firm' : 'Edit Firm'}</Text>
              <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeModal}><Text style={styles.sheetCloseText}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.formScroll}>
              <FormField label="Firm Name *" value={form.name} onChangeText={setField('name')} placeholder="e.g. Sharma Mandi Pvt Ltd" />
              <FormField label="APMC Market" value={form.apmc_name} onChangeText={setField('apmc_name')} placeholder="e.g. Kota APMC" />
              <FormField label="Contact Phone" value={form.contact_phone} onChangeText={setField('contact_phone')} placeholder="e.g. 9800000000" keyboardType="phone-pad" />
              <FormField label="Address" value={form.address} onChangeText={setField('address')} placeholder="Full address" multiline />
              {activeModal === 'create' && (
                <>
                  <View style={styles.dividerRow}><View style={styles.dividerLine} /><Text style={styles.dividerLabel}>Initial Firm Head</Text><View style={styles.dividerLine} /></View>
                  <FormField label="Head Name" value={form.head_name} onChangeText={setField('head_name')} placeholder="e.g. Ramesh Kumar" />
                  <FormField label="Head Phone" value={form.head_phone} onChangeText={setField('head_phone')} placeholder="10-digit mobile" keyboardType="phone-pad" />
                  <Text style={styles.formHint}>ℹ️  The firm head can log in immediately using any OTP in dev mode.</Text>
                </>
              )}
              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: spacing[6] }, (createMutation.isPending || updateMutation.isPending) && { opacity: 0.6 }]}
                onPress={() => activeModal === 'create' ? createMutation.mutate() : updateMutation.mutate()}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{activeModal === 'create' ? 'Create Firm' : 'Save Changes'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>}
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Role Permissions Modal ── */}
      <Modal visible={activeModal === 'permissions'} animationType="slide" presentationStyle="pageSheet">
        {activeModal === 'permissions' && <View style={styles.sheetContainer}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.flex1}>
              <Text style={styles.sheetTitle}>Role Permissions</Text>
              <Text style={styles.sheetSub}>{selectedFirm?.name ?? ''}</Text>
            </View>
            <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeModal}><Text style={styles.sheetCloseText}>✕</Text></TouchableOpacity>
          </View>

          {/* Role Tabs */}
          <View style={styles.roleTabBar}>
            {CONFIGURABLE_ROLES.map(r => (
              <TouchableOpacity key={r} style={selectedRole === r ? [styles.roleTab, styles.roleTabActive] : styles.roleTab} onPress={() => handleRoleSwitch(r)}>
                <View style={[styles.roleTabDot, { backgroundColor: r === 'AUTHORIZER' ? '#3b82f6' : r === 'OPERATOR' ? '#f59e0b' : '#64748b' }]} />
                <Text style={[styles.roleTabText, selectedRole === r && styles.roleTabTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.permHintRow}>
            <Text style={styles.sheetHint}>FIRM_HEAD always has full access. Configure below roles.</Text>
          </View>

          {loadingPerms ? <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 40 }} /> : (
            <>
              <View style={styles.permHeaderRow}>
                <Text style={styles.permModuleHeader}>Module</Text>
                {[{ key: 'can_create', label: 'C', color: '#10b981' }, { key: 'can_read', label: 'R', color: '#3b82f6' }, { key: 'can_update', label: 'U', color: '#f59e0b' }, { key: 'can_delete', label: 'D', color: '#ef4444' }].map(h => (
                  <Text key={h.key} style={[styles.permColHeader, { color: h.color }]}>{h.label}</Text>
                ))}
              </View>
              <ScrollView contentContainerStyle={styles.permList}>
                {allModules.map((mod, idx) => {
                  const p = pendingPerms[mod.id] ?? { can_create: false, can_read: true, can_update: false, can_delete: false };
                  const FIELDS = [
                    { field: 'can_create' as const, color: '#10b981' },
                    { field: 'can_read' as const, color: '#3b82f6' },
                    { field: 'can_update' as const, color: '#f59e0b' },
                    { field: 'can_delete' as const, color: '#ef4444' },
                  ];
                  return (
                    <View key={mod.id} style={[styles.permRow, idx % 2 === 0 && styles.permRowAlt]}>
                      <Text style={styles.permModuleName} numberOfLines={1}>{mod.label}</Text>
                      {FIELDS.map(({ field, color }) => (
                        <TouchableOpacity key={field} style={[styles.permBox, p[field] && { backgroundColor: color, borderColor: color }]} onPress={() => togglePerm(mod.id, field)}>
                          <Text style={[styles.permBoxText, p[field] && styles.permBoxTextActive]}>{p[field] ? '✓' : ''}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}

          {permsDirty && (
            <View style={styles.saveBar}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => savePermsMutation.mutate()} disabled={savePermsMutation.isPending}>
                {savePermsMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{'Save ' + selectedRole + ' Permissions'}</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>}
      </Modal>

      {/* ── Grade Config Modal ── */}
      <Modal visible={activeModal === 'grades'} animationType="slide" presentationStyle="pageSheet">
        {activeModal === 'grades' && <View style={styles.sheetContainer}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.flex1}>
              <Text style={styles.sheetTitle}>{'Grade Config'}</Text>
              <Text style={styles.sheetSub}>{selectedFirm?.name ?? ''}</Text>
            </View>
            <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeModal}>
              <Text style={styles.sheetCloseText}>{'✕'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sheetHint}>{'Configure grade codes and labels for this firm\'s KC screen.'}</Text>

          {gradesLoading ? (
            <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 40 }} />
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
              {/* Grade list */}
              {gradeList.length === 0 && (
                <View style={{ alignItems: 'center', marginTop: 32 }}>
                  <Text style={[styles.sheetSub, { fontSize: 14 }]}>{'No grades yet. Add one below.'}</Text>
                </View>
              )}
              {gradeList.map((g, idx) => {
                const isEditing = editingGradeId === g.id;
                return (
                  <View key={g.id} style={[styles.permRow, idx % 2 === 0 && styles.permRowAlt, { paddingVertical: 10 }]}>
                    {isEditing ? (
                      <View style={{ flex: 1, gap: 6 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TextInput
                            style={[styles.fieldInput, { flex: 1, marginBottom: 0 }]}
                            value={gradeForm.grade_code}
                            onChangeText={v => setGradeForm(p => ({ ...p, grade_code: v.toUpperCase() }))}
                            placeholder={'Code (e.g. A)'}
                            placeholderTextColor={'#94a3b8'}
                            autoCapitalize={'characters'}
                          />
                          <TextInput
                            style={[styles.fieldInput, { flex: 2, marginBottom: 0 }]}
                            value={gradeForm.grade_label}
                            onChangeText={v => setGradeForm(p => ({ ...p, grade_label: v }))}
                            placeholder={'Label (e.g. Premium)'}
                            placeholderTextColor={'#94a3b8'}
                          />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            style={[styles.primaryBtn, { flex: 1, paddingVertical: 8 }]}
                            onPress={() => updateGradeMutation.mutate()}
                            disabled={updateGradeMutation.isPending}
                          >
                            {updateGradeMutation.isPending
                              ? <ActivityIndicator color={'#fff'} size={'small'} />
                              : <Text style={styles.primaryBtnText}>{'Save'}</Text>}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.primaryBtn, { flex: 1, paddingVertical: 8, backgroundColor: '#334155' }]}
                            onPress={() => { setEditingGradeId(null); setGradeForm({ grade_code: '', grade_label: '' }); }}
                          >
                            <Text style={styles.primaryBtnText}>{'Cancel'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                          <View style={{ backgroundColor: g.is_active ? 'rgba(124,58,237,0.15)' : '#1e293b', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                            <Text style={{ color: g.is_active ? '#a78bfa' : '#64748b', fontWeight: '700', fontSize: 13 }}>{g.grade_code}</Text>
                          </View>
                          <Text style={[styles.permModuleName, !g.is_active && { color: '#475569' }]} numberOfLines={1}>{g.grade_label}</Text>
                          {!g.is_active && <Text style={{ fontSize: 11, color: '#475569' }}>{'(off)'}</Text>}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity
                            style={[styles.permBox, { width: 44, borderColor: '#3b82f6' }]}
                            onPress={() => {
                              setEditingGradeId(g.id);
                              setGradeForm({ grade_code: g.grade_code, grade_label: g.grade_label });
                            }}
                          >
                            <Text style={{ color: '#60a5fa', fontSize: 12 }}>{'✏️'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.permBox, { width: 44, borderColor: g.is_active ? '#ef4444' : '#10b981' }]}
                            onPress={() => toggleGradeMutation.mutate(g.id)}
                            disabled={toggleGradeMutation.isPending}
                          >
                            <Text style={{ color: g.is_active ? '#f87171' : '#34d399', fontSize: 12 }}>{g.is_active ? '🚫' : '✓'}</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                );
              })}

              {/* Add grade form */}
              {editingGradeId === null && (
                <View style={{ padding: 16, marginTop: 12, backgroundColor: 'rgba(124,58,237,0.06)', borderRadius: 12, marginHorizontal: 0 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 10 }}>{'＋ Add New Grade'}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <TextInput
                      style={[styles.fieldInput, { flex: 1 }]}
                      value={gradeForm.grade_code}
                      onChangeText={v => setGradeForm(p => ({ ...p, grade_code: v.toUpperCase() }))}
                      placeholder={'Code (A, B, C…)'}
                      placeholderTextColor={'#94a3b8'}
                      autoCapitalize={'characters'}
                      maxLength={10}
                    />
                    <TextInput
                      style={[styles.fieldInput, { flex: 2 }]}
                      value={gradeForm.grade_label}
                      onChangeText={v => setGradeForm(p => ({ ...p, grade_label: v }))}
                      placeholder={'Label (e.g. Premium Quality)'}
                      placeholderTextColor={'#94a3b8'}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.primaryBtn, addGradeMutation.isPending && { opacity: 0.6 }]}
                    onPress={() => addGradeMutation.mutate()}
                    disabled={addGradeMutation.isPending}
                  >
                    {addGradeMutation.isPending
                      ? <ActivityIndicator color={'#fff'} />
                      : <Text style={styles.primaryBtnText}>{'Add Grade'}</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
        </View>}
      </Modal>
    </View>
  );
}

function FirmCard({ firm, onModules, onConfig, onEdit, onDelete, onPermissions, onGrades, inactive }: {
  firm: Firm; onModules: () => void; onConfig: () => void; onEdit: () => void;
  onDelete: () => void; onPermissions: () => void; onGrades: () => void; inactive?: boolean;
}) {
  const initials = firm.name.split(' ').slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase();
  return (
    <View style={[styles.firmCard, inactive && styles.firmCardInactive]}>
      {/* Active indicator bar */}
      <View style={[styles.firmAccentBar, { backgroundColor: inactive ? '#334155' : '#7c3aed' }]} />

      <View style={styles.firmCardContent}>
        {/* Top row: avatar + info + status */}
        <View style={styles.firmTopRow}>
          <View style={[styles.firmAvatar, inactive && { backgroundColor: '#1e293b' }]}>
            <Text style={styles.firmAvatarText}>{initials}</Text>
          </View>
          <View style={styles.firmInfo}>
            <Text style={[styles.firmName, inactive && { color: '#475569' }]} numberOfLines={1}>{firm.name}</Text>
            {firm.apmc_name ? <Text style={styles.firmMeta}>📍 {firm.apmc_name}</Text> : null}
            {firm.contact_phone ? <Text style={styles.firmMeta}>📞 {firm.contact_phone}</Text> : null}
          </View>
          <View style={styles.firmStatusCol}>
            <View style={[styles.statusDot, { backgroundColor: inactive ? '#334155' : '#10b981' }]} />
            <Text style={[styles.userCount, { color: inactive ? '#475569' : '#94a3b8' }]}>{firm.user_count} users</Text>
          </View>
        </View>

        {/* Action grid */}
        <View style={styles.actionGrid}>
          <TouchableOpacity style={[styles.actionTile, { backgroundColor: 'rgba(124,58,237,0.12)' }]} onPress={onModules}>
            <Text style={styles.actionTileIcon}>🔧</Text>
            <Text style={[styles.actionTileText, { color: '#a78bfa' }]}>Modules</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionTile, { backgroundColor: 'rgba(59,130,246,0.12)' }]} onPress={onPermissions}>
            <Text style={styles.actionTileIcon}>🔑</Text>
            <Text style={[styles.actionTileText, { color: '#60a5fa' }]}>Permissions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionTile, { backgroundColor: 'rgba(16,185,129,0.12)' }]} onPress={onConfig}>
            <Text style={styles.actionTileIcon}>📊</Text>
            <Text style={[styles.actionTileText, { color: '#34d399' }]}>Rates</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionTile, { backgroundColor: 'rgba(251,191,36,0.12)' }]} onPress={onGrades}>
            <Text style={styles.actionTileIcon}>🏷️</Text>
            <Text style={[styles.actionTileText, { color: '#fbbf24' }]}>Grades</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionTile, { backgroundColor: 'rgba(245,158,11,0.12)' }]} onPress={onEdit}>
            <Text style={styles.actionTileIcon}>✏️</Text>
            <Text style={[styles.actionTileText, { color: '#fbbf24' }]}>Edit</Text>
          </TouchableOpacity>
          {!inactive && (
            <TouchableOpacity style={[styles.actionTile, { backgroundColor: 'rgba(239,68,68,0.10)' }]} onPress={onDelete}>
              <Text style={styles.actionTileIcon}>🗑️</Text>
              <Text style={[styles.actionTileText, { color: '#f87171' }]}>Deactivate</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function ConfigField({ label, value, onChangeText, placeholder, keyboardType }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{String(label ?? '')}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value == null ? '' : String(value)}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType ?? 'decimal-pad'}
      />
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

const P = '#7c3aed'; // primary purple
const BG = '#050d1a'; // deep navy
const CARD = '#0d1829'; // card background
const BORDER = 'rgba(124,58,237,0.18)';
const TEXT1 = '#f1f5f9';
const TEXT2 = '#94a3b8';
const TEXT3 = '#475569';
const SHEET_BG = '#ffffff';

const styles = StyleSheet.create({
  // ── Main Layout ──────────────────────────────────────────────────────────────
  container: { flex: 1, backgroundColor: BG },
  flex1: { flex: 1 },

  // ── Header ───────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingTop: 58, paddingBottom: spacing[4],
    backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  logoMark: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: P,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)',
  },
  logoText: { fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  headerBrand: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: TEXT1, letterSpacing: -0.3 },
  headerSub: { fontSize: typography.size.xs, color: TEXT2, marginTop: 1 },
  logoutBtn: {
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)', borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  logoutText: { color: '#f87171', fontSize: typography.size.xs, fontWeight: typography.weight.semibold },

  // ── Stats ─────────────────────────────────────────────────────────────────────
  statsRow: { flexDirection: 'row', gap: spacing[3], padding: spacing[4], paddingBottom: spacing[2] },
  statCard: {
    flex: 1, backgroundColor: CARD, borderRadius: radius.xl, paddingVertical: spacing[4],
    alignItems: 'center', borderTopWidth: 3, borderWidth: 1, borderColor: BORDER,
  },
  statNum: { fontSize: 28, fontWeight: '800', color: P, letterSpacing: -0.5 },
  statLabel: { fontSize: typography.size.xs, color: TEXT2, marginTop: 3, fontWeight: typography.weight.medium },

  // ── Section Header ────────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
  },
  sectionTitle: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: TEXT1 },
  sectionSub: { fontSize: typography.size.xs, color: TEXT3, marginTop: 1 },
  newFirmBtn: {
    backgroundColor: P, borderRadius: radius.full, paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)',
  },
  newFirmBtnText: { color: '#fff', fontSize: typography.size.sm, fontWeight: typography.weight.bold, letterSpacing: 0.3 },

  // ── Firm List ─────────────────────────────────────────────────────────────────
  list: { paddingHorizontal: spacing[4], paddingBottom: spacing[12], gap: spacing[3] },
  inactiveLabel: {
    textAlign: 'center', color: TEXT3, fontSize: typography.size.xs,
    fontWeight: typography.weight.medium, letterSpacing: 1.5,
    marginVertical: spacing[3],
  },

  // ── Empty State ───────────────────────────────────────────────────────────────
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: spacing[8] },
  emptyIcon: { fontSize: 48, marginBottom: spacing[3] },
  emptyTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: TEXT2, marginBottom: spacing[2] },
  emptyText: { fontSize: typography.size.sm, color: TEXT3, textAlign: 'center', lineHeight: 20 },

  // ── Firm Card ─────────────────────────────────────────────────────────────────
  firmCard: {
    backgroundColor: CARD, borderRadius: radius.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: BORDER, flexDirection: 'row',
  },
  firmCardInactive: { borderColor: '#1e293b', opacity: 0.6 },
  firmAccentBar: { width: 4 },
  firmCardContent: { flex: 1, padding: spacing[4] },
  firmTopRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing[4], gap: spacing[3] },
  firmAvatar: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(124,58,237,0.2)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)',
  },
  firmAvatarText: { color: '#c4b5fd', fontSize: typography.size.base, fontWeight: '800' },
  firmInfo: { flex: 1 },
  firmName: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: TEXT1, marginBottom: 3 },
  firmMeta: { fontSize: typography.size.xs, color: TEXT3, marginTop: 2 },
  firmStatusCol: { alignItems: 'flex-end', gap: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  userCount: { fontSize: typography.size.xs, fontWeight: typography.weight.medium },

  // Action Grid — 5 tiles in a wrapping row
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  actionTile: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  actionTileIcon: { fontSize: 13 },
  actionTileText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },

  // ── Sheet (modal) ─────────────────────────────────────────────────────────────
  sheetContainer: { flex: 1, backgroundColor: SHEET_BG },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginTop: spacing[3], marginBottom: spacing[1] },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[5],
    paddingVertical: spacing[4], borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  sheetTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: '#0f172a' },
  sheetSub: { fontSize: typography.size.xs, color: '#64748b', marginTop: 2 },
  sheetCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  sheetCloseText: { fontSize: 14, color: '#475569', fontWeight: typography.weight.bold },
  sheetHint: { fontSize: typography.size.sm, color: '#64748b', paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
  permHintRow: { backgroundColor: '#faf5ff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },

  // ── Module List ───────────────────────────────────────────────────────────────
  moduleList: { padding: spacing[4], gap: spacing[2], paddingBottom: spacing[10] },
  moduleRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, borderColor: '#e2e8f0',
    gap: spacing[3],
  },
  moduleRowActive: { borderColor: P, backgroundColor: '#faf5ff' },
  moduleIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  moduleIconActive: { backgroundColor: 'rgba(124,58,237,0.12)' },
  moduleIconText: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#64748b' },
  moduleInfo: { flex: 1 },
  moduleName: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: '#1e293b' },
  moduleDesc: { fontSize: typography.size.xs, color: '#64748b', marginTop: 2 },

  // ── Role Permissions ──────────────────────────────────────────────────────────
  roleTabBar: { flexDirection: 'row', margin: spacing[4], marginBottom: spacing[2], backgroundColor: '#f1f5f9', borderRadius: radius.xl, padding: 4 },
  roleTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: spacing[2], borderRadius: radius.lg },
  roleTabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  roleTabDot: { width: 6, height: 6, borderRadius: 3 },
  roleTabText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: '#64748b' },
  roleTabTextActive: { color: '#1e293b' },

  permHeaderRow: {
    flexDirection: 'row', paddingHorizontal: spacing[5], paddingVertical: spacing[2],
    backgroundColor: '#f8fafc', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e2e8f0',
  },
  permModuleHeader: { flex: 1, fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  permColHeader: { width: 40, textAlign: 'center', fontSize: typography.size.xs, fontWeight: typography.weight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  permList: { padding: spacing[3], paddingBottom: spacing[10] },
  permRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[3], borderRadius: radius.md },
  permRowAlt: { backgroundColor: '#f8fafc' },
  permModuleName: { flex: 1, fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: '#1e293b' },
  permBox: { width: 34, height: 34, borderRadius: 8, borderWidth: 1.5, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', marginLeft: 3 },
  permBoxText: { fontSize: 14, color: '#94a3b8', fontWeight: typography.weight.bold },
  permBoxTextActive: { color: '#fff', fontSize: 14 },

  // ── Save Bar ──────────────────────────────────────────────────────────────────
  saveBar: { padding: spacing[4], backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  primaryBtn: {
    backgroundColor: P, borderRadius: radius.xl, paddingVertical: spacing[4],
    alignItems: 'center', shadowColor: P, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: typography.size.base, fontWeight: typography.weight.bold, letterSpacing: 0.3 },

  // ── Form Sheet ────────────────────────────────────────────────────────────────
  formScroll: { padding: spacing[5], paddingBottom: spacing[10] },
  field: { marginBottom: spacing[4] },
  fieldLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: '#475569', marginBottom: spacing[2] },
  fieldInput: {
    backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: radius.xl,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontSize: typography.size.base, color: '#1e293b',
  },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginVertical: spacing[4] },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: P, letterSpacing: 0.5, textTransform: 'uppercase' },
  formHint: { fontSize: typography.size.xs, color: '#94a3b8', fontStyle: 'italic', marginBottom: spacing[3], lineHeight: 18 },

  // ── Config Sheet ──────────────────────────────────────────────────────────────
  configSection: { backgroundColor: '#fff', borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, borderColor: '#e2e8f0' },
  configSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[4] },
  configSectionIcon: { fontSize: 24 },
  configSectionTitle: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#1e293b' },
  configHint: { fontSize: typography.size.xs, color: '#64748b', marginTop: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[3] },
  chip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  chipActive: { backgroundColor: P, borderColor: P },
  chipText: { fontSize: typography.size.xs, color: '#475569', fontWeight: typography.weight.semibold },
  chipTextActive: { color: '#fff' },
  configRow: { flexDirection: 'row', gap: spacing[3] },
  configHalf: { flex: 1 },
});
