import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Template, CapturedImages, SlotStates } from '@/types';
import { SlotRegion } from './SlotRegion';
import { extractSlots, scaleSlots } from '@/utils/slotParser';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_PADDING = 20;
const MAX_CANVAS_WIDTH = SCREEN_WIDTH - CANVAS_PADDING * 2;

interface TemplateCanvasProps {
  template: Template;
  capturedImages: CapturedImages;
  slotStates?: SlotStates;
  onSlotPress: (slotId: string) => void;
  onSlotRetry?: (slotId: string) => void;
  /** Rendered preview from Templated.io (shown when photos are added) */
  renderedPreviewUri?: string | null;
  /** Whether a render is in progress */
  isRendering?: boolean;
}

/**
 * TemplateCanvas - Renders template preview with transparent slot regions
 * 
 * Architecture:
 * 1. Empty state: Shows template preview (templatedPreviewUrl) with placeholder buttons
 *    - SlotRegions are transparent clickable zones
 *    - User sees the template's designed placeholder buttons
 * 
 * 2. Photos added: Shows rendered preview from Templated.io
 *    - Templated.io handles all layer ordering
 *    - Labels, decorations appear correctly on top of photos
 *    - SlotRegions remain as transparent tap targets for replacing photos
 * 
 * This removes the need for complex overlay/frame logic.
 */
export function TemplateCanvas({
  template,
  capturedImages,
  slotStates = {},
  onSlotPress,
  onSlotRetry,
  renderedPreviewUri,
  isRendering = false,
}: TemplateCanvasProps) {
  // Calculate display dimensions to fit canvas on screen
  const { displayWidth, displayHeight } = useMemo(() => {
    const aspectRatio = template.canvasWidth / template.canvasHeight;
    
    let width = MAX_CANVAS_WIDTH;
    let height = width / aspectRatio;
    
    // If too tall, constrain by height instead
    const maxHeight = SCREEN_WIDTH * 1.2; // Max height is 120% of screen width
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    
    return {
      displayWidth: width,
      displayHeight: height,
    };
  }, [template.canvasWidth, template.canvasHeight]);

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

  // Determine which preview to show
  // If we have a rendered preview from Templated.io, use it
  // Otherwise show the template preview with placeholder buttons
  const previewUrl = renderedPreviewUri || template.templatedPreviewUrl || template.thumbnail;

  // Check if any photos have been added
  const hasPhotos = Object.values(capturedImages).some(img => img?.uri);

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
        {/* Template/Rendered Preview Image */}
        <Image
          source={{ uri: previewUrl }}
          style={styles.previewImage}
          contentFit="cover"
          transition={200}
        />

        {/* Transparent slot regions - clickable zones at slot positions */}
        {/* These are invisible - the template's placeholder design shows through */}
        {scaledSlots.map(slot => {
          const slotState = slotStates[slot.layerId] || { state: 'empty' };
          const capturedUri = capturedImages[slot.layerId]?.uri || null;
          
          return (
            <SlotRegion
              key={slot.layerId}
              slot={slot}
              state={slotState.state}
              capturedUri={capturedUri}
              onPress={() => onSlotPress(slot.layerId)}
              onRetry={onSlotRetry ? () => onSlotRetry(slot.layerId) : undefined}
              errorMessage={slotState.errorMessage}
              progress={slotState.progress}
              // Show as transparent when we have a rendered preview
              isTransparent={!!renderedPreviewUri || hasPhotos}
            />
          );
        })}

        {/* Rendering Overlay */}
        {isRendering && (
          <View style={styles.renderingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.renderingText}>Generating preview...</Text>
          </View>
        )}
      </View>

      {/* Template dimensions */}
      <View style={styles.infoContainer}>
        <Text style={styles.templateDimensions}>
          {template.canvasWidth} × {template.canvasHeight}
        </Text>
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
    // Shadow for depth with glass effect
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
  infoContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  templateDimensions: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
});

export default TemplateCanvas;
