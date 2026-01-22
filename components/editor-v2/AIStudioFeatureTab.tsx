/**
 * AIStudioFeatureTab Component
 * 
 * Individual feature tab for the AI Studio panel.
 * Displays an AI feature with icon and label.
 * Minimal design with brand-aligned gold colors.
 */

import React, { useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Sparkles,
  ImagePlus,
  Wand2,
  Crown,
} from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Colors from '@/constants/colors';
import type { AIFeatureKey, AIModelConfig } from '@/types';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * Get icon component for a feature
 */
function getFeatureIcon(featureKey: AIFeatureKey, color: string, size: number = 28) {
  switch (featureKey) {
    case 'background_replace':
      return <ImagePlus size={size} color={color} strokeWidth={1.8} />;
    case 'auto_quality':
      return <Wand2 size={size} color={color} strokeWidth={1.8} />;
    default:
      return <Sparkles size={size} color={color} strokeWidth={1.8} />;
  }
}

/**
 * Get gradient colors for a feature (brand-aligned warm tones)
 */
function getFeatureGradient(featureKey: AIFeatureKey): [string, string] {
  switch (featureKey) {
    case 'auto_quality':
      return Colors.light.ai.gradientQuality;
    case 'background_replace':
      return Colors.light.ai.gradientReplace;
    default:
      return Colors.light.ai.gradientQuality;
  }
}

interface AIStudioFeatureTabProps {
  /** Feature configuration */
  feature: AIModelConfig;
  /** Whether this feature is currently selected/expanded */
  isSelected: boolean;
  /** Whether user has premium access */
  isPremium: boolean;
  /** Whether this feature is currently processing */
  isProcessing: boolean;
  /** Callback when feature is pressed */
  onPress: (featureKey: AIFeatureKey) => void;
}

export function AIStudioFeatureTab({
  feature,
  isSelected,
  isPremium,
  isProcessing,
  onPress,
}: AIStudioFeatureTabProps) {
  const scale = useSharedValue(1);
  
  const isLocked = feature.isPremiumOnly && !isPremium;
  const gradientColors = getFeatureGradient(feature.featureKey);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { damping: 15 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15 });
  }, [scale]);

  const handlePress = useCallback(() => {
    if (!isProcessing) {
      onPress(feature.featureKey);
    }
  }, [feature.featureKey, isProcessing, onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchable
      style={[
        styles.container,
        isSelected && styles.containerSelected,
        animatedStyle,
      ]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
      disabled={isProcessing}
    >
      {/* Icon with gradient background */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.iconContainer,
          isSelected && styles.iconContainerSelected,
        ]}
      >
        {isProcessing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          getFeatureIcon(feature.featureKey, '#FFFFFF')
        )}
      </LinearGradient>

      {/* Feature name */}
      <Text 
        style={[
          styles.label,
          isSelected && styles.labelSelected,
        ]} 
        numberOfLines={2}
      >
        {feature.displayName}
      </Text>

      {/* PRO badge for locked features */}
      {isLocked && (
        <View style={styles.proBadge}>
          <Crown size={10} color="#FFFFFF" />
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <View style={styles.selectionIndicator} />
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 88,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  containerSelected: {
    backgroundColor: Colors.light.ai.lightBg,
    borderColor: Colors.light.ai.primary,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconContainerSelected: {
    shadowColor: Colors.light.ai.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
    lineHeight: 14,
    minHeight: 28,
  },
  labelSelected: {
    color: Colors.light.ai.primaryDark,
  },
  proBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  selectionIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    right: '25%',
    height: 3,
    backgroundColor: Colors.light.ai.primary,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
});

export default AIStudioFeatureTab;
