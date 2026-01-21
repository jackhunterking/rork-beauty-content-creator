/**
 * LayeredCanvas Component
 * 
 * Client-side composition of template elements for zero-API-call background color changes.
 * Renders layers in this order (bottom to top):
 * 1. Background color (solid color View via container backgroundColor)
 * 2. User photos (positioned at slot coordinates)
 * 3. Frame overlay PNG (card backgrounds, blur shadows, decorative elements)
 * 4. Theme layers (colored shapes/text - rendered ON TOP of frame overlay)
 * 5. User overlays (text, logo, date - handled by parent/children)
 * 
 * This component enables instant background color switching without Templated.io API calls.
 * It also supports theme color customization for layers prefixed with 'theme-'.
 * 
 * Z-Order Rationale:
 * - Frame overlay contains card backgrounds that theme layers should appear ON TOP of
 * - Theme layers (labels, circles) are rendered ABOVE the frame overlay
 * - This ensures theme elements are visible over the white card backgrounds
 * 
 * Theme Layer Types:
 * - 'shape': Renders as colored View (rectangle/circle with border radius, stroke, fill)
 * - 'text': Renders as styled Text with customizable color
 */

import React, { useMemo } from 'react';
import { View, Image, Text, ImageStyle, ViewStyle, TextStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Template, CapturedImages, Slot, ThemeLayer, isTextThemeLayer, TextThemeLayer, ShapeThemeLayer, VectorLayer, MediaAsset } from '@/types';

/**
 * Parse a color string that might be hex, rgb(), or rgba()
 * Returns the color and any embedded opacity
 */
function parseColor(colorStr: string | undefined | null): { color: string; opacity?: number } {
  if (!colorStr) return { color: 'transparent' };
  
  // Check for rgba format
  const rgbaMatch = colorStr.match(/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/i);
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    return {
      color: `rgb(${r}, ${g}, ${b})`,
      opacity: parseFloat(a),
    };
  }
  
  return { color: colorStr };
}

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


  // Get container style for a photo slot (with clipping)
  // This wraps the photo and clips it to the slot boundaries with rounded corners
  const getPhotoContainerStyle = (slot: Slot): ViewStyle => {
    // Scale border radius to match card corners (18px is common in Templated.io templates)
    const scaledBorderRadius = 18 * Math.min(scale.x, scale.y);
    
    return {
      position: 'absolute',
      left: slot.x * scale.x,
      top: slot.y * scale.y,
      width: slot.width * scale.x,
      height: slot.height * scale.y,
      zIndex: slot.zIndex || 1,
      overflow: 'hidden', // CRITICAL: Clips photo to slot boundaries
      borderRadius: scaledBorderRadius, // Match card corner radius
    };
  };
  
  // Calculate base image size for cover fit (image exactly fills slot at scale 1.0)
  const getBaseImageSize = (imageWidth: number, imageHeight: number, slotWidth: number, slotHeight: number) => {
    const imageAspect = imageWidth / imageHeight;
    const slotAspect = slotWidth / slotHeight;
    
    if (imageAspect > slotAspect) {
      // Image is wider - height fits, width overflows
      return { width: slotHeight * imageAspect, height: slotHeight };
    } else {
      // Image is taller - width fits, height overflows
      return { width: slotWidth, height: slotWidth / imageAspect };
    }
  };
  
  // Get photo style with adjustments applied (scale, translate, rotate)
  // This replicates the logic from ManipulationOverlay for consistent rendering
  const getPhotoStyleWithAdjustments = (slot: Slot, image: MediaAsset): { style: ImageStyle; hasAdjustments: boolean } => {
    const slotWidth = slot.width * scale.x;
    const slotHeight = slot.height * scale.y;
    
    // Check if we have meaningful adjustments
    const adj = image.adjustments;
    const hasAdjustments = adj && (
      adj.scale !== 1 ||
      adj.translateX !== 0 ||
      adj.translateY !== 0 ||
      (adj.rotation !== undefined && adj.rotation !== 0)
    );
    
    if (!hasAdjustments) {
      // No adjustments - use simple cover fit
      return {
        style: { width: '100%', height: '100%' },
        hasAdjustments: false,
      };
    }
    
    const { scale: imgScale, translateX: normTx, translateY: normTy, rotation = 0 } = adj!;
    
    // Calculate base image size (cover fit at scale 1.0)
    const baseSize = getBaseImageSize(image.width, image.height, slotWidth, slotHeight);
    
    // Apply scale
    const scaledWidth = baseSize.width * imgScale;
    const scaledHeight = baseSize.height * imgScale;
    
    // Calculate max translation for denormalization (same as ManipulationOverlay)
    const halfW = scaledWidth / 2;
    const halfH = scaledHeight / 2;
    const halfSlotW = slotWidth / 2;
    const halfSlotH = slotHeight / 2;
    
    const angleRad = (rotation * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const absCos = Math.abs(cos);
    const absSin = Math.abs(sin);
    
    const maxU = Math.max(0, halfW - (halfSlotW * absCos + halfSlotH * absSin));
    const maxV = Math.max(0, halfH - (halfSlotW * absSin + halfSlotH * absCos));
    
    // Denormalize translation from normalized rotated coords to actual rotated coords
    const u = normTx * maxU;
    const v = normTy * maxV;
    
    // Convert from rotated coords (u, v) to screen coords (tx, ty)
    const tx = u * cos - v * sin;
    const ty = u * sin + v * cos;
    
    // Center the image on the slot, then apply translation
    const left = (slotWidth - scaledWidth) / 2 + tx;
    const top = (slotHeight - scaledHeight) / 2 + ty;
    
    const style: ImageStyle = {
      position: 'absolute',
      left,
      top,
      width: scaledWidth,
      height: scaledHeight,
    };
    
    // Apply rotation transform if needed
    if (rotation !== 0) {
      style.transform = [{ rotate: `${rotation}deg` }];
    }
    
    return { style, hasAdjustments: true };
  };

  // Get style for a shape theme layer (colored rectangle)
  const getShapeLayerStyle = (layer: ShapeThemeLayer | ThemeLayer): ViewStyle => {
    // Determine the fill color to use:
    // - Layers with 'theme-' prefix: use themeColor (or fall back to original fill)
    // - Other layers (heart-, icon-, decoration-): keep original fill color (not themed)
    const isThemedLayer = layer.id.toLowerCase().startsWith('theme-');
    
    let fillColor: string;
    if (isThemedLayer) {
      // Theme layers use the selected theme color, or fall back to original fill
      fillColor = themeColor || (('fill' in layer && layer.fill) ? parseColor(layer.fill).color : backgroundColor);
    } else {
      // Non-theme layers (heart-, icon-, etc.) keep their original fill color
      fillColor = ('fill' in layer && layer.fill) ? parseColor(layer.fill).color : backgroundColor;
    }
    
    // Calculate final opacity
    // Combine layer opacity with any embedded opacity from fill color
    let finalOpacity = layer.opacity ?? 1.0;
    if ('fill' in layer && layer.fill) {
      const parsed = parseColor(layer.fill);
      if (parsed.opacity !== undefined) {
        // Multiply explicit opacity with color-embedded opacity
        finalOpacity = (layer.opacity ?? 1.0) * parsed.opacity;
      }
    }
    
    const style: ViewStyle = {
      position: 'absolute',
      left: layer.x * scale.x,
      top: layer.y * scale.y,
      width: layer.width * scale.x,
      height: layer.height * scale.y,
      backgroundColor: fillColor,
      opacity: finalOpacity,
      // Use layer's zIndex for proper stacking order relative to photos
      zIndex: layer.zIndex || 1,
    };

    // Apply border radius if specified (shape layers only)
    // Handle both circle/ellipse (100% radius) and rectangle with rounded corners
    if ('borderRadius' in layer && layer.borderRadius && layer.borderRadius > 0) {
      style.borderRadius = layer.borderRadius * Math.min(scale.x, scale.y);
    }
    
    // For circle/ellipse shapes, apply full border radius
    if ('shapeType' in layer) {
      const shapeType = (layer as ShapeThemeLayer).shapeType;
      if (shapeType === 'circle' || shapeType === 'ellipse') {
        // For circles/ellipses, use half the smaller dimension
        const minDim = Math.min(layer.width * scale.x, layer.height * scale.y);
        style.borderRadius = minDim / 2;
      }
    }
    
    // Apply stroke/border if specified
    if ('stroke' in layer && layer.stroke) {
      const strokeParsed = parseColor(layer.stroke);
      const strokeWidth = ('strokeWidth' in layer && layer.strokeWidth) ? layer.strokeWidth : 1;
      style.borderWidth = strokeWidth * Math.min(scale.x, scale.y);
      style.borderColor = strokeParsed.color;
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
      // Use layer's zIndex for proper stacking order relative to photos
      zIndex: layer.zIndex || 1,
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
    
    // Determine text color:
    // 1. If themeColor is provided, use it (user chose a theme)
    // 2. Otherwise, use original color from template
    // 3. Finally, fall back to black
    let textColor = themeColor;
    if (!textColor && 'color' in layer && layer.color) {
      const parsed = parseColor(layer.color as string);
      textColor = parsed.color;
    }
    textColor = textColor || '#000000';
    
    const style: TextStyle = {
      color: textColor,
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

  // Check if we have vector layers
  const hasVectorLayers = useMemo(() => {
    return template.vectorLayers && template.vectorLayers.length > 0;
  }, [template.vectorLayers]);

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

  // Frame overlay style - zIndex 0 ensures it's at the bottom of the stack
  const frameOverlayStyle: ImageStyle = useMemo(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: canvasWidth,
    height: canvasHeight,
    zIndex: 0,
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

    // Shape layer - check if it has SVG path data (for custom shapes like heart)
    const shapeLayer = layer as ShapeThemeLayer;
    if (shapeLayer.pathData && shapeLayer.viewBox) {
      // Render as SVG (like heart-icon with custom path)
      const scaledWidth = layer.width * scale.x;
      const scaledHeight = layer.height * scale.y;
      
      const svgStyle: ViewStyle = {
        position: 'absolute',
        left: layer.x * scale.x,
        top: layer.y * scale.y,
        width: scaledWidth,
        height: scaledHeight,
        opacity: layer.opacity ?? 1.0,
        zIndex: layer.zIndex || 1,
      };
      
      return (
        <View key={layer.id} style={svgStyle}>
          <Svg
            width="100%"
            height="100%"
            viewBox={shapeLayer.viewBox}
            preserveAspectRatio="xMidYMid meet"
          >
            <Path
              d={shapeLayer.pathData}
              fill={shapeLayer.fill || '#FF5757'}
            />
          </Svg>
        </View>
      );
    }

    // Regular shape layer (rectangle, circle, etc.)
    const shapeStyle = getShapeLayerStyle(layer);
    
    return (
      <View
        key={layer.id}
        style={shapeStyle}
      />
    );
  };

  // Render a single vector layer (icon/shape with SVG)
  const renderVectorLayer = (layer: VectorLayer) => {
    if (!layer.pathData) {
      return null;
    }

    const scaledWidth = layer.width * scale.x;
    const scaledHeight = layer.height * scale.y;

    // Container style for the SVG
    const vectorStyle: ViewStyle = {
      position: 'absolute',
      left: layer.x * scale.x,
      top: layer.y * scale.y,
      width: scaledWidth,
      height: scaledHeight,
      opacity: layer.opacity ?? 1.0,
      // Use layer's zIndex for proper stacking order relative to photos
      zIndex: layer.zIndex || 1,
    };

    // Apply rotation if specified
    if (layer.rotation && layer.rotation !== 0) {
      vectorStyle.transform = [{ rotate: `${layer.rotation}deg` }];
    }

    return (
      <View key={layer.id} style={vectorStyle}>
        <Svg
          width="100%"
          height="100%"
          viewBox={layer.viewBox}
          preserveAspectRatio="xMidYMid meet"
        >
          <Path
            d={layer.pathData}
            fill={layer.fill || '#FFFFFF'}
          />
        </Svg>
      </View>
    );
  };



  // Create a unified list of all renderable layers sorted by zIndex
  // This ensures correct stacking order regardless of React Native z-index quirks
  type RenderableLayer = 
    | { type: 'photo'; slot: Slot; image: MediaAsset; zIndex: number }
    | { type: 'theme'; layer: ThemeLayer; zIndex: number }
    | { type: 'vector'; layer: VectorLayer; zIndex: number };

  const sortedLayers = useMemo(() => {
    const layers: RenderableLayer[] = [];
    
    // Add photos (only if captured)
    slots.forEach((slot) => {
      const image = capturedImages[slot.layerId];
      if (image) {
        layers.push({ type: 'photo', slot, image, zIndex: slot.zIndex || 1 });
      }
    });
    
    // Add theme layers
    template.themeLayers?.forEach((layer) => {
      layers.push({ type: 'theme', layer, zIndex: layer.zIndex || 1 });
    });
    
    // Add vector layers
    template.vectorLayers?.forEach((layer) => {
      layers.push({ type: 'vector', layer, zIndex: layer.zIndex || 1 });
    });
    
    // Sort by zIndex (ascending - lower zIndex renders first, higher renders on top)
    return layers.sort((a, b) => a.zIndex - b.zIndex);
  }, [slots, capturedImages, template.themeLayers, template.vectorLayers]);

  // Render a single layer based on its type
  const renderLayer = (item: RenderableLayer, index: number) => {
    switch (item.type) {
      case 'photo':
        // Wrap photo in a View with overflow:hidden to clip to slot boundaries
        const { style: photoStyle, hasAdjustments } = getPhotoStyleWithAdjustments(item.slot, item.image);
        return (
          <View key={`photo-${item.slot.layerId}`} style={getPhotoContainerStyle(item.slot)}>
            <Image
              source={{ uri: item.image.uri }}
              style={photoStyle}
              // Only use cover fit when no adjustments - otherwise we control sizing manually
              resizeMode={hasAdjustments ? undefined : "cover"}
            />
          </View>
        );
      case 'theme':
        return renderThemeLayer(item.layer);
      case 'vector':
        return renderVectorLayer(item.layer);
      default:
        return null;
    }
  };

  return (
    <View style={containerStyle}>
      {/* Layer 1: Frame Overlay PNG (card backgrounds, blur shadows - always at bottom) */}
      {template.frameOverlayUrl && (
        <Image
          source={{ uri: template.frameOverlayUrl }}
          style={frameOverlayStyle}
          resizeMode="contain"
        />
      )}

      {/* All other layers rendered in zIndex order */}
      {/* Photos, theme layers, and vector layers are sorted by zIndex and rendered in order */}
      {/* This ensures correct stacking: lower zIndex renders first (behind), higher zIndex renders last (in front) */}
      {sortedLayers.map(renderLayer)}

      {/* User Overlays (text, logo, date) - always on top */}
      {children}
    </View>
  );
}

export default LayeredCanvas;
