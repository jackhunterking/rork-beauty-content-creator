/**
 * WatermarkOverlay Component
 * 
 * Renders a diagonal repeating "RESULTA" watermark pattern across the canvas.
 * Used for free users to prevent screenshot bypass of the paywall.
 * 
 * Design specs:
 * - Text: "RESULTA" (can be replaced with SVG/PNG logo later)
 * - Pattern: Diagonal rows with offset (checkerboard-style)
 * - Opacity: 15% (subtle - visible but doesn't distract)
 * - Rotation: -30 degrees
 * - Color: Dark gray (#333333)
 * 
 * Usage:
 * <WatermarkOverlay visible={!isPremium} />
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface WatermarkOverlayProps {
  /** Whether to show the watermark */
  visible: boolean;
  /** Canvas width in pixels */
  canvasWidth?: number;
  /** Canvas height in pixels */
  canvasHeight?: number;
  /** Custom watermark text (default: "RESULTA") */
  text?: string;
  /** Opacity from 0 to 1 (default: 0.15 for subtle) */
  opacity?: number;
  /** Font size in pixels (default: 24) */
  fontSize?: number;
  /** Rotation angle in degrees (default: -30) */
  rotation?: number;
  /** Spacing between watermark texts (default: 80) */
  spacing?: number;
}

/**
 * WatermarkOverlay - Diagonal repeating text pattern
 * 
 * Creates a grid of rotated text elements that tile across the canvas.
 * The pattern is designed to be visible but not intrusive, ensuring
 * the user can still evaluate their design while preventing usable screenshots.
 */
export function WatermarkOverlay({
  visible,
  canvasWidth = 300,
  canvasHeight = 400,
  text = 'RESULTA',
  opacity = 0.15,
  fontSize = 24,
  rotation = -30,
  spacing = 80,
}: WatermarkOverlayProps) {
  // Don't render if not visible
  if (!visible) return null;

  // Calculate the number of rows and columns needed to cover the canvas
  // We need extra coverage because of the rotation
  const watermarkItems = useMemo(() => {
    const items: { x: number; y: number; key: string }[] = [];
    
    // Estimate text width based on font size and character count
    // Average character width is roughly 0.6x font size for bold fonts
    const estimatedTextWidth = text.length * fontSize * 0.65;
    
    // Use horizontal spacing that accounts for text width + gap
    const horizontalSpacing = Math.max(spacing, estimatedTextWidth + 40);
    // Vertical spacing should be comfortable
    const verticalSpacing = Math.max(spacing, fontSize * 2.5);
    
    // Calculate diagonal coverage - need more items due to rotation
    const diagonalMultiplier = 1.8; // Extra coverage for rotation
    const cols = Math.ceil((canvasWidth * diagonalMultiplier) / horizontalSpacing) + 2;
    const rows = Math.ceil((canvasHeight * diagonalMultiplier) / verticalSpacing) + 2;
    
    // Start offset to ensure coverage at edges
    const startX = -horizontalSpacing;
    const startY = -verticalSpacing;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Offset every other row for staggered pattern
        const offsetX = row % 2 === 0 ? 0 : horizontalSpacing / 2;
        
        items.push({
          x: startX + col * horizontalSpacing + offsetX,
          y: startY + row * verticalSpacing,
          key: `wm-${row}-${col}`,
        });
      }
    }
    
    return items;
  }, [canvasWidth, canvasHeight, spacing, fontSize, text.length]);

  return (
    <View 
      style={[
        styles.container,
        { width: canvasWidth, height: canvasHeight }
      ]}
      pointerEvents="none"
    >
      <View 
        style={[
          styles.rotatedContainer,
          { transform: [{ rotate: `${rotation}deg` }] }
        ]}
      >
        {watermarkItems.map((item) => (
          <Text
            key={item.key}
            style={[
              styles.watermarkText,
              {
                left: item.x,
                top: item.y,
                fontSize,
                opacity,
              }
            ]}
          >
            {text}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
    zIndex: 9999, // Ensure watermark is on top of everything
  },
  rotatedContainer: {
    position: 'absolute',
    // Center the rotation point and expand to cover rotated area
    top: '-50%',
    left: '-50%',
    width: '200%',
    height: '200%',
  },
  watermarkText: {
    position: 'absolute',
    color: '#333333',
    fontWeight: '700',
    letterSpacing: 2,
    // Prevent text selection
    userSelect: 'none',
  },
});

export default WatermarkOverlay;
