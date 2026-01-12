/**
 * OverlayStyleSheet Component
 * 
 * Bottom sheet for customizing text and date overlay styles.
 * Includes font picker, color picker, size slider, and date format picker.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Check, Trash2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import {
  TextOverlay,
  DateOverlay,
  Overlay,
  FontFamily,
  DateFormat,
  FONT_OPTIONS,
  DATE_FORMAT_OPTIONS,
  COLOR_PRESETS,
  FONT_SIZE_CONSTRAINTS,
  isTextBasedOverlay,
} from '@/types/overlays';

interface OverlayStyleSheetProps {
  /** Reference to the bottom sheet */
  bottomSheetRef: React.RefObject<BottomSheet>;
  /** Currently selected overlay */
  overlay: Overlay | null;
  /** Called when overlay is updated */
  onUpdateOverlay: (updates: Partial<TextOverlay | DateOverlay>) => void;
  /** Called when overlay is deleted */
  onDeleteOverlay: () => void;
}

// Slider component for font size
interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function SimpleSlider({ value, min, max, step, onChange }: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  
  const handlePress = useCallback((event: { nativeEvent: { locationX: number } }, width: number) => {
    const newPercentage = Math.max(0, Math.min(100, (event.nativeEvent.locationX / width) * 100));
    const newValue = min + (newPercentage / 100) * (max - min);
    const steppedValue = Math.round(newValue / step) * step;
    onChange(Math.max(min, Math.min(max, steppedValue)));
  }, [min, max, step, onChange]);

  return (
    <View 
      style={styles.sliderContainer}
      onLayout={(e) => {
        // Store width for calculations
      }}
    >
      <TouchableOpacity
        style={styles.sliderTrack}
        onPress={(e) => handlePress(e, 280)}
        activeOpacity={1}
      >
        <View style={[styles.sliderFill, { width: `${percentage}%` }]} />
        <View style={[styles.sliderThumb, { left: `${percentage}%` }]} />
      </TouchableOpacity>
      <Text style={styles.sliderValue}>{value}pt</Text>
    </View>
  );
}

export function OverlayStyleSheet({
  bottomSheetRef,
  overlay,
  onUpdateOverlay,
  onDeleteOverlay,
}: OverlayStyleSheetProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Snap points for bottom sheet
  const snapPoints = useMemo(() => ['50%', '80%'], []);

  // Check if overlay is text-based
  const isTextBased = overlay ? isTextBasedOverlay(overlay) : false;
  const textOverlay = isTextBased ? (overlay as TextOverlay | DateOverlay) : null;

  // Render backdrop
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  // Handle font change
  const handleFontChange = useCallback((fontFamily: FontFamily) => {
    onUpdateOverlay({ fontFamily });
  }, [onUpdateOverlay]);

  // Handle color change
  const handleColorChange = useCallback((color: string) => {
    onUpdateOverlay({ color });
  }, [onUpdateOverlay]);

  // Handle font size change
  const handleFontSizeChange = useCallback((fontSize: number) => {
    onUpdateOverlay({ fontSize });
  }, [onUpdateOverlay]);

  // Handle text content change
  const handleTextChange = useCallback((content: string) => {
    onUpdateOverlay({ content });
  }, [onUpdateOverlay]);

  // Handle date change
  const handleDateChange = useCallback((event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      onUpdateOverlay({ date: selectedDate.toISOString() });
    }
  }, [onUpdateOverlay]);

  // Handle date format change
  const handleDateFormatChange = useCallback((format: DateFormat) => {
    onUpdateOverlay({ format });
  }, [onUpdateOverlay]);

  // Handle text shadow toggle
  const handleShadowToggle = useCallback(() => {
    if (textOverlay) {
      onUpdateOverlay({ textShadow: !textOverlay.textShadow });
    }
  }, [textOverlay, onUpdateOverlay]);

  if (!overlay || !isTextBased || !textOverlay) {
    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={styles.emptyContent}>
          <Text style={styles.emptyText}>Select an overlay to customize</Text>
        </BottomSheetView>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView style={styles.content}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {overlay.type === 'date' ? 'Date Style' : 'Text Style'}
            </Text>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={onDeleteOverlay}
              activeOpacity={0.7}
            >
              <Trash2 size={18} color={Colors.light.error} />
            </TouchableOpacity>
          </View>

          {/* Text Input (for text overlays) */}
          {overlay.type === 'text' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Text</Text>
              <TextInput
                style={styles.textInput}
                value={(overlay as TextOverlay).content}
                onChangeText={handleTextChange}
                placeholder="Enter your text"
                placeholderTextColor={Colors.light.textTertiary}
                multiline
                maxLength={100}
              />
            </View>
          )}

          {/* Date Picker (for date overlays) */}
          {overlay.type === 'date' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.dateButtonText}>
                  {new Date((overlay as DateOverlay).date).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              
              {showDatePicker && (
                <DateTimePicker
                  value={new Date((overlay as DateOverlay).date)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={handleDateChange}
                />
              )}

              {/* Date Format Picker */}
              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Format</Text>
              <View style={styles.formatOptions}>
                {DATE_FORMAT_OPTIONS.map((format) => (
                  <TouchableOpacity
                    key={format.id}
                    style={[
                      styles.formatOption,
                      (overlay as DateOverlay).format === format.id && styles.formatOptionSelected,
                    ]}
                    onPress={() => handleDateFormatChange(format.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.formatLabel,
                      (overlay as DateOverlay).format === format.id && styles.formatLabelSelected,
                    ]}>
                      {format.example}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Font Picker */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Font</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.fontScroll}
            >
              {FONT_OPTIONS.map((font) => (
                <TouchableOpacity
                  key={font.id}
                  style={[
                    styles.fontOption,
                    textOverlay.fontFamily === font.id && styles.fontOptionSelected,
                  ]}
                  onPress={() => handleFontChange(font.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.fontLabel,
                    textOverlay.fontFamily === font.id && styles.fontLabelSelected,
                  ]}>
                    {font.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Color Picker */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Color</Text>
            <View style={styles.colorGrid}>
              {COLOR_PRESETS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    textOverlay.color === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => handleColorChange(color)}
                  activeOpacity={0.7}
                >
                  {textOverlay.color === color && (
                    <Check 
                      size={16} 
                      color={isLightColor(color) ? '#000' : '#FFF'} 
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Font Size Slider */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Size</Text>
            <SimpleSlider
              value={textOverlay.fontSize}
              min={FONT_SIZE_CONSTRAINTS.min}
              max={FONT_SIZE_CONSTRAINTS.max}
              step={FONT_SIZE_CONSTRAINTS.step}
              onChange={handleFontSizeChange}
            />
          </View>

          {/* Text Shadow Toggle */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={handleShadowToggle}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleLabel}>Text Shadow</Text>
              <View style={[
                styles.toggle,
                textOverlay.textShadow && styles.toggleActive,
              ]}>
                {textOverlay.textShadow && (
                  <Check size={14} color={Colors.light.surface} />
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Bottom padding */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </BottomSheetView>
    </BottomSheet>
  );
}

/**
 * Check if a hex color is light or dark
 */
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  deleteButton: {
    padding: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: Colors.light.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateButton: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  formatOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formatOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  formatOptionSelected: {
    backgroundColor: Colors.light.accent,
    borderColor: Colors.light.accent,
  },
  formatLabel: {
    fontSize: 13,
    color: Colors.light.text,
  },
  formatLabelSelected: {
    color: Colors.light.surface,
    fontWeight: '600',
  },
  fontScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  fontOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceSecondary,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  fontOptionSelected: {
    backgroundColor: Colors.light.accent,
    borderColor: Colors.light.accent,
  },
  fontLabel: {
    fontSize: 14,
    color: Colors.light.text,
  },
  fontLabelSelected: {
    color: Colors.light.surface,
    fontWeight: '600',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: Colors.light.accent,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.light.border,
    borderRadius: 3,
    position: 'relative',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.light.accent,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    top: -7,
    marginLeft: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.light.surface,
    borderWidth: 3,
    borderColor: Colors.light.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    width: 50,
    textAlign: 'right',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
  },
  toggleLabel: {
    fontSize: 15,
    color: Colors.light.text,
  },
  toggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: Colors.light.accent,
  },
});

export default OverlayStyleSheet;
