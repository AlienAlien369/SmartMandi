import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { trucksApi } from '../../api/endpoints';
import type { Truck, TruckStackParamList } from '../../types';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { extractApiError } from '../../utils/errorUtils';
import { useNetworkState } from '../../hooks/useNetworkState';
import { offlineQueue } from '../../offline/queue';

type RouteT = RouteProp<TruckStackParamList, 'TruckDetail'>;
type Nav = NativeStackNavigationProp<TruckStackParamList>;

export function TruckDetailScreen() {
  const { params } = useRoute<RouteT>();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkState();

  // Modal state for arrive action
  const [arriveModal, setArriveModal] = useState(false);
  const [gateWeight, setGateWeight] = useState('');

  // Modal state for close action
  const [closeModal, setCloseModal] = useState(false);
  const [actualWeight, setActualWeight] = useState('');
  const [ratePerKg, setRatePerKg] = useState('');
  const [inamAmount, setInamAmount] = useState('');

  const { data: truck, isLoading, isError, error } = useQuery<Truck & { purchase_entries?: any[] }>({
    queryKey: ['truck', params?.truckId],
    queryFn: async () => {
      if (!params?.truckId) throw new Error('No truck ID');
      const { data } = await trucksApi.get(params.truckId);
      return data as Truck & { purchase_entries?: any[] };
    },
    enabled: !!params?.truckId,
  });

  const arriveMutation = useMutation({
    mutationFn: async (weight: string) => {
      const payload = { arrived_weight_kg: weight };
      if (!isOnline) {
        await offlineQueue.enqueue('POST', `/trucks/${params.truckId}/arrive`, payload);
        return null;
      }
      return trucksApi.arrive(params.truckId, payload);
    },
    onSuccess: (data) => {
      if (!data) {
        setArriveModal(false);
        setGateWeight('');
        // Optimistic update so button is hidden offline
        queryClient.setQueryData(['truck', params.truckId], (old: any) =>
          old ? { ...old, status: 'ARRIVED', arrived_weight_kg: gateWeight } : old,
        );
        Alert.alert('Saved Offline 📶', 'Truck arrival will be recorded when you reconnect.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['truck', params.truckId] });
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setArriveModal(false);
      setGateWeight('');
      Alert.alert('Success', 'Truck marked as ARRIVED');
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const closeMutation = useMutation({
    mutationFn: async (payload: { actual_weight_kg: string; rate_per_kg: string; inam_amount?: string }) => {
      if (!isOnline) {
        await offlineQueue.enqueue('POST', `/trucks/${params.truckId}/close`, payload);
        return null;
      }
      return trucksApi.close(params.truckId, payload);
    },
    onSuccess: (data) => {
      if (!data) {
        setCloseModal(false);
        setActualWeight('');
        setRatePerKg('');
        setInamAmount('');
        // Optimistic update so button is hidden offline
        queryClient.setQueryData(['truck', params.truckId], (old: any) =>
          old ? { ...old, status: 'CLOSED', actual_weight_kg: actualWeight } : old,
        );
        Alert.alert('Saved Offline 📶', 'Truck closure will be recorded when you reconnect.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['truck', params.truckId] });
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCloseModal(false);
      setActualWeight('');
      setRatePerKg('');
      setInamAmount('');
      Alert.alert('Success', 'Truck CLOSED successfully');
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const handleArriveSubmit = () => {
    if (!gateWeight.trim()) return Alert.alert('Required', 'Please enter gate weight');
    arriveMutation.mutate(gateWeight.trim());
  };

  const handleCloseSubmit = () => {
    if (!actualWeight.trim()) return Alert.alert('Required', 'Please enter actual weight');
    if (!ratePerKg.trim()) return Alert.alert('Required', 'Please enter rate per kg');
    closeMutation.mutate({
      actual_weight_kg: actualWeight.trim(),
      rate_per_kg: ratePerKg.trim(),
      ...(inamAmount.trim() ? { inam_amount: inamAmount.trim() } : {}),
    });
  };

  if (isLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
  if (isError || !truck) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load truck details.</Text>
        <Text style={styles.errorSub}>{extractApiError(error)}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = {
    SCHEDULED: colors.statusScheduled,
    ARRIVED: colors.statusArrived,
    CLOSED: colors.statusClosed,
  }[truck.status] ?? colors.textSecondary;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Status Header */}
        <View style={[styles.statusHeader, { backgroundColor: statusColor + '15' }]}>
          <Text style={[styles.statusLabel, { color: statusColor }]}>{truck.status}</Text>
          <Text style={styles.truckNum}>{truck.truck_number}</Text>
          <Text style={styles.produceName}>{truck.produce_name} · {truck.sale_date}</Text>
        </View>

        {/* Info Card */}
        <View style={styles.card}>
          <InfoRow label="Driver" value={truck.driver_name} />
          {truck.driver_phone && <InfoRow label="Phone" value={truck.driver_phone} />}
          <InfoRow label="Estimated Weight" value={truck.estimated_weight_kg ? `${truck.estimated_weight_kg} kg` : '—'} />
          {truck.arrived_weight_kg && <InfoRow label="Gate Weight" value={`${truck.arrived_weight_kg} kg`} />}
          {truck.actual_weight_kg && <InfoRow label="Actual Weight" value={`${truck.actual_weight_kg} kg`} accent />}
          {truck.weight_variance_kg && <InfoRow label="Variance" value={`${truck.weight_variance_kg} kg`} />}
          {truck.inam_amount && parseFloat(truck.inam_amount) > 0 && (
            <InfoRow label="Inam" value={`₹${truck.inam_amount}`} />
          )}
        </View>

        {/* Action Buttons */}
        {truck.status === 'SCHEDULED' && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => setArriveModal(true)} disabled={arriveMutation.isPending}>
            <Text style={styles.actionBtnText}>
              {arriveMutation.isPending ? 'Processing...' : '🚛 Mark as Arrived'}
            </Text>
          </TouchableOpacity>
        )}

        {truck.status === 'ARRIVED' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.success }]}
            onPress={() => setCloseModal(true)}
            disabled={closeMutation.isPending}
          >
            <Text style={styles.actionBtnText}>
              {closeMutation.isPending ? 'Closing...' : '✅ Close Truck'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Arrive Modal */}
      <Modal visible={arriveModal} transparent animationType="slide" onRequestClose={() => setArriveModal(false)}>
        <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>🚛 Mark Truck Arrived</Text>
              <Text style={styles.modalLabel}>Gate Weight (kg)</Text>
              <TextInput
                style={styles.modalInput}
                value={gateWeight}
                onChangeText={setGateWeight}
                placeholder="e.g. 8500"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setArriveModal(false); setGateWeight(''); }}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, (!gateWeight || arriveMutation.isPending) && styles.btnDisabled]}
                  onPress={handleArriveSubmit}
                  disabled={!gateWeight || arriveMutation.isPending}
                >
                  <Text style={styles.modalSubmitText}>{arriveMutation.isPending ? 'Saving...' : 'Confirm'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Close Truck Modal */}
      <Modal visible={closeModal} transparent animationType="slide" onRequestClose={() => setCloseModal(false)}>
        <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>✅ Close Truck</Text>

              <Text style={styles.modalLabel}>Actual Weight (kg) *</Text>
              <TextInput
                style={styles.modalInput}
                value={actualWeight}
                onChangeText={setActualWeight}
                placeholder="e.g. 8450"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                autoFocus
              />

              <Text style={styles.modalLabel}>Rate per kg (₹) *</Text>
              <TextInput
                style={styles.modalInput}
                value={ratePerKg}
                onChangeText={setRatePerKg}
                placeholder="e.g. 25.50"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />

              <Text style={styles.modalLabel}>Inam for Driver (₹) — optional</Text>
              <TextInput
                style={styles.modalInput}
                value={inamAmount}
                onChangeText={setInamAmount}
                placeholder="e.g. 500"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setCloseModal(false); setActualWeight(''); setRatePerKg(''); setInamAmount(''); }}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, (!actualWeight || !ratePerKg || closeMutation.isPending) && styles.btnDisabled]}
                  onPress={handleCloseSubmit}
                  disabled={!actualWeight || !ratePerKg || closeMutation.isPending}
                >
                  <Text style={styles.modalSubmitText}>{closeMutation.isPending ? 'Closing...' : 'Close Truck'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, accent && { color: colors.primary, fontWeight: typography.weight.semibold }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[8] },
  statusHeader: { borderRadius: radius.xl, padding: spacing[5], alignItems: 'center' },
  statusLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, marginBottom: spacing[1] },
  truckNum: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: colors.textPrimary },
  produceName: { color: colors.textSecondary, marginTop: spacing[1] },
  card: { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: spacing[5], borderWidth: 0.5, borderColor: colors.border, ...shadow.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[2] },
  infoLabel: { color: colors.textSecondary, fontSize: typography.size.base },
  infoValue: { color: colors.textPrimary, fontSize: typography.size.base },
  actionBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing[4], alignItems: 'center', ...shadow.md },
  actionBtnText: { color: colors.textInverse, fontSize: typography.size.base, fontWeight: typography.weight.semibold },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[6], gap: spacing[3] },
  errorText: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.danger },
  errorSub: { fontSize: typography.size.sm, color: colors.textSecondary, textAlign: 'center' },
  backBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing[5], paddingVertical: spacing[3], borderRadius: radius.md },
  backBtnText: { color: colors.textInverse, fontWeight: typography.weight.medium },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surfaceRaised, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[6], gap: spacing[3], borderTopWidth: 0.5, borderColor: colors.border },
  modalTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.textPrimary, marginBottom: spacing[1] },
  modalLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textSecondary },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontSize: typography.size.base, color: colors.textPrimary, backgroundColor: colors.surfaceMuted },
  modalActions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  modalCancelText: { color: colors.textSecondary, fontWeight: typography.weight.medium },
  modalSubmitBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  modalSubmitText: { color: colors.textInverse, fontWeight: typography.weight.semibold },
  btnDisabled: { opacity: 0.5 },
  flex1: { flex: 1 },
});
