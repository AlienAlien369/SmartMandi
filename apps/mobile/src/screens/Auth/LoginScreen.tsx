import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { Input } from '../../components/ui';
import { Button } from '../../components/ui';

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
          <View style={styles.iconCircle}>
            <Text style={styles.emoji}>🌾</Text>
          </View>
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

          <Input
            label="Firm ID"
            placeholder="Enter your firm ID"
            value={firmId}
            onChangeText={setFirmId}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Mobile Number"
            placeholder="10-digit mobile number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={10}
          />

          <Button
            label={loading ? 'Sending...' : 'Get OTP'}
            onPress={handleSendOtp}
            loading={loading}
            style={styles.submitBtn}
          />
        </View>

        <Text style={styles.footer}>Smart Mandi v2.0 · Multi-tenant APMC</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing[5] },
  header: { alignItems: 'center', marginBottom: spacing[8] },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[2],
  },
  emoji: { fontSize: 32 },
  title: {
    fontSize: typography.size['3xl'], fontWeight: typography.weight.extrabold,
    color: colors.textPrimary, letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.size.base, color: colors.textSecondary, marginTop: spacing[1],
  },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.xl, padding: spacing[6],
    borderWidth: 0.5, borderColor: colors.border,
    ...shadow.md,
  },
  cardTitle: {
    fontSize: typography.size.xl, fontWeight: typography.weight.bold,
    color: colors.textPrimary, marginBottom: spacing[1],
  },
  cardSubtitle: {
    fontSize: typography.size.sm, color: colors.textSecondary, marginBottom: spacing[5],
  },
  submitBtn: { marginTop: spacing[1] },
  footer: {
    textAlign: 'center', color: colors.textMuted,
    fontSize: typography.size.xs, marginTop: spacing[6],
  },
  saBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1C1C1A',
    borderRadius: radius.lg, padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 0.5, borderColor: 'rgba(240,237,232,0.15)',
  },
  saBannerIcon: { fontSize: 24, marginRight: spacing[3] },
  saBannerText: { flex: 1 },
  saBannerTitle: { color: '#F0EDE8', fontSize: typography.size.base, fontWeight: typography.weight.bold },
  saBannerSub: { color: '#9E9B96', fontSize: typography.size.xs, marginTop: 2 },
  saBannerArrow: { fontSize: 22, color: '#9E9B96' },
});
