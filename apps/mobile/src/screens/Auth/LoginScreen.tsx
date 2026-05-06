import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types';
import { colors, typography, spacing, radius, shadow } from '../../theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const [phone, setPhone] = useState(__DEV__ ? '9999999999' : '');
  const [firmId, setFirmId] = useState(__DEV__ ? '115c557f-0c07-4162-b3bc-84f1feab88fb' : '');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (phone.length < 10) {
      Alert.alert('Invalid', 'Please enter a valid 10-digit phone number');
      return;
    }
    if (!firmId.trim()) {
      Alert.alert('Required', 'Please enter your Firm ID');
      return;
    }
    setLoading(true);
    // In dev, OTP is always "123456"
    setLoading(false);
    navigation.navigate('OtpVerify', { phone, firm_id: firmId });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🌾</Text>
          <Text style={styles.title}>Smart Mandi</Text>
          <Text style={styles.subtitle}>Digital APMC Mandi Management</Text>
        </View>

        {/* Super Admin Banner — prominent, above the card */}
        <TouchableOpacity style={styles.saBanner} onPress={() => navigation.navigate('SuperAdminLogin')}>
          <Text style={styles.saBannerIcon}>🔐</Text>
          <View style={styles.saBannerText}>
            <Text style={styles.saBannerTitle}>Super Admin?</Text>
            <Text style={styles.saBannerSub}>Tap here to access the platform admin panel</Text>
          </View>
          <Text style={styles.saBannerArrow}>›</Text>
        </TouchableOpacity>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Firm Login</Text>
          <Text style={styles.cardSubtitle}>Sign in to your mandi account</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Firm ID</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your firm ID"
              placeholderTextColor={colors.textTertiary}
              value={firmId}
              onChangeText={setFirmId}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mobile Number</Text>
            <TextInput
              style={styles.input}
              placeholder="10-digit mobile number"
              placeholderTextColor={colors.textTertiary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendOtp}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Get OTP'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Smart Mandi v2.0 · Multi-tenant APMC</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing[5] },
  header: { alignItems: 'center', marginBottom: spacing[8] },
  emoji: { fontSize: 56, marginBottom: spacing[2] },
  title: {
    fontSize: typography.size['3xl'], fontWeight: typography.weight.extrabold,
    color: colors.textPrimary, letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.size.base, color: colors.textSecondary, marginTop: spacing[1],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl, padding: spacing[6],
    ...shadow.md,
  },
  cardTitle: {
    fontSize: typography.size.xl, fontWeight: typography.weight.bold,
    color: colors.textPrimary, marginBottom: spacing[1],
  },
  cardSubtitle: {
    fontSize: typography.size.sm, color: colors.textSecondary, marginBottom: spacing[6],
  },
  field: { marginBottom: spacing[4] },
  label: {
    fontSize: typography.size.sm, fontWeight: typography.weight.medium,
    color: colors.textSecondary, marginBottom: spacing[1],
  },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: typography.size.base, color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  button: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing[4], alignItems: 'center', marginTop: spacing[2],
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: colors.textInverse, fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  footer: {
    textAlign: 'center', color: colors.textTertiary,
    fontSize: typography.size.xs, marginTop: spacing[6],
  },
  saBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e1b4b',
    borderRadius: radius.lg, padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1, borderColor: '#4338ca',
  },
  saBannerIcon: { fontSize: 24, marginRight: spacing[3] },
  saBannerText: { flex: 1 },
  saBannerTitle: { color: '#a5b4fc', fontSize: typography.size.base, fontWeight: typography.weight.bold },
  saBannerSub: { color: '#6366f1', fontSize: typography.size.xs, marginTop: 2 },
  saBannerArrow: { fontSize: 22, color: '#6366f1' },
});
