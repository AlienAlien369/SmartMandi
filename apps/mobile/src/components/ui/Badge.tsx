import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '../../theme';

interface BadgeProps {
  label: string;
  color?: string;
  bg?: string;
  style?: ViewStyle;
}

export const Badge = React.memo(function Badge({ label, color = colors.textSecondary, bg = colors.surfaceMuted, style }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
});
