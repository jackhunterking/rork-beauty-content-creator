/**
 * AI Success Overlay
 * 
 * Shows before/after comparison with draggable slider.
 * Allows user to apply or try another enhancement.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import Colors from '@/constants/colors';
import type { AIFeatureKey } from '@/types';
import { getGradientPoints } from '@/constants/gradients';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COMPARISON_WIDTH = SCREEN_WIDTH - 48;
const COMPARISON_HEIGHT = COMPARISON_WIDTH * 1.25;

// Feature-specific labels for the comparison view
const FEATURE_LABELS: Record<AIFeatureKey, { result: string; original: string }> = {
  auto_quality: { result: 'ENHANCED', original: 'ORIGINAL' },
  background_remove: { result: 'REMOVED', original: 'ORIGINAL' },
  background_replace: { result: 'NEW BG', original: 'ORIGINAL' },
};

/** Background info for transparent PNG overlays (solid color, gradient, or transparent-only) */
interface BackgroundInfo {
  type: 'solid' | 'gradient' | 'transparent';
  solidColor?: string;
  gradient?: {
    type: 'linear';
    colors: [string, string];
    direction: 'vertical' | 'horizontal' | 'diagonal-tl' | 'diagonal-tr';
  };
}

interface AISuccessOverlayProps {
  originalUri: string;
  enhancedUri: string;
  featureKey: AIFeatureKey;
  onKeepEnhanced: () => void;
  onRevert: () => void;
  /** Background info for displaying transparent PNG over color/gradient */
  backgroundInfo?: BackgroundInfo;
}

export default function AISuccessOverlay({
  originalUri,
  enhancedUri,
  featureKey,
  onKeepEnhanced,
  onRevert,
  backgroundInfo,
}: AISuccessOverlayProps) {
  const labels = FEATURE_LABELS[featureKey] || FEATURE_LABELS.auto_quality;
  
  // Slider position (0-1, 0.5 = middle)
  const sliderPosition = useSharedValue(0.5);
  const [isDragging, setIsDragging] = useState(false);
  
  // Pan gesture for slider
  const panGesture = Gesture.Pan()
    .onBegin(() => {
      runOnJS(setIsDragging)(true);
    })
    .onUpdate((event) => {
      const newPosition = Math.max(0.05, Math.min(0.95, (event.x) / COMPARISON_WIDTH));
      sliderPosition.value = newPosition;
    })
    .onEnd(() => {
      runOnJS(setIsDragging)(false);
    });
  
  // Animated styles for the comparison
  const enhancedClipStyle = useAnimatedStyle(() => ({
    width: sliderPosition.value * COMPARISON_WIDTH,
  }));
  
  const sliderLineStyle = useAnimatedStyle(() => ({
    left: sliderPosition.value * COMPARISON_WIDTH - 2,
  }));
  
  const sliderHandleStyle = useAnimatedStyle(() => ({
    left: sliderPosition.value * COMPARISON_WIDTH - 20,
    transform: [{ scale: withSpring(isDragging ? 1.1 : 1) }],
  }));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="checkmark-circle" size={28} color={Colors.light.success} />
        <Text style={styles.title}>Looking great!</Text>
        <Text style={styles.subtitle}>Drag to compare before & after</Text>
      </View>

      {/* Before/After Comparison */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.comparisonContainer}>
          {/* Original (After) - full width behind */}
          {/* Background color/gradient for transparent PNG (shows user's perceived "original") */}
          {backgroundInfo?.type === 'solid' && backgroundInfo.solidColor && (
            <View 
              style={[styles.comparisonImage, { backgroundColor: backgroundInfo.solidColor, position: 'absolute' }]} 
            />
          )}
          {backgroundInfo?.type === 'gradient' && backgroundInfo.gradient && (
            <LinearGradient
              colors={backgroundInfo.gradient.colors}
              {...getGradientPoints(backgroundInfo.gradient.direction)}
              style={[styles.comparisonImage, { position: 'absolute' }]}
            />
          )}
          {/* The original image (may be transparent PNG) on top of background */}
          <ExpoImage
            source={{ uri: originalUri }}
            style={styles.comparisonImage}
            contentFit="cover"
            cachePolicy="none"
          />
          
          {/* Enhanced (Before) - clipped on top */}
          <Animated.View style={[styles.enhancedClip, enhancedClipStyle]}>
            {/* Background for transparent PNG - MUST mask the original image behind */}
            {/* For background_remove: use white background when no backgroundInfo is provided */}
            {featureKey === 'background_remove' && !backgroundInfo && (
              <View 
                style={[
                  styles.comparisonImage, 
                  { width: COMPARISON_WIDTH, backgroundColor: '#FFFFFF' }
                ]} 
              />
            )}
            {/* Background color/gradient for transparent PNG (when user has selected one) */}
            {backgroundInfo?.type === 'solid' && backgroundInfo.solidColor && (
              <View 
                style={[
                  styles.comparisonImage, 
                  { width: COMPARISON_WIDTH, backgroundColor: backgroundInfo.solidColor }
                ]} 
              />
            )}
            {backgroundInfo?.type === 'gradient' && backgroundInfo.gradient && (
              <LinearGradient
                colors={backgroundInfo.gradient.colors}
                {...getGradientPoints(backgroundInfo.gradient.direction)}
                style={[styles.comparisonImage, { width: COMPARISON_WIDTH }]}
              />
            )}
            {/* The transparent PNG on top */}
            <ExpoImage
              source={{ uri: enhancedUri }}
              style={[styles.comparisonImage, { width: COMPARISON_WIDTH }]}
              contentFit="cover"
              cachePolicy="none"
            />
          </Animated.View>
          
          {/* Slider Line */}
          <Animated.View style={[styles.sliderLine, sliderLineStyle]} />
          
          {/* Slider Handle */}
          <Animated.View style={[styles.sliderHandle, sliderHandleStyle]}>
            <View style={styles.sliderHandleInner}>
              <Ionicons name="chevron-back" size={14} color="#FFFFFF" />
              <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
            </View>
          </Animated.View>
          
          {/* Labels */}
          <View style={styles.labelContainer}>
            <View style={styles.labelLeft}>
              <Text style={styles.labelText}>{labels.result}</Text>
            </View>
            <View style={styles.labelRight}>
              <Text style={styles.labelText}>{labels.original}</Text>
            </View>
          </View>
        </View>
      </GestureDetector>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.tryAnotherButton}
          onPress={onRevert}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={18} color={Colors.light.accent} />
          <Text style={styles.tryAnotherText}>Try Another</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.applyButton}
          onPress={onKeepEnhanced}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark" size={20} color="#FFFFFF" />
          <Text style={styles.applyButtonText}>Apply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  comparisonContainer: {
    width: COMPARISON_WIDTH,
    height: COMPARISON_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  comparisonImage: {
    width: COMPARISON_WIDTH,
    height: COMPARISON_HEIGHT,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  enhancedClip: {
    height: COMPARISON_HEIGHT,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  sliderLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  sliderHandle: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  sliderHandleInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelContainer: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  labelLeft: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  labelRight: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 24,
    paddingHorizontal: 4,
    width: '100%',
  },
  tryAnotherButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.light.surface,
    borderWidth: 2,
    borderColor: Colors.light.accent,
    marginRight: 8,
  },
  tryAnotherText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.accent,
    marginLeft: 6,
  },
  applyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.light.accent,
    marginLeft: 8,
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 6,
  },
});
