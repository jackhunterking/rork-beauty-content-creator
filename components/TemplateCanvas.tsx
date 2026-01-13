import React, { useMemo } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Template } from '@/types';
import { SlotRegion } from './SlotRegion';
import { extractSlots, scaleSlots } from '@/utils/slotParser';
import Colors from '@/constants/colors';
import { withCacheBust } from '@/services/imageUtils';

const CANVAS_PADDING = 20;

interface TemplateCanvasProps {
  template: Template;
  onSlotPress: (slotId: string) => void;
  /** Rendered preview from Templated.io (shown when photos are added) */
  renderedPreviewUri?: string | null;
  /** Whether a render is in progress */
  isRendering?: boolean;
  /** Called when the cached preview image fails to load (e.g., expired URL) */
  onPreviewError?: () => void;
  /** Whether user has premium status - affects which preview is shown */
  isPremium?: boolean;
  /** Called when the preview image has loaded and is ready for capture */
  onPreviewLoad?: () => void;
}

/**
 * TemplateCanvas - Renders template preview with invisible slot tap targets
 * 
 * Preview Priority (based on premium status):
 * 1. renderedPreviewUri (if user has added photos - watermark controlled by isPremium)
 * 2. For FREE users: watermarkedPreviewUrl (shows watermark upfront in editor)
 * 3. For PRO users: templatedPreviewUrl (clean preview)
 * 4. Fallback: thumbnail
 * 
 * Slot regions are invisible tap targets - template design shows through
 */
export function TemplateCanvas({
  template,
  onSlotPress,
  renderedPreviewUri,
  isRendering = false,
  onPreviewError,
  isPremium = false,
  onPreviewLoad,
}: TemplateCanvasProps) {
  // Use reactive window dimensions to handle screen rotation and dynamic updates
  const { width: screenWidth } = useWindowDimensions();
  const maxCanvasWidth = screenWidth - CANVAS_PADDING * 2;

  // Calculate display dimensions to fit canvas on screen
  const { displayWidth, displayHeight } = useMemo(() => {
    const aspectRatio = template.canvasWidth / template.canvasHeight;
    
    let width = maxCanvasWidth;
    let height = width / aspectRatio;
    
    // If too tall, constrain by height instead
    const maxHeight = screenWidth * 1.2; // Max height is 120% of screen width
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    
    return {
      displayWidth: width,
      displayHeight: height,
    };
  }, [template.canvasWidth, template.canvasHeight, maxCanvasWidth, screenWidth]);

  // Extract slots from template and scale to display dimensions
  const scaledSlots = useMemo(() => {
    const slots = extractSlots(template);
    return scaleSlots(
      slots,
      template.canvasWidth,
      template.canvasHeight,
      displayWidth,
      displayHeight
    );
  }, [template, displayWidth, displayHeight]);

  // Preview priority based on premium status:
  // 1. renderedPreviewUri (if user has added photos)
  // 2. For FREE users: watermarkedPreviewUrl (shows watermark upfront)
  // 3. For PRO users: templatedPreviewUrl (clean)
  // 4. Fallback: thumbnail
  //
  // Cache busting is applied to local files (file://) to ensure
  // updated content (e.g., with overlays) is displayed correctly.
  const previewUrl = useMemo(() => {
    let url: string;
    
    // If we have a rendered preview (user added photos), use it
    if (renderedPreviewUri) {
      // Apply cache busting for local files
      // This ensures updated previews (with overlays) are displayed
      const cacheBusted = withCacheBust(renderedPreviewUri, Date.now());
      return cacheBusted || renderedPreviewUri;
    }
    
    // Before photos are added, show appropriate preview based on premium status
    if (isPremium) {
      // Pro users see clean preview
      url = template.templatedPreviewUrl || template.thumbnail;
    } else {
      // Free users see watermarked preview so they know upfront
      url = template.watermarkedPreviewUrl || template.templatedPreviewUrl || template.thumbnail;
    }
    
    return url;
  }, [renderedPreviewUri, isPremium, template.watermarkedPreviewUrl, template.templatedPreviewUrl, template.thumbnail]);

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.canvas,
          {
            width: displayWidth,
            height: displayHeight,
          },
        ]}
      >
        {/* Preview Image */}
        <Image
          source={{ uri: previewUrl }}
          style={styles.previewImage}
          contentFit="cover"
          transition={200}
          onLoad={() => {
            // Notify parent that the preview image has loaded
            if (onPreviewLoad) {
              console.log('[TemplateCanvas] Preview image loaded:', previewUrl?.substring(0, 50) + '...');
              onPreviewLoad();
            }
          }}
          onError={() => {
            // If the rendered preview fails to load (e.g., expired URL),
            // notify parent to trigger a fresh render
            if (renderedPreviewUri && onPreviewError) {
              console.warn('[TemplateCanvas] Cached preview failed to load, requesting re-render');
              onPreviewError();
            }
          }}
        />

        {/* Invisible slot tap targets */}
        {scaledSlots.map(slot => (
          <SlotRegion
            key={slot.layerId}
            slot={slot}
            onPress={() => onSlotPress(slot.layerId)}
          />
        ))}

        {/* Rendering Overlay - shown while Templated.io is processing */}
        {isRendering && (
          <View style={styles.renderingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.renderingText}>Updating preview...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  canvas: {
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
    // Glass UI border effect
    borderWidth: 1,
    borderColor: Colors.light.glassEdge,
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  renderingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  renderingText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});

export default TemplateCanvas;
