/**
 * LayeredCanvas Component
 * 
 * Client-side composition of template elements for zero-API-call background color changes.
 * Renders layers in this order (bottom to top):
 * 1. Background color (solid color View)
 * 2. Theme layers (colored shapes or styled text at theme layer positions)
 * 3. User photos (positioned at slot coordinates)
 * 4. Frame overlay PNG (template borders, labels, watermarks)
 * 5. User overlays (text, logo, date - handled by parent)
 * 
 * This component enables instant background color switching without Templated.io API calls.
 * It also supports theme color customization for layers prefixed with 'theme-'.
 * 
 * Theme Layer Types:
 * - 'shape': Renders as colored View (rectangle/background)
 * - 'text': Renders as styled Text with customizable color
 */

import React, { useMemo } from 'react';
import { View, Image, Text, StyleSheet, ImageStyle, ViewStyle, TextStyle } from 'react-native';
import { Template, CapturedImages, Slot, ThemeLayer, isTextThemeLayer, TextThemeLayer, ShapeThemeLayer } from '@/types';

// Font mapping from Templated.io fonts to React Native fonts
const TEMPLATED_FONT_MAP: Record<string, string> = {
  // Sans-serif fonts
  'Noto Sans': 'System',
  'Arial': 'Helvetica',
  'Helvetica': 'Helvetica',
  'Roboto': 'System',
  'Open Sans': 'System',
  'Inter': 'System',
  'Montserrat': 'System',
  'Lato': 'System',
  'Poppins': 'System',
  
  // Serif fonts
  'Times New Roman': 'Georgia',
  'Georgia': 'Georgia',
  'Playfair Display': 'Georgia',
  'Merriweather': 'Georgia',
  
  // Default fallback
  'System': 'System',
};

/**
 * Map Templated.io font family to React Native compatible font
 */
function mapFont(templatedFont: string | undefined): string {
  if (!templatedFont) return 'System';
  return TEMPLATED_FONT_MAP[templatedFont] || 'System';
}

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

  // Get style for a shape theme layer (colored rectangle)
  const getShapeLayerStyle = (layer: ShapeThemeLayer | ThemeLayer): ViewStyle => {
    const style: ViewStyle = {
      position: 'absolute',
      left: layer.x * scale.x,
      top: layer.y * scale.y,
      width: layer.width * scale.x,
      height: layer.height * scale.y,
      backgroundColor: themeColor || backgroundColor,
      // Apply opacity from template (defaults to 1.0 if not specified)
      opacity: layer.opacity ?? 1.0,
    };

    // Apply border radius if specified (shape layers only)
    if ('borderRadius' in layer && layer.borderRadius && layer.borderRadius > 0) {
      style.borderRadius = layer.borderRadius * Math.min(scale.x, scale.y);
    }

    // Apply rotation if specified
    if (layer.rotation && layer.rotation !== 0) {
      style.transform = [{ rotate: `${layer.rotation}deg` }];
    }

    return style;
  };

  // Get style for a text theme layer container
  // Use ORIGINAL Templated.io dimensions - text lays out first, then container rotates
  const getTextLayerContainerStyle = (layer: TextThemeLayer): ViewStyle => {
    // Scale the original dimensions (DO NOT swap for rotation)
    const scaledWidth = layer.width * scale.x;
    const scaledHeight = layer.height * scale.y;
    
    // Position: Templated.io x,y is the top-left corner of the unrotated element
    // The rotation happens around the CENTER of the element
    const left = layer.x * scale.x;
    const top = layer.y * scale.y;
    
    const style: ViewStyle = {
      position: 'absolute',
      left,
      top,
      width: scaledWidth,
      height: scaledHeight,
      // Center the text within the container
      justifyContent: 'center',
      alignItems: 'center',
      // No background - text only (transparent container)
      // Apply opacity from template (defaults to 1.0 if not specified)
      opacity: layer.opacity ?? 1.0,
    };

    // Apply rotation around center (React Native default behavior)
    if (layer.rotation && layer.rotation !== 0) {
      style.transform = [{ rotate: `${layer.rotation}deg` }];
    }

    return style;
  };

  // Get text style for a text theme layer
  const getTextLayerStyle = (layer: TextThemeLayer): TextStyle => {
    // Calculate scaled font size - use uniform scale to maintain proportions
    const uniformScale = Math.min(scale.x, scale.y);
    const scaledFontSize = (layer.fontSize || 16) * uniformScale;
    
    const style: TextStyle = {
      color: themeColor || '#000000', // Use theme color (dynamic) or default black
      fontSize: scaledFontSize,
      fontWeight: layer.fontWeight as TextStyle['fontWeight'] || 'normal',
      textAlign: 'center',
    };

    // Apply font family mapping
    const mappedFont = mapFont(layer.fontFamily);
    if (mappedFont !== 'System') {
      style.fontFamily = mappedFont;
    }

    // Apply letter spacing if specified
    if (layer.letterSpacing !== undefined) {
      style.letterSpacing = layer.letterSpacing * uniformScale;
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

  // Container style - keeps overflow hidden for proper canvas clipping
  const containerStyle: ViewStyle = useMemo(() => {
    return {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: backgroundColor,
      position: 'relative',
      overflow: 'hidden',
      // DEBUG: Add border to see container bounds
      // borderWidth: 5,
      // borderColor: '#FF00FF', // Magenta
    };
  }, [canvasWidth, canvasHeight, backgroundColor]);
  
  // Theme layer wrapper style - allows rotated layers to show even if
  // their unrotated bounding box extends outside the canvas
  const themeLayerWrapperStyle: ViewStyle = useMemo(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: canvasWidth,
    height: canvasHeight,
    overflow: 'visible', // Allow rotated text to show outside bounds
  }), [canvasWidth, canvasHeight]);

  // Frame overlay style
  const frameOverlayStyle: ImageStyle = useMemo(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: canvasWidth,
    height: canvasHeight,
  }), [canvasWidth, canvasHeight]);

  // Render a single theme layer (text or shape)
  const renderThemeLayer = (layer: ThemeLayer) => {
    // Check if this is a text layer
    if (isTextThemeLayer(layer)) {
      const containerStyle = getTextLayerContainerStyle(layer as TextThemeLayer);
      const textStyle = getTextLayerStyle(layer as TextThemeLayer);
      
      return (
        <View key={layer.id} style={containerStyle}>
          <Text style={textStyle}>
            {(layer as TextThemeLayer).text}
          </Text>
        </View>
      );
    }

    // Shape layer - only render if we have a theme color
    if (themeColor) {
      return (
        <View
          key={layer.id}
          style={getShapeLayerStyle(layer)}
        />
      );
    }

    return null;
  };

  return (
    <View style={containerStyle}>
      {/* Layer 1: User Photos */}
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

      {/* Layer 2: Frame Overlay PNG */}
      {template.frameOverlayUrl && (
        <Image
          source={{ uri: template.frameOverlayUrl }}
          style={frameOverlayStyle}
          resizeMode="contain"
        />
      )}

      {/* Layer 3: Theme Layers (rendered on top of frame overlay) */}
      {hasThemeLayers && (
        <View style={[themeLayerWrapperStyle, { zIndex: 10 }]}>
          {template.themeLayers?.map(renderThemeLayer)}
        </View>
      )}

      {/* Layer 4: User Overlays (children) */}
      {children}
    </View>
  );
}

export default LayeredCanvas;
