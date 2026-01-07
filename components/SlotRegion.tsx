import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Slot } from '@/types';

interface SlotRegionProps {
  slot: Slot;
  capturedUri: string | null;
  onPress: () => void;
}

/**
 * SlotRegion - Simplified slot touch area for templates
 * 
 * No UI overlay needed - placeholder buttons are designed in the template itself.
 * When no image is captured, the slot area is transparent, showing the
 * placeholder design from the template's frame preview background.
 * When an image is captured, it fills the entire slot area.
 */
export function SlotRegion({ slot, capturedUri, onPress }: SlotRegionProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[
        styles.container,
        {
          left: slot.x,
          top: slot.y,
          width: slot.width,
          height: slot.height,
        },
      ]}
    >
      {/* Show captured image if available, otherwise slot area is transparent
          (placeholder is visible from frame preview background) */}
      {capturedUri && (
        <Image
          source={{ uri: capturedUri }}
          style={styles.capturedImage}
          contentFit="cover"
          transition={200}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    overflow: 'hidden',
  },
  capturedImage: {
    width: '100%',
    height: '100%',
  },
});

export default SlotRegion;

