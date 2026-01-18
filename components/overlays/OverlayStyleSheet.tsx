/**
 * OverlayStyleSheet Component
 * 
 * Bottom sheet for customizing text and date overlay styles.
 * Includes font picker, color picker, size slider/input, and date format picker.
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
  Keyboard,
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
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

// Slider component for font size with editable input - using native slider
interface SizeSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onInputFocus?: () => void;
}

function SizeSlider({ value, min, max, step, onChange, onInputFocus }: SizeSliderProps) {
  const [inputValue, setInputValue] = useState(value.toString());
  const [isEditing, setIsEditing] = useState(false);

  // Handle slider value change
  const handleSliderChange = useCallback((newValue: number) => {
    const steppedValue = Math.round(newValue / step) * step;
    const clampedValue = Math.max(min, Math.min(max, steppedValue));
    onChange(clampedValue);
  }, [min, max, step, onChange]);

  // Handle direct input change
  const handleInputChange = useCallback((text: string) => {
    // Allow only numbers
    const numericText = text.replace(/[^0-9]/g, '');
    setInputValue(numericText);
  }, []);

  // Handle input focus
  const handleInputFocus = useCallback(() => {
    setIsEditing(true);
    onInputFocus?.();
  }, [onInputFocus]);

  // Handle input submit/blur
  const handleInputSubmit = useCallback(() => {
    setIsEditing(false);
    const numValue = parseInt(inputValue, 10);
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(min, Math.min(max, numValue));
      onChange(clampedValue);
      setInputValue(clampedValue.toString());
    } else {
      setInputValue(value.toString());
    }
    Keyboard.dismiss();
  }, [inputValue, min, max, value, onChange]);

  // Sync input value when value prop changes (e.g., from slider)
  React.useEffect(() => {
    if (!isEditing) {
      setInputValue(value.toString());
    }
  }, [value, isEditing]);

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderWrapper}>
        <Slider
          style={styles.nativeSlider}
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={value}
          onValueChange={handleSliderChange}
          minimumTrackTintColor={Colors.light.accent}
          maximumTrackTintColor={Colors.light.border}
          thumbTintColor={Colors.light.accent}
        />
      </View>
      <View style={styles.sizeInputContainer}>
        <TextInput
          style={styles.sizeInput}
          value={inputValue}
          onChangeText={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputSubmit}
          onSubmitEditing={handleInputSubmit}
          keyboardType="number-pad"
          returnKeyType="done"
          selectTextOnFocus
          maxLength={3}
        />
        <Text style={styles.sizeUnit}>pt</Text>
      </View>
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
  
  // Snap points for bottom sheet - includes higher snap point for keyboard visibility
  // 30% for compact view, 60% for expanded, 90% when keyboard is active
  const snapPoints = useMemo(() => ['30%', '60%', '90%'], []);

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
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
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
            <BottomSheetTextInput
              style={styles.textInput}
              value={(overlay as TextOverlay).content}
              onChangeText={handleTextChange}
              placeholder="Enter your text"
              placeholderTextColor={Colors.light.textTertiary}
              multiline
              maxLength={100}
              onFocus={() => bottomSheetRef.current?.snapToIndex(2)}
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
              <View style={styles.datePickerContainer}>
                <DateTimePicker
                  value={new Date((overlay as DateOverlay).date)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={handleDateChange}
                  style={styles.datePicker}
                />
              </View>
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
            nestedScrollEnabled
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

        {/* Font Size Slider with Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Size</Text>
          <SizeSlider
            value={textOverlay.fontSize}
            min={FONT_SIZE_CONSTRAINTS.min}
            max={FONT_SIZE_CONSTRAINTS.max}
            step={FONT_SIZE_CONSTRAINTS.step}
            onChange={handleFontSizeChange}
            onInputFocus={() => bottomSheetRef.current?.snapToIndex(2)}
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

        {/* Bottom padding for safe scrolling */}
        <View style={{ height: 60 }} />
      </BottomSheetScrollView>
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
  scrollContent: {
    paddingBottom: 20,
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
  // Date picker container - ensures full width
  datePickerContainer: {
    width: '100%',
    marginTop: 12,
    alignItems: 'center',
  },
  datePicker: {
    width: '100%',
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
  sliderWrapper: {
    flex: 1,
  },
  nativeSlider: {
    width: '100%',
    height: 40,
  },
  // Size input styles
  sizeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 70,
  },
  sizeInput: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
    minWidth: 30,
    paddingVertical: 2,
  },
  sizeUnit: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 2,
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
