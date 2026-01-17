/**
 * ResizeToolbar Component (formerly CropToolbar)
 * 
 * Bottom toolbar shown during resize/crop mode with:
 * - Cancel and Done buttons
 * - Rotation slider with angle display
 * - Drag/pinch hint
 */

import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import { RotateCw } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface CropToolbarProps {
  onCancel: () => void;
  onDone: () => void;
  /** Current rotation angle in degrees */
  rotation?: number;
  /** Called when rotation changes */
  onRotationChange?: (rotation: number) => void;
}

export function CropToolbar({ 
  onCancel, 
  onDone,
  rotation = 0,
  onRotationChange,
}: CropToolbarProps) {
  const insets = useSafeAreaInsets();
  const [localRotation, setLocalRotation] = useState(rotation);

  const handleRotationChange = useCallback((value: number) => {
    // Round to nearest integer
    const rounded = Math.round(value);
    setLocalRotation(rounded);
    onRotationChange?.(rounded);
  }, [onRotationChange]);

  const handleRotationComplete = useCallback((value: number) => {
    const rounded = Math.round(value);
    setLocalRotation(rounded);
    onRotationChange?.(rounded);
  }, [onRotationChange]);

  // Quick rotation presets
  const setRotation = useCallback((angle: number) => {
    setLocalRotation(angle);
    onRotationChange?.(angle);
  }, [onRotationChange]);

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
          Pinch to zoom, drag to position within the frame
        </Text>
      </View>

      {/* Rotation Section */}
      <View style={styles.rotationSection}>
        <View style={styles.rotationHeader}>
          <View style={styles.rotationLabel}>
            <RotateCw size={18} color={Colors.light.textSecondary} strokeWidth={2} />
            <Text style={styles.rotationTitle}>Rotation</Text>
          </View>
          <Text style={styles.rotationValue}>{localRotation}°</Text>
        </View>

        {/* Slider */}
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>-180°</Text>
          <Slider
            style={styles.slider}
            minimumValue={-180}
            maximumValue={180}
            value={localRotation}
            onValueChange={handleRotationChange}
            onSlidingComplete={handleRotationComplete}
            step={1}
            minimumTrackTintColor={Colors.light.accent}
            maximumTrackTintColor={Colors.light.border}
            thumbTintColor={Colors.light.accent}
          />
          <Text style={styles.sliderLabel}>180°</Text>
        </View>

        {/* Quick presets */}
        <View style={styles.presetsRow}>
          {[-90, -45, 0, 45, 90].map((angle) => (
            <TouchableOpacity
              key={angle}
              style={[
                styles.presetButton,
                localRotation === angle && styles.presetButtonActive,
              ]}
              onPress={() => setRotation(angle)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.presetText,
                localRotation === angle && styles.presetTextActive,
              ]}>
                {angle === 0 ? '0°' : `${angle > 0 ? '+' : ''}${angle}°`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
    paddingVertical: 12,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    textAlign: 'center',
  },
  rotationSection: {
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.border,
  },
  rotationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 12,
  },
  rotationLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rotationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  rotationValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.accent,
    minWidth: 50,
    textAlign: 'right',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderLabel: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    minWidth: 36,
    textAlign: 'center',
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  presetButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
  },
  presetButtonActive: {
    backgroundColor: Colors.light.accent,
  },
  presetText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  presetTextActive: {
    color: Colors.light.surface,
  },
});

export default CropToolbar;
