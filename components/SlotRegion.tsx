import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Slot } from '@/types';

interface SlotRegionProps {
  slot: Slot;
  onPress: () => void;
  /** Whether the slot is empty (no image captured) */
  isEmpty?: boolean;
}

/**
 * SlotRegion - Tap target for template slots with visible placeholder
 * 
 * This component is positioned over slot areas in the template preview.
 * When empty, it shows:
 * - A border indicating the slot boundaries and size
 * - A subtle background tint
 * - A centered + icon for adding photos
 * When filled, it's transparent to let the image show through.
 * When tapped, it triggers the photo picker/camera action sheet.
 */
export function SlotRegion({ slot, onPress, isEmpty = false }: SlotRegionProps) {
  // Calculate responsive icon size based on slot dimensions
  const minDimension = Math.min(slot.width, slot.height);
  const iconSize = Math.max(20, Math.min(36, minDimension * 0.12));
  const circleSize = iconSize * 2;
  
  // Calculate rotation transform if slot has rotation
  const rotationTransform = slot.rotation ? [{ rotate: `${slot.rotation}deg` }] : [];
  
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.container,
        isEmpty && styles.emptyContainer,
        {
          left: slot.x,
          top: slot.y,
          width: slot.width,
          height: slot.height,
          transform: rotationTransform,
        },
      ]}
    >
      {isEmpty && (
        <View style={styles.iconWrapper}>
          <View style={[
            styles.iconCircle, 
            { 
              width: circleSize, 
              height: circleSize, 
              borderRadius: circleSize / 2 
            }
          ]}>
            <Plus size={iconSize} color="#7A8B7D" strokeWidth={2.5} />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    backgroundColor: 'transparent',
    // Ensure slot regions appear above frame overlay in LayeredCanvas
    zIndex: 20,
  },
  emptyContainer: {
    // Subtle background tint to make slot area visible
    backgroundColor: 'rgba(122, 139, 125, 0.12)',
    // Border to show slot boundaries
    borderWidth: 2,
    borderColor: 'rgba(122, 139, 125, 0.35)',
    borderStyle: 'dashed',
    // Slight rounding for aesthetics
    borderRadius: 8,
  },
  iconWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    backgroundColor: 'rgba(122, 139, 125, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SlotRegion;
