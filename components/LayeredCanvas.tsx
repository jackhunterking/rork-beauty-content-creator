/**
 * LayeredCanvas Component
 * 
 * Renders ALL layers directly from Templated.io API data using SINGLE SOURCE OF TRUTH.
 * 
 * UNIFIED FONT LOADING (Jan 2026):
 * Uses the unified font service to load fonts from any source:
 * - Google Fonts (via Google Fonts Developer API)
 * - Supabase Storage (for custom uploaded fonts like "Sacco-SemiBoldCondensed")
 * - System fonts (no loading needed)
 * 
 * Text layers are only rendered AFTER fonts are loaded to ensure pixel-perfect rendering.
 * 
 * Layer Handling:
 * - slot-* prefix → render user's photo with adjustments
 * - theme-* prefix → apply themeColor to dark colors (fill/stroke for shapes, text color for text)
 * - type: "shape" with html → detect SVG element type (rect, ellipse, circle, path) and render appropriately
 * - type: "vector" with html → parse and render SVG path with proper stroke support
 * - type: "text" → render text with font styling
 * - image_url → render image
 * 
 * SVG Element Support (Jan 2026):
 * - <rect> → Rendered with Rect component, supports rx/ry for rounded corners
 * - <ellipse> → Rendered with Ellipse component, supports cx/cy/rx/ry
 * - <circle> → Rendered with Circle component, supports cx/cy/r
 * - <path> → Rendered with Path component, supports d, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SvgUri, SvgXml, Svg, Path, Rect, Ellipse, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Template, CapturedImages, TemplatedLayer, MediaAsset, ThemeLayer, isTextThemeLayer } from '@/types';
import { useTemplateFonts } from '@/hooks/useTemplateFonts';
import { getGradientPoints } from '@/constants/gradients';

// ============================================
// SVG Element Type Detection
// ============================================

type SvgElementType = 'rect' | 'ellipse' | 'circle' | 'path' | 'unknown';

/**
 * Detect the primary SVG element type in HTML
 */
function detectSvgElementType(html: string): SvgElementType {
  const lowerHtml = html.toLowerCase();
  
  // Check for specific element types in order of specificity
  if (/<path\s/i.test(html)) return 'path';
  if (/<ellipse\s/i.test(html)) return 'ellipse';
  if (/<circle\s/i.test(html)) return 'circle';
  if (/<rect\s/i.test(html)) return 'rect';
  
  return 'unknown';
}

// ============================================
// SVG Parsing Functions
// ============================================

interface RectAttributes {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  rx: number;
  ry: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EllipseAttributes {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

interface CircleAttributes {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  cx: number;
  cy: number;
  r: number;
}

interface PathAttributes {
  d: string;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  strokeLinecap: string | null;
  strokeLinejoin: string | null;
  viewBox: string;
}

/**
 * Extract rect element attributes from SVG HTML
 */
function parseRectAttributes(html: string): RectAttributes | null {
  try {
    const rectMatch = html.match(/<rect[^>]*>/i);
    if (!rectMatch) return null;
    
    const rectTag = rectMatch[0];
    
    const fillMatch = rectTag.match(/fill="([^"]+)"/i);
    const strokeMatch = rectTag.match(/stroke="([^"]+)"/i);
    const strokeWidthMatch = rectTag.match(/stroke-width="([^"]+)"/i);
    const rxMatch = rectTag.match(/rx="([^"]+)"/i);
    const ryMatch = rectTag.match(/ry="([^"]+)"/i);
    const xMatch = rectTag.match(/\sx="([^"]+)"/i);
    const yMatch = rectTag.match(/\sy="([^"]+)"/i);
    const widthMatch = rectTag.match(/width="([^"]+)"/i);
    const heightMatch = rectTag.match(/height="([^"]+)"/i);
    
    return {
      fill: fillMatch ? fillMatch[1] : null,
      stroke: strokeMatch ? strokeMatch[1] : null,
      strokeWidth: strokeWidthMatch ? parseFloat(strokeWidthMatch[1]) : 0,
      rx: rxMatch ? parseFloat(rxMatch[1]) : 0,
      ry: ryMatch ? parseFloat(ryMatch[1]) : 0,
      x: xMatch ? parseFloat(xMatch[1]) : 0,
      y: yMatch ? parseFloat(yMatch[1]) : 0,
      width: widthMatch ? parseFloat(widthMatch[1]) : 0,
      height: heightMatch ? parseFloat(heightMatch[1]) : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Extract ellipse element attributes from SVG HTML
 */
function parseEllipseAttributes(html: string): EllipseAttributes | null {
  try {
    const ellipseMatch = html.match(/<ellipse[^>]*>/i);
    if (!ellipseMatch) return null;
    
    const ellipseTag = ellipseMatch[0];
    
    const fillMatch = ellipseTag.match(/fill="([^"]+)"/i);
    const strokeMatch = ellipseTag.match(/stroke="([^"]+)"/i);
    const strokeWidthMatch = ellipseTag.match(/stroke-width="([^"]+)"/i);
    const cxMatch = ellipseTag.match(/cx="([^"]+)"/i);
    const cyMatch = ellipseTag.match(/cy="([^"]+)"/i);
    const rxMatch = ellipseTag.match(/rx="([^"]+)"/i);
    const ryMatch = ellipseTag.match(/ry="([^"]+)"/i);
    
    return {
      fill: fillMatch ? fillMatch[1] : null,
      stroke: strokeMatch ? strokeMatch[1] : null,
      strokeWidth: strokeWidthMatch ? parseFloat(strokeWidthMatch[1]) : 0,
      cx: cxMatch ? parseFloat(cxMatch[1]) : 0,
      cy: cyMatch ? parseFloat(cyMatch[1]) : 0,
      rx: rxMatch ? parseFloat(rxMatch[1]) : 0,
      ry: ryMatch ? parseFloat(ryMatch[1]) : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Extract circle element attributes from SVG HTML
 */
function parseCircleAttributes(html: string): CircleAttributes | null {
  try {
    const circleMatch = html.match(/<circle[^>]*>/i);
    if (!circleMatch) return null;
    
    const circleTag = circleMatch[0];
    
    const fillMatch = circleTag.match(/fill="([^"]+)"/i);
    const strokeMatch = circleTag.match(/stroke="([^"]+)"/i);
    const strokeWidthMatch = circleTag.match(/stroke-width="([^"]+)"/i);
    const cxMatch = circleTag.match(/cx="([^"]+)"/i);
    const cyMatch = circleTag.match(/cy="([^"]+)"/i);
    const rMatch = circleTag.match(/\sr="([^"]+)"/i);
    
    return {
      fill: fillMatch ? fillMatch[1] : null,
      stroke: strokeMatch ? strokeMatch[1] : null,
      strokeWidth: strokeWidthMatch ? parseFloat(strokeWidthMatch[1]) : 0,
      cx: cxMatch ? parseFloat(cxMatch[1]) : 0,
      cy: cyMatch ? parseFloat(cyMatch[1]) : 0,
      r: rMatch ? parseFloat(rMatch[1]) : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Extract path element attributes from SVG HTML (including stroke support for arrows)
 */
function parsePathAttributes(html: string): PathAttributes | null {
  try {
    const pathMatch = html.match(/<path[^>]*>/i);
    if (!pathMatch) return null;
    
    const pathTag = pathMatch[0];
    
    // Extract viewBox from the SVG wrapper
    const viewBoxMatch = html.match(/viewBox="([^"]+)"/i) || html.match(/viewbox="([^"]+)"/i);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';
    
    const dMatch = pathTag.match(/d="([^"]+)"/i);
    const fillMatch = pathTag.match(/fill="([^"]+)"/i);
    const strokeMatch = pathTag.match(/stroke="([^"]+)"/i);
    const strokeWidthMatch = pathTag.match(/stroke-width="([^"]+)"/i);
    const strokeLinecapMatch = pathTag.match(/stroke-linecap="([^"]+)"/i);
    const strokeLinejoinMatch = pathTag.match(/stroke-linejoin="([^"]+)"/i);
    
    if (!dMatch) return null;
    
    return {
      d: dMatch[1],
      fill: fillMatch ? fillMatch[1] : null,
      stroke: strokeMatch ? strokeMatch[1] : null,
      strokeWidth: strokeWidthMatch ? parseFloat(strokeWidthMatch[1]) : 0,
      strokeLinecap: strokeLinecapMatch ? strokeLinecapMatch[1] : null,
      strokeLinejoin: strokeLinejoinMatch ? strokeLinejoinMatch[1] : null,
      viewBox,
    };
  } catch {
    return null;
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * SmartImage - Handles both PNG/JPG and SVG images
 */
function SmartImage({ uri, style }: { uri: string; style: ViewStyle }) {
  const [useSvg, setUseSvg] = useState(false);

  if (useSvg) {
    return (
      <View style={style}>
        <SvgUri uri={uri} width="100%" height="100%" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="contain"
      onError={() => setUseSvg(true)}
    />
  );
}

/**
 * Parse border radius from number, string ("52px"), or null
 */
function parseBorderRadius(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const match = String(value).match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Check if a fill color value is transparent
 * Handles: 'none', 'transparent', rgba with 0 alpha, etc.
 */
function isTransparentColor(color: string | null | undefined): boolean {
  if (!color) return true;
  if (color === 'none' || color === 'transparent') return true;
  // Check for rgba with 0 alpha (e.g., rgba(255,255,255,0) or rgba(0,0,0,0))
  if (color.match(/rgba\s*\([^,]+,[^,]+,[^,]+,\s*0\s*\)/i)) return true;
  return false;
}

/**
 * Apply theme color to SVG HTML for theme-* prefixed layers
 * 
 * For theme layers, we replace fill/stroke colors with the theme color,
 * BUT we preserve transparent fills to maintain stroke-only shapes.
 */
function applyThemeToSvgHtml(html: string, themeColor: string): string {
  let result = html;
  
  // For theme layers, replace fill attributes ONLY if they are not transparent/none
  // This preserves stroke-only shapes (transparent fill with visible stroke)
  result = result.replace(/fill="([^"]+)"/gi, (match, fillValue) => {
    // Don't replace transparent/none fills
    if (isTransparentColor(fillValue)) {
      return match;
    }
    return `fill="${themeColor}"`;
  });
  
  // For strokes, only replace non-transparent/non-none strokes
  // Don't replace stroke="none" or stroke="rgba(0,0,0,0)" as those indicate no stroke
  result = result.replace(/stroke="([^"]+)"/gi, (match, strokeValue) => {
    // Keep transparent strokes as-is
    if (isTransparentColor(strokeValue)) {
      return match;
    }
    return `stroke="${themeColor}"`;
  });
  
  return result;
}

/**
 * Clean SVG HTML for SvgXml - remove fixed dimensions to allow scaling
 */
function cleanSvgHtml(html: string): string {
  let result = html;
  
  // Remove inline style with fixed dimensions
  result = result.replace(/style="[^"]*width:\s*\d+px[^"]*"/gi, '');
  
  // Remove fixed width/height attributes from svg tag, keep viewBox
  result = result.replace(/<svg\s+width="[^"]*"\s+height="[^"]*"/gi, '<svg');
  result = result.replace(/<svg([^>]*)\s+width="[^"]*"/gi, '<svg$1');
  result = result.replace(/<svg([^>]*)\s+height="[^"]*"/gi, '<svg$1');
  
  return result;
}

/**
 * SlotImage - Renders user's captured photo with adjustments
 * Supports background color/gradient for transparent PNGs (from AI background replacement)
 */
function SlotImage({ 
  photo, 
  slotWidth, 
  slotHeight 
}: { 
  photo: MediaAsset; 
  slotWidth: number; 
  slotHeight: number;
}) {
  const { uri, width: imageWidth, height: imageHeight, adjustments, backgroundInfo } = photo;
  
  const imageStyle = useMemo(() => {
    const imageAspect = imageWidth / imageHeight;
    const slotAspect = slotWidth / slotHeight;
    
    const baseW = imageAspect > slotAspect ? slotHeight * imageAspect : slotWidth;
    const baseH = imageAspect > slotAspect ? slotHeight : slotWidth / imageAspect;
    
    const scale = adjustments?.scale ?? 1;
    const rotation = adjustments?.rotation ?? 0;
    const normTx = adjustments?.translateX ?? 0;
    const normTy = adjustments?.translateY ?? 0;
    
    const scaledW = baseW * scale;
    const scaledH = baseH * scale;
    
    const angleRad = (rotation * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    
    const maxU = Math.max(0, scaledW / 2 - (slotWidth * Math.abs(cos) + slotHeight * Math.abs(sin)) / 2);
    const maxV = Math.max(0, scaledH / 2 - (slotWidth * Math.abs(sin) + slotHeight * Math.abs(cos)) / 2);
    
    const u = normTx * maxU;
    const v = normTy * maxV;
    const tx = u * cos - v * sin;
    const ty = u * sin + v * cos;
    
    return {
      position: 'absolute' as const,
      width: scaledW,
      height: scaledH,
      left: (slotWidth - scaledW) / 2 + tx,
      top: (slotHeight - scaledH) / 2 + ty,
      transform: rotation !== 0 ? [{ rotate: `${rotation}deg` }] : [],
    };
  }, [imageWidth, imageHeight, slotWidth, slotHeight, adjustments]);
  
  // Render background color/gradient for transparent PNGs (AI background replacement)
  const renderBackground = () => {
    if (!backgroundInfo) return null;
    
    const bgStyle = {
      position: 'absolute' as const,
      width: slotWidth,
      height: slotHeight,
      left: 0,
      top: 0,
    };
    
    if (backgroundInfo.type === 'solid' && backgroundInfo.solidColor) {
      return <View style={[bgStyle, { backgroundColor: backgroundInfo.solidColor }]} />;
    }
    
    if (backgroundInfo.type === 'gradient' && backgroundInfo.gradient) {
      return (
        <LinearGradient
          colors={backgroundInfo.gradient.colors}
          {...getGradientPoints(backgroundInfo.gradient.direction)}
          style={bgStyle}
        />
      );
    }
    
    return null;
  };
  
  return (
    <>
      {renderBackground()}
      <Image source={{ uri }} style={imageStyle} contentFit="cover" />
    </>
  );
}

// ============================================
// Main Component
// ============================================

interface LayeredCanvasProps {
  template: Template;
  capturedImages: CapturedImages;
  backgroundColor: string;
  themeColor?: string;
  canvasWidth: number;
  canvasHeight: number;
  children?: React.ReactNode;
}

export function LayeredCanvas({
  template,
  capturedImages,
  backgroundColor,
  themeColor,
  canvasWidth,
  canvasHeight,
  children,
}: LayeredCanvasProps) {
  const scaleX = canvasWidth / template.canvasWidth;
  const scaleY = canvasHeight / template.canvasHeight;
  const uniformScale = Math.min(scaleX, scaleY);

  // SINGLE SOURCE OF TRUTH: All rendering from layers_json
  const layers: TemplatedLayer[] = Array.isArray(template.layersJson) ? template.layersJson : [];
  
  // Legacy array for font loading only
  const themeLayers: ThemeLayer[] = template.themeLayers || [];

  // Collect fonts for loading from the unified font service
  const templateFonts = useMemo(() => {
    const fonts: string[] = [];
    layers.forEach(layer => {
      if (layer.font_family && !fonts.includes(layer.font_family)) {
        fonts.push(layer.font_family);
      }
    });
    themeLayers.forEach(layer => {
      if (isTextThemeLayer(layer) && layer.fontFamily && !fonts.includes(layer.fontFamily)) {
        fonts.push(layer.fontFamily);
      }
    });
    return fonts;
  }, [layers, themeLayers]);

  // Load fonts using the unified font service (supports Google Fonts + Supabase custom fonts)
  const fontsLoaded = useTemplateFonts(templateFonts);

  /**
   * Render a single layer based on its type and prefix
   */
  const renderLayer = (layer: TemplatedLayer, index: number) => {
    const name = (layer.layer || '').toLowerCase();
    const isSlot = name.startsWith('slot-');
    const isTheme = name.startsWith('theme-');
    
    // Skip hidden layers
    if (layer.hide === true) return null;

    // Base positioning style
    const style: ViewStyle = {
      position: 'absolute',
      left: layer.x * scaleX,
      top: layer.y * scaleY,
      width: layer.width * scaleX,
      height: layer.height * scaleY,
      zIndex: index + 1,
      opacity: layer.opacity ?? 1,
    };

    if (layer.rotation) {
      style.transform = [{ rotate: `${layer.rotation}deg` }];
    }

    // ═══════════════════════════════════════════════════════════════════
    // SLOT LAYERS: User's captured photos
    // ═══════════════════════════════════════════════════════════════════
    if (isSlot) {
      const photo = capturedImages[layer.layer];
      if (photo) {
        return (
          <View key={layer.layer} style={[style, { overflow: 'hidden' }]}>
            <SlotImage 
              photo={photo} 
              slotWidth={layer.width * scaleX} 
              slotHeight={layer.height * scaleY} 
            />
          </View>
        );
      }
      // Empty slot placeholder
      return <View key={layer.layer} style={[style, { backgroundColor: layer.fill || '#E5E5E5' }]} />;
    }

    // ═══════════════════════════════════════════════════════════════════
    // SHAPE LAYERS WITH HTML: Detect element type and render appropriately
    // ═══════════════════════════════════════════════════════════════════
    if (layer.type === 'shape' && layer.html) {
      const elementType = detectSvgElementType(layer.html);
      const scaledWidth = layer.width * scaleX;
      const scaledHeight = layer.height * scaleY;
      
      // ─────────────────────────────────────────────────────────────────
      // RECT ELEMENTS
      // ─────────────────────────────────────────────────────────────────
      if (elementType === 'rect') {
        const attrs = parseRectAttributes(layer.html);
        if (attrs) {
          // Determine fill color - apply theme if needed
          let fillColor = attrs.fill || 'transparent';
          const isTransparentFill = !fillColor || 
            fillColor === 'transparent' || 
            fillColor === 'none' ||
            fillColor.match(/rgba\s*\([^,]+,[^,]+,[^,]+,\s*0\s*\)/i) !== null;
          
          if (!isTransparentFill && isTheme && themeColor) {
            fillColor = themeColor;
          }
          
          // Determine stroke color - apply theme if needed
          let strokeColor = attrs.stroke || 'transparent';
          if (isTheme && themeColor && attrs.stroke && attrs.stroke !== 'transparent' && attrs.stroke !== 'none' && attrs.stroke !== 'rgba(0,0,0,0)') {
            strokeColor = themeColor;
          }
          
          const scaledRx = attrs.rx * uniformScale;
          const scaledRy = attrs.ry * uniformScale;
          const scaledStrokeWidth = attrs.strokeWidth * uniformScale;
          
          return (
            <View key={layer.layer} style={style}>
              <Svg width="100%" height="100%" viewBox={`0 0 ${scaledWidth} ${scaledHeight}`}>
                <Rect
                  x={scaledStrokeWidth / 2}
                  y={scaledStrokeWidth / 2}
                  width={scaledWidth - scaledStrokeWidth}
                  height={scaledHeight - scaledStrokeWidth}
                  rx={scaledRx}
                  ry={scaledRy}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={scaledStrokeWidth}
                />
              </Svg>
            </View>
          );
        }
      }
      
      // ─────────────────────────────────────────────────────────────────
      // ELLIPSE ELEMENTS
      // ─────────────────────────────────────────────────────────────────
      if (elementType === 'ellipse') {
        const attrs = parseEllipseAttributes(layer.html);
        if (attrs) {
          let fillColor = attrs.fill || 'transparent';
          const isTransparentFill = !fillColor || 
            fillColor === 'transparent' || 
            fillColor === 'none' ||
            fillColor.match(/rgba\s*\([^,]+,[^,]+,[^,]+,\s*0\s*\)/i) !== null;
          
          if (!isTransparentFill && isTheme && themeColor) {
            fillColor = themeColor;
          }
          
          let strokeColor = attrs.stroke || 'transparent';
          if (isTheme && themeColor && attrs.stroke && attrs.stroke !== 'transparent' && attrs.stroke !== 'none' && attrs.stroke !== 'rgba(0,0,0,0)') {
            strokeColor = themeColor;
          }
          
          const scaledCx = attrs.cx * scaleX;
          const scaledCy = attrs.cy * scaleY;
          const scaledRx = attrs.rx * scaleX;
          const scaledRy = attrs.ry * scaleY;
          const scaledStrokeWidth = attrs.strokeWidth * uniformScale;
          
          return (
            <View key={layer.layer} style={style}>
              <Svg width="100%" height="100%" viewBox={`0 0 ${scaledWidth} ${scaledHeight}`}>
                <Ellipse
                  cx={scaledCx}
                  cy={scaledCy}
                  rx={scaledRx}
                  ry={scaledRy}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={scaledStrokeWidth}
                />
              </Svg>
            </View>
          );
        }
      }
      
      // ─────────────────────────────────────────────────────────────────
      // CIRCLE ELEMENTS
      // ─────────────────────────────────────────────────────────────────
      if (elementType === 'circle') {
        const attrs = parseCircleAttributes(layer.html);
        if (attrs) {
          let fillColor = attrs.fill || 'transparent';
          const isTransparentFill = !fillColor || 
            fillColor === 'transparent' || 
            fillColor === 'none' ||
            fillColor.match(/rgba\s*\([^,]+,[^,]+,[^,]+,\s*0\s*\)/i) !== null;
          
          if (!isTransparentFill && isTheme && themeColor) {
            fillColor = themeColor;
          }
          
          let strokeColor = attrs.stroke || 'transparent';
          if (isTheme && themeColor && attrs.stroke && attrs.stroke !== 'transparent' && attrs.stroke !== 'none' && attrs.stroke !== 'rgba(0,0,0,0)') {
            strokeColor = themeColor;
          }
          
          const scaledCx = attrs.cx * scaleX;
          const scaledCy = attrs.cy * scaleY;
          const scaledR = attrs.r * uniformScale;
          const scaledStrokeWidth = attrs.strokeWidth * uniformScale;
          
          return (
            <View key={layer.layer} style={style}>
              <Svg width="100%" height="100%" viewBox={`0 0 ${scaledWidth} ${scaledHeight}`}>
                <Circle
                  cx={scaledCx}
                  cy={scaledCy}
                  r={scaledR}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={scaledStrokeWidth}
                />
              </Svg>
            </View>
          );
        }
      }
      
      // ─────────────────────────────────────────────────────────────────
      // PATH ELEMENTS
      // ─────────────────────────────────────────────────────────────────
      if (elementType === 'path') {
        const attrs = parsePathAttributes(layer.html);
        if (attrs) {
          let fillColor = attrs.fill;
          const hasStroke = attrs.stroke && attrs.stroke !== 'none' && !isTransparentColor(attrs.stroke);
          
          if (!fillColor || fillColor === 'none') {
            if (hasStroke && attrs.strokeWidth > 0) {
              fillColor = 'none';
            } else if (isTheme && themeColor) {
              fillColor = themeColor;
            } else if (isTheme) {
              fillColor = layer.color || '#000000';
            } else {
              fillColor = layer.color || '#000000';
            }
          } else if (!isTransparentColor(fillColor) && isTheme && themeColor) {
            fillColor = themeColor;
          }
          
          let strokeColor = attrs.stroke || 'none';
          if (strokeColor !== 'none' && isTheme && themeColor) {
            strokeColor = themeColor;
          }
          
          return (
            <View key={layer.layer} style={style}>
              <Svg
                width="100%"
                height="100%"
                viewBox={attrs.viewBox}
                preserveAspectRatio="xMidYMid meet"
              >
                <Path
                  d={attrs.d}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={attrs.strokeWidth}
                  strokeLinecap={attrs.strokeLinecap as any || undefined}
                  strokeLinejoin={attrs.strokeLinejoin as any || undefined}
                />
              </Svg>
            </View>
          );
        }
      }
      
      // ─────────────────────────────────────────────────────────────────
      // FALLBACK: Use SvgXml for unknown/complex SVG elements
      // ─────────────────────────────────────────────────────────────────
      let svgHtml = cleanSvgHtml(layer.html);
      if (isTheme && themeColor) {
        svgHtml = applyThemeToSvgHtml(svgHtml, themeColor);
      }
      
      return (
        <View key={layer.layer} style={style}>
          <SvgXml xml={svgHtml} width="100%" height="100%" />
        </View>
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    // VECTOR LAYERS: Parse path from HTML and render (legacy support)
    // ═══════════════════════════════════════════════════════════════════
    if (layer.type === 'vector' && layer.html) {
      const attrs = parsePathAttributes(layer.html);
      if (attrs) {
        let fillColor = attrs.fill;
        
        if (!fillColor || fillColor === 'none') {
          if (isTheme && themeColor) {
            fillColor = themeColor;
          } else if (isTheme) {
            fillColor = layer.color || '#000000';
          } else {
            fillColor = layer.color || '#000000';
          }
        } else if (!isTransparentColor(fillColor) && isTheme && themeColor) {
          fillColor = themeColor;
        }
        
        let strokeColor = attrs.stroke || 'none';
        if (strokeColor !== 'none' && isTheme && themeColor) {
          strokeColor = themeColor;
        }
        
        return (
          <View key={layer.layer} style={style}>
            <Svg
              width="100%"
              height="100%"
              viewBox={attrs.viewBox}
              preserveAspectRatio="xMidYMid meet"
            >
              <Path
                d={attrs.d}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={attrs.strokeWidth}
                strokeLinecap={attrs.strokeLinecap as any || undefined}
                strokeLinejoin={attrs.strokeLinejoin as any || undefined}
              />
            </Svg>
          </View>
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // THEME TEXT LAYERS: Text with theme-affected color
    // Only render when fonts are loaded for pixel-perfect rendering
    // ═══════════════════════════════════════════════════════════════════
    if (isTheme && (layer.type === 'text' || layer.text)) {
      // Don't render text until fonts are loaded
      if (!fontsLoaded) {
        return <View key={layer.layer} style={style} />;
      }
      
      const fontSize = layer.font_size ? parseInt(String(layer.font_size)) * uniformScale : 16 * uniformScale;
      const originalColor = layer.color || '#000000';
      const textColor = themeColor ? themeColor : originalColor;
      
      const textStyle: TextStyle = {
        color: textColor,
        fontSize,
        fontWeight: (layer.font_weight as TextStyle['fontWeight']) || 'normal',
        fontFamily: layer.font_family || undefined,
        textAlign: (layer.horizontal_align as TextStyle['textAlign']) || 'center',
        letterSpacing: layer.letter_spacing ? layer.letter_spacing * uniformScale : undefined,
      };
      
      return (
        <View key={layer.layer} style={[style, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={textStyle}>{layer.text}</Text>
        </View>
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    // THEME SHAPE LAYERS (without HTML): Simple fill shapes
    // ═══════════════════════════════════════════════════════════════════
    if (isTheme && layer.fill) {
      const borderRadius = parseBorderRadius(layer.border_radius);
      const fillColor = themeColor ? themeColor : layer.fill;
      
      return (
        <View 
          key={layer.layer} 
          style={[style, { 
            backgroundColor: fillColor,
            borderRadius: borderRadius * uniformScale,
          }]} 
        />
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    // IMAGE LAYERS: Render with SmartImage (handles PNG/JPG/SVG)
    // ═══════════════════════════════════════════════════════════════════
    if (layer.image_url) {
      return <SmartImage key={layer.layer} uri={layer.image_url} style={style} />;
    }

    // ═══════════════════════════════════════════════════════════════════
    // TEXT LAYERS: Render text with font styling
    // Only render when fonts are loaded for pixel-perfect rendering
    // ═══════════════════════════════════════════════════════════════════
    if (layer.text) {
      // Don't render text until fonts are loaded
      if (!fontsLoaded) {
        return <View key={layer.layer} style={style} />;
      }
      
      const fontSize = layer.font_size ? parseInt(String(layer.font_size)) * uniformScale : 16 * uniformScale;
      const textStyle: TextStyle = {
        color: layer.color || '#000000',
        fontSize,
        fontWeight: (layer.font_weight as TextStyle['fontWeight']) || 'normal',
        fontFamily: layer.font_family || undefined,
        textAlign: (layer.horizontal_align as TextStyle['textAlign']) || 'center',
        letterSpacing: layer.letter_spacing ? layer.letter_spacing * uniformScale : undefined,
      };
      
      return (
        <View key={layer.layer} style={[style, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={textStyle}>{layer.text}</Text>
        </View>
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    // PLAIN SHAPE LAYERS: Simple colored rectangles
    // ═══════════════════════════════════════════════════════════════════
    if (layer.fill) {
      const borderRadius = parseBorderRadius(layer.border_radius);
      return (
        <View 
          key={layer.layer} 
          style={[style, { 
            backgroundColor: layer.fill,
            borderRadius: borderRadius * uniformScale,
          }]} 
        />
      );
    }

    // Fallback: transparent view
    return <View key={layer.layer} style={style} />;
  };

  return (
    <View style={{ 
      width: canvasWidth, 
      height: canvasHeight, 
      backgroundColor, 
      position: 'relative', 
      overflow: 'hidden' 
    }}>
      {layers.map(renderLayer)}
      {children}
    </View>
  );
}

export default LayeredCanvas;
