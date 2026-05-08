import React from 'react';
import { View, Pressable, Animated, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, elevation } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export const Card = React.memo(function Card({ children, onPress, style }: CardProps) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const onPressIn = React.useCallback(() => {
    if (!onPress) return;
    Animated.timing(scale, { toValue: 0.98, duration: 100, useNativeDriver: true }).start();
  }, [onPress, scale]);

  const onPressOut = React.useCallback(() => {
    if (!onPress) return;
    Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }).start();
  }, [onPress, scale]);

  if (onPress) {
    return (
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <Animated.View style={[styles.card, style, { transform: [{ scale }] }]}>
          {children}
        </Animated.View>
      </Pressable>
    );
  }

  return <View style={[styles.card, style]}>{children}</View>;
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 0.5,
    borderColor: colors.border,
    ...elevation.card,
  },
});
