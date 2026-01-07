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
 * Uses absolute positioning for precise mask regions:
 * - Top mask: covers from screen top to frame top
 * - Bottom mask: covers from frame bottom to screen bottom
 * - Left mask: covers from screen left to frame left (frame height only)
 * - Right mask: covers from frame right to screen right (frame height only)
 * 
 * The frame area itself is transparent to show camera/preview content.
 * When previewUri is provided, it displays the captured image inside
 * the frame area, ensuring visual consistency between capture and preview.
 */
export function FrameOverlay({ slot, label, showCorners = true, previewUri }: FrameOverlayProps) {
  // Calculate frame dimensions and position using the centralized calculator
  const frame = useMemo(() => {
    return calculateFrameDimensions(slot);
  }, [slot]);

  const cornerSize = Math.min(frame.width, frame.height) * 0.08;
  const cornerThickness = 3;

  // Calculate mask region dimensions
  const topMaskHeight = frame.top;
  const bottomMaskHeight = frame.screenHeight - frame.top - frame.height;
  const leftMaskWidth = frame.left;
  const rightMaskWidth = frame.screenWidth - frame.left - frame.width;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* TOP MASK - Full width, from screen top to frame top */}
      <View 
        style={[
          styles.mask,
          {
            top: 0,
            left: 0,
            right: 0,
            height: topMaskHeight,
          }
        ]} 
      />

      {/* BOTTOM MASK - Full width, from frame bottom to screen bottom */}
      <View 
        style={[
          styles.mask,
          {
            bottom: 0,
            left: 0,
            right: 0,
            height: bottomMaskHeight,
          }
        ]} 
      />

      {/* LEFT MASK - From screen left to frame left, frame height only */}
      <View 
        style={[
          styles.mask,
          {
            top: frame.top,
            left: 0,
            width: leftMaskWidth,
            height: frame.height,
          }
        ]} 
      />

      {/* RIGHT MASK - From frame right to screen right, frame height only */}
      <View 
        style={[
          styles.mask,
          {
            top: frame.top,
            right: 0,
            width: rightMaskWidth,
            height: frame.height,
          }
        ]} 
      />

      {/* FRAME AREA - The transparent window showing camera/preview */}
      <View 
        style={[
          styles.frameArea, 
          { 
            top: frame.top,
            left: frame.left,
            width: frame.width, 
            height: frame.height,
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
        
        {/* Frame border and corners */}
        <View style={[styles.frameBorder, previewUri && styles.frameBorderPreview]}>
          {showCorners && (
            <>
              {/* Top-left corner */}
              <View style={[styles.corner, styles.cornerTopLeft]}>
                <View style={[styles.cornerHorizontal, { width: cornerSize, height: cornerThickness, top: 0, left: 0 }]} />
                <View style={[styles.cornerVertical, { width: cornerThickness, height: cornerSize, top: 0, left: 0 }]} />
              </View>
              
              {/* Top-right corner */}
              <View style={[styles.corner, styles.cornerTopRight]}>
                <View style={[styles.cornerHorizontal, { width: cornerSize, height: cornerThickness, top: 0, right: 0 }]} />
                <View style={[styles.cornerVertical, { width: cornerThickness, height: cornerSize, top: 0, right: 0 }]} />
              </View>
              
              {/* Bottom-left corner */}
              <View style={[styles.corner, styles.cornerBottomLeft]}>
                <View style={[styles.cornerHorizontal, { width: cornerSize, height: cornerThickness, bottom: 0, left: 0 }]} />
                <View style={[styles.cornerVertical, { width: cornerThickness, height: cornerSize, bottom: 0, left: 0 }]} />
              </View>
              
              {/* Bottom-right corner */}
              <View style={[styles.corner, styles.cornerBottomRight]}>
                <View style={[styles.cornerHorizontal, { width: cornerSize, height: cornerThickness, bottom: 0, right: 0 }]} />
                <View style={[styles.cornerVertical, { width: cornerThickness, height: cornerSize, bottom: 0, right: 0 }]} />
              </View>
            </>
          )}
        </View>
        
        {/* Dimension label below frame */}
        {label && (
          <View style={styles.labelContainer}>
            <Text style={styles.labelText}>{label}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    // No zIndex here - let CaptureScreen control layering
  },
  mask: {
    position: 'absolute',
    backgroundColor: '#000000', // Solid black mask
  },
  frameArea: {
    position: 'absolute',
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
