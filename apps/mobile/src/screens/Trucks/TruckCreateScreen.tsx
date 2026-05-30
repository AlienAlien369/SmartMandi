import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { trucksApi, configApi } from '../../api/endpoints';
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
  const [showProducePicker, setShowProducePicker] = useState(false);

  const { data: producesData } = useQuery({
    queryKey: ['produces'],
    queryFn: () => configApi.getProduces().then(r => r.data as Array<{ id: string; name: string }>),
    staleTime: 5 * 60 * 1000,
  });

  const produces = producesData ?? [];

  // Auto-select if only one produce is configured
  React.useEffect(() => {
    if (produces.length === 1 && !form.produce_name) {
      setForm(f => ({ ...f, produce_name: produces[0].name }));
    }
  }, [produces]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        truck_number: form.truck_number.trim().toUpperCase(),
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
      queryClient.invalidateQueries({ queryKey: ['trucks-available'] });
      Alert.alert('Success', 'Truck scheduled!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    },
    onError: (e: any) => Alert.alert('Error', extractApiError(e)),
  });

  const setField = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));
  const isValid = form.truck_number.trim() && form.driver_name.trim() && form.produce_name.trim() && form.sale_date;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Input
            label="Truck Number *"
            value={form.truck_number}
            onChangeText={v => setField('truck_number', v.toUpperCase())}
            placeholder="e.g. RJ14GB0001"
            autoCapitalize="characters"
          />
          <Input
            label="Driver Name *"
            value={form.driver_name}
            onChangeText={v => setField('driver_name', v)}
            placeholder="Driver's full name"
          />
          <Input
            label="Driver Phone"
            value={form.driver_phone}
            onChangeText={v => setField('driver_phone', v)}
            placeholder="Mobile number"
            keyboardType="phone-pad"
          />

          {/* Produce Dropdown */}
          <Text style={styles.label}>Produce / Maal *</Text>
          <TouchableOpacity
            style={[styles.dropdown, !form.produce_name && styles.dropdownEmpty]}
            onPress={() => produces.length > 0 && setShowProducePicker(!showProducePicker)}
          >
            <Text style={form.produce_name ? styles.dropdownValue : styles.dropdownPlaceholder}>
              {form.produce_name || (produces.length === 0 ? 'No produces configured' : 'Select produce...')}
            </Text>
            <Text style={styles.dropdownArrow}>{showProducePicker ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showProducePicker && (
            <View style={styles.dropdownList}>
              {produces.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.dropdownItem, form.produce_name === p.name && styles.dropdownItemSelected]}
                  onPress={() => { setField('produce_name', p.name); setShowProducePicker(false); }}
                >
                  <Text style={[styles.dropdownItemText, form.produce_name === p.name && styles.dropdownItemTextSelected]}>
                    {p.name}
                  </Text>
                  {form.produce_name === p.name && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Input
            label="Sale Date *"
            value={form.sale_date}
            onChangeText={v => setField('sale_date', v)}
            placeholder="YYYY-MM-DD"
          />
          <Input
            label="Estimated Weight (kg)"
            value={form.estimated_weight_kg}
            onChangeText={v => setField('estimated_weight_kg', v)}
            placeholder="Optional estimate"
            keyboardType="decimal-pad"
          />
          <Input
            label="Notes"
            value={form.notes}
            onChangeText={v => setField('notes', v)}
            placeholder="Optional"
            multiline
            style={styles.notesInput}
          />
        </View>

        <Button
          label={mutation.isPending ? 'Scheduling...' : '🚛 Schedule Truck'}
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!isValid || mutation.isPending}
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
  label: {
    ...typography.labelSm,
    color: colors.textSecondary,
    marginBottom: spacing[1],
    marginTop: spacing[3],
  },
  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    backgroundColor: colors.surface,
    marginBottom: spacing[1],
  },
  dropdownEmpty: { borderColor: colors.border },
  dropdownValue: { ...typography.bodyMd, color: colors.text, flex: 1 },
  dropdownPlaceholder: { ...typography.bodyMd, color: colors.textDisabled, flex: 1 },
  dropdownArrow: { color: colors.textSecondary, fontSize: 12 },
  dropdownList: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised, marginBottom: spacing[3],
    maxHeight: 200, overflow: 'hidden',
    ...shadow.sm,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  dropdownItemSelected: { backgroundColor: colors.primaryLight ?? colors.surface },
  dropdownItemText: { ...typography.bodyMd, color: colors.text },
  dropdownItemTextSelected: { color: colors.primary, fontWeight: '600' },
  checkmark: { color: colors.primary, fontSize: 16 },
});
