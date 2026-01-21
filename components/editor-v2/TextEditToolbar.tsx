/**
 * TextEditToolbar Component
 * 
 * Canva-style toolbar that appears above the keyboard when editing text overlays.
 * Horizontally scrollable with quick shortcuts for all text formatting options.
 * Uses InputAccessoryView on iOS for proper keyboard integration.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  InputAccessoryView,
  Platform,
  Keyboard,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Check,
  Plus,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { COLOR_PRESETS, FONT_OPTIONS, FontFamily } from '@/types/overlays';
import { ColorPickerModal } from './ColorPickerModal';

const INPUT_ACCESSORY_ID = 'textEditToolbarInput';

// Font size presets for quick selection
const FONT_SIZE_PRESETS = [12, 16, 20, 24, 32, 40, 48, 64, 72, 96];

/**
 * Text format options
 */
export interface TextFormatOptions {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
}

interface TextEditToolbarProps {
  /** Initial text content */
  initialContent: string;
  /** Current text color */
  currentColor: string;
  /** Current font family */
  currentFont?: FontFamily;
  /** Current font size */
  currentFontSize?: number;
  /** Current format options */
  currentFormat?: TextFormatOptions;
  /** Called when text content changes */
  onContentChange: (content: string) => void;
  /** Called when color changes */
  onColorChange: (color: string) => void;
  /** Called when font changes */
  onFontChange?: (font: FontFamily) => void;
  /** Called when font size changes */
  onFontSizeChange?: (size: number) => void;
  /** Called when format changes */
  onFormatChange?: (format: TextFormatOptions) => void;
  /** Called when editing is done */
  onDone: () => void;
  /** Whether visible */
  visible: boolean;
}

type ExpandedOption = 'color' | 'font' | 'size' | null;

export function TextEditToolbar({
  initialContent,
  currentColor,
  currentFont = 'System',
  currentFontSize = 24,
  currentFormat = {},
  onContentChange,
  onColorChange,
  onFontChange,
  onFontSizeChange,
  onFormatChange,
  onDone,
  visible,
}: TextEditToolbarProps) {
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState(initialContent);
  const [expandedOption, setExpandedOption] = useState<ExpandedOption>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Focus input when visible - dismiss any existing keyboard first, then focus our input
  // selectTextOnFocus prop handles selecting all text automatically
  useEffect(() => {
    if (visible) {
      // Dismiss any existing keyboard first to ensure clean state
      Keyboard.dismiss();
      // Delay focus to give InputAccessoryView time to register with iOS
      // before the TextInput gains focus and triggers the keyboard
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 350);
      return () => clearTimeout(timer);
    } else {
      Keyboard.dismiss();
      setExpandedOption(null);
    }
  }, [visible]);

  // Sync text with initial content
  useEffect(() => {
    setText(initialContent);
  }, [initialContent]);

  const handleTextChange = (newText: string) => {
    setText(newText);
    onContentChange(newText);
  };

  const handleDone = () => {
    Keyboard.dismiss();
    setExpandedOption(null);
    onDone();
  };

  const handleColorSelect = (color: string) => {
    onColorChange(color);
    setExpandedOption(null);
  };

  const handleOpenColorPicker = useCallback(() => {
    setShowColorPicker(true);
  }, []);

  const handleColorPickerSelect = useCallback((color: string) => {
    onColorChange(color);
  }, [onColorChange]);

  const handleFontSelect = (font: FontFamily) => {
    onFontChange?.(font);
    setExpandedOption(null);
  };

  const handleSizeSelect = (size: number) => {
    onFontSizeChange?.(size);
    setExpandedOption(null);
  };

  const handleFormatToggle = (key: keyof TextFormatOptions) => {
    const newFormat = { ...currentFormat, [key]: !currentFormat[key] };
    onFormatChange?.(newFormat);
  };

  const toggleExpanded = (option: ExpandedOption) => {
    setExpandedOption(expandedOption === option ? null : option);
  };

  // Render expanded color picker
  const renderColorPicker = () => (
    <Animated.View 
      style={styles.expandedRow}
      entering={FadeIn.duration(100)}
      exiting={FadeOut.duration(80)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.expandedScrollContent}
        bounces={false}
      >
        {/* Add custom color button - opens full picker */}
        <TouchableOpacity 
          style={styles.colorWheelButton} 
          activeOpacity={0.7}
          onPress={handleOpenColorPicker}
        >
          <View style={styles.colorWheelGradient}>
            <Plus size={12} color={Colors.light.surface} strokeWidth={2.5} />
          </View>
        </TouchableOpacity>

        {/* Color presets */}
        {COLOR_PRESETS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorOption,
              { backgroundColor: color },
              currentColor === color && styles.colorOptionSelected,
            ]}
            onPress={() => handleColorSelect(color)}
            activeOpacity={0.7}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );

  // Render expanded font picker
  const renderFontPicker = () => (
    <Animated.View 
      style={styles.expandedRow}
      entering={FadeIn.duration(100)}
      exiting={FadeOut.duration(80)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.expandedScrollContent}
        bounces={false}
      >
        {FONT_OPTIONS.map((font) => (
          <TouchableOpacity
            key={font.id}
            style={[
              styles.fontOption,
              currentFont === font.id && styles.fontOptionSelected,
            ]}
            onPress={() => handleFontSelect(font.id)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.fontOptionText,
              currentFont === font.id && styles.fontOptionTextSelected,
            ]}>
              {font.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );

  // Render expanded size picker
  const renderSizePicker = () => (
    <Animated.View 
      style={styles.expandedRow}
      entering={FadeIn.duration(100)}
      exiting={FadeOut.duration(80)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.expandedScrollContent}
        bounces={false}
      >
        {FONT_SIZE_PRESETS.map((size) => (
          <TouchableOpacity
            key={size}
            style={[
              styles.sizeOption,
              currentFontSize === size && styles.sizeOptionSelected,
            ]}
            onPress={() => handleSizeSelect(size)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.sizeOptionText,
              currentFontSize === size && styles.sizeOptionTextSelected,
            ]}>
              {size}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );

  // Render the toolbar content
  const renderToolbar = () => (
    <View style={styles.toolbarContainer}>
      {/* Expanded options row */}
      {expandedOption === 'color' && renderColorPicker()}
      {expandedOption === 'font' && renderFontPicker()}
      {expandedOption === 'size' && renderSizePicker()}

      {/* Main toolbar */}
      <View style={styles.toolbar}>
        {/* Scrollable formatting options */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarScroll}
          bounces={false}
          style={styles.scrollView}
        >
          {/* Color indicator button */}
          <TouchableOpacity
            style={[styles.toolButton, expandedOption === 'color' && styles.toolButtonActive]}
            onPress={() => toggleExpanded('color')}
            activeOpacity={0.7}
          >
            <View style={[styles.colorIndicator, { backgroundColor: currentColor }]} />
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Font button */}
          <TouchableOpacity
            style={[styles.toolButtonWide, expandedOption === 'font' && styles.toolButtonActive]}
            onPress={() => toggleExpanded('font')}
            activeOpacity={0.7}
          >
            <Text style={styles.toolButtonText} numberOfLines={1}>
              {FONT_OPTIONS.find(f => f.id === currentFont)?.label || 'System'}
            </Text>
          </TouchableOpacity>

          {/* Font size button */}
          <TouchableOpacity
            style={[styles.toolButtonSize, expandedOption === 'size' && styles.toolButtonActive]}
            onPress={() => toggleExpanded('size')}
            activeOpacity={0.7}
          >
            <Text style={styles.toolButtonText}>{currentFontSize} pt</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Bold */}
          <TouchableOpacity
            style={[styles.toolButton, currentFormat.bold && styles.toolButtonActive]}
            onPress={() => handleFormatToggle('bold')}
            activeOpacity={0.7}
          >
            <Bold 
              size={20} 
              color={currentFormat.bold ? Colors.light.accent : Colors.light.text} 
              strokeWidth={2.5} 
            />
          </TouchableOpacity>

          {/* Italic */}
          <TouchableOpacity
            style={[styles.toolButton, currentFormat.italic && styles.toolButtonActive]}
            onPress={() => handleFormatToggle('italic')}
            activeOpacity={0.7}
          >
            <Italic 
              size={20} 
              color={currentFormat.italic ? Colors.light.accent : Colors.light.text} 
              strokeWidth={2} 
            />
          </TouchableOpacity>

          {/* Underline */}
          <TouchableOpacity
            style={[styles.toolButton, currentFormat.underline && styles.toolButtonActive]}
            onPress={() => handleFormatToggle('underline')}
            activeOpacity={0.7}
          >
            <Underline 
              size={20} 
              color={currentFormat.underline ? Colors.light.accent : Colors.light.text} 
              strokeWidth={2} 
            />
          </TouchableOpacity>

          {/* Strikethrough */}
          <TouchableOpacity
            style={[styles.toolButton, currentFormat.strikethrough && styles.toolButtonActive]}
            onPress={() => handleFormatToggle('strikethrough')}
            activeOpacity={0.7}
          >
            <Strikethrough 
              size={20} 
              color={currentFormat.strikethrough ? Colors.light.accent : Colors.light.text} 
              strokeWidth={2} 
            />
          </TouchableOpacity>

          {/* Text case (aA) */}
          <TouchableOpacity
            style={styles.toolButton}
            activeOpacity={0.7}
          >
            <Text style={styles.textCaseLabel}>aA</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Done button */}
        <TouchableOpacity
          style={styles.doneButton}
          onPress={handleDone}
          activeOpacity={0.8}
        >
          <Check size={20} color={Colors.light.surface} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!visible) return null;

  return (
    <>
      {/* Hidden TextInput that triggers the keyboard */}
      {/* FIX: Removed autoFocus - it was causing keyboard to appear BEFORE InputAccessoryView registered */}
      {/* Focus is now handled by useEffect with a delay to ensure InputAccessoryView is ready */}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={text}
        onChangeText={handleTextChange}
        multiline
        blurOnSubmit={false}
        selectTextOnFocus={true}
        inputAccessoryViewID={Platform.OS === 'ios' ? INPUT_ACCESSORY_ID : undefined}
      />

      {/* InputAccessoryView for iOS - shows toolbar above keyboard */}
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={INPUT_ACCESSORY_ID}>
          {renderToolbar()}
        </InputAccessoryView>
      ) : (
        // For Android, use absolute positioning
        <View style={styles.androidToolbar}>
          {renderToolbar()}
        </View>
      )}

      {/* Color Picker Modal */}
      <ColorPickerModal
        visible={showColorPicker}
        currentColor={currentColor}
        title="Text Color"
        onSelectColor={handleColorPickerSelect}
        onClose={() => setShowColorPicker(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  toolbarContainer: {
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  // Expanded row (color, font, size pickers)
  expandedRow: {
    backgroundColor: Colors.light.surfaceSecondary,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  expandedScrollContent: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
  },
  // Color picker
  colorWheelButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  colorWheelGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    borderWidth: 2,
    borderColor: '#EC4899',
  },
  colorOption: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: Colors.light.accent,
    borderWidth: 2,
  },
  // Font picker
  fontOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  fontOptionSelected: {
    backgroundColor: Colors.light.accent,
    borderColor: Colors.light.accent,
  },
  fontOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.text,
  },
  fontOptionTextSelected: {
    color: Colors.light.surface,
  },
  // Size picker
  sizeOption: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    minWidth: 40,
    alignItems: 'center',
  },
  sizeOptionSelected: {
    backgroundColor: Colors.light.accent,
    borderColor: Colors.light.accent,
  },
  sizeOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
  },
  sizeOptionTextSelected: {
    color: Colors.light.surface,
  },
  // Main toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  scrollView: {
    flex: 1,
  },
  toolbarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  toolButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolButtonWide: {
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    marginHorizontal: 2,
    maxWidth: 120,
  },
  toolButtonSize: {
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  toolButtonActive: {
    backgroundColor: Colors.light.surfaceSecondary,
  },
  toolButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  textCaseLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  colorIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.light.border,
    marginHorizontal: 6,
  },
  doneButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  hiddenInput: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: 1,
    height: 1,
    opacity: 0,
  },
  androidToolbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default TextEditToolbar;
