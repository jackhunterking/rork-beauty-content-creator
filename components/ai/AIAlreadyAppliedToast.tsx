/**
 * AIAlreadyAppliedToast Component
 * 
 * A non-intrusive toast notification that appears when users tap an AI feature
 * that has already been applied to the current image.
 * 
 * Explains why re-applying is not recommended (quality degradation) and
 * suggests capturing a new photo instead.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  FadeInUp,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/colors';
import type { AIFeatureKey } from '@/types';

const TOAST_DURATION_MS = 3000;

interface AIAlreadyAppliedToastProps {
  /** Whether to show the toast */
  visible: boolean;
  /** Which AI feature was tapped */
  featureKey: AIFeatureKey;
  /** Callback when toast is dismissed (either by timeout or tap) */
  onDismiss: () => void;
}

/**
 * Get feature-specific message based on the AI feature type
 */
function getFeatureMessage(featureKey: AIFeatureKey): string {
  switch (featureKey) {
    case 'auto_quality':
      return 'Quality enhancement already applied. Re-applying may reduce image quality.';
    case 'background_replace':
      return 'Background already processed. Re-applying may cause artifacts.';
    default:
      return 'AI feature already applied to this image.';
  }
}

export default function AIAlreadyAppliedToast({
  visible,
  featureKey,
  onDismiss,
}: AIAlreadyAppliedToastProps) {
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);

  // Auto-dismiss after duration
  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      
      const timer = setTimeout(() => {
        onDismiss();
      }, TOAST_DURATION_MS);

      return () => clearTimeout(timer);
    } else {
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible, onDismiss, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) {
    return null;
  }

  const message = getFeatureMessage(featureKey);

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + 8 },
        animatedStyle,
      ]}
      entering={FadeInUp.duration(200)}
      exiting={FadeOutUp.duration(150)}
    >
      <TouchableOpacity
        style={styles.toast}
        onPress={onDismiss}
        activeOpacity={0.9}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="information-circle" size={20} color={Colors.light.ai.primary} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.message}>{message}</Text>
          <Text style={styles.hint}>Capture a new photo for best results.</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
          <Ionicons name="close" size={18} color={Colors.light.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 10,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.ai.lightBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
    lineHeight: 18,
  },
  hint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  closeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
