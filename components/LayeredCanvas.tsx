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
  // Handles positioning for rotated text layers where Templated.io uses center-based coordinates
  const getTextLayerContainerStyle = (layer: TextThemeLayer): ViewStyle => {
    // For rotated layers, we need to position based on where the CENTER should be
    // In Templated.io, x,y represents the position before rotation is applied
    // The rotation happens around the center of the element
    
    const scaledWidth = layer.width * scale.x;
    const scaledHeight = layer.height * scale.y;
    
    // Calculate where the center should be positioned
    // Templated.io x,y seems to be the top-left corner of the unrotated bounding box
    // We need to find the center and position relative to that
    const unrotatedCenterX = (layer.x + layer.width / 2) * scale.x;
    const unrotatedCenterY = (layer.y + layer.height / 2) * scale.y;
    
    // For React Native, we position top-left and it rotates around the center
    // So top-left = center - (width/2, height/2)
    const left = unrotatedCenterX - scaledWidth / 2;
    const top = unrotatedCenterY - scaledHeight / 2;
    
    console.log(`[LayeredCanvas] Text layer positioning:`, {
      id: layer.id,
      original: { x: layer.x, y: layer.y, w: layer.width, h: layer.height, r: layer.rotation },
      center: { x: unrotatedCenterX, y: unrotatedCenterY },
      final: { left, top, scaledWidth, scaledHeight },
    });
    
    const style: ViewStyle = {
      position: 'absolute',
      left,
      top,
      width: scaledWidth,
      height: scaledHeight,
      // Use flexbox for text alignment within the container
      justifyContent: layer.verticalAlign === 'top' ? 'flex-start' 
                   : layer.verticalAlign === 'bottom' ? 'flex-end' 
                   : 'center',
      alignItems: layer.horizontalAlign === 'left' ? 'flex-start'
               : layer.horizontalAlign === 'right' ? 'flex-end'
               : 'center',
      // DEBUG: Add visible background to see positioning (remove after testing)
      backgroundColor: 'rgba(255, 0, 0, 0.2)',
    };

    // Apply rotation around center (React Native default behavior)
    if (layer.rotation && layer.rotation !== 0) {
      style.transform = [{ rotate: `${layer.rotation}deg` }];
    }

    return style;
  };

  // Get text style for a text theme layer
  const getTextLayerStyle = (layer: TextThemeLayer): TextStyle => {
    // Calculate scaled font size
    const scaledFontSize = (layer.fontSize || 16) * Math.min(scale.x, scale.y);
    
    const style: TextStyle = {
      color: themeColor || '#000000', // Use theme color or default black
      fontSize: scaledFontSize,
      fontWeight: layer.fontWeight as TextStyle['fontWeight'] || 'normal',
      textAlign: layer.horizontalAlign || 'center',
    };

    // Apply font family mapping
    const mappedFont = mapFont(layer.fontFamily);
    if (mappedFont !== 'System') {
      style.fontFamily = mappedFont;
    }

    // Apply letter spacing if specified
    if (layer.letterSpacing !== undefined) {
      style.letterSpacing = layer.letterSpacing * Math.min(scale.x, scale.y);
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
  const containerStyle: ViewStyle = useMemo(() => ({
    width: canvasWidth,
    height: canvasHeight,
    backgroundColor: backgroundColor,
    position: 'relative',
    overflow: 'hidden',
  }), [canvasWidth, canvasHeight, backgroundColor]);
  
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

  // #region agent log
  console.log('[LayeredCanvas] Rendering with:', {
    backgroundColor,
    themeColor: themeColor || '(none)',
    frameOverlayUrl: template.frameOverlayUrl?.substring(0, 80) + '...',
    canvasSize: `${canvasWidth}x${canvasHeight}`,
    photoCount: Object.values(capturedImages).filter(img => img !== null).length,
    themeLayerCount: template.themeLayers?.length || 0,
    textLayerCount: template.themeLayers?.filter(l => isTextThemeLayer(l)).length || 0,
    shapeLayerCount: template.themeLayers?.filter(l => !isTextThemeLayer(l)).length || 0,
  });
  // #endregion

  // Render a single theme layer (text or shape)
  const renderThemeLayer = (layer: ThemeLayer) => {
    // #region agent log
    // Hypothesis B: Check if isTextThemeLayer returns correct value
    const isText = isTextThemeLayer(layer);
    fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LayeredCanvas.tsx:renderThemeLayer',message:'Type guard check',data:{layerId:layer.id,layerType:layer.type,isTextResult:isText,hasTypeProperty:'type' in layer,fullLayer:JSON.stringify(layer)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Check if this is a text layer
    if (isText) {
      console.log('[LayeredCanvas] Rendering text layer:', layer.id, 'text:', (layer as any).text);
      const containerStyle = getTextLayerContainerStyle(layer as any);
      const textStyle = getTextLayerStyle(layer as any);
      
      // #region agent log
      // Hypothesis D: Log text styling to see if it's visible
      fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LayeredCanvas.tsx:renderTextLayer',message:'Text layer styles',data:{layerId:layer.id,text:(layer as any).text,containerStyle:JSON.stringify(containerStyle),textStyle:JSON.stringify(textStyle)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      return (
        <View key={layer.id} style={containerStyle}>
          <Text style={textStyle}>
            {(layer as any).text}
          </Text>
        </View>
      );
    }

    // Shape layer - only render if we have a theme color
    if (themeColor) {
      console.log('[LayeredCanvas] Rendering shape layer:', layer.id);
      return (
        <View
          key={layer.id}
          style={getShapeLayerStyle(layer)}
        />
      );
    }

    return null;
  };

  // #region agent log
  // Hypothesis A & E: Check if LayeredCanvas is rendering and has correct data
  fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LayeredCanvas.tsx:render',message:'LayeredCanvas render entry',data:{hasThemeLayers,themeLayerCount:template.themeLayers?.length||0,themeLayersRaw:JSON.stringify(template.themeLayers),backgroundColor,themeColor,canvasWidth,canvasHeight},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,E'})}).catch(()=>{});
  // #endregion

  return (
    <View style={containerStyle}>
      {/* Layer 1: Background Color - handled by container backgroundColor */}

      {/* Layer 2: Theme Layers (colored shapes or styled text) */}
      {/* Wrapped in a container with overflow:visible to allow rotated text */}
      {hasThemeLayers && (
        <View style={themeLayerWrapperStyle}>
          {/* #region agent log */}
          {/* Hypothesis C: Log that wrapper is rendering */}
          {(() => { fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LayeredCanvas.tsx:themeWrapper',message:'Theme wrapper rendering',data:{wrapperStyle:JSON.stringify(themeLayerWrapperStyle)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{}); return null; })()}
          {/* #endregion */}
          {template.themeLayers?.map(renderThemeLayer)}
        </View>
      )}

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
