import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, radius, typography } from '../../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export const Button = React.memo(function Button({
  label, onPress, variant = 'primary', loading = false, disabled = false, style,
}: ButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], (disabled || loading) && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' ? colors.textInverse : colors.primary} size="small" />
        : <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
      }
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  base: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  ghost: { height: 44, backgroundColor: 'transparent' },
  destructive: { backgroundColor: colors.dangerBg },
  disabled: { opacity: 0.55 },
  label: { fontSize: 15, fontWeight: '600' },
});

const labelStyles: Record<Variant, TextStyle> = {
  primary: { color: colors.textInverse },
  secondary: { color: colors.primary },
  ghost: { color: colors.primary },
  destructive: { color: colors.danger },
};
