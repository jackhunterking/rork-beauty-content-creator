/**
 * Skeleton Component
 * 
 * A simple, reusable skeleton loading placeholder with pulse animation.
 * Uses react-native-reanimated for smooth 60fps animations.
 * 
 * Usage:
 * <Skeleton width={100} height={20} borderRadius={4} />
 * <Skeleton width="100%" height={48} borderRadius={12} />
 * <Skeleton circle size={40} />
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Colors from '@/constants/colors';

interface SkeletonProps {
  /** Width of the skeleton (number for pixels, string for percentage) */
  width?: number | string;
  /** Height of the skeleton */
  height?: number;
  /** Border radius for rounded corners */
  borderRadius?: number;
  /** If true, creates a circle (uses size prop) */
  circle?: boolean;
  /** Size for circle mode (width and height) */
  size?: number;
  /** Additional styles */
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 4,
  circle = false,
  size = 40,
  style,
}: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // Infinite
      true // Reverse
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const dimensions: ViewStyle = circle
    ? {
        width: size,
        height: size,
        borderRadius: size / 2,
      }
    : {
        width,
        height,
        borderRadius,
      };

  return (
    <Animated.View
      style={[
        styles.skeleton,
        dimensions,
        animatedStyle,
        style,
      ]}
    />
  );
}

/**
 * SkeletonText - A preset for text-like skeletons
 */
export function SkeletonText({ 
  width = '100%', 
  lines = 1,
  lineHeight = 14,
  spacing = 8,
}: { 
  width?: number | string;
  lines?: number;
  lineHeight?: number;
  spacing?: number;
}) {
  return (
    <View style={{ gap: spacing }}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton 
          key={index} 
          width={index === lines - 1 && lines > 1 ? '60%' : width} 
          height={lineHeight} 
          borderRadius={4}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.light.surfaceSecondary,
  },
});

export default Skeleton;
