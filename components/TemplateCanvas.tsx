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
  composedPreviewUri?: string | null;
  isComposing?: boolean;
}

/**
 * TemplateCanvas - Renders template preview with dynamic slot regions
 * 
 * Modes:
 * 1. Editing mode: Shows individual slots with their states
 * 2. Composed mode: Shows the final rendered image from Templated.io
 * 
 * Features:
 * - Uses framePreviewUrl (clean background without slot content) when available
 * - Falls back to templatedPreviewUrl or thumbnail
 * - Renders SlotRegion for each slot extracted from layers_json
 * - Supports any number of slots (not limited to before/after)
 * - Scales everything proportionally to fit the screen
 * - Per-slot loading states
 */
export function TemplateCanvas({
  template,
  capturedImages,
  slotStates = {},
  onSlotPress,
  onSlotRetry,
  composedPreviewUri,
  isComposing = false,
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

  // Use framePreviewUrl (no slot content) if available, fall back to templatedPreviewUrl or thumbnail
  // framePreviewUrl provides a clean background where slot areas are transparent/hidden
  const backgroundUrl = template.framePreviewUrl || template.templatedPreviewUrl || template.thumbnail;

  // Check if we should show composed preview
  const showComposedPreview = composedPreviewUri && !isComposing;

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
        {/* Composed Preview Mode */}
        {showComposedPreview ? (
          <Image
            source={{ uri: composedPreviewUri }}
            style={styles.previewImage}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <>
            {/* Background image - ideally framePreviewUrl without slot content */}
            <Image
              source={{ uri: backgroundUrl }}
              style={styles.previewImage}
              contentFit="cover"
              transition={200}
            />

            {/* Dynamic slot regions with per-slot states */}
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
                />
              );
            })}

            {/* Overlay layer - rendered ON TOP of slots */}
            {/* Contains labels, arrows, decorative elements that appear over user photos */}
            {template.overlayPreviewUrl && (
              <Image
                source={{ uri: template.overlayPreviewUrl }}
                style={styles.overlayImage}
                contentFit="cover"
                transition={200}
                pointerEvents="none"
              />
            )}
          </>
        )}

        {/* Composing Overlay */}
        {isComposing && (
          <View style={styles.composingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.composingText}>Generating preview...</Text>
          </View>
        )}
      </View>

      {/* Template info - dimensions only */}
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
  overlayImage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10, // Ensure overlay appears on top of slot regions
  },
  composingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composingText: {
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
