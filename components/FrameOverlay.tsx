import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { ImageSlot } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FrameOverlayProps {
  slot: ImageSlot;
  label?: string;
  showCorners?: boolean;
}

/**
 * FrameOverlay displays a visual guide over the camera preview
 * that matches the aspect ratio of the target image slot.
 * 
 * The overlay calculates the aspect ratio from pixel dimensions
 * and renders a centered frame guide for the user to align their shot.
 */
export function FrameOverlay({ slot, label, showCorners = true }: FrameOverlayProps) {
  // Calculate aspect ratio from pixel dimensions
  const aspectRatio = slot.width / slot.height;
  
  // Calculate frame dimensions that fit within the screen
  // while maintaining the target aspect ratio
  const frameDimensions = useMemo(() => {
    const maxWidth = SCREEN_WIDTH * 0.85;
    const maxHeight = SCREEN_HEIGHT * 0.65;
    
    let frameWidth: number;
    let frameHeight: number;
    
    // Determine which dimension is the limiting factor
    if (maxWidth / maxHeight > aspectRatio) {
      // Height is the limiting factor
      frameHeight = maxHeight;
      frameWidth = frameHeight * aspectRatio;
    } else {
      // Width is the limiting factor
      frameWidth = maxWidth;
      frameHeight = frameWidth / aspectRatio;
    }
    
    return { width: frameWidth, height: frameHeight };
  }, [aspectRatio]);

  const cornerSize = Math.min(frameDimensions.width, frameDimensions.height) * 0.08;
  const cornerThickness = 3;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Semi-transparent overlay around the frame */}
      <View style={styles.overlayContainer}>
        {/* Top dark area */}
        <View style={[styles.darkArea, { flex: 1 }]} />
        
        {/* Middle row with frame */}
        <View style={styles.middleRow}>
          {/* Left dark area */}
          <View style={[styles.darkArea, { flex: 1 }]} />
          
          {/* Clear frame area */}
          <View 
            style={[
              styles.frameArea, 
              { 
                width: frameDimensions.width, 
                height: frameDimensions.height 
              }
            ]}
          >
            {/* Frame border */}
            <View style={styles.frameBorder}>
              {showCorners && (
                <>
                  {/* Top-left corner */}
                  <View style={[styles.corner, styles.cornerTopLeft]}>
                    <View style={[styles.cornerHorizontal, { width: cornerSize, height: cornerThickness }]} />
                    <View style={[styles.cornerVertical, { width: cornerThickness, height: cornerSize }]} />
                  </View>
                  
                  {/* Top-right corner */}
                  <View style={[styles.corner, styles.cornerTopRight]}>
                    <View style={[styles.cornerHorizontal, { width: cornerSize, height: cornerThickness }]} />
                    <View style={[styles.cornerVertical, { width: cornerThickness, height: cornerSize }]} />
                  </View>
                  
                  {/* Bottom-left corner */}
                  <View style={[styles.corner, styles.cornerBottomLeft]}>
                    <View style={[styles.cornerHorizontal, { width: cornerSize, height: cornerThickness }]} />
                    <View style={[styles.cornerVertical, { width: cornerThickness, height: cornerSize }]} />
                  </View>
                  
                  {/* Bottom-right corner */}
                  <View style={[styles.corner, styles.cornerBottomRight]}>
                    <View style={[styles.cornerHorizontal, { width: cornerSize, height: cornerThickness }]} />
                    <View style={[styles.cornerVertical, { width: cornerThickness, height: cornerSize }]} />
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
          <View style={[styles.darkArea, { flex: 1 }]} />
        </View>
        
        {/* Bottom dark area */}
        <View style={[styles.darkArea, { flex: 1 }]} />
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
  },
  frameBorder: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
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

