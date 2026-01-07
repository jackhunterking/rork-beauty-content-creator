import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { Image } from 'expo-image';
import { Template } from '@/types';
import { SlotImage } from './SlotImage';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_PADDING = 20;
const MAX_CANVAS_WIDTH = SCREEN_WIDTH - CANVAS_PADDING * 2;

interface TemplateCanvasProps {
  template: Template;
  beforeUri: string | null;
  afterUri: string | null;
  onSlotPress: (slotType: 'before' | 'after') => void;
}

/**
 * TemplateCanvas - Renders a scaled preview of the template with positioned slots
 * 
 * - Scales the template canvas to fit the screen while maintaining aspect ratio
 * - Positions slot images using percentage-based coordinates
 * - Shows optional background image
 */
export function TemplateCanvas({
  template,
  beforeUri,
  afterUri,
  onSlotPress,
}: TemplateCanvasProps) {
  // Calculate scale to fit canvas on screen
  const { canvasDisplayWidth, canvasDisplayHeight, scale } = useMemo(() => {
    const aspectRatio = template.canvasWidth / template.canvasHeight;
    
    let displayWidth = MAX_CANVAS_WIDTH;
    let displayHeight = displayWidth / aspectRatio;
    
    // If too tall, constrain by height instead
    const maxHeight = SCREEN_WIDTH * 1.2; // Max height is 120% of screen width
    if (displayHeight > maxHeight) {
      displayHeight = maxHeight;
      displayWidth = displayHeight * aspectRatio;
    }
    
    const scaleValue = displayWidth / template.canvasWidth;
    
    return {
      canvasDisplayWidth: displayWidth,
      canvasDisplayHeight: displayHeight,
      scale: scaleValue,
    };
  }, [template.canvasWidth, template.canvasHeight]);

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.canvas,
          {
            width: canvasDisplayWidth,
            height: canvasDisplayHeight,
          },
        ]}
      >
        {/* Background image (optional) */}
        {template.backgroundUrl ? (
          <Image
            source={{ uri: template.backgroundUrl }}
            style={styles.backgroundImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.defaultBackground} />
        )}

        {/* Before slot */}
        <SlotImage
          slot={template.beforeSlot}
          capturedUri={beforeUri}
          onPress={() => onSlotPress('before')}
          label="Before"
          canvasScale={scale}
        />

        {/* After slot */}
        <SlotImage
          slot={template.afterSlot}
          capturedUri={afterUri}
          onPress={() => onSlotPress('after')}
          label="After"
          canvasScale={scale}
        />
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
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  defaultBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1a',
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

