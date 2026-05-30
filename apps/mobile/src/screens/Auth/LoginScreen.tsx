import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types';
import { authApi } from '../../api/endpoints';
import { extractApiError } from '../../utils/errorUtils';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { Input, Button } from '../../components/ui';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

// Pulsing orb for background depth
function GlowOrb({ style }: { style: object }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 3200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,    duration: 3200, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[style, { transform: [{ scale }] }]} />;
}

export function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const [phone, setPhone] = useState(__DEV__ ? '9999999999' : '');
  const [firmId, setFirmId] = useState(__DEV__ ? '115c557f-0c07-4162-b3bc-84f1feab88fb' : '');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (phone.length < 10) { Alert.alert('Invalid', 'Please enter a valid 10-digit phone number'); return; }
    if (!firmId.trim()) { Alert.alert('Required', 'Please enter your Firm ID'); return; }
    setLoading(true);
    try {
      // In dev mode, backend auto-accepts any OTP — still call so prod works correctly
      await authApi.sendOtp(phone, firmId).catch(() => {}); // non-fatal if endpoint not found
      navigation.navigate('OtpVerify', { phone, firm_id: firmId });
    } catch (e: any) {
      Alert.alert('Error', extractApiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* ── Decorative background orbs ── */}
      <GlowOrb style={styles.orb1} />
      <GlowOrb style={styles.orb2} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* ── Hero header ── */}
        <View style={styles.header}>
          <View style={styles.logoRing}>
            <View style={styles.logoInner}>
              <Text style={styles.logoEmoji}>🌾</Text>
            </View>
          </View>
          <Text style={styles.title}>Smart Mandi</Text>
          <Text style={styles.subtitle}>Digital APMC Mandi Management</Text>

          {/* Decorative dots */}
          <View style={styles.dotsRow}>
            {[0,1,2].map(i => <View key={i} style={[styles.dot, i === 1 && styles.dotActive]} />)}
          </View>
        </View>

        {/* ── Super Admin Banner ── */}
        <TouchableOpacity style={styles.saBanner} onPress={() => navigation.navigate('SuperAdminLogin')} activeOpacity={0.88}>
          {/* Forest shimmer accent */}
          <View style={styles.saBannerShimmer} />
          <Text style={styles.saBannerIcon}>🔐</Text>
          <View style={styles.saBannerText}>
            <Text style={styles.saBannerTitle}>Super Admin</Text>
            <Text style={styles.saBannerSub}>Platform administration panel</Text>
          </View>
          <View style={styles.saBannerArrow}>
            <Text style={{ color: colors.primaryMid, fontSize: 18, fontWeight: '700' }}>›</Text>
          </View>
        </TouchableOpacity>

        {/* ── Login Card ── */}
        <View style={styles.card}>
          {/* Card top accent bar */}
          <View style={styles.cardAccent} />

          <Text style={styles.cardTitle}>Firm Login</Text>
          <Text style={styles.cardSubtitle}>Sign in to your mandi account</Text>

          <Input label="Firm ID" placeholder="Enter your firm ID" value={firmId} onChangeText={setFirmId} autoCapitalize="none" autoCorrect={false} />
          <Input label="Mobile Number" placeholder="10-digit mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} />

          <Button label={loading ? 'Sending OTP…' : 'Get OTP  →'} onPress={handleSendOtp} loading={loading} style={styles.submitBtn} />
        </View>

        <Text style={styles.footer}>Smart Mandi v2.0  ·  Multi-tenant APMC  ·  🔒 Secured</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  // Background orbs — botanical depth
  orb1: {
    position: 'absolute', top: -80, right: -60,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: colors.primaryLight, opacity: 0.55,
  },
  orb2: {
    position: 'absolute', bottom: 60, left: -80,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: colors.accentLight, opacity: 0.40,
  },

  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing[5], paddingVertical: spacing[8] },

  // Header
  header: { alignItems: 'center', marginBottom: spacing[7] },
  logoRing: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(22,163,74,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[4],
    borderWidth: 1.5, borderColor: 'rgba(22,163,74,0.22)',
  },
  logoInner: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  logoEmoji: { fontSize: 34 },
  title: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.extrabold,
    color: colors.textPrimary,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: typography.size.sm, color: colors.textSecondary,
    marginTop: spacing[1], letterSpacing: 0.2,
  },
  dotsRow: { flexDirection: 'row', gap: 6, marginTop: spacing[4] },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 20, backgroundColor: colors.primary },

  // SA Banner — deep forest green, luxurious
  saBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#052e16',
    borderRadius: radius.lg, padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.22)',
    overflow: 'hidden',
    ...shadow.md,
  },
  saBannerShimmer: {
    position: 'absolute', top: -30, right: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(74,222,128,0.08)',
  },
  saBannerIcon: { fontSize: 22, marginRight: spacing[3] },
  saBannerText: { flex: 1 },
  saBannerTitle: {
    color: '#f0fdf4', fontSize: typography.size.base, fontWeight: typography.weight.bold,
  },
  saBannerSub: { color: 'rgba(240,253,244,0.55)', fontSize: typography.size.xs, marginTop: 2 },
  saBannerArrow: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(74,222,128,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Login card — glowing white
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.xl,
    paddingTop: 0,
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.md,
  },
  cardAccent: {
    height: 4, marginBottom: spacing[5],
    backgroundColor: colors.primary, borderRadius: 2,
  },
  cardTitle: {
    fontSize: typography.size.xl, fontWeight: typography.weight.bold,
    color: colors.textPrimary, marginBottom: spacing[1],
  },
  cardSubtitle: {
    fontSize: typography.size.sm, color: colors.textSecondary,
    marginBottom: spacing[5],
  },
  submitBtn: { marginTop: spacing[1] },
  footer: {
    textAlign: 'center', color: colors.textMuted,
    fontSize: typography.size.xs, marginTop: spacing[6], letterSpacing: 0.2,
  },
});

