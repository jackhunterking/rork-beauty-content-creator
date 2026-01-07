import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { ImageSlot } from '@/types';
import { calculateFrameDimensions } from '@/utils/frameCalculator';

interface FrameOverlayProps {
  slot: ImageSlot;
  label?: string;
  showCorners?: boolean;
  previewUri?: string; // When provided, display the captured image inside the frame
}

/**
 * FrameOverlay displays a visual guide over the camera preview
 * that matches the aspect ratio of the target image slot.
 * 
 * The overlay calculates the aspect ratio from pixel dimensions
 * and renders a centered frame guide for the user to align their shot.
 * 
 * When previewUri is provided, it displays the captured image inside
 * the same frame area, ensuring visual consistency between capture and preview.
 */
export function FrameOverlay({ slot, label, showCorners = true, previewUri }: FrameOverlayProps) {
  // Calculate frame dimensions using the centralized calculator
  // This handles dynamic aspect ratios and enforces minimum dimensions
  const frameCalculation = useMemo(() => {
    return calculateFrameDimensions(slot);
  }, [slot]);

  const cornerSize = Math.min(frameCalculation.width, frameCalculation.height) * 0.08;
  const cornerThickness = 3;

  // Always fully black outside frame - frame acts as a window
  const overlayOpacity = 1.0;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Semi-transparent (or opaque when preview) overlay around the frame */}
      <View style={styles.overlayContainer}>
        {/* Top dark area */}
        <View style={[styles.darkArea, { flex: 1, backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }]} />
        
        {/* Middle row with frame */}
        <View style={styles.middleRow}>
          {/* Left dark area */}
          <View style={[styles.darkArea, { flex: 1, backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }]} />
          
          {/* Frame area - shows either camera view or captured image */}
          <View 
            style={[
              styles.frameArea, 
              { 
                width: frameCalculation.width, 
                height: frameCalculation.height 
              }
            ]}
          >
            {/* Preview image inside frame (when captured) */}
            {previewUri && (
              <Image
                source={{ uri: previewUri }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
              />
            )}
            
            {/* Frame border */}
            <View style={[styles.frameBorder, previewUri && styles.frameBorderPreview]}>
              {showCorners && (
                <>
                  {/* Top-left corner - bars point right and down */}
                  <View style={[styles.corner, styles.cornerTopLeft]}>
                    <View style={[styles.cornerHorizontal, { width: cornerSize, height: cornerThickness, top: 0, left: 0 }]} />
                    <View style={[styles.cornerVertical, { width: cornerThickness, height: cornerSize, top: 0, left: 0 }]} />
                  </View>
                  
                  {/* Top-right corner - bars point left and down */}
                  <View style={[styles.corner, styles.cornerTopRight]}>
                    <View style={[styles.cornerHorizontal, { width: cornerSize, height: cornerThickness, top: 0, right: 0 }]} />
                    <View style={[styles.cornerVertical, { width: cornerThickness, height: cornerSize, top: 0, right: 0 }]} />
                  </View>
                  
                  {/* Bottom-left corner - bars point right and up */}
                  <View style={[styles.corner, styles.cornerBottomLeft]}>
                    <View style={[styles.cornerHorizontal, { width: cornerSize, height: cornerThickness, bottom: 0, left: 0 }]} />
                    <View style={[styles.cornerVertical, { width: cornerThickness, height: cornerSize, bottom: 0, left: 0 }]} />
                  </View>
                  
                  {/* Bottom-right corner - bars point left and up */}
                  <View style={[styles.corner, styles.cornerBottomRight]}>
                    <View style={[styles.cornerHorizontal, { width: cornerSize, height: cornerThickness, bottom: 0, right: 0 }]} />
                    <View style={[styles.cornerVertical, { width: cornerThickness, height: cornerSize, bottom: 0, right: 0 }]} />
                  </View>
                </>
              )}
            </View>
            
            {/* Dimension label */}
            {label && (
              <View style={styles.labelContainer}>
                <Text style={styles.labelText}>{label}</Text>
              </View>
            )}
          </View>
          
          {/* Right dark area */}
          <View style={[styles.darkArea, { flex: 1, backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }]} />
        </View>
        
        {/* Bottom dark area */}
        <View style={[styles.darkArea, { flex: 1, backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  overlayContainer: {
    flex: 1,
  },
  darkArea: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  middleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  frameArea: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 4,
  },
  frameBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
  },
  frameBorderPreview: {
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  corner: {
    position: 'absolute',
  },
  cornerTopLeft: {
    top: -1,
    left: -1,
  },
  cornerTopRight: {
    top: -1,
    right: -1,
  },
  cornerBottomLeft: {
    bottom: -1,
    left: -1,
  },
  cornerBottomRight: {
    bottom: -1,
    right: -1,
  },
  cornerHorizontal: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  cornerVertical: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  labelContainer: {
    position: 'absolute',
    bottom: -30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  labelText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
});

export default FrameOverlay;
