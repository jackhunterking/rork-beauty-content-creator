/**
 * LayeredCanvas Component
 * 
 * Client-side composition of template elements for zero-API-call background color changes.
 * Renders layers in this order (bottom to top):
 * 1. Background color (solid color View)
 * 2. User photos (positioned at slot coordinates)
 * 3. Frame overlay PNG (template borders, labels, watermarks)
 * 4. User overlays (text, logo, date - handled by parent)
 * 
 * This component enables instant background color switching without Templated.io API calls.
 */

import React, { useMemo } from 'react';
import { View, Image, StyleSheet, ImageStyle, ViewStyle } from 'react-native';
import { Template, CapturedImages, Slot } from '@/types';

interface LayeredCanvasProps {
  /** Template data including frameOverlayUrl */
  template: Template;
  /** Parsed slots from template layers */
  slots: Slot[];
  /** User's captured images keyed by slot ID */
  capturedImages: CapturedImages;
  /** Current background color (hex) */
  backgroundColor: string;
  /** Canvas width in device pixels */
  canvasWidth: number;
  /** Canvas height in device pixels */
  canvasHeight: number;
  /** Children to render on top (overlays) */
  children?: React.ReactNode;
}

export function LayeredCanvas({
  template,
  slots,
  capturedImages,
  backgroundColor,
  canvasWidth,
  canvasHeight,
  children,
}: LayeredCanvasProps) {
  // Calculate scale factor from template dimensions to display dimensions
  const scale = useMemo(() => ({
    x: canvasWidth / template.canvasWidth,
    y: canvasHeight / template.canvasHeight,
  }), [canvasWidth, canvasHeight, template.canvasWidth, template.canvasHeight]);

  // Get photo style for a slot
  const getPhotoStyle = (slot: Slot): ImageStyle => {
    return {
      position: 'absolute',
      left: slot.xPercent * canvasWidth / 100,
      top: slot.yPercent * canvasHeight / 100,
      width: slot.width * scale.x,
      height: slot.height * scale.y,
    };
  };

  // Check if we have any photos captured
  const hasPhotos = useMemo(() => {
    return Object.values(capturedImages).some(img => img !== null);
  }, [capturedImages]);

  // Container style
  const containerStyle: ViewStyle = useMemo(() => ({
    width: canvasWidth,
    height: canvasHeight,
    backgroundColor: backgroundColor,
    position: 'relative',
    overflow: 'hidden',
  }), [canvasWidth, canvasHeight, backgroundColor]);

  // Frame overlay style
  const frameOverlayStyle: ImageStyle = useMemo(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: canvasWidth,
    height: canvasHeight,
  }), [canvasWidth, canvasHeight]);

  return (
    <View style={containerStyle}>
      {/* Layer 1: Background Color - handled by container backgroundColor */}

      {/* Layer 2: User Photos */}
      {slots.map((slot) => {
        const image = capturedImages[slot.id];
        if (!image) return null;

        return (
          <Image
            key={slot.id}
            source={{ uri: image.uri }}
            style={getPhotoStyle(slot)}
            resizeMode="cover"
          />
        );
      })}

      {/* Layer 3: Frame Overlay PNG */}
      {template.frameOverlayUrl && (
        <Image
          source={{ uri: template.frameOverlayUrl }}
          style={frameOverlayStyle}
          resizeMode="contain"
        />
      )}

      {/* Layer 4: User Overlays (children) */}
      {children}
    </View>
  );
}

export default LayeredCanvas;
