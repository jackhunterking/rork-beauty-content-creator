/**
 * TextOverlayContent Component
 * 
 * Renders text content for text and date overlays
 * with configurable font, size, color, and shadow.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import {
  TextOverlay,
  DateOverlay,
  formatDate,
  FONT_OPTIONS,
  FontFamily,
  BACKGROUND_CONSTRAINTS,
} from '@/types/overlays';

interface TextOverlayContentProps {
  overlay: TextOverlay | DateOverlay;
}

/**
 * Get the platform-specific font name
 */
function getFontFamily(fontFamily: FontFamily): string {
  const fontOption = FONT_OPTIONS.find(f => f.id === fontFamily);
  
  if (!fontOption || fontFamily === 'System') {
    return Platform.OS === 'ios' ? 'System' : 'Roboto';
  }
  
  // For custom fonts, return the font name
  // Note: These fonts need to be loaded via expo-font in the app
  return fontOption.fontName;
}

/**
 * Get the display text for the overlay
 */
function getDisplayText(overlay: TextOverlay | DateOverlay): string {
  if (overlay.type === 'date') {
    return formatDate(new Date(overlay.date), overlay.format);
  }
  return overlay.content;
}

export function TextOverlayContent({ overlay }: TextOverlayContentProps) {
  const displayText = useMemo(() => getDisplayText(overlay), [overlay]);
  const fontFamily = useMemo(() => getFontFamily(overlay.fontFamily), [overlay.fontFamily]);

  // Calculate shadow style based on text color
  const shadowStyle = useMemo(() => {
    if (!overlay.textShadow) return {};
    
    // Use dark shadow for light text, light shadow for dark text
    const isLightText = isLightColor(overlay.color);
    
    return {
      textShadowColor: isLightText ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 3,
    };
  }, [overlay.textShadow, overlay.color]);

  // Calculate format styles (bold, italic, underline, strikethrough)
  const formatStyle = useMemo(() => {
    const overlayAny = overlay as any;
    return {
      fontWeight: overlayAny.bold ? 'bold' as const : 'normal' as const,
      fontStyle: overlayAny.italic ? 'italic' as const : 'normal' as const,
      textDecorationLine: (overlayAny.underline && overlayAny.strikethrough) 
        ? 'underline line-through' as const
        : overlayAny.underline 
          ? 'underline' as const 
          : overlayAny.strikethrough 
            ? 'line-through' as const 
            : 'none' as const,
      textAlign: (overlayAny.textAlign || 'center') as 'left' | 'center' | 'right' | 'justify',
    };
  }, [overlay]);

  // Calculate background style
  const backgroundStyle = useMemo(() => {
    if (!overlay.backgroundColor) return {};
    
    const padding = overlay.backgroundPadding ?? BACKGROUND_CONSTRAINTS.defaultPadding;
    const borderRadius = overlay.backgroundBorderRadius ?? BACKGROUND_CONSTRAINTS.defaultBorderRadius;
    
    return {
      backgroundColor: overlay.backgroundColor,
      paddingHorizontal: padding + 4, // Extra horizontal padding for readability
      paddingVertical: padding,
      borderRadius,
    };
  }, [overlay.backgroundColor, overlay.backgroundPadding, overlay.backgroundBorderRadius]);

  return (
    <View style={[styles.container, backgroundStyle]}>
      <Text
        style={[
          styles.text,
          {
            fontFamily,
            fontSize: overlay.fontSize,
            color: overlay.color,
          },
          shadowStyle,
          formatStyle,
        ]}
        numberOfLines={3}
        adjustsFontSizeToFit={false}
      >
        {displayText}
      </Text>
    </View>
  );
}

/**
 * Check if a hex color is light or dark
 */
function isLightColor(hexColor: string): boolean {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5;
}

const styles = StyleSheet.create({
  container: {
    padding: 4,
  },
  text: {
    textAlign: 'center',
  },
});

export default TextOverlayContent;
