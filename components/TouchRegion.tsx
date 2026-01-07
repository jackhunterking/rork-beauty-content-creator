import React from 'react';
import { TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { Camera, ImagePlus } from 'lucide-react-native';
import { InteractiveRegion } from '@/utils/layerParser';
import Colors from '@/constants/colors';

interface TouchRegionProps {
  region: InteractiveRegion;
  capturedUri: string | null;
  onPress: () => void;
  showIndicator?: boolean; // Show visual indicator when empty
}

/**
 * TouchRegion - Interactive overlay for before/after image slots
 * 
 * - Empty state: Invisible or shows subtle indicator (optional)
 * - Filled state: Shows captured image at exact position
 * - Tap to trigger capture/upload action sheet
 */
export function TouchRegion({
  region,
  capturedUri,
  onPress,
  showIndicator = true,
}: TouchRegionProps) {
  const isFilled = !!capturedUri;
  const label = region.type === 'before' ? 'Before' : 'After';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.container,
        {
          left: region.x,
          top: region.y,
          width: region.width,
          height: region.height,
        },
      ]}
    >
      {/* Captured image - fills the entire region */}
      {isFilled && (
        <Image
          source={{ uri: capturedUri }}
          style={styles.capturedImage}
          contentFit="cover"
          transition={200}
        />
      )}

      {/* Empty state indicator */}
      {!isFilled && showIndicator && (
        <View style={styles.emptyIndicator}>
          <View style={styles.iconContainer}>
            <Camera size={24} color="rgba(255, 255, 255, 0.7)" />
            <ImagePlus size={20} color="rgba(255, 255, 255, 0.7)" style={styles.plusIcon} />
          </View>
          <Text style={styles.tapText}>Tap to add {label}</Text>
        </View>
      )}

      {/* Filled state overlay - shows on long press or can be removed */}
      {isFilled && (
        <View style={styles.filledOverlay}>
          <View style={styles.labelBadge}>
            <Text style={styles.labelText}>{label}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    overflow: 'hidden',
    // Subtle border to show tap area when debugging
    // borderWidth: 1,
    // borderColor: 'rgba(255, 0, 0, 0.3)',
  },
  capturedImage: {
    width: '100%',
    height: '100%',
  },
  emptyIndicator: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  plusIcon: {
    marginLeft: 4,
  },
  tapText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  filledOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: 8,
  },
  labelBadge: {
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  labelText: {
    color: Colors.light.surface,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default TouchRegion;

