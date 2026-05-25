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
import { useNetworkState } from '../../hooks/useNetworkState';
import { offlineQueue } from '../../offline/queue';
import type { LinkedOp } from '../../offline/queue';

type Nav = NativeStackNavigationProp<KCStackParamList>;

interface LineItemForm {
  grade_config_id: string;
  grade_label: string;
  quantity_bags: string;
  weight_per_bag_kg: string;
  rate_per_kg: string;
  rate_per_nag: string;
  baardana_source: 'FIRM' | 'CUSTOMER';
  baardana_quantity: string;
  rate_mode: 'PER_KG' | 'PER_NAG';
}

interface PaymentMode { id: string; mode_code: string; mode_label: string; }

const STEPS = ['👤 Buyer & Truck', '📦 Items', '💰 Payment'];

export function KCCreateScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const { isOnline } = useNetworkState();

  // Wizard step
  const [step, setStep] = useState(0);

  // Step 1 state
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [saleDate, setSaleDate] = useState(today);
  const [truckId, setTruckId] = useState('');
  const [truckLabel, setTruckLabel] = useState('');
  const [truckSearch, setTruckSearch] = useState('');
  const [showTruckDropdown, setShowTruckDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [addCustModal, setAddCustModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustVillage, setNewCustVillage] = useState('');

  // Step 2 state
  const [lineItems, setLineItems] = useState<LineItemForm[]>([]);
  const [showGradePicker, setShowGradePicker] = useState<number | null>(null);

  // Step 3 state
  const [cashAmount, setCashAmount] = useState('');
  const [upiAmount, setUpiAmount] = useState('');
  const [cashModeId, setCashModeId] = useState('');
  const [upiModeId, setUpiModeId] = useState('');
  const [udharModeId, setUdharModeId] = useState('');

  // Data fetching
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
      modes.forEach(m => {
        if (m.mode_code?.toUpperCase() === 'CASH') setCashModeId(m.id);
        else if (m.mode_code?.toUpperCase() === 'UPI') setUpiModeId(m.id);
        else if (m.mode_code?.toUpperCase() === 'UDHAR') setUdharModeId(m.id);
      });
      return modes;
    },
    staleTime: 60000,
  });

  const { data: baardanaConfig } = useQuery({
    queryKey: ['baardana-config'],
    queryFn: async () => {
      const { data } = await configApi.getBaardanaConfig();
      return data as { baardana_provider: 'FIRM' | 'CUSTOMER'; default_bags: number; cost_per_unit: string | null; rate_mode: 'PER_KG' | 'PER_NAG' };
    },
    staleTime: 300000,
  });

  const grades = gradesData ?? [];
  const paymentModes = paymentModesData ?? [];
  const availableTrucks = trucksData ?? [];

  const filteredTrucks = useMemo(() => {
    const q = truckSearch.toLowerCase().trim();
    if (!q) return availableTrucks.slice(0, 20);
    return availableTrucks.filter(t =>
      t.truck_number?.toLowerCase().includes(q) || t.driver_name?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [availableTrucks, truckSearch]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return (customersData ?? []).slice(0, 20);
    return (customersData ?? []).filter(c =>
      c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
    ).slice(0, 20);
  }, [customersData, customerSearch]);

  const estimatedGross = useMemo(() => {
    return lineItems.reduce((sum, it) => {
      const bags = parseFloat(it.quantity_bags) || 0;
      if (it.rate_mode === 'PER_NAG') return sum + bags * (parseFloat(it.rate_per_nag) || 0);
      const wpb = parseFloat(it.weight_per_bag_kg) || 0;
      return sum + (bags * wpb) * (parseFloat(it.rate_per_kg) || 0);
    }, 0);
  }, [lineItems]);

  const paymentBalance = useMemo(() => {
    const cash = parseFloat(cashAmount) || 0;
    const upi = parseFloat(upiAmount) || 0;
    return estimatedGross - cash - upi;
  }, [estimatedGross, cashAmount, upiAmount]);

  const udharAmount = Math.max(0, paymentBalance);
  const overpaidAmount = Math.max(0, -paymentBalance);

  const addCustomerMutation = useMutation({
    mutationFn: () => customersApi.create({ name: newCustName, phone: newCustPhone, address: newCustVillage }),
    onSuccess: (res: any) => {
      const newCust = res?.data;
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (newCust?.id) { setCustomerId(newCust.id); setCustomerName(newCust.name); }
      setAddCustModal(false); setNewCustName(''); setNewCustPhone(''); setNewCustVillage('');
      setShowCustomerDropdown(false);
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const addLineItem = () => {
    if (grades.length === 0) return Alert.alert('No Grades', 'No grade configs found for this firm.');
    const defaultSource = baardanaConfig?.baardana_provider ?? 'FIRM';
    const defaultBags = baardanaConfig?.default_bags != null ? String(baardanaConfig.default_bags) : '0';
    const defaultRateMode = baardanaConfig?.rate_mode ?? 'PER_KG';
    setLineItems(prev => [...prev, {
      grade_config_id: grades[0].id, grade_label: grades[0].grade_label,
      quantity_bags: '', weight_per_bag_kg: '', rate_per_kg: '', rate_per_nag: '',
      baardana_source: defaultSource, baardana_quantity: defaultBags, rate_mode: defaultRateMode,
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
        customer_id: customerId, sale_date: saleDate,
        line_items: lineItems.map((li, idx) => {
          const bags = parseInt(li.quantity_bags, 10) || 1;
          if (li.rate_mode === 'PER_NAG') {
            return { grade_config_id: li.grade_config_id, quantity_bags: bags, weight_per_bag_kg: undefined,
              total_weight_kg: 0, rate_per_kg: parseFloat(li.rate_per_nag) || 0,
              baardana_source: li.baardana_source, baardana_quantity: parseInt(li.baardana_quantity, 10) || 0,
              rate_mode: 'PER_NAG' as const, sort_order: idx };
          }
          const wpb = parseFloat(li.weight_per_bag_kg) || 0;
          return { grade_config_id: li.grade_config_id, quantity_bags: bags, weight_per_bag_kg: wpb,
            total_weight_kg: parseFloat((bags * wpb).toFixed(3)),
            rate_per_kg: parseFloat(li.rate_per_kg) || 0,
            baardana_source: li.baardana_source, baardana_quantity: parseInt(li.baardana_quantity, 10) || 0,
            rate_mode: 'PER_KG' as const, sort_order: idx };
        }),
        idempotency_key: idempKey,
        ...(truckId.trim() ? { truck_id: truckId.trim() } : {}),
      };

      if (!isOnline) {
        const paymentDate = new Date().toISOString().slice(0, 10);
        const cashAmt = parseFloat(cashAmount) || 0;
        const upiAmt = parseFloat(upiAmount) || 0;
        const udharAmt = Math.max(0, estimatedGross - cashAmt - upiAmt);
        const linkedOps: LinkedOp[] = [];
        if (cashAmt > 0 && cashModeId) linkedOps.push({ method: 'POST', endpoint_template: '/kcs/{id}/payments',
          payload: { payment_mode_id: cashModeId, amount: cashAmt, payment_date: paymentDate, idempotency_key: `${idempKey}-cash`, is_udhar: false }, idempotency_key: `${idempKey}-cash` });
        if (upiAmt > 0 && upiModeId) linkedOps.push({ method: 'POST', endpoint_template: '/kcs/{id}/payments',
          payload: { payment_mode_id: upiModeId, amount: upiAmt, payment_date: paymentDate, idempotency_key: `${idempKey}-upi`, is_udhar: false }, idempotency_key: `${idempKey}-upi` });
        if (udharAmt > 0 && udharModeId) linkedOps.push({ method: 'POST', endpoint_template: '/kcs/{id}/payments',
          payload: { payment_mode_id: udharModeId, amount: udharAmt, payment_date: paymentDate, idempotency_key: `${idempKey}-udhar`, is_udhar: true }, idempotency_key: `${idempKey}-udhar` });
        await offlineQueue.enqueue('POST', '/kcs', payload, idempKey, linkedOps.length > 0 ? linkedOps : undefined);
        return null;
      }

      const createRes = await kcsApi.create(payload);
      const kcId = createRes?.data?.id;
      if (!kcId) return createRes;

      const paymentDate = new Date().toISOString().slice(0, 10);
      const cashAmt = parseFloat(cashAmount) || 0;
      const upiAmt = parseFloat(upiAmount) || 0;
      const udharAmt = Math.max(0, estimatedGross - cashAmt - upiAmt);

      if (cashAmt > 0 && cashModeId) await kcsApi.addPayment(kcId, { payment_mode_id: cashModeId, amount: cashAmt, payment_date: paymentDate, idempotency_key: `${idempKey}-cash`, is_udhar: false }).catch(() => {});
      if (upiAmt > 0 && upiModeId) await kcsApi.addPayment(kcId, { payment_mode_id: upiModeId, amount: upiAmt, payment_date: paymentDate, idempotency_key: `${idempKey}-upi`, is_udhar: false }).catch(() => {});
      if (udharAmt > 0 && udharModeId) await kcsApi.addPayment(kcId, { payment_mode_id: udharModeId, amount: udharAmt, payment_date: paymentDate, idempotency_key: `${idempKey}-udhar`, is_udhar: true }).catch(() => {});

      return createRes;
    },
    onSuccess: (res) => {
      if (!res) {
        Alert.alert('Saved Offline 📶', 'KC will be submitted when you reconnect.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['kcs'] });
      Alert.alert('KC Banaya ✅', `KC ${res?.data?.kc_number ?? ''} Draft mein save hua`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    },
    onError: (e: any) => Alert.alert('Error', e?.message ?? extractApiError(e)),
  });

  if (gradesLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.hint}>Loading...</Text></View>;
  }

  return (
    <>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* ── Progress Bar ── */}
        <View style={styles.progressBar}>
          {STEPS.map((label, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.stepBtn, idx <= step && styles.stepBtnActive]}
              onPress={() => idx < step && setStep(idx)}
              disabled={idx > step}
            >
              <View style={[styles.stepDot, idx < step ? styles.stepDotDone : idx === step ? styles.stepDotActive : styles.stepDotInactive]}>
                <Text style={[styles.stepDotText, idx <= step && styles.stepDotTextActive]}>
                  {idx < step ? '✓' : String(idx + 1)}
                </Text>
              </View>
              <Text style={[styles.stepLabel, idx === step && styles.stepLabelActive]} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* ══════════ STEP 1: Buyer & Truck ══════════ */}
          {step === 0 && (
            <>
              {/* Customer search */}
              <View style={styles.section}>
                <Text style={styles.sectionIcon}>👤</Text>
                <Text style={styles.sectionTitle}>Kharidaar (Buyer) *</Text>
              </View>

              {customerId ? (
                <View style={styles.selectedChip}>
                  <Text style={styles.selectedEmoji}>✓</Text>
                  <Text style={styles.selectedText}>{customerName}</Text>
                  <TouchableOpacity onPress={() => { setCustomerId(''); setCustomerName(''); setCustomerSearch(''); }}>
                    <Text style={styles.changeBtn}>Badlo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.inputGroup}>
                  <TextInput
                    style={styles.bigInput}
                    value={customerSearch}
                    onChangeText={v => { setCustomerSearch(v); setShowCustomerDropdown(true); }}
                    placeholder="Naam ya phone number likho..."
                    placeholderTextColor={colors.textMuted}
                    onFocus={() => setShowCustomerDropdown(true)}
                  />
                  {showCustomerDropdown && (
                    <View style={styles.dropList}>
                      {filteredCustomers.length === 0 ? (
                        <View style={styles.dropEmpty}>
                          <Text style={styles.dropEmptyText}>"{customerSearch}" nahi mila</Text>
                          <TouchableOpacity style={styles.addBtn} onPress={() => {
                            setNewCustPhone(customerSearch.match(/^\d+$/) ? customerSearch : '');
                            setNewCustName(!customerSearch.match(/^\d+$/) ? customerSearch : '');
                            setAddCustModal(true);
                          }}>
                            <Text style={styles.addBtnText}>+ Naya Kharidaar Banao</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          {filteredCustomers.map(c => (
                            <TouchableOpacity key={c.id} style={styles.dropItem} onPress={() => {
                              setCustomerId(c.id); setCustomerName(c.name);
                              setShowCustomerDropdown(false); setCustomerSearch('');
                            }}>
                              <Text style={styles.dropItemName}>{c.name}</Text>
                              {c.phone && <Text style={styles.dropItemSub}>{c.phone}{c.village ? ` · ${c.village}` : ''}</Text>}
                            </TouchableOpacity>
                          ))}
                          <TouchableOpacity style={styles.addInlineBtn} onPress={() => {
                            setNewCustPhone(customerSearch.match(/^\d+$/) ? customerSearch : '');
                            setNewCustName(!customerSearch.match(/^\d+$/) ? customerSearch : '');
                            setAddCustModal(true);
                          }}>
                            <Text style={styles.addInlineBtnText}>+ Naya Kharidaar Banao</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionIcon}>📅</Text>
                <Text style={styles.sectionTitle}>Bikri ki Tarikh *</Text>
              </View>
              <TextInput
                style={styles.bigInput}
                value={saleDate}
                onChangeText={setSaleDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
              />

              <View style={styles.section}>
                <Text style={styles.sectionIcon}>🚛</Text>
                <Text style={styles.sectionTitle}>Truck (Zaruri nahi)</Text>
              </View>

              {truckId ? (
                <View style={styles.selectedChip}>
                  <Text style={styles.selectedEmoji}>🚛</Text>
                  <Text style={styles.selectedText} numberOfLines={1}>{truckLabel}</Text>
                  <TouchableOpacity onPress={() => { setTruckId(''); setTruckLabel(''); setTruckSearch(''); }}>
                    <Text style={styles.changeBtn}>Hatao</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.inputGroup}>
                  <TextInput
                    style={styles.bigInput}
                    value={truckSearch}
                    onChangeText={v => { setTruckSearch(v); setShowTruckDropdown(true); }}
                    placeholder="Truck number ya driver ka naam..."
                    placeholderTextColor={colors.textMuted}
                    onFocus={() => setShowTruckDropdown(true)}
                  />
                  {showTruckDropdown && (
                    <View style={styles.dropList}>
                      {availableTrucks.length === 0 ? (
                        <Text style={[styles.dropEmptyText, { padding: spacing[3] }]}>Koi ARRIVED/SCHEDULED truck nahi</Text>
                      ) : filteredTrucks.length === 0 ? (
                        <Text style={[styles.dropEmptyText, { padding: spacing[3] }]}>Koi match nahi "{truckSearch}"</Text>
                      ) : (
                        filteredTrucks.map(t => (
                          <TouchableOpacity key={t.id} style={styles.dropItem} onPress={() => {
                            setTruckId(t.id);
                            setTruckLabel(`${t.truck_number} — ${t.driver_name} (${t.status})`);
                            setShowTruckDropdown(false); setTruckSearch('');
                          }}>
                            <Text style={styles.dropItemName}>{t.truck_number}</Text>
                            <Text style={styles.dropItemSub}>{t.driver_name} · {t.status}</Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[styles.nextBtn, !customerId && styles.btnDisabled]}
                onPress={() => setStep(1)}
                disabled={!customerId}
              >
                <Text style={styles.nextBtnText}>Aage Badho → Items</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ══════════ STEP 2: Items ══════════ */}
          {step === 1 && (
            <>
              {/* Rate mode info banner */}
              {baardanaConfig && (
                <View style={[styles.infoBanner, baardanaConfig.rate_mode === 'PER_NAG' ? styles.infoBannerPurple : styles.infoBannerBlue]}>
                  <Text style={styles.infoBannerIcon}>{baardanaConfig.rate_mode === 'PER_NAG' ? '🎒' : '⚖️'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoBannerTitle}>
                      {baardanaConfig.rate_mode === 'PER_NAG' ? 'Rate per Nag (Theli/Bori)' : 'Rate per KG'}
                    </Text>
                    <Text style={styles.infoBannerSub}>
                      {baardanaConfig.rate_mode === 'PER_NAG' ? 'Total = Bag × Rate' : 'Total = Bag × Wajan × Rate'}
                    </Text>
                  </View>
                </View>
              )}

              {lineItems.length === 0 && (
                <View style={styles.emptyItems}>
                  <Text style={styles.emptyItemsIcon}>📦</Text>
                  <Text style={styles.emptyItemsText}>Koi item nahi — neeche "+ Item Jodo" dabao</Text>
                </View>
              )}

              {lineItems.map((item, i) => (
                <View key={i} style={styles.itemCard}>
                  {/* Item header */}
                  <View style={styles.itemCardHeader}>
                    <Text style={styles.itemNum}>📦 Item {i + 1}</Text>
                    <TouchableOpacity onPress={() => removeItem(i)} style={styles.removeChip}>
                      <Text style={styles.removeChipText}>✕ Hatao</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Grade picker */}
                  <Text style={styles.fieldLabel}>Grade (Maal ki Quality)</Text>
                  <TouchableOpacity style={styles.pickerRow} onPress={() => setShowGradePicker(showGradePicker === i ? null : i)}>
                    <Text style={styles.pickerVal}>{item.grade_label}</Text>
                    <Text style={styles.pickerArrow}>{showGradePicker === i ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {showGradePicker === i && (
                    <View style={styles.dropList}>
                      {grades.map(g => (
                        <TouchableOpacity key={g.id} style={styles.dropItem} onPress={() => selectGrade(i, g)}>
                          <Text style={styles.dropItemName}>{g.grade_label}</Text>
                          <Text style={styles.dropItemSub}>{g.grade_code}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Bags */}
                  <Text style={styles.fieldLabel}>Kitne Bag / Bori *</Text>
                  <TextInput style={styles.bigInput} value={item.quantity_bags} onChangeText={v => setItemField(i, 'quantity_bags', v)} keyboardType="number-pad" placeholder="e.g. 10" placeholderTextColor={colors.textMuted} />

                  {item.rate_mode === 'PER_NAG' ? (
                    <>
                      <Text style={styles.fieldLabel}>Rate per Bori (₹) *</Text>
                      <TextInput style={styles.bigInput} value={item.rate_per_nag} onChangeText={v => setItemField(i, 'rate_per_nag', v)} keyboardType="decimal-pad" placeholder="e.g. 500" placeholderTextColor={colors.textMuted} />
                      {!!item.quantity_bags && !!item.rate_per_nag && (
                        <View style={styles.calcBox}>
                          <Text style={styles.calcLabel}>Anumaan Rakam</Text>
                          <Text style={styles.calcValue}>₹{((parseFloat(item.quantity_bags)||0)*(parseFloat(item.rate_per_nag)||0)).toLocaleString('en-IN',{maximumFractionDigits:2})}</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={styles.fieldLabel}>Ek Bag ka Wajan (kg) *</Text>
                      <TextInput style={styles.bigInput} value={item.weight_per_bag_kg} onChangeText={v => setItemField(i, 'weight_per_bag_kg', v)} keyboardType="decimal-pad" placeholder="e.g. 50" placeholderTextColor={colors.textMuted} />
                      {!!item.quantity_bags && !!item.weight_per_bag_kg && (
                        <View style={styles.calcBox}>
                          <Text style={styles.calcLabel}>Kul Wajan</Text>
                          <Text style={styles.calcValue}>{((parseFloat(item.quantity_bags)||0)*(parseFloat(item.weight_per_bag_kg)||0)).toFixed(2)} kg</Text>
                        </View>
                      )}
                      <Text style={styles.fieldLabel}>Rate per KG (₹) *</Text>
                      <TextInput style={styles.bigInput} value={item.rate_per_kg} onChangeText={v => setItemField(i, 'rate_per_kg', v)} keyboardType="decimal-pad" placeholder="e.g. 25.50" placeholderTextColor={colors.textMuted} />
                    </>
                  )}

                  {/* Baardana */}
                  <Text style={styles.fieldLabel}>Baardana (Bag) Kiska?</Text>
                  <View style={styles.toggleRow}>
                    {(['FIRM', 'CUSTOMER'] as const).map(s => (
                      <TouchableOpacity key={s} style={[styles.toggleBtn, item.baardana_source === s && styles.toggleBtnActive]} onPress={() => setItemField(i, 'baardana_source', s)}>
                        <Text style={[styles.toggleText, item.baardana_source === s && styles.toggleTextActive]}>
                          {s === 'FIRM' ? '🏢 Hamara (Firm)' : '🚛 Driver ka'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.fieldLabel}>Baardana Bags</Text>
                  <TextInput style={styles.bigInput} value={item.baardana_quantity} onChangeText={v => setItemField(i, 'baardana_quantity', v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textMuted} />
                </View>
              ))}

              <TouchableOpacity style={styles.addItemBtn} onPress={addLineItem}>
                <Text style={styles.addItemText}>＋ Item Jodo</Text>
              </TouchableOpacity>

              {estimatedGross > 0 && (
                <View style={styles.grossBanner}>
                  <Text style={styles.grossLabel}>Anumaan Total</Text>
                  <Text style={styles.grossValue}>₹{estimatedGross.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                </View>
              )}

              <View style={styles.navRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(0)}>
                  <Text style={styles.backBtnText}>← Wapas</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nextBtn, { flex: 1 }, lineItems.length === 0 && styles.btnDisabled]}
                  onPress={() => setStep(2)}
                  disabled={lineItems.length === 0}
                >
                  <Text style={styles.nextBtnText}>Aage → Payment</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ══════════ STEP 3: Payment ══════════ */}
          {step === 2 && (
            <>
              {/* Summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryRow}>👤 {customerName}</Text>
                {truckLabel ? <Text style={styles.summarySub}>🚛 {truckLabel}</Text> : null}
                <Text style={styles.summarySub}>📅 {saleDate} · {lineItems.length} item{lineItems.length !== 1 ? 's' : ''}</Text>
                <View style={styles.grossBanner}>
                  <Text style={styles.grossLabel}>Anumaan Total</Text>
                  <Text style={styles.grossValue}>₹{estimatedGross.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionIcon}>💰</Text>
                <Text style={styles.sectionTitle}>Abhi Kitna Mila?</Text>
              </View>

              <Text style={styles.fieldLabel}>💵 Cash (₹)</Text>
              <TextInput style={styles.bigInput} value={cashAmount} onChangeText={setCashAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textMuted} />

              <Text style={styles.fieldLabel}>📱 UPI (₹)</Text>
              <TextInput style={styles.bigInput} value={upiAmount} onChangeText={setUpiAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textMuted} />

              {/* Balance status */}
              {paymentBalance > 0.005 ? (
                <View style={styles.udharCard}>
                  <Text style={styles.udharIcon}>🔄</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.udharTitle}>Udhar (Baad mein milega)</Text>
                    <Text style={styles.udharAmt}>₹{udharAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                  </View>
                </View>
              ) : paymentBalance < -0.005 ? (
                <View style={styles.overpayCard}>
                  <Text style={styles.overpayIcon}>✅</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.overpayTitle}>Zyada Mila — Udhar Kum Hoga</Text>
                    <Text style={styles.overpayAmt}>₹{overpaidAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                  </View>
                </View>
              ) : estimatedGross > 0 ? (
                <View style={styles.settledCard}>
                  <Text style={styles.settledText}>✅ Poora Payment — Koi Udhar Nahi</Text>
                </View>
              ) : null}

              {paymentModes.length === 0 && (
                <Text style={styles.warnText}>⚠️ Payment modes set nahi — payment skip hogi</Text>
              )}

              <View style={styles.navRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                  <Text style={styles.backBtnText}>← Wapas</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, mutation.isPending && styles.btnDisabled]}
                  onPress={() => mutation.mutate()}
                  disabled={mutation.isPending}
                >
                  <Text style={styles.submitBtnText}>{mutation.isPending ? 'Save ho raha hai...' : '📋 KC Banao (Draft)'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Add Customer Modal */}
      <Modal visible={addCustModal} transparent animationType="slide" onRequestClose={() => setAddCustModal(false)}>
        <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Naya Kharidaar Banao</Text>

              <Text style={styles.fieldLabel}>Poora Naam *</Text>
              <TextInput style={styles.bigInput} value={newCustName} onChangeText={setNewCustName} placeholder="e.g. Ramesh Patel" placeholderTextColor={colors.textMuted} autoFocus={!newCustName} />

              <Text style={styles.fieldLabel}>Phone Number</Text>
              <TextInput style={styles.bigInput} value={newCustPhone} onChangeText={setNewCustPhone} placeholder="10-digit mobile" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" maxLength={10} />

              <Text style={styles.fieldLabel}>Gaon / Ilaqa (Zaruri nahi)</Text>
              <TextInput style={styles.bigInput} value={newCustVillage} onChangeText={setNewCustVillage} placeholder="e.g. Jhajjar" placeholderTextColor={colors.textMuted} />

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAddCustModal(false)}>
                  <Text style={styles.modalCancelText}>Ruko</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, (!newCustName || addCustomerMutation.isPending) && styles.btnDisabled]}
                  onPress={() => addCustomerMutation.mutate()}
                  disabled={!newCustName || addCustomerMutation.isPending}
                >
                  <Text style={styles.modalSubmitText}>{addCustomerMutation.isPending ? 'Save...' : 'Jodo ✓'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing[4], paddingBottom: spacing[12] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing[3] },
  hint: { color: colors.textMuted, fontSize: typography.size.sm },

  // Progress bar
  progressBar: { flexDirection: 'row', backgroundColor: colors.surfaceRaised, paddingHorizontal: spacing[2], paddingVertical: spacing[3], borderBottomWidth: 0.5, borderBottomColor: colors.border },
  stepBtn: { flex: 1, alignItems: 'center', gap: spacing[1] },
  stepBtnActive: {},
  stepDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  stepDotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepDotInactive: { backgroundColor: colors.surface, borderColor: colors.border },
  stepDotText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  stepDotTextActive: { color: colors.textInverse },
  stepLabel: { fontSize: 9, color: colors.textMuted, fontWeight: '600', textAlign: 'center' as const },
  stepLabelActive: { color: colors.primary },

  // Sections
  section: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2], marginTop: spacing[3] },
  sectionIcon: { fontSize: 18 },
  sectionTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.bold as any, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.medium as any, color: colors.textSecondary, marginBottom: spacing[1], marginTop: spacing[3] },

  // Inputs
  bigInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[4],
    fontSize: typography.size.lg, color: colors.textPrimary,
    backgroundColor: colors.surfaceRaised,
    minHeight: 52,
  },
  inputGroup: { marginBottom: spacing[2] },

  // Selected chips
  selectedChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.primaryLight, borderRadius: radius.lg,
    padding: spacing[3], borderWidth: 1.5, borderColor: colors.primary,
    marginBottom: spacing[2],
  },
  selectedEmoji: { fontSize: 18 },
  selectedText: { flex: 1, fontSize: typography.size.base, fontWeight: typography.weight.semibold as any, color: colors.primary },
  changeBtn: { fontSize: typography.size.sm, color: colors.primary, fontWeight: typography.weight.semibold as any },

  // Dropdown
  dropList: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, maxHeight: 220, overflow: 'hidden', ...shadow.md, marginBottom: spacing[2] },
  dropItem: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  dropItemName: { fontSize: typography.size.base, color: colors.textPrimary, fontWeight: typography.weight.medium as any },
  dropItemSub: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  dropEmpty: { padding: spacing[4] },
  dropEmptyText: { color: colors.textSecondary, fontSize: typography.size.sm },
  addBtn: { marginTop: spacing[2], backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing[2], paddingHorizontal: spacing[4], alignSelf: 'flex-start' },
  addBtnText: { color: colors.textInverse, fontWeight: typography.weight.semibold as any },
  addInlineBtn: { padding: spacing[3], backgroundColor: colors.surfaceMuted, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  addInlineBtnText: { color: colors.primary, fontWeight: typography.weight.semibold as any, textAlign: 'center' as const },

  // Items
  itemCard: { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: spacing[4], borderWidth: 0.5, borderColor: colors.border, ...shadow.sm, marginBottom: spacing[3] },
  itemCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  itemNum: { fontSize: typography.size.sm, fontWeight: typography.weight.bold as any, color: colors.textPrimary },
  removeChip: { backgroundColor: '#fee2e2', borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[1] },
  removeChipText: { fontSize: typography.size.xs, color: colors.danger, fontWeight: typography.weight.semibold as any },
  pickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3], backgroundColor: colors.surfaceMuted, minHeight: 52 },
  pickerVal: { fontSize: typography.size.base, color: colors.textPrimary, flex: 1 },
  pickerArrow: { fontSize: 12, color: colors.textMuted },
  toggleRow: { flexDirection: 'row', gap: spacing[2] },
  toggleBtn: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing[3], alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium as any },
  toggleTextActive: { color: colors.textInverse },
  calcBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2], marginBottom: spacing[2], borderWidth: 0.5, borderColor: '#bbf7d0' },
  calcLabel: { fontSize: typography.size.sm, color: '#166534' },
  calcValue: { fontSize: typography.size.sm, fontWeight: typography.weight.bold as any, color: '#16a34a' },

  emptyItems: { alignItems: 'center', paddingVertical: spacing[8] },
  emptyItemsIcon: { fontSize: 40, marginBottom: spacing[3] },
  emptyItemsText: { fontSize: typography.size.sm, color: colors.textMuted, textAlign: 'center' as const },

  addItemBtn: { borderWidth: 2, borderColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing[4], alignItems: 'center', borderStyle: 'dashed', marginBottom: spacing[3] },
  addItemText: { color: colors.primary, fontWeight: typography.weight.bold as any, fontSize: typography.size.base },

  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, marginBottom: spacing[3] },
  infoBannerBlue: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  infoBannerPurple: { backgroundColor: '#fdf4ff', borderColor: '#e9d5ff' },
  infoBannerIcon: { fontSize: 24 },
  infoBannerTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.bold as any, color: '#1e293b' },
  infoBannerSub: { fontSize: typography.size.xs, color: '#64748b', marginTop: 2 },

  grossBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.lg, padding: spacing[4], borderWidth: 1, borderColor: colors.primary, marginTop: spacing[2] },
  grossLabel: { fontSize: typography.size.sm, color: colors.primary, fontWeight: typography.weight.semibold as any },
  grossValue: { fontSize: typography.size.xl, fontWeight: typography.weight.bold as any, color: colors.primary },

  summaryCard: { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: spacing[4], borderWidth: 0.5, borderColor: colors.border, ...shadow.sm, marginBottom: spacing[3] },
  summaryRow: { fontSize: typography.size.base, fontWeight: typography.weight.bold as any, color: colors.textPrimary },
  summarySub: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: spacing[1] },

  udharCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: '#fffbeb', borderRadius: radius.lg, padding: spacing[4], borderWidth: 1, borderColor: '#fde68a' },
  udharIcon: { fontSize: 24 },
  udharTitle: { fontSize: typography.size.sm, color: '#92400e', fontWeight: typography.weight.semibold as any },
  udharAmt: { fontSize: typography.size.xl, fontWeight: typography.weight.bold as any, color: '#d97706' },

  overpayCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: '#f0fdf4', borderRadius: radius.lg, padding: spacing[4], borderWidth: 1, borderColor: '#bbf7d0' },
  overpayIcon: { fontSize: 24 },
  overpayTitle: { fontSize: typography.size.sm, color: '#166534', fontWeight: typography.weight.semibold as any },
  overpayAmt: { fontSize: typography.size.xl, fontWeight: typography.weight.bold as any, color: '#16a34a' },

  settledCard: { backgroundColor: '#f0fdf4', borderRadius: radius.lg, padding: spacing[4], borderWidth: 1, borderColor: '#bbf7d0', alignItems: 'center' },
  settledText: { fontSize: typography.size.base, fontWeight: typography.weight.bold as any, color: '#16a34a' },

  warnText: { fontSize: typography.size.xs, color: colors.warning, marginTop: spacing[2] },

  // Navigation buttons
  navRow: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[4] },
  backBtn: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing[4], paddingHorizontal: spacing[5], alignItems: 'center' },
  backBtnText: { color: colors.textSecondary, fontWeight: typography.weight.semibold as any, fontSize: typography.size.base },
  nextBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing[4], alignItems: 'center', ...shadow.sm, marginTop: spacing[4] },
  nextBtnText: { color: colors.textInverse, fontWeight: typography.weight.bold as any, fontSize: typography.size.base },
  submitBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing[4], alignItems: 'center', ...shadow.md },
  submitBtnText: { color: colors.textInverse, fontWeight: typography.weight.bold as any, fontSize: typography.size.base },
  btnDisabled: { opacity: 0.45 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surfaceRaised, borderTopLeftRadius: radius['2xl'] ?? 24, borderTopRightRadius: radius['2xl'] ?? 24, padding: spacing[6], gap: spacing[2] },
  modalTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold as any, color: colors.textPrimary, marginBottom: spacing[2] },
  modalBtns: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[3] },
  modalCancelBtn: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing[4], alignItems: 'center' },
  modalCancelText: { color: colors.textSecondary, fontWeight: typography.weight.medium as any },
  modalSubmitBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing[4], alignItems: 'center' },
  modalSubmitText: { color: colors.textInverse, fontWeight: typography.weight.semibold as any },
});
