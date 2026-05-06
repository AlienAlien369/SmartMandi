import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import { loginSuperAdmin } from '../../store/slices/authSlice';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types';
import { colors, typography, spacing, radius, shadow } from '../../theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'SuperAdminLogin'>;

export function SuperAdminLoginScreen() {
  const navigation = useNavigation<Nav>();
  const dispatch = useDispatch<AppDispatch>();
  const isLoading = useSelector((s: RootState) => s.auth.isLoading);
  const [phone, setPhone] = useState(__DEV__ ? '9000000000' : '');
  const [otp, setOtp] = useState(__DEV__ ? '123456' : '');

  const handleLogin = async () => {
    if (phone.length < 10) {
      Alert.alert('Invalid', 'Enter a valid 10-digit phone number');
      return;
    }
    if (!otp.trim()) {
      Alert.alert('Required', 'Enter OTP');
      return;
    }
    const result = await dispatch(loginSuperAdmin({ phone, otp }));
    if (loginSuperAdmin.rejected.match(result)) {
      Alert.alert('Login Failed', 'Invalid Super Admin credentials');
    }
    // On success, RootNavigator will redirect to SuperAdmin stack automatically
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🔐</Text>
          <Text style={styles.title}>Super Admin</Text>
          <Text style={styles.subtitle}>Smart Mandi Platform Management</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>PLATFORM ADMINISTRATOR</Text>
          </View>
          <Text style={styles.cardTitle}>Admin Sign In</Text>
          <Text style={styles.cardSubtitle}>Manage firms and module access</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Admin Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="10-digit phone number"
              placeholderTextColor={colors.textTertiary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>OTP</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter OTP"
              placeholderTextColor={colors.textTertiary}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In as Super Admin</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back to Firm Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing[5] },
  header: { alignItems: 'center', marginBottom: spacing[8] },
  emoji: { fontSize: 56, marginBottom: spacing[2] },
  title: {
    fontSize: typography.size['3xl'], fontWeight: typography.weight.extrabold,
    color: '#f8fafc', letterSpacing: -0.5,
  },
  subtitle: { fontSize: typography.size.base, color: '#94a3b8', marginTop: spacing[1] },
  card: {
    backgroundColor: '#1e293b', borderRadius: radius.xl,
    padding: spacing[6], borderWidth: 1, borderColor: '#334155',
  },
  badge: {
    backgroundColor: '#7c3aed', borderRadius: radius.sm,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    alignSelf: 'flex-start', marginBottom: spacing[4],
  },
  badgeText: { color: '#fff', fontSize: typography.size.xs, fontWeight: typography.weight.bold, letterSpacing: 1 },
  cardTitle: {
    fontSize: typography.size.xl, fontWeight: typography.weight.bold,
    color: '#f8fafc', marginBottom: spacing[1],
  },
  cardSubtitle: { fontSize: typography.size.sm, color: '#94a3b8', marginBottom: spacing[6] },
  field: { marginBottom: spacing[4] },
  label: {
    fontSize: typography.size.sm, fontWeight: typography.weight.medium,
    color: '#cbd5e1', marginBottom: spacing[1],
  },
  input: {
    borderWidth: 1, borderColor: '#334155', borderRadius: radius.md,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: typography.size.base, color: '#f8fafc',
    backgroundColor: '#0f172a',
  },
  button: {
    backgroundColor: '#7c3aed', borderRadius: radius.md,
    paddingVertical: spacing[4], alignItems: 'center', marginTop: spacing[2],
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: typography.size.base, fontWeight: typography.weight.semibold },
  backLink: { alignItems: 'center', marginTop: spacing[6] },
  backText: { color: '#94a3b8', fontSize: typography.size.sm },
});
