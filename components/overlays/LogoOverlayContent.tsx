/**
 * LogoOverlayContent Component
 * 
 * Renders logo image content for logo overlays
 * with aspect ratio preservation.
 */

import React, { useMemo, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import Colors from '@/constants/colors';
import { LogoOverlay } from '@/types/overlays';

interface LogoOverlayContentProps {
  overlay: LogoOverlay;
  /** Base size for rendering (will be scaled by transform) */
  baseSize?: number;
}

/**
 * Calculate display dimensions while preserving aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  baseSize: number
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight;
  
  if (aspectRatio >= 1) {
    // Landscape or square - fit to width
    return {
      width: baseSize,
      height: baseSize / aspectRatio,
    };
  } else {
    // Portrait - fit to height
    return {
      width: baseSize * aspectRatio,
      height: baseSize,
    };
  }
}

export function LogoOverlayContent({ 
  overlay, 
  baseSize = 100 
}: LogoOverlayContentProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Calculate dimensions
  const dimensions = useMemo(() => 
    calculateDimensions(
      overlay.originalWidth,
      overlay.originalHeight,
      baseSize
    ),
    [overlay.originalWidth, overlay.originalHeight, baseSize]
  );

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <View style={[styles.container, dimensions]}>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.light.accent} />
        </View>
      )}

      {hasError ? (
        <View style={styles.errorContainer}>
          <View style={styles.errorPlaceholder} />
        </View>
      ) : (
        <Image
          source={{ uri: overlay.imageUri }}
          style={[styles.image, dimensions]}
          contentFit="contain"
          transition={200}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    borderRadius: 4,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 4,
  },
  errorPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: Colors.light.border,
  },
});

export default LogoOverlayContent;
