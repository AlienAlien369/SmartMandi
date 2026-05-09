import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { kcsApi, configApi, customersApi, trucksApi } from '../../api/endpoints';
import type { KCStackParamList } from '../../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { extractApiError } from '../../utils/errorUtils';

type Nav = NativeStackNavigationProp<KCStackParamList>;

interface LineItemForm {
  grade_config_id: string;
  grade_label: string;
  quantity_bags: string;
  weight_per_bag_kg: string;
  rate_per_kg: string;    // used for PER_KG mode
  rate_per_nag: string;   // used for PER_NAG mode
  baardana_source: 'FIRM' | 'CUSTOMER';
  baardana_quantity: string;
  rate_mode: 'PER_KG' | 'PER_NAG';
}

interface PaymentMode { id: string; mode_code: string; mode_label: string; }

export function KCCreateScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  // Header state
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [saleDate, setSaleDate] = useState(today);
  const [truckId, setTruckId] = useState('');
  const [truckLabel, setTruckLabel] = useState('');
  const [truckSearch, setTruckSearch] = useState('');
  const [showTruckDropdown, setShowTruckDropdown] = useState(false);

  // Customer search state
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Inline add customer modal
  const [addCustModal, setAddCustModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustVillage, setNewCustVillage] = useState('');

  // Line items state
  const [lineItems, setLineItems] = useState<LineItemForm[]>([]);
  const [showGradePicker, setShowGradePicker] = useState<number | null>(null);

  // Payment state
  const [cashAmount, setCashAmount] = useState('');
  const [upiAmount, setUpiAmount] = useState('');
  const [cashModeId, setCashModeId] = useState('');
  const [upiModeId, setUpiModeId] = useState('');
  const [udharModeId, setUdharModeId] = useState('');

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data: gradesData, isLoading: gradesLoading } = useQuery({
    queryKey: ['grades'],
    queryFn: async () => {
      const { data } = await configApi.getGrades();
      return data as Array<{ id: string; grade_code: string; grade_label: string }>;
    },
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data } = await customersApi.list({ limit: 200 });
      return (data?.data ?? data ?? []) as Array<{ id: string; name: string; phone?: string; village?: string }>;
    },
  });

  const { data: trucksData } = useQuery({
    queryKey: ['trucks-available'],
    queryFn: async () => {
      const { data } = await trucksApi.list({ limit: 200, page: 1 });
      const all = data?.data ?? data ?? [];
      return (all as Array<{ id: string; truck_number: string; driver_name: string; status: string }>)
        .filter(t => t.status === 'ARRIVED' || t.status === 'SCHEDULED');
    },
  });

  const { data: paymentModesData } = useQuery({
    queryKey: ['paymentModes'],
    queryFn: async () => {
      const { data } = await configApi.getPaymentModes();
      const modes = (data ?? []) as PaymentMode[];
      // Cache mode IDs for CASH / UPI / UDHAR
      modes.forEach(m => {
        if (m.mode_code?.toUpperCase() === 'CASH') setCashModeId(m.id);
        else if (m.mode_code?.toUpperCase() === 'UPI') setUpiModeId(m.id);
        else if (m.mode_code?.toUpperCase() === 'UDHAR') setUdharModeId(m.id);
      });      return modes;
    },
    staleTime: 60000,
  });

  // Fetch baardana config to pre-fill line item defaults
  const { data: baardanaConfig } = useQuery({
    queryKey: ['baardana-config'],
    queryFn: async () => {
      const { data } = await configApi.getBaardanaConfig();
      return data as { baardana_provider: 'FIRM' | 'CUSTOMER'; default_bags: number; cost_per_unit: string | null; rate_mode: 'PER_KG' | 'PER_NAG' };
    },
    staleTime: 300000, // cache 5 min — rarely changes
  });

  const grades = gradesData ?? [];
  const paymentModes = paymentModesData ?? [];
  const availableTrucks = trucksData ?? [];

  // Filtered trucks by search term
  const filteredTrucks = useMemo(() => {
    const q = truckSearch.toLowerCase().trim();
    if (!q) return availableTrucks.slice(0, 20);
    return availableTrucks.filter(t =>
      t.truck_number?.toLowerCase().includes(q) || t.driver_name?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [availableTrucks, truckSearch]);

  // Filtered customers by search term
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return (customersData ?? []).slice(0, 20);
    return (customersData ?? []).filter(c =>
      c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
    ).slice(0, 20);
  }, [customersData, customerSearch]);

  // Estimated udhar = gross_estimate - cash - upi
  const estimatedGross = useMemo(() => {
    return lineItems.reduce((sum, it) => {
      const bags = parseFloat(it.quantity_bags) || 0;
      if (it.rate_mode === 'PER_NAG') {
        return sum + bags * (parseFloat(it.rate_per_nag) || 0);
      }
      const wpb = parseFloat(it.weight_per_bag_kg) || 0;
      const r = parseFloat(it.rate_per_kg) || 0;
      return sum + (bags * wpb) * r;
    }, 0);
  }, [lineItems]);

  // Payment balance: positive = udhar owed, negative = overpayment
  const paymentBalance = useMemo(() => {
    const cash = parseFloat(cashAmount) || 0;
    const upi = parseFloat(upiAmount) || 0;
    return estimatedGross - cash - upi;
  }, [estimatedGross, cashAmount, upiAmount]);

  const udharAmount = Math.max(0, paymentBalance);
  const overpaidAmount = Math.max(0, -paymentBalance);

  // ── Add customer mutation ───────────────────────────────────────────────────
  const addCustomerMutation = useMutation({
    mutationFn: () => customersApi.create({ name: newCustName, phone: newCustPhone, address: newCustVillage }),
    onSuccess: (res: any) => {
      const newCust = res?.data;
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (newCust?.id) {
        setCustomerId(newCust.id);
        setCustomerName(newCust.name);
      }
      setAddCustModal(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustVillage('');
      setShowCustomerDropdown(false);
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  // ── Line item helpers ───────────────────────────────────────────────────────
  const addLineItem = () => {
    if (grades.length === 0) return Alert.alert('No Grades', 'No grade configs found.');
    const defaultSource = baardanaConfig?.baardana_provider ?? 'FIRM';
    const defaultBags = baardanaConfig?.default_bags != null ? String(baardanaConfig.default_bags) : '0';
    const defaultRateMode = baardanaConfig?.rate_mode ?? 'PER_KG';
    setLineItems(prev => [...prev, {
      grade_config_id: grades[0].id,
      grade_label: grades[0].grade_label,
      quantity_bags: '',
      weight_per_bag_kg: '',
      rate_per_kg: '',
      rate_per_nag: '',
      baardana_source: defaultSource,
      baardana_quantity: defaultBags,
      rate_mode: defaultRateMode,
    }]);
  };

  const setItemField = (i: number, key: keyof LineItemForm, value: string) =>
    setLineItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: value } : it));

  const selectGrade = (itemIdx: number, grade: { id: string; grade_code: string; grade_label: string }) => {
    setLineItems(prev => prev.map((it, idx) => idx === itemIdx
      ? { ...it, grade_config_id: grade.id, grade_label: grade.grade_label } : it));
    setShowGradePicker(null);
  };

  const removeItem = (i: number) => setLineItems(prev => prev.filter((_, idx) => idx !== i));

  // ── Main KC create mutation ─────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async () => {
      if (!customerId.trim()) throw new Error('Please select a customer');
      if (lineItems.length === 0) throw new Error('Add at least one line item');
      for (const it of lineItems) {
        if (!it.quantity_bags) throw new Error('Fill bag count for all items');
        if (it.rate_mode === 'PER_NAG') {
          if (!it.rate_per_nag) throw new Error('Fill rate per nag for all items');
        } else {
          if (!it.weight_per_bag_kg || !it.rate_per_kg) throw new Error('Fill weight per bag and rate for all items');
        }
      }

      const idempKey = `kc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const payload = {
        customer_id: customerId,
        sale_date: saleDate,
        line_items: lineItems.map((li, idx) => {
          const bags = parseInt(li.quantity_bags, 10) || 1;
          if (li.rate_mode === 'PER_NAG') {
            return {
              grade_config_id: li.grade_config_id,
              quantity_bags: bags,
              weight_per_bag_kg: undefined,
              total_weight_kg: 0,
              rate_per_kg: parseFloat(li.rate_per_nag) || 0,
              baardana_source: li.baardana_source,
              baardana_quantity: parseInt(li.baardana_quantity, 10) || 0,
              rate_mode: 'PER_NAG' as const,
              sort_order: idx,
            };
          }
          const wpb = parseFloat(li.weight_per_bag_kg) || 0;
          return {
            grade_config_id: li.grade_config_id,
            quantity_bags: bags,
            weight_per_bag_kg: wpb,
            total_weight_kg: parseFloat((bags * wpb).toFixed(3)),
            rate_per_kg: parseFloat(li.rate_per_kg) || 0,
            baardana_source: li.baardana_source,
            baardana_quantity: parseInt(li.baardana_quantity, 10) || 0,
            rate_mode: 'PER_KG' as const,
            sort_order: idx,
          };
        }),
        idempotency_key: idempKey,
        ...(truckId.trim() ? { truck_id: truckId.trim() } : {}),
      };
      const createRes = await kcsApi.create(payload);
      const kcId = createRes?.data?.id;
      if (!kcId) return createRes;

      // Add payment records if amounts are filled
      const today = new Date().toISOString().slice(0, 10);
      const cashAmt = parseFloat(cashAmount) || 0;
      const upiAmt = parseFloat(upiAmount) || 0;
      const balance = estimatedGross - cashAmt - upiAmt;
      const udharAmt = Math.max(0, balance); // only positive = actual udhar

      if (cashAmt > 0 && cashModeId) {
        await kcsApi.addPayment(kcId, {
          payment_mode_id: cashModeId, amount: cashAmt,
          payment_date: today,
          idempotency_key: `${idempKey}-cash`,
          is_udhar: false,
        }).catch(() => {}); // Non-blocking — KC is created
      }
      if (upiAmt > 0 && upiModeId) {
        await kcsApi.addPayment(kcId, {
          payment_mode_id: upiModeId, amount: upiAmt,
          payment_date: today,
          idempotency_key: `${idempKey}-upi`,
          is_udhar: false,
        }).catch(() => {});
      }
      // Only record udhar if customer hasn't overpaid
      if (udharAmt > 0 && udharModeId) {
        await kcsApi.addPayment(kcId, {
          payment_mode_id: udharModeId, amount: udharAmt,
          payment_date: today,
          idempotency_key: `${idempKey}-udhar`,
          is_udhar: true,
        }).catch(() => {});
      }

      return createRes;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['kcs'] });
      const kcNum = res?.data?.kc_number ?? res?.data?.id ?? 'KC';
      Alert.alert('KC Created ✅', `KC ${kcNum} created as DRAFT`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (e: any) => {
      const msg = e?.message ?? extractApiError(e);
      Alert.alert('Error', msg);
    },
  });

  if (gradesLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.loadingText}>Loading...</Text></View>;
  }

  return (
    <>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* ── Header card ─────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>KC Header</Text>

            {/* Customer search */}
            <Text style={styles.fieldLabel}>Customer * (search by name/phone)</Text>
            {customerId ? (
              <View style={styles.selectedCustomer}>
                <View style={styles.flex1}>
                  <Text style={styles.selectedCustomerName}>{customerName}</Text>
                </View>
                <TouchableOpacity onPress={() => { setCustomerId(''); setCustomerName(''); setCustomerSearch(''); }}>
                  <Text style={styles.clearBtn}>✕ Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={customerSearch}
                  onChangeText={v => { setCustomerSearch(v); setShowCustomerDropdown(true); }}
                  placeholder="Type name or phone number..."
                  placeholderTextColor={colors.textTertiary}
                  onFocus={() => setShowCustomerDropdown(true)}
                />
                {showCustomerDropdown && (
                  <View style={styles.dropdownList}>
                    {filteredCustomers.length === 0 ? (
                      <View style={styles.noResultRow}>
                        <Text style={styles.noResultText}>No customer found for "{customerSearch}"</Text>
                        <TouchableOpacity style={styles.addCustBtn} onPress={() => {
                          setNewCustPhone(customerSearch.match(/^\d+$/) ? customerSearch : '');
                          setNewCustName(!customerSearch.match(/^\d+$/) ? customerSearch : '');
                          setAddCustModal(true);
                        }}>
                          <Text style={styles.addCustBtnText}>+ Add New Customer</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        {filteredCustomers.map(c => (
                          <TouchableOpacity key={c.id} style={styles.dropdownItem} onPress={() => {
                            setCustomerId(c.id);
                            setCustomerName(c.name);
                            setShowCustomerDropdown(false);
                            setCustomerSearch('');
                          }}>
                            <Text style={styles.dropdownItemText}>{c.name}</Text>
                            {c.phone && <Text style={styles.dropdownItemSub}>{c.phone}</Text>}
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.addCustInlineBtn} onPress={() => {
                          setNewCustPhone(customerSearch.match(/^\d+$/) ? customerSearch : '');
                          setNewCustName(!customerSearch.match(/^\d+$/) ? customerSearch : '');
                          setAddCustModal(true);
                        }}>
                          <Text style={styles.addCustInlineBtnText}>+ New Customer</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}
              </>
            )}

            <FormField label="Sale Date *" value={saleDate} onChangeText={setSaleDate} placeholder="YYYY-MM-DD" />

            {/* Truck searchable dropdown */}
            <Text style={styles.fieldLabel}>Truck (optional — ARRIVED/SCHEDULED)</Text>
            {truckId ? (
              <View style={styles.selectedCustomer}>
                <View style={styles.flex1}>
                  <Text style={styles.selectedCustomerName}>{truckLabel}</Text>
                </View>
                <TouchableOpacity onPress={() => { setTruckId(''); setTruckLabel(''); setTruckSearch(''); }}>
                  <Text style={styles.clearBtn}>✕ Clear</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={truckSearch}
                  onChangeText={v => { setTruckSearch(v); setShowTruckDropdown(true); }}
                  placeholder="Search by truck number or driver..."
                  placeholderTextColor={colors.textTertiary}
                  onFocus={() => setShowTruckDropdown(true)}
                />
                {showTruckDropdown && (
                  <View style={styles.dropdownList}>
                    {availableTrucks.length === 0 ? (
                      <Text style={[styles.noResultText, { padding: spacing[3] }]}>No ARRIVED/SCHEDULED trucks</Text>
                    ) : filteredTrucks.length === 0 ? (
                      <Text style={[styles.noResultText, { padding: spacing[3] }]}>No match for "{truckSearch}"</Text>
                    ) : (
                      filteredTrucks.map(t => (
                        <TouchableOpacity key={t.id} style={styles.dropdownItem} onPress={() => {
                          setTruckId(t.id);
                          setTruckLabel(`${t.truck_number} — ${t.driver_name} (${t.status})`);
                          setShowTruckDropdown(false);
                          setTruckSearch('');
                        }}>
                          <Text style={styles.dropdownItemText}>{t.truck_number}</Text>
                          <Text style={styles.dropdownItemSub}>{t.driver_name} · {t.status}</Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </>
            )}
          </View>

          {/* ── Rate Mode Banner (firm-configured, locked by SA) ── */}
          {baardanaConfig && (
            <View style={[styles.rateModeBar, baardanaConfig.rate_mode === 'PER_NAG' ? styles.rateModeBarNag : styles.rateModeBarKg]}>
              <Text style={styles.rateModeBarIcon}>{baardanaConfig.rate_mode === 'PER_NAG' ? '🎒' : '⚖️'}</Text>
              <View style={styles.flex1}>
                <Text style={styles.rateModeBarTitle}>
                  {baardanaConfig.rate_mode === 'PER_NAG' ? 'Rate per Nag (Bardana)' : 'Rate per KG'}
                </Text>
                <Text style={styles.rateModeBarHint}>
                  {baardanaConfig.rate_mode === 'PER_NAG'
                    ? 'Gross = Bags × Rate/nag — no weight required'
                    : 'Gross = Bags × Weight × Rate/kg'}
                </Text>
              </View>
              <Text style={styles.rateModeBarLock}>🔒 SA</Text>
            </View>
          )}

          {/* ── Line items ──────────────────────────────────────── */}
          {lineItems.map((item, i) => (
            <View key={i} style={styles.card}>
              <View style={styles.itemHeader}>
                <Text style={styles.sectionTitle}>Item {i + 1}</Text>
                <TouchableOpacity onPress={() => removeItem(i)}>
                  <Text style={styles.removeBtn}>✕ Remove</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Grade *</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowGradePicker(showGradePicker === i ? null : i)}>
                <Text style={styles.pickerBtnText}>{item.grade_label}</Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </TouchableOpacity>
              {showGradePicker === i && (
                <View style={styles.dropdownList}>
                  {grades.map(g => (
                    <TouchableOpacity key={g.id} style={styles.dropdownItem} onPress={() => selectGrade(i, g)}>
                      <Text style={styles.dropdownItemText}>{g.grade_label}</Text>
                      <Text style={styles.dropdownItemSub}>{g.grade_code}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <FormField label="Bags *" value={item.quantity_bags} onChangeText={v => setItemField(i, 'quantity_bags', v)} keyboardType="number-pad" placeholder="Number of bags" />

              {item.rate_mode === 'PER_NAG' ? (
                <>
                  {/* PER_NAG: only rate per bag, no weight needed */}
                  <View style={styles.rateModeTag}>
                    <Text style={styles.rateModeTagText}>🎒 Rate per Nag mode</Text>
                  </View>
                  <FormField label="Rate per Nag (₹) *" value={item.rate_per_nag} onChangeText={v => setItemField(i, 'rate_per_nag', v)} keyboardType="decimal-pad" placeholder="e.g. 500" />
                  {!!item.quantity_bags && !!item.rate_per_nag && (
                    <View style={styles.calcRow}>
                      <Text style={styles.calcLabel}>Est. Gross</Text>
                      <Text style={styles.calcValue}>
                        ₹{((parseFloat(item.quantity_bags) || 0) * (parseFloat(item.rate_per_nag) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  {/* PER_KG: weight + rate per kg */}
                  <FormField label="Weight per Bag (kg) *" value={item.weight_per_bag_kg} onChangeText={v => setItemField(i, 'weight_per_bag_kg', v)} keyboardType="decimal-pad" placeholder="e.g. 50.5" />
                  {!!item.quantity_bags && !!item.weight_per_bag_kg && (
                    <View style={styles.calcRow}>
                      <Text style={styles.calcLabel}>Total Weight</Text>
                      <Text style={styles.calcValue}>
                        {((parseFloat(item.quantity_bags) || 0) * (parseFloat(item.weight_per_bag_kg) || 0)).toFixed(2)} kg
                      </Text>
                    </View>
                  )}
                  <FormField label="Rate per kg (₹) *" value={item.rate_per_kg} onChangeText={v => setItemField(i, 'rate_per_kg', v)} keyboardType="decimal-pad" placeholder="e.g. 25.50" />
                </>
              )}

              <Text style={styles.fieldLabel}>Baardana Provided By</Text>
              <View style={styles.modeRow}>
                {(['FIRM', 'CUSTOMER'] as const).map(s => (
                  <TouchableOpacity key={s} style={[styles.modeChip, item.baardana_source === s && styles.modeChipActive]} onPress={() => setItemField(i, 'baardana_source', s)}>
                    <Text style={[styles.modeChipText, item.baardana_source === s && styles.modeChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <FormField label="Baardana Bags" value={item.baardana_quantity} onChangeText={v => setItemField(i, 'baardana_quantity', v)} keyboardType="number-pad" placeholder="0" />
            </View>
          ))}

          <TouchableOpacity style={styles.addItemBtn} onPress={addLineItem}>
            <Text style={styles.addItemText}>+ Add Line Item</Text>
          </TouchableOpacity>

          {/* ── Payment modes ──────────────────────────────────── */}
          {lineItems.length > 0 && estimatedGross > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Payment (Optional)</Text>
              <Text style={styles.estimateRow}>Est. Gross: ₹{estimatedGross.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>

              <FormField
                label="💵 Cash Amount (₹)"
                value={cashAmount}
                onChangeText={setCashAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
              <FormField
                label="📱 UPI Amount (₹)"
                value={upiAmount}
                onChangeText={setUpiAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />

              {/* Payment status — udhar / settled / overpayment */}
              {paymentBalance > 0.005 ? (
                <View style={styles.udharRow}>
                  <Text style={styles.udharLabel}>🔄 Udhar (deferred)</Text>
                  <Text style={styles.udharAmount}>₹{udharAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                </View>
              ) : paymentBalance < -0.005 ? (
                <View style={styles.overpayRow}>
                  <View style={styles.overpayLeft}>
                    <Text style={styles.overpayLabel}>✅ Overpayment</Text>
                    <Text style={styles.overpayHint}>Extra amount will reduce customer's udhar balance</Text>
                  </View>
                  <Text style={styles.overpayAmount}>₹{overpaidAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                </View>
              ) : (
                <View style={styles.settledRow}>
                  <Text style={styles.settledText}>✓ Fully Settled — No Udhar</Text>
                </View>
              )}

              {paymentModes.length === 0 && (
                <Text style={styles.paymentWarning}>⚠️ Payment modes not configured — payments will be skipped</Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, (!customerId || lineItems.length === 0 || mutation.isPending) && styles.btnDisabled]}
            onPress={() => mutation.mutate()}
            disabled={!customerId || lineItems.length === 0 || mutation.isPending}
          >
            <Text style={styles.submitText}>{mutation.isPending ? 'Creating...' : '📋 Create KC (Draft)'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Add New Customer Modal ───────────────────────────── */}
      <Modal visible={addCustModal} transparent animationType="slide" onRequestClose={() => setAddCustModal(false)}>
        <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Add New Customer</Text>

              <Text style={styles.fieldLabel}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={newCustName}
                onChangeText={setNewCustName}
                placeholder="e.g. Ramesh Patel"
                placeholderTextColor={colors.textTertiary}
                autoFocus={!newCustName}
              />

              <Text style={styles.fieldLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={newCustPhone}
                onChangeText={setNewCustPhone}
                placeholder="10-digit mobile"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
                maxLength={10}
              />

              <Text style={styles.fieldLabel}>Village / Area (optional)</Text>
              <TextInput
                style={styles.input}
                value={newCustVillage}
                onChangeText={setNewCustVillage}
                placeholder="e.g. Jhajjar"
                placeholderTextColor={colors.textTertiary}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAddCustModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, (!newCustName || addCustomerMutation.isPending) && styles.btnDisabled]}
                  onPress={() => addCustomerMutation.mutate()}
                  disabled={!newCustName || addCustomerMutation.isPending}
                >
                  <Text style={styles.modalSubmitText}>{addCustomerMutation.isPending ? 'Adding...' : 'Add Customer'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function FormField({ label, ...props }: { label: string } & any) {
  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={fieldStyles.input}
        placeholderTextColor={colors.textMuted}
        {...props}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: { marginBottom: spacing[3] },
  label: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textSecondary, marginBottom: spacing[1] },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontSize: typography.size.base, color: colors.textPrimary, backgroundColor: colors.surfaceMuted },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[10] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing[3] },
  loadingText: { color: colors.textSecondary },
  card: { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: spacing[5], borderWidth: 0.5, borderColor: colors.border, ...shadow.sm },
  sectionTitle: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.textMuted, marginBottom: spacing[4], textTransform: 'uppercase', letterSpacing: 0.6 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  removeBtn: { fontSize: typography.size.sm, color: colors.danger, fontWeight: typography.weight.medium },
  fieldLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textSecondary, marginBottom: spacing[1] },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontSize: typography.size.base, color: colors.textPrimary, backgroundColor: colors.surfaceMuted, marginBottom: spacing[3] },
  selectedCustomer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing[3], marginBottom: spacing[3], borderWidth: 1, borderColor: colors.primary },
  selectedCustomerName: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.primary },
  clearBtn: { fontSize: typography.size.sm, color: colors.textSecondary },
  dropdownList: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing[3], maxHeight: 220, overflow: 'hidden', ...shadow.md },
  dropdownItem: { padding: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  dropdownItemText: { fontSize: typography.size.base, color: colors.textPrimary, fontWeight: typography.weight.medium },
  dropdownItemSub: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  noResultRow: { padding: spacing[3] },
  noResultText: { color: colors.textSecondary, marginBottom: spacing[2] },
  addCustBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: spacing[2], paddingHorizontal: spacing[3], alignSelf: 'flex-start' },
  addCustBtnText: { color: colors.textInverse, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  addCustInlineBtn: { padding: spacing[3], backgroundColor: colors.surfaceMuted, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  addCustInlineBtnText: { color: colors.primary, fontWeight: typography.weight.semibold, textAlign: 'center' },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3], backgroundColor: colors.surfaceMuted, marginBottom: spacing[3] },
  pickerBtnText: { fontSize: typography.size.base, color: colors.textPrimary, flex: 1 },
  pickerArrow: { fontSize: typography.size.sm, color: colors.textMuted },
  modeRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  modeChip: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing[2], alignItems: 'center' },
  modeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeChipText: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium },
  modeChipTextActive: { color: colors.textInverse },
  rateModeTag: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[1], alignSelf: 'flex-start', marginBottom: spacing[2] },
  rateModeTagText: { fontSize: typography.size.xs, color: '#16a34a', fontWeight: typography.weight.semibold },
  // Rate mode banner (firm-wide, locked by SA)
  rateModeBar: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginHorizontal: spacing[4], marginBottom: spacing[3], borderRadius: radius.xl, padding: spacing[4], borderWidth: 1 },
  rateModeBarKg: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  rateModeBarNag: { backgroundColor: '#fdf4ff', borderColor: '#e9d5ff' },
  rateModeBarIcon: { fontSize: 24 },
  rateModeBarTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: '#1e293b' },
  rateModeBarHint: { fontSize: typography.size.xs, color: '#64748b', marginTop: 2 },
  rateModeBarLock: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: '#94a3b8' },
  addItemBtn: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center', borderStyle: 'dashed' },
  addItemText: { color: colors.primary, fontWeight: typography.weight.medium },
  estimateRow: { fontSize: typography.size.sm, color: colors.textSecondary, marginBottom: spacing[3] },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[2], marginBottom: spacing[3] },
  calcLabel: { fontSize: typography.size.sm, color: colors.textSecondary },
  calcValue: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primary },
  udharRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing[3], marginBottom: spacing[3] },
  udharLabel: { fontSize: typography.size.sm, color: colors.textSecondary },
  udharAmount: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.warning },
  overpayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: radius.md, padding: spacing[3], marginBottom: spacing[3], borderWidth: 1, borderColor: '#bbf7d0' },
  overpayLeft: { flex: 1, marginRight: spacing[3] },
  overpayLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: '#15803d' },
  overpayHint: { fontSize: typography.size.xs, color: '#22c55e', marginTop: 2 },
  overpayAmount: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#16a34a' },
  settledRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: radius.md, padding: spacing[3], marginBottom: spacing[3], borderWidth: 1, borderColor: '#bbf7d0' },
  settledText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: '#15803d' },
  paymentWarning: { fontSize: typography.size.xs, color: colors.warning, marginTop: spacing[1] },
  submitBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing[4], alignItems: 'center', ...shadow.md },
  btnDisabled: { opacity: 0.5 },
  submitText: { color: colors.textInverse, fontSize: typography.size.base, fontWeight: typography.weight.semibold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surfaceRaised, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[6], gap: spacing[3] },
  modalTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.textPrimary, marginBottom: spacing[2] },
  modalActions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  modalCancelText: { color: colors.textSecondary, fontWeight: typography.weight.medium },
  modalSubmitBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  modalSubmitText: { color: colors.textInverse, fontWeight: typography.weight.semibold },
  flex1: { flex: 1 },
});
