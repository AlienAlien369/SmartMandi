import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '../../theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const SkeletonLoader = React.memo(function SkeletonLoader({
  width = '100%', height = 16, borderRadius = radius.sm, style,
}: SkeletonProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: [colors.surfaceMuted, colors.surfaceOverlay as string] });

  return (
    <Animated.View style={[{ width: width as number, height, borderRadius, backgroundColor: bg }, style]} />
  );
});

export function CardSkeleton() {
  return (
    <View style={skStyles.card}>
      <SkeletonLoader height={14} width="60%" />
      <SkeletonLoader height={11} width="40%" style={skStyles.gap} />
      <SkeletonLoader height={11} width="30%" style={skStyles.gap} />
    </View>
  );
}

const skStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 0.5,
    borderColor: colors.border,
    marginBottom: 12,
  },
  gap: { marginTop: 8 },
});
