import React, { useMemo } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Template } from '@/types';
import { SlotRegion } from './SlotRegion';
import { extractSlots, scaleSlots } from '@/utils/slotParser';
import Colors from '@/constants/colors';

const CANVAS_PADDING = 20;

interface TemplateCanvasProps {
  template: Template;
  onSlotPress: (slotId: string) => void;
  /** Rendered preview from Templated.io (shown when photos are added) */
  renderedPreviewUri?: string | null;
  /** Whether a render is in progress */
  isRendering?: boolean;
}

/**
 * TemplateCanvas - Renders template preview with invisible slot tap targets
 * 
 * Simple architecture:
 * 1. Shows template preview initially (templatedPreviewUrl)
 * 2. When photos are added, shows rendered preview from Templated.io
 * 3. Slot regions are invisible tap targets - template design shows through
 */
export function TemplateCanvas({
  template,
  onSlotPress,
  renderedPreviewUri,
  isRendering = false,
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

  // Preview priority: rendered preview > template preview > thumbnail
  const previewUrl = renderedPreviewUri || template.templatedPreviewUrl || template.thumbnail;

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
