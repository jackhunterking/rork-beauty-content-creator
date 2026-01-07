import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { Image } from 'expo-image';
import { Template } from '@/types';
import { TouchRegion } from './TouchRegion';
import { extractInteractiveRegions, scaleRegionsToDisplay, getRegionByType } from '@/utils/layerParser';
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
 * TemplateCanvas - Renders template preview with interactive touch regions
 * 
 * - Displays the templatedPreviewUrl (or thumbnail) as full background
 * - Overlays TouchRegion components at positions from layers_json
 * - Falls back to slot data if layers_json is not available
 * - Scales everything proportionally to fit the screen
 */
export function TemplateCanvas({
  template,
  beforeUri,
  afterUri,
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

  // Extract and scale interactive regions
  const scaledRegions = useMemo(() => {
    const regions = extractInteractiveRegions(template);
    return scaleRegionsToDisplay(
      regions,
      template.canvasWidth,
      template.canvasHeight,
      displayWidth,
      displayHeight
    );
  }, [template, displayWidth, displayHeight]);

  // Get individual regions
  const beforeRegion = getRegionByType(scaledRegions, 'before');
  const afterRegion = getRegionByType(scaledRegions, 'after');

  // Use templatedPreviewUrl if available, fall back to thumbnail
  const previewImageUrl = template.templatedPreviewUrl || template.thumbnail;

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
        {/* Preview image as background */}
        <Image
          source={{ uri: previewImageUrl }}
          style={styles.previewImage}
          contentFit="cover"
          transition={200}
        />

        {/* Touch regions for before/after */}
        {beforeRegion && (
          <TouchRegion
            region={beforeRegion}
            capturedUri={beforeUri}
            onPress={() => onSlotPress('before')}
            showIndicator={!beforeUri}
          />
        )}

        {afterRegion && (
          <TouchRegion
            region={afterRegion}
            capturedUri={afterUri}
            onPress={() => onSlotPress('after')}
            showIndicator={!afterUri}
          />
        )}
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
