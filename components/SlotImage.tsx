import React from 'react';
import { TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { ImageSlot } from '@/types';
import Colors from '@/constants/colors';

interface SlotImageProps {
  slot: ImageSlot;
  capturedUri: string | null;
  onPress: () => void;
  label: 'Before' | 'After';
  canvasScale: number; // Scale factor to convert from canvas pixels to display pixels
}

/**
 * SlotImage component - Simple image that swaps between placeholder and captured photo
 * 
 * - Empty state: Shows the placeholder image (designed to look like a button)
 * - Filled state: Shows the user's captured/imported photo
 * - Tap to trigger action sheet for capture/replace
 */
export function SlotImage({ 
  slot, 
  capturedUri, 
  onPress, 
  label,
  canvasScale 
}: SlotImageProps) {
  // Calculate display dimensions based on canvas scale
  const displayWidth = slot.width * canvasScale;
  const displayHeight = slot.height * canvasScale;

  const isFilled = !!capturedUri;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.container,
        {
          left: `${slot.xPercent}%`,
          top: `${slot.yPercent}%`,
          width: displayWidth,
          height: displayHeight,
        },
      ]}
    >
      <Image
        source={{ uri: capturedUri || slot.placeholderUrl }}
        style={styles.image}
        contentFit="cover"
        transition={200}
      />
      
      {/* Overlay indicator for filled state - shows tap to replace */}
      {isFilled && (
        <View style={styles.filledOverlay}>
          <View style={styles.tapIndicator}>
            <Text style={styles.tapText}>Tap to replace</Text>
          </View>
        </View>
      )}
      
      {/* Label badge */}
      <View style={[styles.labelBadge, isFilled && styles.labelBadgeFilled]}>
        <Text style={styles.labelText}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  filledOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    opacity: 0, // Hidden by default, shown on hover/focus
  },
  tapText: {
    color: Colors.light.surface,
    fontSize: 12,
    fontWeight: '500',
  },
  labelBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  labelBadgeFilled: {
    backgroundColor: Colors.light.accent,
  },
  labelText: {
    color: Colors.light.surface,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default SlotImage;
