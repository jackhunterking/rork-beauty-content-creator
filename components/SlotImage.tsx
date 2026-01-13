import React, { useMemo } from 'react';
import { TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Move } from 'lucide-react-native';
import { ImageSlot, MediaAsset } from '@/types';
import Colors from '@/constants/colors';

const AnimatedImage = Animated.createAnimatedComponent(Image);

interface SlotImageProps {
  slot: ImageSlot;
  /** The captured media asset (includes uri, dimensions, and adjustments) */
  capturedMedia: MediaAsset | null;
  /** Legacy: just the URI (for backwards compatibility) */
  capturedUri?: string | null;
  onPress: () => void;
  label: 'Before' | 'After' | string;
  canvasScale: number; // Scale factor to convert from canvas pixels to display pixels
  /** Whether to show the adjust position indicator */
  showAdjustIndicator?: boolean;
}

/**
 * SlotImage component - Displays captured photo with adjustments applied
 * 
 * - Empty state: Shows the placeholder image (designed to look like a button)
 * - Filled state: Shows the user's captured/imported photo with pan/zoom adjustments
 * - Tap to trigger action sheet for capture/replace/adjust
 */
export function SlotImage({ 
  slot, 
  capturedMedia,
  capturedUri,
  onPress, 
  label,
  canvasScale,
  showAdjustIndicator = true,
}: SlotImageProps) {
  // Calculate display dimensions based on canvas scale
  const displayWidth = slot.width * canvasScale;
  const displayHeight = slot.height * canvasScale;

  // Get image URI from either capturedMedia or legacy capturedUri
  const imageUri = capturedMedia?.uri || capturedUri;
  const isFilled = !!imageUri;

  // Get adjustments (defaults if not provided)
  const adjustments = capturedMedia?.adjustments || {
    translateX: 0,
    translateY: 0,
    scale: 1.0,
  };

  // Calculate image display size based on adjustments
  // The image dimensions from capturedMedia represent the oversized image
  const imageWidth = capturedMedia?.width || slot.width;
  const imageHeight = capturedMedia?.height || slot.height;

  // Calculate base image size that fills the slot (cover mode)
  const imageAspect = imageWidth / imageHeight;
  const slotAspect = displayWidth / displayHeight;

  const baseImageSize = useMemo(() => {
    if (imageAspect > slotAspect) {
      // Image is wider - height fills slot
      return {
        width: displayHeight * imageAspect,
        height: displayHeight,
      };
    } else {
      // Image is taller - width fills slot
      return {
        width: displayWidth,
        height: displayWidth / imageAspect,
      };
    }
  }, [imageAspect, slotAspect, displayWidth, displayHeight]);

  // Calculate scaled size and translation
  const scaledSize = useMemo(() => ({
    width: baseImageSize.width * adjustments.scale,
    height: baseImageSize.height * adjustments.scale,
  }), [baseImageSize, adjustments.scale]);

  const translationPixels = useMemo(() => {
    const excessWidth = Math.max(0, scaledSize.width - displayWidth);
    const excessHeight = Math.max(0, scaledSize.height - displayHeight);
    
    return {
      x: adjustments.translateX * excessWidth,
      y: adjustments.translateY * excessHeight,
    };
  }, [scaledSize, displayWidth, displayHeight, adjustments.translateX, adjustments.translateY]);

  // Animated style for adjusted image
  const imageAnimatedStyle = useAnimatedStyle(() => ({
    width: scaledSize.width,
    height: scaledSize.height,
    transform: [
      { translateX: translationPixels.x },
      { translateY: translationPixels.y },
    ],
  }));

  // Check if adjustments have been made (non-default values)
  const hasAdjustments = adjustments.translateX !== 0 || 
                         adjustments.translateY !== 0 || 
                         adjustments.scale !== 1.0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.container,
        {
          left: `${slot.xPercent}%`,
          top: `${slot.yPercent}%`,
          width: displayWidth,
          height: displayHeight,
        },
      ]}
    >
      {isFilled && capturedMedia ? (
        // Filled with adjustable image
        <View style={styles.imageContainer}>
          <AnimatedImage
            source={{ uri: imageUri }}
            style={[styles.adjustableImage, imageAnimatedStyle]}
            contentFit="cover"
          />
        </View>
      ) : (
        // Empty or legacy mode - simple image
        <Image
          source={{ uri: imageUri || slot.placeholderUrl }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
      )}
      
      {/* Adjust position indicator for filled slots */}
      {isFilled && showAdjustIndicator && (
        <View style={styles.adjustIndicator}>
          <Move size={12} color={Colors.light.surface} />
        </View>
      )}
      
      {/* Label badge */}
      <View style={[styles.labelBadge, isFilled && styles.labelBadgeFilled]}>
        <Text style={styles.labelText}>{label}</Text>
        {hasAdjustments && (
          <View style={styles.adjustedDot} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  imageContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  adjustableImage: {
    position: 'absolute',
  },
  adjustIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  labelBadgeFilled: {
    backgroundColor: Colors.light.accent,
  },
  labelText: {
    color: Colors.light.surface,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adjustedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.surface,
  },
});

export default SlotImage;
