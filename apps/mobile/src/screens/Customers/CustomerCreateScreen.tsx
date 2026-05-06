import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../../api/endpoints';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { extractApiError } from '../../utils/errorUtils';

export function CustomerCreateScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '', phone: '', address: '',
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = { name: form.name.trim() };
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.address.trim()) payload.address = form.address.trim();
      return customersApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      Alert.alert('Success', 'Customer created!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const F = (k: string) => ({ value: form[k as keyof typeof form], onChangeText: (v: string) => setForm(f => ({ ...f, [k]: v })) });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Field label="Name *" placeholder="Customer full name" {...F('name')} />
          <Field label="Phone" placeholder="Mobile number" keyboardType="phone-pad" {...F('phone')} />
          <Field label="Village / City / Address" placeholder="Optional address" {...F('address')} />
        </View>

        <TouchableOpacity
          style={[styles.btn, mutation.isPending && styles.btnDisabled]}
          onPress={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          <Text style={styles.btnText}>{mutation.isPending ? 'Creating...' : '👨‍🌾 Add Customer'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, ...props }: { label: string } & any) {
  return (
    <View style={{ marginBottom: spacing[4] }}>
      <Text style={{ fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textSecondary, marginBottom: spacing[1] }}>{label}</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontSize: typography.size.base, color: colors.textPrimary, backgroundColor: colors.background }}
        placeholderTextColor={colors.textTertiary}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[10] },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[5], ...shadow.sm },
  btn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing[4], alignItems: 'center', ...shadow.md },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.textInverse, fontSize: typography.size.base, fontWeight: typography.weight.semibold },
});
