import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, LayoutAnimation, Platform, UIManager, Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { customersApi } from '../../api/endpoints';
import type { CustomerStackParamList } from '../../types';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { usePermissions } from '../../hooks/usePermissions';
import { extractApiError } from '../../utils/errorUtils';
import { useNetworkState } from '../../hooks/useNetworkState';
import { offlineQueue } from '../../offline/queue';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

type RouteT = RouteProp<CustomerStackParamList, 'CustomerDetail'>;
type NavT = NativeStackNavigationProp<CustomerStackParamList, 'CustomerDetail'>;

type LineItem = { grade_name: string; produce_name: string; quantity_bags: number; total_weight_kg: string; rate_per_kg: string; gross_amount: string; baardana_cost: string };
type Payment = { payment_mode: string; amount: string; is_udhar: boolean; payment_date: string; payment_reference?: string };
type KC = { id: string; kc_number: string; sale_date: string; status: string; truck_number: string; produce_name: string; total_weight_kg: string; total_gross_amount: string; total_apmc_fee: string; total_commission: string; total_baardana_cost: string; total_net_payable: string; udhar_amount: number; line_items: LineItem[]; payments: Payment[]; created_by_name: string };
type History = { customer: any; outstanding_udhar: number; credit_balance: number; total_purchase_amount: number; total_kcs: number; kcs: KC[] };

const fmt = (n: any) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtRs = (n: any) => `₹${fmt(n)}`;
const STATUS_COLOR: Record<string, string> = { DRAFT: '#f59e0b', AUTHORIZED: '#10b981', CANCELLED: '#ef4444' };

export function CustomerDetailScreen() {
  const { params } = useRoute<RouteT>();
  const navigation = useNavigation<NavT>();
  const queryClient = useQueryClient();
  const perms = usePermissions('CUSTOMERS');
  const { isOnline } = useNetworkState();
  const [expandedKc, setExpandedKc] = useState<string | null>(null);

  const { data: history, isLoading, error } = useQuery<History>({
    queryKey: ['customer-history', params.customerId],
    queryFn: async () => {
      const { data } = await customersApi.getHistory(params.customerId);
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!isOnline) {
        await offlineQueue.enqueue('DELETE', `/customers/${params.customerId}`, null);
        return null;
      }
      return customersApi.delete(params.customerId);
    },
    onSuccess: (data) => {
      if (!data) {
        Alert.alert('Queued 📶', 'Customer deletion will be processed when you reconnect.');
        navigation.goBack();
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const handleDelete = () => {
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete ${history?.customer?.name ?? 'this customer'}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ],
    );
  };

  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedKc(prev => (prev === id ? null : id));
  };

  if (isLoading) return <ActivityIndicator style={styles.flex1} size="large" color={colors.primary} />;
  if (error || !history) return <View style={styles.centered}><Text style={styles.errorText}>Failed to load customer history</Text></View>;

  const { customer, outstanding_udhar, credit_balance, total_purchase_amount, total_kcs, kcs } = history;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{customer.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
        </View>
        <Text style={styles.name}>{customer.name}</Text>
        {customer.phone ? <Text style={styles.phone}>📞 {customer.phone}</Text> : null}
        {customer.village ? <Text style={styles.phone}>🏘️ {customer.village}</Text> : null}
        {!customer.is_active && <View style={styles.inactiveBadge}><Text style={styles.inactiveText}>Inactive</Text></View>}

        {/* Edit / Delete actions */}
        {(perms.can_update || perms.can_delete) && (
          <View style={styles.actionRow}>
            {perms.can_update && (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => navigation.navigate('CustomerEdit', {
                  customerId: customer.id,
                  name: customer.name,
                  phone: customer.phone ?? '',
                  address: customer.address ?? customer.village ?? '',
                })}
              >
                <Text style={styles.editBtnText}>✏️  Edit</Text>
              </TouchableOpacity>
            )}
            {perms.can_delete && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Text style={styles.deleteBtnText}>
                  {deleteMutation.isPending ? 'Deleting…' : '🗑  Delete'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Balance card — 3 states: firm owes customer (credit), customer owes firm (udhar), settled */}
      {credit_balance > 0 ? (
        <View style={styles.creditCard}>
          <View style={styles.udharLeft}>
            <Text style={styles.creditLabel}>Firm Owes Customer</Text>
            <Text style={styles.creditSub}>Customer has paid extra — refund or adjust next KC</Text>
          </View>
          <Text style={styles.creditAmount}>{fmtRs(credit_balance)}</Text>
        </View>
      ) : (
        <View style={[styles.udharCard, outstanding_udhar === 0 && styles.udharCardClear]}>
          <View style={styles.udharLeft}>
            <Text style={[styles.udharLabel, outstanding_udhar === 0 && { color: colors.success }]}>Outstanding Udhar</Text>
            <Text style={[styles.udharSub, outstanding_udhar === 0 && { color: colors.success }]}>
              {outstanding_udhar === 0 ? 'No pending credit — fully settled' : 'Credit to be collected'}
            </Text>
          </View>
          <Text style={[styles.udharAmount, outstanding_udhar === 0 && styles.udharAmountClear]}>
            {fmtRs(outstanding_udhar)}
          </Text>
        </View>
      )}

      {/* Summary stats */}
      <View style={styles.statsRow}>
        <StatBox label="Total KCs" value={String(total_kcs)} />
        <StatBox label="Total Purchases" value={fmtRs(total_purchase_amount)} />
      </View>

      {/* KC History */}
      <Text style={styles.sectionTitle}>Purchase History</Text>
      {kcs.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No KC records found for this customer.</Text>
        </View>
      )}
      {kcs.map(kc => (
        <View key={kc.id} style={styles.kcCard}>
          {/* KC header — always visible */}
          <TouchableOpacity style={styles.kcHeader} onPress={() => toggle(kc.id)} activeOpacity={0.7}>
            <View style={styles.kcHeaderLeft}>
              <View style={styles.kcTopRow}>
                <Text style={styles.kcNumber}>{kc.kc_number}</Text>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[kc.status] + '20' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLOR[kc.status] }]}>{kc.status}</Text>
                </View>
              </View>
              <Text style={styles.kcDate}>📅 {kc.sale_date} · 🚛 {kc.truck_number || '—'}</Text>
              <Text style={styles.kcProduce}>🌾 {kc.produce_name || '—'} · {fmt(kc.total_weight_kg)} kg</Text>
            </View>
            <View style={styles.kcHeaderRight}>
              <Text style={styles.kcNetLabel}>Net Payable</Text>
              <Text style={styles.kcNetAmount}>{fmtRs(kc.total_net_payable)}</Text>
              {kc.udhar_amount > 0 && (
                <Text style={styles.kcUdhar}>⚠️ Udhar {fmtRs(kc.udhar_amount)}</Text>
              )}
              <Text style={styles.expandIcon}>{expandedKc === kc.id ? '▲' : '▼'}</Text>
            </View>
          </TouchableOpacity>

          {/* Expanded detail */}
          {expandedKc === kc.id && (
            <View style={styles.kcBody}>
              {/* Financial summary */}
              <View style={styles.finGrid}>
                <FinRow label="Gross Amount" value={fmtRs(kc.total_gross_amount)} />
                <FinRow label="APMC Fee" value={fmtRs(kc.total_apmc_fee)} highlight="deduction" />
                <FinRow label="Commission" value={fmtRs(kc.total_commission)} highlight="deduction" />
                <FinRow label="Baardana" value={fmtRs(kc.total_baardana_cost)} highlight="deduction" />
                <View style={styles.finDivider} />
                <FinRow label="Net Payable" value={fmtRs(kc.total_net_payable)} highlight="total" />
              </View>

              {/* Line Items */}
              {kc.line_items.length > 0 && (
                <>
                  <Text style={styles.subHeader}>📦 Items</Text>
                  {kc.line_items.map((li, idx) => (
                    <View key={idx} style={styles.lineItem}>
                      <Text style={styles.liGrade}>{li.grade_name || li.produce_name || `Item ${idx + 1}`}</Text>
                      <View style={styles.liRow}><Text style={styles.liLabel}>Bags</Text><Text style={styles.liVal}>{li.quantity_bags}</Text></View>
                      <View style={styles.liRow}><Text style={styles.liLabel}>Weight</Text><Text style={styles.liVal}>{fmt(li.total_weight_kg)} kg</Text></View>
                      <View style={styles.liRow}><Text style={styles.liLabel}>Rate</Text><Text style={styles.liVal}>₹{fmt(li.rate_per_kg)}/kg</Text></View>
                      <View style={styles.liRow}><Text style={styles.liLabel}>Gross</Text><Text style={styles.liVal}>{fmtRs(li.gross_amount)}</Text></View>
                      {Number(li.baardana_cost) > 0 && <View style={styles.liRow}><Text style={styles.liLabel}>Baardana</Text><Text style={styles.liVal}>-{fmtRs(li.baardana_cost)}</Text></View>}
                    </View>
                  ))}
                </>
              )}

              {/* Payments */}
              {kc.payments.length > 0 && (
                <>
                  <Text style={styles.subHeader}>💰 Payments</Text>
                  {kc.payments.map((p, idx) => (
                    <View key={idx} style={[styles.paymentRow, p.is_udhar && styles.paymentRowUdhar]}>
                      <View style={styles.paymentLeft}>
                        <Text style={styles.paymentMode}>{p.is_udhar ? '⚠️ Udhar (Credit)' : `💳 ${p.payment_mode || 'Cash'}`}</Text>
                        {p.payment_date && <Text style={styles.paymentDate}>{p.payment_date}</Text>}
                        {p.payment_reference ? <Text style={styles.paymentRef}>Ref: {p.payment_reference}</Text> : null}
                      </View>
                      <Text style={[styles.paymentAmt, p.is_udhar && styles.paymentAmtUdhar]}>{fmtRs(p.amount)}</Text>
                    </View>
                  ))}
                </>
              )}

              <Text style={styles.createdBy}>Created by: {kc.created_by_name || '—'}</Text>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FinRow({ label, value, highlight }: { label: string; value: string; highlight?: 'deduction' | 'total' }) {
  return (
    <View style={styles.finRow}>
      <Text style={[styles.finLabel, highlight === 'total' && styles.finLabelTotal]}>{label}</Text>
      <Text style={[styles.finValue, highlight === 'deduction' && styles.finValueDeduction, highlight === 'total' && styles.finValueTotal]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[10] },
  profileCard: { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: spacing[6], alignItems: 'center', borderWidth: 0.5, borderColor: colors.border, ...shadow.sm },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: spacing[3] },
  avatarText: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: colors.primary },
  name: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  phone: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: spacing[1] },
  inactiveBadge: { marginTop: spacing[2], backgroundColor: colors.dangerBg, paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full },
  inactiveText: { color: colors.danger, fontSize: typography.size.xs, fontWeight: typography.weight.medium },
  udharCard: { backgroundColor: colors.dangerBg, borderRadius: radius.xl, padding: spacing[5], flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.danger + '30', marginBottom: spacing[4] },
  udharCardClear: { backgroundColor: colors.successBg, borderColor: colors.success + '30' },
  udharLeft: { flex: 1 },
  udharLabel: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.danger },
  udharSub: { fontSize: typography.size.xs, color: colors.danger, marginTop: 2, opacity: 0.7 },
  udharAmount: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: colors.danger },
  udharAmountClear: { color: colors.success },
  // Credit card — firm owes the customer (overpaid)
  creditCard: {
    backgroundColor: '#eff6ff', borderRadius: radius.xl, padding: spacing[5],
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#3b82f660', marginBottom: spacing[4],
  },
  creditLabel: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#1d4ed8' },
  creditSub: { fontSize: typography.size.xs, color: '#3b82f6', marginTop: 2, opacity: 0.85 },
  creditAmount: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: '#1d4ed8' },
  statsRow: { flexDirection: 'row', gap: spacing[3] },
  statBox: { flex: 1, backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: spacing[4], alignItems: 'center', borderWidth: 0.5, borderColor: colors.border, ...shadow.sm },
  statValue: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.primary },
  statLabel: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.textPrimary, marginTop: spacing[2] },
  emptyBox: { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: spacing[8], alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  emptyText: { color: colors.textSecondary, fontSize: typography.size.sm },
  kcCard: { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.border, ...shadow.sm },
  kcHeader: { padding: spacing[4], flexDirection: 'row', alignItems: 'flex-start' },
  kcHeaderLeft: { flex: 1 },
  kcHeaderRight: { alignItems: 'flex-end', marginLeft: spacing[3] },
  kcTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] },
  kcNumber: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.textPrimary },
  statusBadge: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm },
  statusText: { fontSize: 10, fontWeight: typography.weight.bold },
  kcDate: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  kcProduce: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  kcNetLabel: { fontSize: 10, color: colors.textMuted },
  kcNetAmount: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.textPrimary },
  kcUdhar: { fontSize: 10, color: colors.danger, marginTop: 2 },
  expandIcon: { fontSize: 10, color: colors.textMuted, marginTop: spacing[2] },
  kcBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, padding: spacing[4], gap: spacing[3] },
  finGrid: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: spacing[4], gap: spacing[2] },
  finRow: { flexDirection: 'row', justifyContent: 'space-between' },
  finLabel: { fontSize: typography.size.sm, color: colors.textSecondary },
  finLabelTotal: { fontWeight: typography.weight.bold, color: colors.textPrimary },
  finValue: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textPrimary },
  finValueDeduction: { color: colors.danger },
  finValueTotal: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.primary },
  finDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing[1] },
  subHeader: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.textPrimary },
  lineItem: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: spacing[3], gap: spacing[1] },
  liGrade: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primary, marginBottom: spacing[1] },
  liRow: { flexDirection: 'row', justifyContent: 'space-between' },
  liLabel: { fontSize: typography.size.xs, color: colors.textSecondary },
  liVal: { fontSize: typography.size.xs, fontWeight: typography.weight.medium, color: colors.textPrimary },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: spacing[3] },
  paymentRowUdhar: { backgroundColor: colors.dangerBg },
  paymentLeft: { flex: 1 },
  paymentMode: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textPrimary },
  paymentDate: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  paymentRef: { fontSize: typography.size.xs, color: colors.textMuted },
  paymentAmt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.textPrimary },
  paymentAmtUdhar: { color: colors.danger },
  createdBy: { fontSize: typography.size.xs, color: colors.textMuted, textAlign: 'right', marginTop: spacing[2] },
  actionRow: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[4], width: '100%' },
  editBtn: {
    flex: 1, height: 40, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.primaryLight,
  },
  editBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primary },
  deleteBtn: {
    flex: 1, height: 40, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.danger,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.dangerBg,
  },
  deleteBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.danger },
  flex1: { flex: 1 },
  centered: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  errorText: { color: colors.danger, fontSize: typography.size.base },
});
