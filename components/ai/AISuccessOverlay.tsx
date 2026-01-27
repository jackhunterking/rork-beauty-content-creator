/**
 * AI Success Overlay
 * 
 * Shows before/after comparison with draggable slider.
 * Allows user to apply or try another enhancement.
 * 
 * REFACTORED: Now uses slot-based sizing and applies image transforms
 * to show the same cropped/zoomed view as in the editor.
 */

import React, { useState, useMemo } from 'react';
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
import type { AIFeatureKey, MediaAsset } from '@/types';
import { getGradientPoints } from '@/constants/gradients';
import { calculateRenderParams } from '@/utils/transformCalculator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Max dimensions for the comparison container (will be adjusted based on slot AR)
const MAX_COMPARISON_WIDTH = SCREEN_WIDTH - 48;
const MAX_COMPARISON_HEIGHT = 400;

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
  /** Background info for displaying the NEW state (what user is applying) */
  newBackgroundInfo?: BackgroundInfo;
  /** Background info for displaying the PREVIOUS state (what user currently has) */
  previousBackgroundInfo?: BackgroundInfo;
  /** Slot dimensions for proper container sizing */
  slotDimensions?: { width: number; height: number };
  /** Original image dimensions for transform calculations */
  imageSize?: { width: number; height: number };
  /** User's zoom/pan/rotation adjustments to apply to the preview */
  imageAdjustments?: MediaAsset['adjustments'];
}

export default function AISuccessOverlay({
  originalUri,
  enhancedUri,
  featureKey,
  onKeepEnhanced,
  onRevert,
  newBackgroundInfo,
  previousBackgroundInfo,
  slotDimensions,
  imageSize,
  imageAdjustments,
}: AISuccessOverlayProps) {
  const labels = FEATURE_LABELS[featureKey] || FEATURE_LABELS.auto_quality;

  // Calculate container dimensions based on slot aspect ratio
  const { containerWidth, containerHeight } = useMemo(() => {
    if (!slotDimensions || slotDimensions.width === 0 || slotDimensions.height === 0) {
      // Fallback to old behavior if no slot dimensions
      return { containerWidth: MAX_COMPARISON_WIDTH, containerHeight: MAX_COMPARISON_WIDTH * 1.25 };
    }
    
    const slotAR = slotDimensions.width / slotDimensions.height;
    
    // Fit container within MAX bounds while maintaining slot aspect ratio
    let width = MAX_COMPARISON_WIDTH;
    let height = width / slotAR;
    
    // If too tall, constrain by height
    if (height > MAX_COMPARISON_HEIGHT) {
      height = MAX_COMPARISON_HEIGHT;
      width = height * slotAR;
    }
    
    return { containerWidth: width, containerHeight: height };
  }, [slotDimensions]);

  // Calculate transform parameters for applying adjustments to images
  const transformParams = useMemo(() => {
    if (!imageSize || !slotDimensions || !imageAdjustments) {
      return null;
    }
    
    return calculateRenderParams(
      { width: imageSize.width, height: imageSize.height },
      { width: slotDimensions.width, height: slotDimensions.height },
      {
        scale: imageAdjustments.scale ?? 1,
        translateX: imageAdjustments.translateX ?? 0,
        translateY: imageAdjustments.translateY ?? 0,
        rotation: imageAdjustments.rotation ?? 0,
      }
    );
  }, [imageSize, slotDimensions, imageAdjustments]);

  // Calculate the scale ratio from slot dimensions to container dimensions
  const displayScale = useMemo(() => {
    if (!slotDimensions || slotDimensions.width === 0) return 1;
    return containerWidth / slotDimensions.width;
  }, [containerWidth, slotDimensions]);

  // Slider position (0-1, 0.5 = middle)
  const sliderPosition = useSharedValue(0.5);
  const [isDragging, setIsDragging] = useState(false);
  
  // Pan gesture for slider - uses containerWidth for calculations
  const panGesture = Gesture.Pan()
    .onBegin(() => {
      runOnJS(setIsDragging)(true);
    })
    .onUpdate((event) => {
      const newPosition = Math.max(0.05, Math.min(0.95, (event.x) / containerWidth));
      sliderPosition.value = newPosition;
    })
    .onEnd(() => {
      runOnJS(setIsDragging)(false);
    });
  
  // Animated styles for the comparison - use containerWidth
  const enhancedClipStyle = useAnimatedStyle(() => ({
    width: sliderPosition.value * containerWidth,
  }));
  
  const sliderLineStyle = useAnimatedStyle(() => ({
    left: sliderPosition.value * containerWidth - 2,
  }));
  
  const sliderHandleStyle = useAnimatedStyle(() => ({
    left: sliderPosition.value * containerWidth - 20,
    transform: [{ scale: withSpring(isDragging ? 1.1 : 1) }],
  }));

  // Helper to render an image with transforms applied
  const renderTransformedImage = (uri: string, isFullWidth: boolean = false) => {
    // Use fixed width for clipped (enhanced) side
    const imageContainerWidth = isFullWidth ? containerWidth : containerWidth;
    
    // If we have valid transforms, apply them
    if (transformParams && displayScale) {
      // Scale from slot coordinates to container coordinates
      const scaledWidth = transformParams.scaledSize.width * displayScale;
      const scaledHeight = transformParams.scaledSize.height * displayScale;
      const scaledLeft = transformParams.offset.x * displayScale;
      const scaledTop = transformParams.offset.y * displayScale;
      
      return (
        <View style={{ width: imageContainerWidth, height: containerHeight, overflow: 'hidden', position: 'absolute', top: 0, left: 0 }}>
          <ExpoImage
            source={{ uri }}
            style={{
              width: scaledWidth,
              height: scaledHeight,
              position: 'absolute',
              left: scaledLeft,
              top: scaledTop,
              transform: [{ rotate: `${transformParams.rotation}deg` }],
            }}
            contentFit="fill"
            cachePolicy="none"
          />
        </View>
      );
    }
    
    // Fallback: use cover fit (no transforms)
    return (
      <ExpoImage
        source={{ uri }}
        style={{
          width: imageContainerWidth,
          height: containerHeight,
          position: 'absolute',
          top: 0,
          left: 0,
        }}
        contentFit="cover"
        cachePolicy="none"
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="checkmark-circle" size={28} color={Colors.light.success} />
        <Text style={styles.title}>Looking great!</Text>
        <Text style={styles.subtitle}>Drag to compare before & after</Text>
      </View>

      {/* Before/After Comparison - now uses dynamic sizing based on slot dimensions */}
      <GestureDetector gesture={panGesture}>
        <View style={[styles.comparisonContainer, { width: containerWidth, height: containerHeight }]}>
          {/* ====== ORIGINAL SIDE (right) - What user currently has ====== */}
          {/* Background for ORIGINAL: use previousBackgroundInfo, or white if transparent/none */}
          {previousBackgroundInfo?.type === 'solid' && previousBackgroundInfo.solidColor ? (
            <View 
              style={[{ width: containerWidth, height: containerHeight, position: 'absolute', backgroundColor: previousBackgroundInfo.solidColor }]} 
            />
          ) : previousBackgroundInfo?.type === 'gradient' && previousBackgroundInfo.gradient ? (
            <LinearGradient
              colors={previousBackgroundInfo.gradient.colors}
              {...getGradientPoints(previousBackgroundInfo.gradient.direction)}
              style={[{ width: containerWidth, height: containerHeight, position: 'absolute' }]}
            />
          ) : (featureKey === 'background_replace' || featureKey === 'background_remove') ? (
            // For background features with no previous bg: show white (user has transparent PNG)
            <View 
              style={[{ width: containerWidth, height: containerHeight, position: 'absolute', backgroundColor: '#FFFFFF' }]} 
            />
          ) : null}
          {/* The original image on top of its background - WITH TRANSFORMS */}
          {renderTransformedImage(originalUri)}
          
          {/* ====== ENHANCED SIDE (left) - What user will get ====== */}
          <Animated.View style={[styles.enhancedClip, enhancedClipStyle, { height: containerHeight }]}>
            {/* Background for ENHANCED: use newBackgroundInfo */}
            {/* For background_remove: always use white (result is transparent PNG on white) */}
            {featureKey === 'background_remove' && (
              <View 
                style={[
                  { width: containerWidth, height: containerHeight, position: 'absolute', backgroundColor: '#FFFFFF' }
                ]} 
              />
            )}
            {/* For background_replace: use the NEW selected color/gradient */}
            {featureKey === 'background_replace' && newBackgroundInfo?.type === 'solid' && newBackgroundInfo.solidColor && (
              <View 
                style={[
                  { width: containerWidth, height: containerHeight, position: 'absolute', backgroundColor: newBackgroundInfo.solidColor }
                ]} 
              />
            )}
            {featureKey === 'background_replace' && newBackgroundInfo?.type === 'gradient' && newBackgroundInfo.gradient && (
              <LinearGradient
                colors={newBackgroundInfo.gradient.colors}
                {...getGradientPoints(newBackgroundInfo.gradient.direction)}
                style={[{ width: containerWidth, height: containerHeight, position: 'absolute' }]}
              />
            )}
            {/* The enhanced image on top - WITH TRANSFORMS */}
            {renderTransformedImage(enhancedUri, true)}
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
    // Width and height now set dynamically based on slot dimensions
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  enhancedClip: {
    // Height now set dynamically
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
