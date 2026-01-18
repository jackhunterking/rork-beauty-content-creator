/**
 * TextStylePanel Component
 * 
 * Compact bottom panel for customizing text and date overlay styles.
 * Follows Canva's pattern: 25% height, tabbed navigation at bottom,
 * horizontal scrolling content within each tab.
 */

import React, { useState, useCallback, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
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
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Check, Trash2, X } from 'lucide-react-native';
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

/**
 * Tab types for the panel
 */
type TabType = 'content' | 'font' | 'color' | 'size' | 'format';

interface TabConfig {
  id: TabType;
  label: string;
  showFor: Array<'text' | 'date'>;
}

const TABS: TabConfig[] = [
  { id: 'content', label: 'Edit', showFor: ['text'] },
  { id: 'font', label: 'Font', showFor: ['text', 'date'] },
  { id: 'color', label: 'Color', showFor: ['text', 'date'] },
  { id: 'size', label: 'Size', showFor: ['text', 'date'] },
  { id: 'format', label: 'Format', showFor: ['date'] },
];

export interface TextStylePanelProps {
  /** Currently selected overlay */
  overlay: Overlay | null;
  /** Called when overlay is updated */
  onUpdateOverlay: (updates: Partial<TextOverlay | DateOverlay>) => void;
  /** Called when overlay is deleted */
  onDeleteOverlay: () => void;
  /** Called when panel is closed */
  onClose?: () => void;
}

export interface TextStylePanelRef {
  open: () => void;
  close: () => void;
}

export const TextStylePanel = forwardRef<TextStylePanelRef, TextStylePanelProps>(
  function TextStylePanel(
    { overlay, onUpdateOverlay, onDeleteOverlay, onClose },
    ref
  ) {
    const insets = useSafeAreaInsets();
    const bottomSheetRef = useRef<BottomSheet>(null);
    const [activeTab, setActiveTab] = useState<TabType>('font');
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Snap points - 28% for compact panel to account for safe area, 42% when editing text
    const snapPoints = useMemo(() => ['28%', '42%'], []);
    
    // Calculate bottom padding with safe area
    const bottomPadding = Math.max(insets.bottom, 16);

    // Check if overlay is text-based
    const isTextBased = overlay ? isTextBasedOverlay(overlay) : false;
    const textOverlay = isTextBased ? (overlay as TextOverlay | DateOverlay) : null;
    const overlayType = overlay?.type as 'text' | 'date' | undefined;

    // Filter tabs based on overlay type
    const visibleTabs = useMemo(() => {
      if (!overlayType) return [];
      return TABS.filter((tab) => tab.showFor.includes(overlayType));
    }, [overlayType]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      open: () => {
        // Reset to appropriate default tab
        if (overlayType === 'date') {
          setActiveTab('format');
        } else {
          setActiveTab('font');
        }
        bottomSheetRef.current?.snapToIndex(0);
      },
      close: () => {
        bottomSheetRef.current?.close();
        onClose?.();
      },
    }));

    // Handle close
    const handleClose = useCallback(() => {
      bottomSheetRef.current?.close();
      onClose?.();
    }, [onClose]);

    // Handle sheet changes
    const handleSheetChange = useCallback(
      (index: number) => {
        if (index === -1) {
          onClose?.();
        }
      },
      [onClose]
    );

    // Render backdrop
    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.3}
          pressBehavior="close"
        />
      ),
      []
    );

    // Handler functions
    const handleFontChange = useCallback(
      (fontFamily: FontFamily) => {
        onUpdateOverlay({ fontFamily });
      },
      [onUpdateOverlay]
    );

    const handleColorChange = useCallback(
      (color: string) => {
        onUpdateOverlay({ color });
      },
      [onUpdateOverlay]
    );

    const handleFontSizeChange = useCallback(
      (fontSize: number) => {
        onUpdateOverlay({ fontSize: Math.round(fontSize) });
      },
      [onUpdateOverlay]
    );

    const handleTextChange = useCallback(
      (content: string) => {
        onUpdateOverlay({ content });
      },
      [onUpdateOverlay]
    );

    const handleDateChange = useCallback(
      (event: any, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
          onUpdateOverlay({ date: selectedDate.toISOString() });
        }
      },
      [onUpdateOverlay]
    );

    const handleDateFormatChange = useCallback(
      (format: DateFormat) => {
        onUpdateOverlay({ format });
      },
      [onUpdateOverlay]
    );

    const handleShadowToggle = useCallback(() => {
      if (textOverlay) {
        onUpdateOverlay({ textShadow: !textOverlay.textShadow });
      }
    }, [textOverlay, onUpdateOverlay]);

    // Render tab content
    const renderTabContent = () => {
      if (!textOverlay) return null;

      switch (activeTab) {
        case 'content':
          return (
            <View style={styles.tabContent}>
              <BottomSheetTextInput
                style={styles.textInput}
                value={(overlay as TextOverlay).content}
                onChangeText={handleTextChange}
                placeholder="Enter your text"
                placeholderTextColor={Colors.light.textTertiary}
                multiline
                maxLength={100}
                onFocus={() => bottomSheetRef.current?.snapToIndex(1)}
              />
            </View>
          );

        case 'font':
          return (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
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
                  <Text
                    style={[
                      styles.fontLabel,
                      textOverlay.fontFamily === font.id && styles.fontLabelSelected,
                    ]}
                  >
                    {font.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          );

        case 'color':
          return (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
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
                    <Check size={16} color={isLightColor(color) ? '#000' : '#FFF'} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          );

        case 'size':
          return (
            <View style={styles.sizeContent}>
              <View style={styles.sizeSliderRow}>
                <Text style={styles.sizeLabel}>A</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={FONT_SIZE_CONSTRAINTS.min}
                  maximumValue={FONT_SIZE_CONSTRAINTS.max}
                  step={FONT_SIZE_CONSTRAINTS.step}
                  value={textOverlay.fontSize}
                  onValueChange={handleFontSizeChange}
                  minimumTrackTintColor={Colors.light.accent}
                  maximumTrackTintColor={Colors.light.border}
                  thumbTintColor={Colors.light.accent}
                />
                <Text style={styles.sizeLabelLarge}>A</Text>
                <View style={styles.sizeValueBadge}>
                  <Text style={styles.sizeValueText}>{textOverlay.fontSize}</Text>
                </View>
              </View>
              {/* Shadow toggle */}
              <TouchableOpacity
                style={styles.shadowToggle}
                onPress={handleShadowToggle}
                activeOpacity={0.7}
              >
                <Text style={styles.shadowLabel}>Shadow</Text>
                <View
                  style={[
                    styles.toggleIndicator,
                    textOverlay.textShadow && styles.toggleIndicatorActive,
                  ]}
                >
                  {textOverlay.textShadow && (
                    <Check size={12} color={Colors.light.surface} />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          );

        case 'format':
          if (overlay?.type !== 'date') return null;
          const dateOverlay = overlay as DateOverlay;
          return (
            <View style={styles.formatContent}>
              {/* Date picker button */}
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.dateButtonText}>
                  {new Date(dateOverlay.date).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={new Date(dateOverlay.date)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                  style={styles.datePicker}
                />
              )}
              {/* Format options */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
                style={styles.formatScroll}
              >
                {DATE_FORMAT_OPTIONS.map((format) => (
                  <TouchableOpacity
                    key={format.id}
                    style={[
                      styles.formatOption,
                      dateOverlay.format === format.id && styles.formatOptionSelected,
                    ]}
                    onPress={() => handleDateFormatChange(format.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.formatLabel,
                        dateOverlay.format === format.id && styles.formatLabelSelected,
                      ]}
                    >
                      {format.example}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          );

        default:
          return null;
      }
    };

    if (!overlay || !isTextBased || !textOverlay) {
      return null;
    }

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        onChange={handleSheetChange}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <BottomSheetView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={onDeleteOverlay}
              activeOpacity={0.7}
            >
              <Trash2 size={18} color={Colors.light.error} />
            </TouchableOpacity>
            <Text style={styles.title}>
              {overlay.type === 'date' ? 'Date' : 'Text'}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <X size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>{renderTabContent()}</View>

          {/* Tab Bar */}
          <View style={[styles.tabBar, { paddingBottom: bottomPadding }]}>
            {visibleTabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    activeTab === tab.id && styles.tabLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

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
  background: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handleIndicator: {
    backgroundColor: 'rgba(60, 60, 67, 0.3)',
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  deleteButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(214, 69, 69, 0.1)',
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.borderLight,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  tabActive: {
    backgroundColor: Colors.light.surfaceSecondary,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  tabLabelActive: {
    color: Colors.light.text,
    fontWeight: '600',
  },
  // Tab content styles
  tabContent: {
    flex: 1,
  },
  horizontalScroll: {
    paddingVertical: 8,
    gap: 10,
  },
  // Text input
  textInput: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: Colors.light.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // Font options
  fontOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
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
    fontWeight: '500',
  },
  fontLabelSelected: {
    color: Colors.light.surface,
    fontWeight: '600',
  },
  // Color options
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: Colors.light.accent,
  },
  // Size content
  sizeContent: {
    gap: 12,
  },
  sizeSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sizeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  sizeLabelLarge: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sizeValueBadge: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 50,
    alignItems: 'center',
  },
  sizeValueText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  shadowToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  shadowLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  toggleIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleIndicatorActive: {
    backgroundColor: Colors.light.accent,
  },
  // Format content
  formatContent: {
    gap: 12,
  },
  dateButton: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
  },
  datePicker: {
    height: 100,
  },
  formatScroll: {
    marginTop: 8,
  },
  formatOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
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
    fontWeight: '500',
  },
  formatLabelSelected: {
    color: Colors.light.surface,
    fontWeight: '600',
  },
});

export default TextStylePanel;
