import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { Image } from 'expo-image';
import { Template, CapturedImages } from '@/types';
import { SlotRegion } from './SlotRegion';
import { extractSlots, scaleSlots } from '@/utils/slotParser';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_PADDING = 20;
const MAX_CANVAS_WIDTH = SCREEN_WIDTH - CANVAS_PADDING * 2;

interface TemplateCanvasProps {
  template: Template;
  capturedImages: CapturedImages;
  onSlotPress: (slotId: string) => void;
}

/**
 * TemplateCanvas - Renders template preview with dynamic slot regions
 * 
 * - Uses framePreviewUrl (clean background without slot content) when available
 * - Falls back to templatedPreviewUrl or thumbnail
 * - Renders SlotRegion for each slot extracted from layers_json
 * - Supports any number of slots (not limited to before/after)
 * - Scales everything proportionally to fit the screen
 */
export function TemplateCanvas({
  template,
  capturedImages,
  onSlotPress,
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
        {/* Background image - ideally framePreviewUrl without slot content */}
        <Image
          source={{ uri: backgroundUrl }}
          style={styles.previewImage}
          contentFit="cover"
          transition={200}
        />

        {/* Dynamic slot regions */}
        {scaledSlots.map(slot => (
          <SlotRegion
            key={slot.layerId}
            slot={slot}
            capturedUri={capturedImages[slot.layerId]?.uri || null}
            onPress={() => onSlotPress(slot.layerId)}
          />
        ))}
      </View>

      {/* Template info */}
      <View style={styles.infoContainer}>
        <Text style={styles.templateName}>{template.name}</Text>
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
  infoContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  templateDimensions: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
});

export default TemplateCanvas;
