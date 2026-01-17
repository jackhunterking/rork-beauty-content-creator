/**
 * ResizeToolbar Component
 * 
 * Bottom toolbar for resize mode with Cancel/Done buttons and rotation slider.
 * Pinch to zoom and drag to position are done via gestures on the canvas.
 */

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import { RotateCw } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface CropToolbarProps {
  onCancel: () => void;
  onDone: () => void;
  rotation: number;
  onRotationChange: (rotation: number) => void;
}

export function CropToolbar({ onCancel, onDone, rotation, onRotationChange }: CropToolbarProps) {
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
      <Text style={styles.hintText}>
        Pinch to zoom • Drag to position
      </Text>

      {/* Rotation Slider */}
      <View style={styles.rotationContainer}>
        <View style={styles.rotationHeader}>
          <RotateCw size={18} color={Colors.light.textSecondary} strokeWidth={2} />
          <Text style={styles.rotationLabel}>Rotation</Text>
          <Text style={styles.rotationValue}>{Math.round(rotation)}°</Text>
        </View>
        
        <Slider
          style={styles.slider}
          minimumValue={-180}
          maximumValue={180}
          step={1}
          value={rotation}
          onValueChange={onRotationChange}
          minimumTrackTintColor={Colors.light.accent}
          maximumTrackTintColor={Colors.light.border}
          thumbTintColor={Colors.light.accent}
        />
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
  hintText: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    marginBottom: 16,
  },
  rotationContainer: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  rotationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rotationLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
    marginLeft: 8,
    flex: 1,
  },
  rotationValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.accent,
    minWidth: 50,
    textAlign: 'right',
  },
  slider: {
    width: '100%',
    height: 40,
  },
});

export default CropToolbar;
