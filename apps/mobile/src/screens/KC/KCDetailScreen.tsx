import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, FlatList, Linking,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { RouteProp } from '@react-navigation/native';
import { kcsApi, configApi } from '../../api/endpoints';
import type { KacchaChittha, KCStackParamList } from '../../types';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { extractApiError } from '../../utils/errorUtils';
import { usePermissions } from '../../hooks/usePermissions';
import type { RootState } from '../../store';
import { useNetworkState } from '../../hooks/useNetworkState';
import { offlineQueue } from '../../offline/queue';

type RouteT = RouteProp<KCStackParamList, 'KCDetail'>;

interface GradeConfig { id: string; grade_code: string; grade_label: string; }

export function KCDetailScreen() {
  const { params } = useRoute<RouteT>();
  const queryClient = useQueryClient();
  const perms = usePermissions('KC');
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const { isOnline } = useNetworkState();

  // Cancel modal state
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Edit mode state (for DRAFT KCs — authorizer can edit before authorizing)
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState<Array<{
    grade_config_id: string; grade_label: string;
    quantity_bags: string; total_weight_kg: string;
    rate_per_kg: string;   // used for PER_KG mode
    rate_per_nag: string;  // used for PER_NAG mode
    rate_mode: 'PER_KG' | 'PER_NAG';
    baardana_source: 'FIRM' | 'CUSTOMER'; baardana_quantity: string;
  }>>([]);
  const [showGradePicker, setShowGradePicker] = useState<number | null>(null);

  const { data: kc, isLoading } = useQuery<KacchaChittha>({
    queryKey: ['kc', params.kcId],
    queryFn: async () => {
      const { data } = await kcsApi.get(params.kcId);
      return data as KacchaChittha;
    },
  });

  const { data: gradesData } = useQuery<GradeConfig[]>({
    queryKey: ['grades'],
    queryFn: async () => {
      const { data } = await configApi.getGrades();
      return data as GradeConfig[];
    },
  });
  const grades = gradesData ?? [];

  const { data: baardanaConfig } = useQuery({
    queryKey: ['baardana-config'],
    queryFn: async () => {
      const { data } = await configApi.getBaardanaConfig();
      return data as { rate_mode: 'PER_KG' | 'PER_NAG'; baardana_provider: 'FIRM' | 'CUSTOMER'; default_bags: number };
    },
    staleTime: 300000,
  });
  const firmRateMode = baardanaConfig?.rate_mode ?? 'PER_KG';

  const authorizeMutation = useMutation({
    mutationFn: async () => {
      if (!isOnline) {
        await offlineQueue.enqueue('POST', `/kcs/${params.kcId}/authorize`, {});
        return null;
      }
      return kcsApi.authorize(params.kcId, {});
    },
    onSuccess: (data) => {
      if (!data) {
        Alert.alert('Queued 📶', 'Authorization will be submitted when you reconnect. Ledger entries will be written then.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['kc', params.kcId] });
      queryClient.invalidateQueries({ queryKey: ['kcs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      Alert.alert('Authorized ✅', 'KC has been authorized and ledger entries written!');
    },
    onError: (e: any) => Alert.alert('Authorization Failed', extractApiError(e)),
  });

  const cancelMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!isOnline) {
        await offlineQueue.enqueue('POST', `/kcs/${params.kcId}/cancel`, { reason });
        return null;
      }
      return kcsApi.cancel(params.kcId, { reason });
    },
    onSuccess: (data) => {
      if (!data) {
        setCancelModal(false);
        setCancelReason('');
        Alert.alert('Queued 📶', 'Cancellation will be submitted when you reconnect.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['kc', params.kcId] });
      queryClient.invalidateQueries({ queryKey: ['kcs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCancelModal(false);
      setCancelReason('');
      Alert.alert('Cancelled', 'KC has been cancelled');
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const saveEditMutation = useMutation({
    mutationFn: async () => {
      const line_items = editItems.map((it, idx) => {
        if (it.rate_mode === 'PER_NAG') {
          return {
            grade_config_id: it.grade_config_id,
            quantity_bags: parseInt(it.quantity_bags, 10) || 1,
            weight_per_bag_kg: undefined,
            total_weight_kg: 0,
            rate_per_kg: parseFloat(it.rate_per_nag) || 0,
            baardana_source: it.baardana_source,
            baardana_quantity: parseInt(it.baardana_quantity, 10) || 0,
            rate_mode: 'PER_NAG' as const,
            sort_order: idx,
          };
        }
        return {
          grade_config_id: it.grade_config_id,
          quantity_bags: parseInt(it.quantity_bags, 10) || 1,
          total_weight_kg: parseFloat(it.total_weight_kg) || 0,
          rate_per_kg: parseFloat(it.rate_per_kg) || 0,
          baardana_source: it.baardana_source,
          baardana_quantity: parseInt(it.baardana_quantity, 10) || 0,
          rate_mode: 'PER_KG' as const,
          sort_order: idx,
        };
      });
      if (!isOnline) {
        await offlineQueue.enqueue('PATCH', `/kcs/${params.kcId}/items`, { line_items });
        return null;
      }
      return kcsApi.updateItems(params.kcId, { line_items });
    },
    onSuccess: (data) => {
      if (!data) {
        setEditMode(false);
        Alert.alert('Queued 📶', 'Item changes will be saved when you reconnect.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['kc', params.kcId] });
      setEditMode(false);
      Alert.alert('Saved', 'Line items updated');
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const handleAuthorize = () => {
    Alert.alert('Authorize KC?', `This will finalize KC ${kc?.kc_number} and write ledger entries.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Authorize', onPress: () => authorizeMutation.mutate() },
    ]);
  };

  const handleStartEdit = () => {
    if (!kc?.line_items) return;
    setEditItems(kc.line_items.map(item => {
      const mode = item.rate_mode ?? firmRateMode;
      return {
        grade_config_id: item.grade_config_id ?? item.id,
        grade_label: grades.find(g => g.id === item.grade_config_id)?.grade_label ?? item.grade_code ?? '—',
        quantity_bags: String(item.quantity_bags),
        total_weight_kg: String(item.weight_kg ?? item.total_weight_kg ?? ''),
        rate_per_kg: mode === 'PER_KG' ? String(item.rate_per_kg) : '',
        rate_per_nag: mode === 'PER_NAG' ? String(item.rate_per_kg) : '', // backend stores rate_per_nag in rate_per_kg column
        rate_mode: mode,
        baardana_source: (item.baardana_source as 'FIRM' | 'CUSTOMER') ?? 'FIRM',
        baardana_quantity: String(item.baardana_quantity ?? 0),
      };
    }));
    setEditMode(true);
  };

  const setEditField = (i: number, key: string, value: string) =>
    setEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: value } : it));

  if (isLoading) return <ActivityIndicator style={styles.flex1} size="large" color={colors.primary} />;
  if (!kc) return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>KC not found</Text>
    </View>
  );

  const statusColor = {
    DRAFT: colors.statusDraft ?? colors.warning,
    AUTHORIZED: colors.statusAuthorized ?? colors.success,
    CANCELLED: colors.statusCancelled ?? colors.error,
  }[kc.status] ?? colors.textSecondary;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={[styles.header, { borderLeftColor: statusColor }]}>
          <Text style={styles.kcNumber}>{kc.kc_number}</Text>
          <View style={[styles.badge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{kc.status}</Text>
          </View>
          <Text style={styles.dateText}>{kc.sale_date}</Text>
        </View>

        {/* Amounts (only if authorized) */}
        {kc.status === 'AUTHORIZED' && (
          <View style={styles.amountsCard}>
            <AmountRow label="Gross Amount" value={kc.total_gross_amount ?? '0'} />
            <AmountRow label="APMC Fee" value={kc.total_apmc_fee ?? '0'} color={colors.error} />
            <AmountRow label="Commission" value={kc.total_commission ?? '0'} color={colors.warning} />
            <AmountRow label="Baardana" value={kc.total_baardana_cost ?? '0'} />
            <View style={styles.divider} />
            <AmountRow label="Net Payable" value={kc.total_net_payable ?? '0'} color={colors.primary} bold />
          </View>
        )}

        {/* PDF Download (AUTHORIZED only) */}
        {kc.status === 'AUTHORIZED' && accessToken && (
          <TouchableOpacity
            style={styles.pdfBtn}
            onPress={() => {
              const url = kcsApi.getPdfUrl(params.kcId, accessToken);
              Linking.openURL(url).catch(() =>
                Alert.alert('Error', 'Could not open PDF. Make sure a PDF viewer is installed.'),
              );
            }}
          >
            <Text style={styles.pdfBtnText}>📄  Download PDF Receipt</Text>
          </TouchableOpacity>
        )}

        {/* Line Items */}
        {!editMode && kc.line_items && kc.line_items.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Line Items ({kc.line_items.length})</Text>
              {kc.status === 'DRAFT' && (
                <TouchableOpacity onPress={handleStartEdit}>
                  <Text style={styles.editBtn}>✏️ Edit</Text>
                </TouchableOpacity>
              )}
            </View>
            {kc.line_items.map((item, i) => {
              const gradeLabel = grades.find(g => g.id === item.grade_config_id)?.grade_label ?? item.grade_code ?? '—';
              const weight = item.total_weight_kg ?? item.weight_kg ?? '0';
              const isNag = item.rate_mode === 'PER_NAG';
              return (
                <View key={item.id ?? i} style={styles.lineItem}>
                  <Text style={styles.lineItemTitle}>{item.produce_name ?? gradeLabel}</Text>
                  {isNag ? (
                    <Text style={styles.lineItemDetail}>{item.quantity_bags} nag · ₹{item.rate_per_kg}/nag</Text>
                  ) : (
                    <Text style={styles.lineItemDetail}>{item.quantity_bags} bags · {weight} kg · ₹{item.rate_per_kg}/kg</Text>
                  )}
                  <Text style={styles.lineItemGross}>Gross: ₹{item.gross_amount}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Edit Line Items (in-place editor) */}
        {editMode && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Edit Line Items</Text>
              <TouchableOpacity onPress={() => setEditMode(false)}>
                <Text style={[styles.editBtn, { color: colors.error }]}>✕ Cancel</Text>
              </TouchableOpacity>
            </View>
            {editItems.map((item, i) => (
              <View key={i} style={styles.editItemCard}>
                <Text style={styles.editItemLabel}>Item {i + 1} — Grade</Text>
                <TouchableOpacity style={styles.gradePickerBtn} onPress={() => setShowGradePicker(showGradePicker === i ? null : i)}>
                  <Text style={styles.gradePickerText}>{item.grade_label}</Text>
                  <Text style={styles.pickerArrow}>▼</Text>
                </TouchableOpacity>
                {showGradePicker === i && (
                  <View style={styles.gradeDropdown}>
                    {grades.map(g => (
                      <TouchableOpacity key={g.id} style={styles.gradeOption} onPress={() => {
                        setEditField(i, 'grade_config_id', g.id);
                        setEditField(i, 'grade_label', g.grade_label);
                        setShowGradePicker(null);
                      }}>
                        <Text style={styles.gradeOptionText}>{g.grade_label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <View style={styles.editRow}>
                  <View style={styles.flex1}>
                    <Text style={styles.editItemLabel}>Bags</Text>
                    <TextInput style={styles.editInput} value={item.quantity_bags} onChangeText={v => setEditField(i, 'quantity_bags', v)} keyboardType="number-pad" />
                  </View>
                  {item.rate_mode === 'PER_NAG' ? (
                    <View style={[styles.flex1, { flex: 2 }]}>
                      <Text style={styles.editItemLabel}>Rate/Nag (₹)</Text>
                      <TextInput style={styles.editInput} value={item.rate_per_nag} onChangeText={v => setEditField(i, 'rate_per_nag', v)} keyboardType="decimal-pad" />
                    </View>
                  ) : (
                    <>
                      <View style={styles.flex1}>
                        <Text style={styles.editItemLabel}>Weight (kg)</Text>
                        <TextInput style={styles.editInput} value={item.total_weight_kg} onChangeText={v => setEditField(i, 'total_weight_kg', v)} keyboardType="decimal-pad" />
                      </View>
                      <View style={styles.flex1}>
                        <Text style={styles.editItemLabel}>Rate/kg</Text>
                        <TextInput style={styles.editInput} value={item.rate_per_kg} onChangeText={v => setEditField(i, 'rate_per_kg', v)} keyboardType="decimal-pad" />
                      </View>
                    </>
                  )}
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.saveBtn, saveEditMutation.isPending && styles.btnDisabled]}
              onPress={() => saveEditMutation.mutate()}
              disabled={saveEditMutation.isPending}
            >
              <Text style={styles.saveBtnText}>{saveEditMutation.isPending ? 'Saving...' : '💾 Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Payments */}
        {kc.payments && kc.payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payments ({kc.payments.length})</Text>
            {kc.payments.map((p, i) => (
              <View key={p.id ?? i} style={styles.paymentRow}>
                <Text style={styles.paymentMode}>{p.is_udhar ? 'UDHAR' : (p.mode ?? p.payment_mode_id?.slice(0, 8) ?? 'Payment')}</Text>
                <Text style={styles.paymentAmount}>₹{p.amount}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        {kc.status === 'DRAFT' && !editMode && (
          <View style={styles.actions}>
            {perms.can_update && (
              <TouchableOpacity
                style={styles.authorizeBtn}
                onPress={handleAuthorize}
                disabled={authorizeMutation.isPending}
              >
                <Text style={styles.btnText}>{authorizeMutation.isPending ? 'Processing...' : '✅ Authorize KC'}</Text>
              </TouchableOpacity>
            )}
            {perms.can_delete && (
              <TouchableOpacity style={styles.cancelKcBtn} onPress={() => setCancelModal(true)} disabled={cancelMutation.isPending}>
                <Text style={styles.cancelKcBtnText}>Cancel KC</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Cancel Modal */}
      <Modal visible={cancelModal} transparent animationType="slide" onRequestClose={() => setCancelModal(false)}>
        <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Cancel KC?</Text>
              <Text style={styles.modalSubtitle}>Please enter a reason for cancellation (required)</Text>
              <TextInput
                style={styles.modalInput}
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="e.g. Customer backed out"
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setCancelModal(false); setCancelReason(''); }}>
                  <Text style={styles.modalCancelText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalDestructBtn, (!cancelReason.trim() || cancelMutation.isPending) && styles.btnDisabled]}
                  onPress={() => {
                    if (!cancelReason.trim()) return Alert.alert('Required', 'Cancellation reason is required');
                    cancelMutation.mutate(cancelReason.trim());
                  }}
                  disabled={!cancelReason.trim() || cancelMutation.isPending}
                >
                  <Text style={styles.modalDestructText}>{cancelMutation.isPending ? 'Cancelling...' : 'Cancel KC'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function AmountRow({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <View style={styles.amountRow}>
      <Text style={styles.amountLabel}>{label}</Text>
      <Text style={[styles.amountValue, color ? { color } : {}, bold ? { fontWeight: typography.weight.bold } : {}]}>
        ₹{parseFloat(value || '0').toLocaleString('en-IN')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[10] },
  header: { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: spacing[5], borderLeftWidth: 4, borderWidth: 0.5, borderColor: colors.border, ...shadow.sm },
  kcNumber: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  badge: { alignSelf: 'flex-start', paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm, marginTop: spacing[1] },
  badgeText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  dateText: { color: colors.textSecondary, marginTop: spacing[1] },
  amountsCard: { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: spacing[5], borderWidth: 0.5, borderColor: colors.border, ...shadow.sm },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[2], minHeight: 44, alignItems: 'center' },
  amountLabel: { color: colors.textSecondary },
  amountValue: { color: colors.textPrimary, fontWeight: typography.weight.semibold },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing[1] },
  section: { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: spacing[5], borderWidth: 0.5, borderColor: colors.border, ...shadow.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  sectionTitle: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  editBtn: { fontSize: typography.size.sm, color: colors.primary, fontWeight: typography.weight.medium },
  lineItem: { paddingVertical: spacing[2], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  lineItemTitle: { fontWeight: typography.weight.medium, color: colors.textPrimary },
  lineItemDetail: { color: colors.textSecondary, fontSize: typography.size.sm },
  lineItemGross: { color: colors.primary, fontWeight: typography.weight.semibold, marginTop: 2 },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[2] },
  paymentMode: { color: colors.textSecondary },
  paymentAmount: { color: colors.primary, fontWeight: typography.weight.semibold },
  actions: { gap: spacing[3] },
  authorizeBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing[4], alignItems: 'center', ...shadow.md },
  btnText: { color: colors.textInverse, fontSize: typography.size.base, fontWeight: typography.weight.semibold },
  cancelKcBtn: { borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  cancelKcBtnText: { color: colors.danger, fontSize: typography.size.base },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: typography.size.lg },
  editItemCard: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing[3], marginBottom: spacing[2] },
  editItemLabel: { fontSize: typography.size.xs, color: colors.textSecondary, marginBottom: 4 },
  editInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: spacing[2], fontSize: typography.size.sm, color: colors.textPrimary, backgroundColor: colors.surfaceRaised },
  editRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  gradePickerBtn: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing[2], marginBottom: spacing[1], backgroundColor: colors.surfaceRaised },
  gradePickerText: { fontSize: typography.size.sm, color: colors.textPrimary },
  pickerArrow: { fontSize: typography.size.xs, color: colors.textMuted },
  gradeDropdown: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, marginBottom: spacing[2] },
  gradeOption: { padding: spacing[2], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  gradeOptionText: { fontSize: typography.size.sm, color: colors.textPrimary },
  saveBtn: { backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center', marginTop: spacing[2] },
  saveBtnText: { color: colors.textInverse, fontWeight: typography.weight.semibold },
  btnDisabled: { opacity: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surfaceRaised, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[6], gap: spacing[3] },
  modalTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.textPrimary },
  modalSubtitle: { fontSize: typography.size.sm, color: colors.textSecondary },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing[3], fontSize: typography.size.base, color: colors.textPrimary, backgroundColor: colors.surfaceMuted, minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  modalCancelText: { color: colors.textSecondary, fontWeight: typography.weight.medium },
  modalDestructBtn: { flex: 1, backgroundColor: colors.danger, borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  modalDestructText: { color: colors.textInverse, fontWeight: typography.weight.semibold },
  pdfBtn: { backgroundColor: '#1a1a2e', borderRadius: radius.md, paddingVertical: spacing[4], alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing[2], ...shadow.sm },
  pdfBtnText: { color: '#ffffff', fontSize: typography.size.base, fontWeight: typography.weight.semibold },
  flex1: { flex: 1 },
});
