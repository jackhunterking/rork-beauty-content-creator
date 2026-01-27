/**
 * TransformedImagePreview Component
 * 
 * Displays an image with transforms (scale, translate, rotate) applied,
 * matching exactly how it appears in the TemplateCanvas editor.
 * 
 * Used in AI Studio views to show the user's cropped/adjusted image
 * preview before enhancement.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { calculateRenderParams, ImageAdjustments } from '@/utils/transformCalculator';
import { getGradientPoints } from '@/constants/gradients';
import type { GradientConfig } from '@/types';

interface TransformedImagePreviewProps {
  /** Image URI to display */
  imageUri: string;
  /** Original image dimensions */
  imageSize: { width: number; height: number };
  /** Container dimensions (the "slot" in AI preview) */
  containerSize: { width: number; height: number };
  /** Image adjustments from MediaAsset */
  adjustments?: ImageAdjustments | null;
  /** Background info for transparent PNGs */
  backgroundInfo?: {
    type: 'solid' | 'gradient';
    solidColor?: string;
    gradient?: GradientConfig;
  } | null;
  /** Border radius for the container */
  borderRadius?: number;
  /** Border width */
  borderWidth?: number;
  /** Border color */
  borderColor?: string;
  /** Additional styles for the container */
  style?: object;
}

export function TransformedImagePreview({
  imageUri,
  imageSize,
  containerSize,
  adjustments,
  backgroundInfo,
  borderRadius = 16,
  borderWidth = 2,
  borderColor = 'transparent',
  style,
}: TransformedImagePreviewProps) {
  // Calculate render parameters
  const renderParams = useMemo(() => {
    return calculateRenderParams(imageSize, containerSize, adjustments);
  }, [imageSize, containerSize, adjustments]);

  const { scaledSize, offset, rotation } = renderParams;

  // Render background for transparent PNGs
  const renderBackground = () => {
    if (!backgroundInfo) return null;

    if (backgroundInfo.type === 'solid' && backgroundInfo.solidColor) {
      return (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: backgroundInfo.solidColor },
          ]}
        />
      );
    }

    if (backgroundInfo.type === 'gradient' && backgroundInfo.gradient) {
      const gradientPoints = getGradientPoints(backgroundInfo.gradient.direction);
      return (
        <LinearGradient
          colors={backgroundInfo.gradient.colors}
          start={gradientPoints.start}
          end={gradientPoints.end}
          style={StyleSheet.absoluteFill}
        />
      );
    }

    return null;
  };

  return (
    <View
      style={[
        styles.container,
        {
          width: containerSize.width,
          height: containerSize.height,
          borderRadius,
          borderWidth,
          borderColor,
        },
        style,
      ]}
    >
      {/* Background for transparent PNGs */}
      {renderBackground()}

      {/* Transformed image - clipped by container */}
      <View style={styles.imageWrapper}>
        <ExpoImage
          source={{ uri: imageUri }}
          style={[
            {
              width: scaledSize.width,
              height: scaledSize.height,
              position: 'absolute',
              left: offset.x,
              top: offset.y,
              transform: rotation !== 0 ? [{ rotate: `${rotation}deg` }] : undefined,
            },
          ]}
          contentFit="cover"
          transition={200}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#F5F5F5', // Fallback background
  },
  imageWrapper: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});

export default TransformedImagePreview;
