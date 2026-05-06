import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { trucksApi } from '../../api/endpoints';
import type { TruckStackParamList } from '../../types';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { extractApiError } from '../../utils/errorUtils';

type Nav = NativeStackNavigationProp<TruckStackParamList>;

export function TruckCreateScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();

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
    mutationFn: () => {
      // Strip empty strings for optional fields — empty string fails UUID/number validation
      const payload: Record<string, any> = {
        truck_number: form.truck_number.trim(),
        driver_name: form.driver_name.trim(),
        produce_name: form.produce_name.trim(),
        sale_date: form.sale_date,
      };
      if (form.driver_phone.trim()) payload.driver_phone = form.driver_phone.trim();
      if (form.estimated_weight_kg.trim()) payload.estimated_weight_kg = form.estimated_weight_kg.trim();
      if (form.notes.trim()) payload.notes = form.notes.trim();
      return trucksApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      Alert.alert('Success', 'Truck scheduled!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const setField = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <FormField label="Truck Number *" value={form.truck_number} onChangeText={v => setField('truck_number', v)} placeholder="e.g. RJ14GB0001" autoCapitalize="characters" />
          <FormField label="Driver Name *" value={form.driver_name} onChangeText={v => setField('driver_name', v)} placeholder="Driver's full name" />
          <FormField label="Driver Phone" value={form.driver_phone} onChangeText={v => setField('driver_phone', v)} placeholder="Mobile number" keyboardType="phone-pad" />
          <FormField label="Produce Name *" value={form.produce_name} onChangeText={v => setField('produce_name', v)} placeholder="e.g. Wheat, Onion" />
          <FormField label="Sale Date *" value={form.sale_date} onChangeText={v => setField('sale_date', v)} placeholder="YYYY-MM-DD" />
          <FormField label="Estimated Weight (kg)" value={form.estimated_weight_kg} onChangeText={v => setField('estimated_weight_kg', v)} placeholder="Optional estimate" keyboardType="decimal-pad" />
          <FormField label="Notes" value={form.notes} onChangeText={v => setField('notes', v)} placeholder="Optional" multiline />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, mutation.isPending && styles.btnDisabled]}
          onPress={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          <Text style={styles.submitText}>
            {mutation.isPending ? 'Scheduling...' : '🚛 Schedule Truck'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormField({ label, ...props }: { label: string } & any) {
  return (
    <View style={fieldStyles.field}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput style={[fieldStyles.input, props.multiline && fieldStyles.multiline]} placeholderTextColor={colors.textTertiary} {...props} />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  field: { marginBottom: spacing[4] },
  label: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textSecondary, marginBottom: spacing[1] },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: typography.size.base, color: colors.textPrimary, backgroundColor: colors.background,
  },
  multiline: { height: 80, textAlignVertical: 'top' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing[5], paddingBottom: spacing[10] },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[5], ...shadow.sm, marginBottom: spacing[5] },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing[4], alignItems: 'center', ...shadow.md,
  },
  btnDisabled: { opacity: 0.6 },
  submitText: { color: colors.textInverse, fontSize: typography.size.base, fontWeight: typography.weight.semibold },
});
