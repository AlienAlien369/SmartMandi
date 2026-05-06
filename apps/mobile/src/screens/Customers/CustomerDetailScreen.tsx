import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { RouteProp } from '@react-navigation/native';
import { customersApi } from '../../api/endpoints';
import type { CustomerStackParamList } from '../../types';
import { colors, typography, spacing, radius, shadow } from '../../theme';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

type RouteT = RouteProp<CustomerStackParamList, 'CustomerDetail'>;

type LineItem = { grade_name: string; produce_name: string; quantity_bags: number; total_weight_kg: string; rate_per_kg: string; gross_amount: string; baardana_cost: string };
type Payment = { payment_mode: string; amount: string; is_udhar: boolean; payment_date: string; payment_reference?: string };
type KC = { id: string; kc_number: string; sale_date: string; status: string; truck_number: string; produce_name: string; total_weight_kg: string; total_gross_amount: string; total_apmc_fee: string; total_commission: string; total_baardana_cost: string; total_net_payable: string; udhar_amount: number; line_items: LineItem[]; payments: Payment[]; created_by_name: string };
type History = { customer: any; outstanding_udhar: number; total_purchase_amount: number; total_kcs: number; kcs: KC[] };

const fmt = (n: any) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtRs = (n: any) => `₹${fmt(n)}`;
const STATUS_COLOR: Record<string, string> = { DRAFT: '#f59e0b', AUTHORIZED: '#10b981', CANCELLED: '#ef4444' };

export function CustomerDetailScreen() {
  const { params } = useRoute<RouteT>();
  const [expandedKc, setExpandedKc] = useState<string | null>(null);

  const { data: history, isLoading, error } = useQuery<History>({
    queryKey: ['customer-history', params.customerId],
    queryFn: async () => {
      const { data } = await customersApi.getHistory(params.customerId);
      return data;
    },
  });

  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedKc(prev => (prev === id ? null : id));
  };

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />;
  if (error || !history) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.error }}>Failed to load customer history</Text></View>;

  const { customer, outstanding_udhar, total_purchase_amount, total_kcs, kcs } = history;

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
      </View>

      {/* Outstanding Udhar — prominent red card */}
      <View style={[styles.udharCard, outstanding_udhar === 0 && styles.udharCardClear]}>
        <View style={styles.udharLeft}>
          <Text style={styles.udharLabel}>Outstanding Udhar</Text>
          <Text style={styles.udharSub}>{outstanding_udhar === 0 ? 'No pending credit' : 'Credit to be collected'}</Text>
        </View>
        <Text style={[styles.udharAmount, outstanding_udhar === 0 && styles.udharAmountClear]}>
          {fmtRs(outstanding_udhar)}
        </Text>
      </View>

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
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[10] },
  profileCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[6], alignItems: 'center', ...shadow.sm },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: spacing[3] },
  avatarText: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: colors.primary },
  name: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  phone: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: spacing[1] },
  inactiveBadge: { marginTop: spacing[2], backgroundColor: '#FEE2E2', paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full },
  inactiveText: { color: colors.error, fontSize: typography.size.xs, fontWeight: typography.weight.medium },
  udharCard: { backgroundColor: '#FEF2F2', borderRadius: radius.xl, padding: spacing[5], flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  udharCardClear: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  udharLeft: { flex: 1 },
  udharLabel: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#DC2626' },
  udharSub: { fontSize: typography.size.xs, color: '#991B1B', marginTop: 2 },
  udharAmount: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: '#DC2626' },
  udharAmountClear: { color: '#16A34A' },
  statsRow: { flexDirection: 'row', gap: spacing[3] },
  statBox: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], alignItems: 'center', ...shadow.sm },
  statValue: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.primary },
  statLabel: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.textPrimary, marginTop: spacing[2] },
  emptyBox: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[8], alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: typography.size.sm },
  kcCard: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', ...shadow.sm },
  kcHeader: { padding: spacing[4], flexDirection: 'row', alignItems: 'flex-start' },
  kcHeaderLeft: { flex: 1 },
  kcHeaderRight: { alignItems: 'flex-end', marginLeft: spacing[3] },
  kcTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] },
  kcNumber: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.textPrimary },
  statusBadge: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm },
  statusText: { fontSize: 10, fontWeight: typography.weight.bold },
  kcDate: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  kcProduce: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  kcNetLabel: { fontSize: 10, color: colors.textTertiary },
  kcNetAmount: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.textPrimary },
  kcUdhar: { fontSize: 10, color: '#DC2626', marginTop: 2 },
  expandIcon: { fontSize: 10, color: colors.textTertiary, marginTop: spacing[2] },
  kcBody: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing[4], gap: spacing[3] },
  finGrid: { backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing[4], gap: spacing[2] },
  finRow: { flexDirection: 'row', justifyContent: 'space-between' },
  finLabel: { fontSize: typography.size.sm, color: colors.textSecondary },
  finLabelTotal: { fontWeight: typography.weight.bold, color: colors.textPrimary },
  finValue: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textPrimary },
  finValueDeduction: { color: '#DC2626' },
  finValueTotal: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.primary },
  finDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing[1] },
  subHeader: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.textPrimary },
  lineItem: { backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing[3], gap: spacing[1] },
  liGrade: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primary, marginBottom: spacing[1] },
  liRow: { flexDirection: 'row', justifyContent: 'space-between' },
  liLabel: { fontSize: typography.size.xs, color: colors.textSecondary },
  liVal: { fontSize: typography.size.xs, fontWeight: typography.weight.medium, color: colors.textPrimary },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing[3] },
  paymentRowUdhar: { backgroundColor: '#FEF2F2' },
  paymentLeft: { flex: 1 },
  paymentMode: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textPrimary },
  paymentDate: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  paymentRef: { fontSize: typography.size.xs, color: colors.textTertiary },
  paymentAmt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.textPrimary },
  paymentAmtUdhar: { color: '#DC2626' },
  createdBy: { fontSize: typography.size.xs, color: colors.textTertiary, textAlign: 'right', marginTop: spacing[2] },
});
