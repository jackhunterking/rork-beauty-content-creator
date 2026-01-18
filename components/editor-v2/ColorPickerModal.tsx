/**
 * ColorPickerModal Component
 * 
 * A full-featured color picker with:
 * - Rainbow gradient picker for visual selection
 * - Brightness/saturation control
 * - Hex code input for precise colors
 * - Recent colors history
 * - Preset colors quick access
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  X, 
  Check, 
  RotateCcw,
} from 'lucide-react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { COLOR_PRESETS } from '@/types/overlays';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PICKER_WIDTH = SCREEN_WIDTH - 48;
const PICKER_HEIGHT = 200;
const HUE_BAR_HEIGHT = 32;
const THUMB_SIZE = 28;

interface ColorPickerModalProps {
  visible: boolean;
  currentColor: string;
  title?: string;
  onSelectColor: (color: string) => void;
  onClose: () => void;
}

/**
 * Convert HSV to RGB hex
 */
function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Convert hex to HSV
 */
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, v: 1 };

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }

  return { h, s, v };
}

/**
 * Validate and normalize hex color
 */
function normalizeHex(input: string): string | null {
  let hex = input.replace(/[^a-fA-F0-9]/g, '');
  
  // Handle 3-digit hex
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  
  if (hex.length === 6) {
    return `#${hex.toUpperCase()}`;
  }
  
  return null;
}

export function ColorPickerModal({
  visible,
  currentColor,
  title = 'Choose Color',
  onSelectColor,
  onClose,
}: ColorPickerModalProps) {
  const insets = useSafeAreaInsets();
  
  // Parse initial color
  const initialHsv = useMemo(() => hexToHsv(currentColor), [currentColor]);
  
  // State
  const [hue, setHue] = useState(initialHsv.h);
  const [saturation, setSaturation] = useState(initialHsv.s);
  const [brightness, setBrightness] = useState(initialHsv.v);
  const [hexInput, setHexInput] = useState(currentColor.toUpperCase());
  const [recentColors, setRecentColors] = useState<string[]>([]);
  
  // Shared values for gesture
  const huePosition = useSharedValue((initialHsv.h / 360) * PICKER_WIDTH);
  const satBrightX = useSharedValue(initialHsv.s * PICKER_WIDTH);
  const satBrightY = useSharedValue((1 - initialHsv.v) * PICKER_HEIGHT);
  
  // Current color based on HSV
  const selectedColor = useMemo(() => 
    hsvToHex(hue, saturation, brightness),
    [hue, saturation, brightness]
  );
  
  // Update hex input when color changes via picker
  useEffect(() => {
    setHexInput(selectedColor);
  }, [selectedColor]);
  
  // Reset when modal opens with new color
  useEffect(() => {
    if (visible) {
      const hsv = hexToHsv(currentColor);
      setHue(hsv.h);
      setSaturation(hsv.s);
      setBrightness(hsv.v);
      setHexInput(currentColor.toUpperCase());
      huePosition.value = (hsv.h / 360) * PICKER_WIDTH;
      satBrightX.value = hsv.s * PICKER_WIDTH;
      satBrightY.value = (1 - hsv.v) * PICKER_HEIGHT;
    }
  }, [visible, currentColor]);

  // Handle hue change from JS
  const handleHueChange = useCallback((x: number) => {
    const clampedX = Math.max(0, Math.min(PICKER_WIDTH, x));
    const newHue = (clampedX / PICKER_WIDTH) * 360;
    setHue(newHue);
  }, []);

  // Handle saturation/brightness change from JS
  const handleSatBrightChange = useCallback((x: number, y: number) => {
    const clampedX = Math.max(0, Math.min(PICKER_WIDTH, x));
    const clampedY = Math.max(0, Math.min(PICKER_HEIGHT, y));
    setSaturation(clampedX / PICKER_WIDTH);
    setBrightness(1 - (clampedY / PICKER_HEIGHT));
  }, []);

  // Hue bar gesture
  const hueGesture = useMemo(() => 
    Gesture.Pan()
      .onStart((e) => {
        huePosition.value = e.x;
        runOnJS(handleHueChange)(e.x);
      })
      .onUpdate((e) => {
        huePosition.value = Math.max(0, Math.min(PICKER_WIDTH, e.x));
        runOnJS(handleHueChange)(e.x);
      }),
    [handleHueChange]
  );

  // Saturation/Brightness gesture
  const satBrightGesture = useMemo(() =>
    Gesture.Pan()
      .onStart((e) => {
        satBrightX.value = e.x;
        satBrightY.value = e.y;
        runOnJS(handleSatBrightChange)(e.x, e.y);
      })
      .onUpdate((e) => {
        satBrightX.value = Math.max(0, Math.min(PICKER_WIDTH, e.x));
        satBrightY.value = Math.max(0, Math.min(PICKER_HEIGHT, e.y));
        runOnJS(handleSatBrightChange)(e.x, e.y);
      }),
    [handleSatBrightChange]
  );

  // Animated styles
  const hueThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: huePosition.value - THUMB_SIZE / 2 }],
  }));

  const satBrightThumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: satBrightX.value - THUMB_SIZE / 2 },
      { translateY: satBrightY.value - THUMB_SIZE / 2 },
    ],
  }));

  // Handle hex input change
  const handleHexInputChange = useCallback((text: string) => {
    // Allow typing with or without #
    const cleanText = text.startsWith('#') ? text : `#${text}`;
    setHexInput(cleanText.toUpperCase());
    
    const normalized = normalizeHex(text);
    if (normalized) {
      const hsv = hexToHsv(normalized);
      setHue(hsv.h);
      setSaturation(hsv.s);
      setBrightness(hsv.v);
      huePosition.value = (hsv.h / 360) * PICKER_WIDTH;
      satBrightX.value = hsv.s * PICKER_WIDTH;
      satBrightY.value = (1 - hsv.v) * PICKER_HEIGHT;
    }
  }, []);

  // Handle preset color selection
  const handlePresetSelect = useCallback((color: string) => {
    const hsv = hexToHsv(color);
    setHue(hsv.h);
    setSaturation(hsv.s);
    setBrightness(hsv.v);
    setHexInput(color.toUpperCase());
    huePosition.value = (hsv.h / 360) * PICKER_WIDTH;
    satBrightX.value = hsv.s * PICKER_WIDTH;
    satBrightY.value = (1 - hsv.v) * PICKER_HEIGHT;
  }, []);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    // Add to recent colors
    setRecentColors(prev => {
      const newRecent = [selectedColor, ...prev.filter(c => c !== selectedColor)].slice(0, 6);
      return newRecent;
    });
    onSelectColor(selectedColor);
    onClose();
  }, [selectedColor, onSelectColor, onClose]);

  // Handle reset to original
  const handleReset = useCallback(() => {
    const hsv = hexToHsv(currentColor);
    setHue(hsv.h);
    setSaturation(hsv.s);
    setBrightness(hsv.v);
    setHexInput(currentColor.toUpperCase());
    huePosition.value = (hsv.h / 360) * PICKER_WIDTH;
    satBrightX.value = hsv.s * PICKER_WIDTH;
    satBrightY.value = (1 - hsv.v) * PICKER_HEIGHT;
  }, [currentColor]);

  // Pure hue color for gradient background
  const pureHueColor = useMemo(() => hsvToHex(hue, 1, 1), [hue]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.modalContainer}>
        <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <X size={24} color={Colors.light.text} />
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity
              style={[styles.headerButton, styles.confirmButton]}
              onPress={handleConfirm}
              activeOpacity={0.7}
            >
              <Check size={24} color={Colors.light.surface} />
            </TouchableOpacity>
          </View>

          {/* Color Preview */}
          <View style={styles.previewSection}>
            <View style={styles.previewRow}>
              <View style={styles.previewItem}>
                <Text style={styles.previewLabel}>Original</Text>
                <View style={[styles.previewColor, { backgroundColor: currentColor }]} />
              </View>
              <View style={styles.previewItem}>
                <Text style={styles.previewLabel}>New</Text>
                <View style={[styles.previewColor, { backgroundColor: selectedColor }]} />
              </View>
            </View>
            <TouchableOpacity 
              style={styles.resetButton}
              onPress={handleReset}
              activeOpacity={0.7}
            >
              <RotateCcw size={16} color={Colors.light.textSecondary} />
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>

          {/* Saturation/Brightness Picker */}
          <View style={styles.pickerSection}>
            <Text style={styles.sectionLabel}>Select Shade</Text>
            <GestureDetector gesture={satBrightGesture}>
              <View style={styles.satBrightPicker}>
                {/* Base hue color */}
                <View style={[styles.satBrightBase, { backgroundColor: pureHueColor }]} />
                {/* White gradient (left to right) */}
                <LinearGradient
                  colors={['#FFFFFF', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.satBrightOverlay}
                />
                {/* Black gradient (top to bottom) */}
                <LinearGradient
                  colors={['transparent', '#000000']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.satBrightOverlay}
                />
                {/* Thumb */}
                <Animated.View style={[styles.pickerThumb, satBrightThumbStyle]}>
                  <View style={[styles.thumbInner, { backgroundColor: selectedColor }]} />
                </Animated.View>
              </View>
            </GestureDetector>
          </View>

          {/* Hue Bar */}
          <View style={styles.hueSection}>
            <Text style={styles.sectionLabel}>Select Color</Text>
            <GestureDetector gesture={hueGesture}>
              <View style={styles.hueBar}>
                <LinearGradient
                  colors={[
                    '#FF0000', // Red
                    '#FFFF00', // Yellow
                    '#00FF00', // Green
                    '#00FFFF', // Cyan
                    '#0000FF', // Blue
                    '#FF00FF', // Magenta
                    '#FF0000', // Red (loop)
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.hueGradient}
                />
                <Animated.View style={[styles.hueThumb, hueThumbStyle]}>
                  <View style={[styles.thumbInner, { backgroundColor: pureHueColor }]} />
                </Animated.View>
              </View>
            </GestureDetector>
          </View>

          {/* Hex Input */}
          <View style={styles.hexSection}>
            <Text style={styles.sectionLabel}>Hex Code</Text>
            <View style={styles.hexInputRow}>
              <View style={[styles.hexColorPreview, { backgroundColor: selectedColor }]} />
              <TextInput
                style={styles.hexInput}
                value={hexInput}
                onChangeText={handleHexInputChange}
                placeholder="#FFFFFF"
                placeholderTextColor={Colors.light.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={7}
              />
            </View>
          </View>

          {/* Preset Colors */}
          <View style={styles.presetsSection}>
            <Text style={styles.sectionLabel}>Preset Colors</Text>
            <View style={styles.presetsGrid}>
              {COLOR_PRESETS.slice(0, 12).map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.presetColor,
                    { backgroundColor: color },
                    selectedColor === color && styles.presetColorSelected,
                  ]}
                  onPress={() => handlePresetSelect(color)}
                  activeOpacity={0.7}
                />
              ))}
            </View>
          </View>

          {/* Recent Colors */}
          {recentColors.length > 0 && (
            <View style={styles.recentSection}>
              <Text style={styles.sectionLabel}>Recent</Text>
              <View style={styles.recentRow}>
                {recentColors.map((color, index) => (
                  <TouchableOpacity
                    key={`${color}-${index}`}
                    style={[
                      styles.recentColor,
                      { backgroundColor: color },
                      selectedColor === color && styles.presetColorSelected,
                    ]}
                    onPress={() => handlePresetSelect(color)}
                    activeOpacity={0.7}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  confirmButton: {
    backgroundColor: Colors.light.accent,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  previewSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 16,
  },
  previewItem: {
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  previewColor: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  resetText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  pickerSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 10,
  },
  satBrightPicker: {
    width: PICKER_WIDTH,
    height: PICKER_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  satBrightBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  satBrightOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pickerThumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  thumbInner: {
    flex: 1,
    borderRadius: THUMB_SIZE / 2 - 3,
  },
  hueSection: {
    marginBottom: 20,
  },
  hueBar: {
    width: PICKER_WIDTH,
    height: HUE_BAR_HEIGHT,
    borderRadius: HUE_BAR_HEIGHT / 2,
    overflow: 'visible',
    position: 'relative',
  },
  hueGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: HUE_BAR_HEIGHT / 2,
  },
  hueThumb: {
    position: 'absolute',
    top: (HUE_BAR_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  hexSection: {
    marginBottom: 20,
  },
  hexInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  hexColorPreview: {
    width: 48,
    height: 48,
  },
  hexInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Colors.light.text,
  },
  presetsSection: {
    marginBottom: 16,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetColor: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetColorSelected: {
    borderColor: Colors.light.accent,
    borderWidth: 3,
  },
  recentSection: {
    marginBottom: 16,
  },
  recentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  recentColor: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
});

export default ColorPickerModal;
