/**
 * AdjustableSlotPreview Component
 * 
 * Displays an image within a slot frame with adjustments applied.
 * Used to preview how an image looks with translateX, translateY, and scale.
 * 
 * This is a display-only component - for interactive adjustment,
 * see ImageAdjustmentScreen.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Colors from '@/constants/colors';

const AnimatedImage = Animated.createAnimatedComponent(Image);

interface AdjustableSlotPreviewProps {
  /** Image URI to display */
  imageUri: string;
  /** Width of the image in pixels */
  imageWidth: number;
  /** Height of the image in pixels */
  imageHeight: number;
  /** Width of the slot/frame in display pixels */
  frameWidth: number;
  /** Height of the slot/frame in display pixels */
  frameHeight: number;
  /** Adjustments to apply */
  adjustments?: {
    translateX: number;
    translateY: number;
    scale: number;
  };
  /** Border radius for the frame */
  borderRadius?: number;
  /** Whether to show a border around the frame */
  showBorder?: boolean;
}

/**
 * AdjustableSlotPreview - Renders an image with pan/zoom adjustments applied
 * 
 * The adjustments work as follows:
 * - scale: 1.0 means the image exactly fills the frame, >1.0 means zoomed in
 * - translateX: -0.5 to 0.5, moves the image left/right (relative to excess width)
 * - translateY: -0.5 to 0.5, moves the image up/down (relative to excess height)
 */
export function AdjustableSlotPreview({
  imageUri,
  imageWidth,
  imageHeight,
  frameWidth,
  frameHeight,
  adjustments,
  borderRadius = 8,
  showBorder = false,
}: AdjustableSlotPreviewProps) {
  const { translateX, translateY, scale } = adjustments || {
    translateX: 0,
    translateY: 0,
    scale: 1.0,
  };

  // Calculate how the image should be sized to fill the frame at scale 1.0
  const imageAspect = imageWidth / imageHeight;
  const frameAspect = frameWidth / frameHeight;

  // Calculate the base image size that fills the frame (cover mode)
  const baseImageSize = useMemo(() => {
    if (imageAspect > frameAspect) {
      // Image is wider - height fills frame
      return {
        width: frameHeight * imageAspect,
        height: frameHeight,
      };
    } else {
      // Image is taller - width fills frame
      return {
        width: frameWidth,
        height: frameWidth / imageAspect,
      };
    }
  }, [imageAspect, frameAspect, frameWidth, frameHeight]);

  // Calculate the scaled image size
  const scaledSize = useMemo(() => ({
    width: baseImageSize.width * scale,
    height: baseImageSize.height * scale,
  }), [baseImageSize, scale]);

  // Calculate the translation in pixels
  // At scale 1.0, translateX/Y of 0.5 moves the image by half the excess width/height
  const translationPixels = useMemo(() => {
    const excessWidth = Math.max(0, scaledSize.width - frameWidth);
    const excessHeight = Math.max(0, scaledSize.height - frameHeight);
    
    return {
      x: translateX * excessWidth,
      y: translateY * excessHeight,
    };
  }, [scaledSize, frameWidth, frameHeight, translateX, translateY]);

  // Animated style for the image
  const imageStyle = useAnimatedStyle(() => ({
    width: scaledSize.width,
    height: scaledSize.height,
    transform: [
      { translateX: translationPixels.x },
      { translateY: translationPixels.y },
    ],
  }));

  return (
    <View
      style={[
        styles.container,
        {
          width: frameWidth,
          height: frameHeight,
          borderRadius,
        },
        showBorder && styles.border,
      ]}
    >
      <AnimatedImage
        source={{ uri: imageUri }}
        style={[styles.image, imageStyle]}
        contentFit="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  border: {
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  image: {
    position: 'absolute',
  },
});

export default AdjustableSlotPreview;
