import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Slot } from '@/types';

interface SlotRegionProps {
  slot: Slot;
  onPress: () => void;
}

/**
 * SlotRegion - Simple invisible tap target for template slots
 * 
 * This component is positioned over slot areas in the template preview.
 * It's completely transparent - the template preview shows through.
 * When tapped, it triggers the photo picker/camera action sheet.
 */
export function SlotRegion({ slot, onPress }: SlotRegionProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.container,
        {
          left: slot.x,
          top: slot.y,
          width: slot.width,
          height: slot.height,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
});

export default SlotRegion;
