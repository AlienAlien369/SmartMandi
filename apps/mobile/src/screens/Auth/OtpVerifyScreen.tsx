import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack';
import { useDispatch, useSelector } from 'react-redux';
import type { AuthStackParamList } from '../../types';
import type { AppDispatch, RootState } from '../../store';
import { login } from '../../store/slices/authSlice';
import { colors, typography, spacing, radius, shadow } from '../../theme';
import { Input } from '../../components/ui';
import { Button } from '../../components/ui';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'OtpVerify'>;
type RouteT = RouteProp<AuthStackParamList, 'OtpVerify'>;

export function OtpVerifyScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteT>();
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading } = useSelector((s: RootState) => s.auth);

  const [otp, setOtp] = useState(__DEV__ ? '123456' : '');

  const handleVerify = async () => {
    if (otp.length < 4) {
      Alert.alert('Invalid OTP', 'Please enter the OTP');
      return;
    }
    const result = await dispatch(login({
      phone: params.phone,
      otp,
      firmId: params.firm_id,
      deviceId: 'mobile-device',
    }));
    if (login.rejected.match(result)) {
      Alert.alert('Login Failed', result.error.message ?? 'Invalid OTP');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.subtitle}>
            Sent to {params.phone}{'\n'}
            <Text style={styles.hint}>(Dev mode: use any 4+ digit OTP)</Text>
          </Text>
        </View>

        <View style={styles.card}>
          <Input
            placeholder="• • • • • •"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
            autoFocus
            style={styles.otpInput}
          />

          <Button
            label={isLoading ? 'Verifying...' : 'Verify & Login'}
            onPress={handleVerify}
            loading={isLoading}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  inner: { flex: 1, padding: spacing[5], justifyContent: 'center' },
  backBtn: { position: 'absolute', top: spacing[6], left: spacing[5] },
  backText: { color: colors.primary, fontSize: typography.size.base, fontWeight: typography.weight.medium },
  header: { alignItems: 'center', marginBottom: spacing[8] },
  title: {
    fontSize: typography.size['2xl'], fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.size.base, color: colors.textSecondary,
    textAlign: 'center', marginTop: spacing[2], lineHeight: 22,
  },
  hint: { color: colors.textMuted, fontSize: typography.size.sm },
  card: {
    backgroundColor: colors.surfaceRaised, borderRadius: radius.xl,
    padding: spacing[6], borderWidth: 0.5, borderColor: colors.border, ...shadow.md,
  },
  otpInput: {
    height: 64, fontSize: typography.size['2xl'],
    letterSpacing: 8, borderColor: colors.primary,
  },
});
