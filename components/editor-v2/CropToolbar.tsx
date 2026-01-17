/**
 * ResizeToolbar Component
 * 
 * Simple bottom toolbar for resize mode with Cancel and Done buttons.
 * All adjustments (pan, zoom, rotate) are done via gestures on the canvas.
 */

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Colors from '@/constants/colors';

interface CropToolbarProps {
  onCancel: () => void;
  onDone: () => void;
}

export function CropToolbar({ onCancel, onDone }: CropToolbarProps) {
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Resize</Text>

        <TouchableOpacity
          style={styles.doneButton}
          onPress={onDone}
          activeOpacity={0.7}
        >
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>

      {/* Hint */}
      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>
          Pinch to zoom • Two fingers to rotate • Drag to position
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 70,
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '400',
    color: Colors.light.textSecondary,
    letterSpacing: -0.4,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
    letterSpacing: -0.4,
  },
  doneButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 70,
    alignItems: 'flex-end',
  },
  doneText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.accent,
    letterSpacing: -0.4,
  },
  hintContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    textAlign: 'center',
  },
});

export default CropToolbar;
