/**
 * LayeredCanvas Component
 * 
 * Client-side composition of template elements for zero-API-call background color changes.
 * Renders layers in this order (bottom to top):
 * 1. Background color (solid color View)
 * 2. Theme shapes (colored rectangles at theme layer positions)
 * 3. User photos (positioned at slot coordinates)
 * 4. Frame overlay PNG (template borders, labels, watermarks)
 * 5. User overlays (text, logo, date - handled by parent)
 * 
 * This component enables instant background color switching without Templated.io API calls.
 * It also supports theme color customization for layers prefixed with 'theme-'.
 */

import React, { useMemo } from 'react';
import { View, Image, StyleSheet, ImageStyle, ViewStyle } from 'react-native';
import { Template, CapturedImages, Slot, ThemeLayer } from '@/types';

interface LayeredCanvasProps {
  /** Template data including frameOverlayUrl and themeLayers */
  template: Template;
  /** Parsed slots from template layers */
  slots: Slot[];
  /** User's captured images keyed by slot ID */
  capturedImages: CapturedImages;
  /** Current background color (hex) */
  backgroundColor: string;
  /** Current theme color for theme layers (hex) */
  themeColor?: string;
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
  themeColor,
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

  // Get style for a theme layer shape
  const getThemeLayerStyle = (layer: ThemeLayer): ViewStyle => {
    const style: ViewStyle = {
      position: 'absolute',
      left: layer.x * scale.x,
      top: layer.y * scale.y,
      width: layer.width * scale.x,
      height: layer.height * scale.y,
      backgroundColor: themeColor || backgroundColor,
    };

    // Apply border radius if specified
    if (layer.borderRadius && layer.borderRadius > 0) {
      style.borderRadius = layer.borderRadius * Math.min(scale.x, scale.y);
    }

    // Apply rotation if specified
    if (layer.rotation && layer.rotation !== 0) {
      style.transform = [{ rotate: `${layer.rotation}deg` }];
    }

    return style;
  };

  // Check if we have any photos captured
  const hasPhotos = useMemo(() => {
    return Object.values(capturedImages).some(img => img !== null);
  }, [capturedImages]);

  // Check if we have theme layers
  const hasThemeLayers = useMemo(() => {
    return template.themeLayers && template.themeLayers.length > 0;
  }, [template.themeLayers]);

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

  // #region agent log
  console.log('[LayeredCanvas] Rendering with:', {
    backgroundColor,
    themeColor: themeColor || '(none)',
    frameOverlayUrl: template.frameOverlayUrl?.substring(0, 80) + '...',
    canvasSize: `${canvasWidth}x${canvasHeight}`,
    photoCount: Object.values(capturedImages).filter(img => img !== null).length,
    themeLayerCount: template.themeLayers?.length || 0,
  });
  // #endregion

  return (
    <View style={containerStyle}>
      {/* Layer 1: Background Color - handled by container backgroundColor */}

      {/* Layer 2: Theme Shapes (colored rectangles at theme layer positions) */}
      {hasThemeLayers && themeColor && template.themeLayers?.map((layer) => (
        <View
          key={layer.id}
          style={getThemeLayerStyle(layer)}
        />
      ))}

      {/* Layer 3: User Photos */}
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

      {/* Layer 4: Frame Overlay PNG */}
      {template.frameOverlayUrl && (
        <Image
          source={{ 
            uri: template.frameOverlayUrl + (template.frameOverlayUrl.includes('?') ? '&' : '?') + `v=${template.updatedAt || Date.now()}`,
            cache: 'reload',  // Force reload to get fresh overlay
          }}
          style={frameOverlayStyle}
          resizeMode="contain"
        />
      )}

      {/* Layer 5: User Overlays (children) */}
      {children}
    </View>
  );
}

export default LayeredCanvas;
