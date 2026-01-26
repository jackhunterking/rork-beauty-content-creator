/**
 * LogoOverlayContent Component
 * 
 * Renders logo image content for logo overlays
 * with aspect ratio preservation and PNG transparency support.
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
  /** Show checkerboard pattern behind transparent areas (for editing visibility) */
  showTransparencyGrid?: boolean;
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

/**
 * Checkerboard pattern component for transparency visualization
 * Similar to Photoshop's transparency grid
 */
function TransparencyGrid({ width, height }: { width: number; height: number }) {
  const gridSize = 8; // Size of each checkerboard square
  const cols = Math.ceil(width / gridSize);
  const rows = Math.ceil(height / gridSize);
  
  return (
    <View style={[styles.transparencyGrid, { width, height }]}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <View key={rowIndex} style={styles.transparencyRow}>
          {Array.from({ length: cols }).map((_, colIndex) => (
            <View
              key={colIndex}
              style={[
                styles.transparencySquare,
                {
                  width: gridSize,
                  height: gridSize,
                  backgroundColor: (rowIndex + colIndex) % 2 === 0 
                    ? '#FFFFFF' 
                    : '#E0E0E0',
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function LogoOverlayContent({ 
  overlay, 
  baseSize = 100,
  showTransparencyGrid = false,
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

  // Get opacity value (default to 1 if not set)
  const opacity = overlay.opacity ?? 1;

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <View style={[styles.container, dimensions, { opacity }]}>
      {/* Optional transparency grid background */}
      {showTransparencyGrid && !hasError && (
        <TransparencyGrid width={dimensions.width} height={dimensions.height} />
      )}

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
          // Ensure transparency is preserved
          cachePolicy="memory-disk"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    // Transparent background to properly show PNG transparency
    backgroundColor: 'transparent',
  },
  image: {
    // No borderRadius to preserve transparent edges of PNG logos
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
  // Transparency grid styles
  transparencyGrid: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 4,
  },
  transparencyRow: {
    flexDirection: 'row',
  },
  transparencySquare: {
    // Dimensions set dynamically
  },
});

export default LogoOverlayContent;
