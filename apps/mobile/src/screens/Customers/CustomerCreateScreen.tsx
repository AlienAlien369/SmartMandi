import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../../api/endpoints';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { extractApiError } from '../../utils/errorUtils';
import type { CustomerStackParamList } from '../../types';
import { useNetworkState } from '../../hooks/useNetworkState';
import { offlineQueue } from '../../offline/queue';

type CreateRoute = RouteProp<CustomerStackParamList, 'CustomerCreate'>;
type EditRoute   = RouteProp<CustomerStackParamList, 'CustomerEdit'>;

export function CustomerCreateScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkState();

  // Detect edit mode via route params (CustomerEdit route passes customerId + pre-fill)
  const route = useRoute<CreateRoute | EditRoute>();
  const params = route.params as any;
  const isEdit = !!params?.customerId;

  const [form, setForm] = useState({
    name:    params?.name    ?? '',
    phone:   params?.phone   ?? '',
    address: params?.address ?? '',
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = { name: form.name.trim() };
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.address.trim()) payload.address = form.address.trim();
      if (!isOnline) {
        const method = isEdit ? 'PATCH' : 'POST';
        const endpoint = isEdit ? `/customers/${params.customerId}` : '/customers';
        await offlineQueue.enqueue(method, endpoint, payload);
        return null;
      }
      return isEdit
        ? customersApi.update(params.customerId, payload)
        : customersApi.create(payload);
    },
    onSuccess: (data) => {
      if (!data) {
        Alert.alert(
          'Saved Offline 📶',
          `Customer will be ${isEdit ? 'updated' : 'created'} when you reconnect.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-history', params?.customerId] });
      Alert.alert(
        'Success',
        isEdit ? 'Customer updated!' : 'Customer created!',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const F = (k: string) => ({ value: form[k as keyof typeof form], onChangeText: (v: string) => setForm(f => ({ ...f, [k]: v })) });

  return (
    <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Field label="Name *" placeholder="Customer full name" {...F('name')} />
          <Field label="Phone" placeholder="Mobile number" keyboardType="phone-pad" {...F('phone')} />
          <Field label="Village / City / Address" placeholder="Optional address" {...F('address')} />
        </View>

        <TouchableOpacity
          style={[styles.btn, (mutation.isPending || !form.name.trim()) && styles.btnDisabled]}
          onPress={() => mutation.mutate()}
          disabled={mutation.isPending || !form.name.trim()}
        >
          <Text style={styles.btnText}>
            {mutation.isPending
              ? (isEdit ? 'Saving…' : 'Creating…')
              : (isEdit ? '💾  Save Changes' : '👨‍🌾 Add Customer')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, ...props }: { label: string } & any) {
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
  wrapper: { marginBottom: spacing[4] },
  label: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textSecondary, marginBottom: spacing[1] },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontSize: typography.size.base, color: colors.textPrimary, backgroundColor: colors.surfaceMuted },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[10] },
  card: { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: spacing[5], borderWidth: 0.5, borderColor: colors.border, ...shadow.sm },
  btn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing[4], alignItems: 'center', ...shadow.md },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.textInverse, fontSize: typography.size.base, fontWeight: typography.weight.semibold },
  flex1: { flex: 1 },
});
