import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { trucksApi } from '../../api/endpoints';
import type { TruckStackParamList } from '../../types';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { extractApiError } from '../../utils/errorUtils';
import { Input, Button } from '../../components/ui';
import { useNetworkState } from '../../hooks/useNetworkState';
import { offlineQueue } from '../../offline/queue';

type Nav = NativeStackNavigationProp<TruckStackParamList>;

export function TruckCreateScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkState();

  const [form, setForm] = useState({
    truck_number: '',
    driver_name: '',
    driver_phone: '',
    produce_name: '',
    sale_date: new Date().toISOString().slice(0, 10),
    estimated_weight_kg: '',
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        truck_number: form.truck_number.trim(),
        driver_name: form.driver_name.trim(),
        produce_name: form.produce_name.trim(),
        sale_date: form.sale_date,
      };
      if (form.driver_phone.trim()) payload.driver_phone = form.driver_phone.trim();
      if (form.estimated_weight_kg.trim()) payload.estimated_weight_kg = form.estimated_weight_kg.trim();
      if (form.notes.trim()) payload.notes = form.notes.trim();
      if (!isOnline) {
        await offlineQueue.enqueue('POST', '/trucks', payload);
        return null;
      }
      return trucksApi.create(payload);
    },
    onSuccess: (data) => {
      if (!data) {
        Alert.alert('Saved Offline 📶', 'Truck will be scheduled when you reconnect.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      Alert.alert('Success', 'Truck scheduled!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const setField = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Input label="Truck Number *" value={form.truck_number} onChangeText={v => setField('truck_number', v)} placeholder="e.g. RJ14GB0001" autoCapitalize="characters" />
          <Input label="Driver Name *" value={form.driver_name} onChangeText={v => setField('driver_name', v)} placeholder="Driver's full name" />
          <Input label="Driver Phone" value={form.driver_phone} onChangeText={v => setField('driver_phone', v)} placeholder="Mobile number" keyboardType="phone-pad" />
          <Input label="Produce Name *" value={form.produce_name} onChangeText={v => setField('produce_name', v)} placeholder="e.g. Wheat, Onion" />
          <Input label="Sale Date *" value={form.sale_date} onChangeText={v => setField('sale_date', v)} placeholder="YYYY-MM-DD" />
          <Input label="Estimated Weight (kg)" value={form.estimated_weight_kg} onChangeText={v => setField('estimated_weight_kg', v)} placeholder="Optional estimate" keyboardType="decimal-pad" />
          <Input label="Notes" value={form.notes} onChangeText={v => setField('notes', v)} placeholder="Optional" multiline style={styles.notesInput} />
        </View>

        <Button
          label={mutation.isPending ? 'Scheduling...' : '🚛 Schedule Truck'}
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing[5], paddingBottom: spacing[10] },
  card: {
    backgroundColor: colors.surfaceRaised, borderRadius: radius.xl,
    padding: spacing[5], borderWidth: 0.5, borderColor: colors.border,
    ...shadow.sm, marginBottom: spacing[5],
  },
  notesInput: { height: 80, textAlignVertical: 'top' },
});
