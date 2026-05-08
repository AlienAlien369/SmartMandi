import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../../theme';
import { Button } from './Button';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = React.memo(function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction
        ? <Button label={actionLabel} onPress={onAction} style={styles.button} />
        : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 28 },
  title: { fontSize: 17, fontWeight: '600', color: colors.textPrimary, marginTop: 16, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 22 },
  button: { marginTop: 20, width: 180 },
});
