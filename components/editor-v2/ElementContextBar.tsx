/**
 * ElementContextBar Component
 * 
 * Context-aware toolbar that replaces the main toolbar when an element is selected.
 * Follows Canva's pattern: bordered container with inline expandable options above,
 * element-specific options, and a checkmark button.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ColorPickerModal } from './ColorPickerModal';
import {
  RefreshCw,
  Type,
  Maximize2,
  RotateCw,
  Circle,
  Sparkles,
  Check,
  Keyboard,
  ALargeSmall,
  Plus,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  X,
  ListOrdered,
  List,
  CaseSensitive,
  Calendar,
  Square,
  Wand2,
  ImagePlus,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors, { BACKGROUND_COLORS } from '@/constants/colors';
import { COLOR_PRESETS, BACKGROUND_COLOR_PRESETS, BACKGROUND_CONSTRAINTS, FONT_OPTIONS, FontFamily, DATE_FORMAT_OPTIONS, DateFormat } from '@/types/overlays';
import type { AIFeatureKey } from '@/types';

/**
 * TextColorIcon Component
 * 
 * Custom icon showing "A" with a rainbow gradient bar underneath,
 * indicating text/typography color selection.
 */
interface TextColorIconProps {
  size?: number;
}

function TextColorIcon({ size = 22 }: TextColorIconProps) {
  const letterSize = size * 0.75;
  const barHeight = size * 0.18;
  const barWidth = size * 0.9;
  
  return (
    <View style={textColorIconStyles.container}>
      <Text style={[textColorIconStyles.letter, { fontSize: letterSize }]}>A</Text>
      <LinearGradient
        colors={['#FF0000', '#FF9900', '#FFFF00', '#00FF00', '#00FFFF', '#0066FF', '#9900FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[textColorIconStyles.gradientBar, { height: barHeight, width: barWidth }]}
      />
    </View>
  );
}

const textColorIconStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: 20,
    marginBottom: -2,
  },
  gradientBar: {
    borderRadius: 2,
  },
});

/**
 * Element types for context bar
 */
export type ContextBarElementType = 'photo' | 'text' | 'date' | 'logo' | 'background' | 'theme';

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

/**
 * Expandable option types
 */
type ExpandedOption = 'color' | 'size' | 'font' | 'format' | 'dateFormat' | 'datePicker' | 'background' | 'ai' | null;

interface ContextBarAction {
  id: string;
  icon: (color: string) => React.ReactNode;
  label: string;
  onPress: () => void;
  isPrimary?: boolean;
  expandable?: ExpandedOption;
  isAI?: boolean; // New: marks this as an AI feature
  isApplied?: boolean; // Whether AI feature is already applied (disabled state)
}

interface ContextBarButtonProps {
  action: ContextBarAction;
}

/**
 * AIBadge Component
 * 
 * Creates a badge effect where the icon is surrounded by a border,
 * but the top-right corner has a notch where "AI" text sits.
 * The design gives the appearance of a cutoff border with the AI label.
 */
function AIBadge({ children }: { children: React.ReactNode }) {
  return (
    <View style={aiBadgeStyles.container}>
      {/* Border with notch cutout - using 4 border segments */}
      <View style={aiBadgeStyles.borderContainer}>
        {/* Top border - shorter to make room for AI label */}
        <View style={aiBadgeStyles.borderTop} />
        {/* Right border - shorter to make room for AI label */}
        <View style={aiBadgeStyles.borderRight} />
        {/* Bottom border - full width */}
        <View style={aiBadgeStyles.borderBottom} />
        {/* Left border - full height */}
        <View style={aiBadgeStyles.borderLeft} />
      </View>
      
      {/* AI label positioned in the cutoff area */}
      <View style={aiBadgeStyles.aiLabelContainer}>
        <Text style={aiBadgeStyles.aiLabel}>AI</Text>
      </View>
      
      {/* Icon content */}
      <View style={aiBadgeStyles.content}>
        {children}
      </View>
    </View>
  );
}

const aiBadgeStyles = StyleSheet.create({
  container: {
    width: 32,
    height: 32,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4, // Extra space between icon and label
  },
  borderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  borderTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 12, // Leave space for AI label
    height: 1.5,
    backgroundColor: Colors.light.ai.primary,
    borderTopLeftRadius: 6,
  },
  borderRight: {
    position: 'absolute',
    top: 10, // Start below AI label
    right: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: Colors.light.ai.primary,
    borderBottomRightRadius: 6,
  },
  borderBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: Colors.light.ai.primary,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  borderLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: Colors.light.ai.primary,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  aiLabelContainer: {
    position: 'absolute',
    top: -2,
    right: -3,
    paddingHorizontal: 2,
    paddingVertical: 0,
    zIndex: 1,
  },
  aiLabel: {
    fontSize: 7,
    fontWeight: '700',
    color: Colors.light.ai.primary,
    letterSpacing: 0.2,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function ContextBarButton({ action }: ContextBarButtonProps) {
  const isApplied = action.isApplied ?? false;
  const iconColor = isApplied
    ? '#34C759' // Green for applied state
    : action.isPrimary
    ? Colors.light.accent
    : action.isAI
    ? Colors.light.ai.primary
    : Colors.light.text;

  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        isApplied && styles.actionButtonApplied,
      ]}
      onPress={action.onPress}
      activeOpacity={isApplied ? 0.9 : 0.7}
    >
      <View style={[
        styles.actionIconWrapper,
        isApplied && styles.actionIconWrapperApplied,
      ]}>
        {action.isAI ? (
          <View style={styles.aiBadgeWrapper}>
            <AIBadge>{action.icon(iconColor)}</AIBadge>
            {isApplied && (
              <View style={styles.appliedCheckBadge}>
                <Text style={styles.appliedCheckText}>✓</Text>
              </View>
            )}
          </View>
        ) : (
          action.icon(iconColor)
        )}
      </View>
      <Text
        style={[
          styles.actionLabel,
          action.isPrimary && styles.actionLabelPrimary,
          isApplied && styles.actionLabelApplied,
        ]}
        numberOfLines={1}
      >
        {isApplied ? 'Applied' : action.label}
      </Text>
    </TouchableOpacity>
  );
}

interface ElementContextBarProps {
  /** Type of selected element */
  elementType: ContextBarElementType | null;
  /** Whether the bar is visible */
  visible: boolean;
  /** Current color value */
  currentColor?: string;
  /** Current font size value */
  currentFontSize?: number;
  /** Current font family */
  currentFont?: FontFamily;
  /** Current text format options */
  currentFormat?: TextFormatOptions;
  /** Current background color (undefined = no background) */
  currentBackgroundColor?: string;
  /** Auto-expand a specific option when component mounts/changes */
  autoExpandOption?: ExpandedOption;
  /** Photo actions */
  onPhotoReplace?: () => void;
  onPhotoAdjust?: () => void;
  onPhotoResize?: () => void;
  /** AI actions */
  isPremium?: boolean;
  isAIProcessing?: boolean;
  aiProcessingType?: AIFeatureKey | null;
  /** AI enhancements already applied to current image */
  aiEnhancementsApplied?: AIFeatureKey[];
  onAIFeatureSelect?: (featureKey: AIFeatureKey) => void;
  /** Callback when user taps an already-applied AI feature (to show toast) */
  onAlreadyAppliedTap?: (featureKey: AIFeatureKey) => void;
  onRequestPremium?: (feature: string) => void;
  /** Text actions */
  onTextEdit?: () => void;
  onTextFont?: (font: FontFamily) => void;
  onTextColor?: (color: string) => void;
  onTextSize?: (size: number) => void;
  onTextFormat?: (format: TextFormatOptions) => void;
  onTextBackground?: (color: string | undefined) => void;
  /** Date actions */
  onDateChange?: (date: Date) => void;
  currentDate?: Date;
  onDateFormatChange?: (format: DateFormat) => void;
  currentDateFormat?: DateFormat;
  /** Logo actions */
  onLogoReplace?: () => void;
  onLogoOpacity?: () => void;
  onLogoSize?: () => void;
  /** Background actions (for canvas background color) */
  canvasBackgroundColor?: string;
  onCanvasBackgroundColorChange?: (color: string) => void;
  /** Theme actions (for theme layer colors) */
  themeColor?: string;
  onThemeColorChange?: (color: string) => void;
  /** Common actions */
  onConfirm?: () => void;
}

// Font size presets
const FONT_SIZE_PRESETS = [12, 16, 20, 24, 32, 40, 48, 64, 72, 96];

export function ElementContextBar({
  elementType,
  visible,
  currentColor = '#FFFFFF',
  currentFontSize = 24,
  currentFont = 'System',
  currentFormat = {},
  currentBackgroundColor,
  autoExpandOption,
  onPhotoReplace,
  onPhotoAdjust,
  onPhotoResize,
  isPremium = false,
  isAIProcessing = false,
  aiProcessingType = null,
  aiEnhancementsApplied = [],
  onAIFeatureSelect,
  onAlreadyAppliedTap,
  onRequestPremium,
  onTextEdit,
  onTextFont,
  onTextColor,
  onTextSize,
  onTextFormat,
  onTextBackground,
  onDateChange,
  currentDate = new Date(),
  onDateFormatChange,
  currentDateFormat = 'medium',
  onLogoReplace,
  onLogoOpacity,
  onLogoSize,
  canvasBackgroundColor = '#FFFFFF',
  onCanvasBackgroundColorChange,
  themeColor = '#FFFFFF',
  onThemeColorChange,
  onConfirm,
}: ElementContextBarProps) {
  const insets = useSafeAreaInsets();
  const [expandedOption, setExpandedOption] = useState<ExpandedOption>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerMode, setColorPickerMode] = useState<'text' | 'background'>('text');
  const hasAutoExpandedRef = useRef<string | null>(null);

  // Auto-expand option when specified and element type changes
  useEffect(() => {
    if (autoExpandOption && elementType && hasAutoExpandedRef.current !== elementType) {
      setExpandedOption(autoExpandOption);
      hasAutoExpandedRef.current = elementType;
    } else if (!autoExpandOption) {
      // Reset when no auto-expand specified
      hasAutoExpandedRef.current = null;
    }
  }, [autoExpandOption, elementType]);

  // Toggle expanded option
  const handleToggleExpand = (option: ExpandedOption) => {
    setExpandedOption(expandedOption === option ? null : option);
  };

  // Handle color selection
  const handleColorSelect = (color: string) => {
    onTextColor?.(color);
  };

  // Handle font size selection
  const handleSizeSelect = (size: number) => {
    onTextSize?.(size);
  };

  // Handle font selection
  const handleFontSelect = (font: FontFamily) => {
    onTextFont?.(font);
  };

  // Handle format toggle
  const handleFormatToggle = (key: keyof TextFormatOptions, value?: any) => {
    const newFormat = { ...currentFormat };
    if (key === 'textAlign') {
      newFormat.textAlign = value;
    } else {
      newFormat[key] = !currentFormat[key];
    }
    onTextFormat?.(newFormat);
  };

  // Handle date format selection
  const handleDateFormatSelect = (format: DateFormat) => {
    onDateFormatChange?.(format);
  };

  // Handle date picker change
  const handleDatePickerChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      onDateChange?.(selectedDate);
    }
  };

  // Handle background color selection
  const handleBackgroundSelect = (color: string | null) => {
    onTextBackground?.(color ?? undefined);
  };

  // Open color picker for text color
  const handleOpenTextColorPicker = useCallback(() => {
    setColorPickerMode('text');
    setShowColorPicker(true);
  }, []);

  // Open color picker for background color
  const handleOpenBackgroundColorPicker = useCallback(() => {
    setColorPickerMode('background');
    setShowColorPicker(true);
  }, []);

  // Handle color picker selection
  const handleColorPickerSelect = useCallback((color: string) => {
    if (colorPickerMode === 'text') {
      onTextColor?.(color);
    } else {
      onTextBackground?.(color);
    }
  }, [colorPickerMode, onTextColor, onTextBackground]);

  // Handle AI feature selection directly (for inline AI buttons)
  // If feature is already applied, show toast instead - EXCEPT for background_replace
  // which allows re-application since color changes use cached PNG (free!)
  const handleDirectAIFeature = useCallback((featureKey: AIFeatureKey) => {
    // Allow background_replace to be re-selected (color changes are free with cached PNG)
    if (featureKey === 'background_replace') {
      onAIFeatureSelect?.(featureKey);
      return;
    }
    
    // For other features, show toast if already applied
    if (aiEnhancementsApplied.includes(featureKey)) {
      onAlreadyAppliedTap?.(featureKey);
    } else {
      onAIFeatureSelect?.(featureKey);
    }
  }, [onAIFeatureSelect, onAlreadyAppliedTap, aiEnhancementsApplied]);

  // Get actions based on element type
  const getActions = (): ContextBarAction[] => {
    switch (elementType) {
      case 'photo':
        return [
          {
            id: 'replace',
            icon: (color) => <RefreshCw size={20} color={color} strokeWidth={1.8} />,
            label: 'Replace',
            onPress: onPhotoReplace || (() => {}),
          },
          {
            id: 'rotate',
            icon: (color) => <RotateCw size={20} color={color} strokeWidth={1.8} />,
            label: 'Rotate',
            onPress: onPhotoResize || (() => {}),
          },
          {
            id: 'ai-auto-quality',
            icon: (color) => <Wand2 size={16} color={color} strokeWidth={1.8} />,
            label: 'Auto-Quality',
            onPress: () => handleDirectAIFeature('auto_quality'),
            isAI: true,
            isApplied: aiEnhancementsApplied.includes('auto_quality'),
          },
          {
            id: 'ai-replace-bg',
            icon: (color) => <ImagePlus size={16} color={color} strokeWidth={1.8} />,
            label: 'Replace BG',
            onPress: () => handleDirectAIFeature('background_replace'),
            isAI: true,
            // Don't mark as "applied" since color changes are free with cached PNG
            isApplied: false,
          },
        ];

      case 'text':
        return [
          {
            id: 'edit',
            icon: (color) => <Keyboard size={22} color={color} strokeWidth={1.8} />,
            label: 'Edit',
            onPress: onTextEdit || (() => {}),
          },
          {
            id: 'font',
            icon: (color) => <Type size={22} color={color} strokeWidth={1.8} />,
            label: 'Font',
            onPress: () => handleToggleExpand('font'),
            expandable: 'font',
          },
          {
            id: 'size',
            icon: (color) => <ALargeSmall size={22} color={color} strokeWidth={1.8} />,
            label: 'Font size',
            onPress: () => handleToggleExpand('size'),
            expandable: 'size',
          },
          {
            id: 'color',
            icon: () => <TextColorIcon size={22} />,
            label: 'Color',
            onPress: () => handleToggleExpand('color'),
            expandable: 'color',
          },
          {
            id: 'background',
            icon: (color) => (
              <View style={styles.bgIconWrapper}>
                <Square 
                  size={20} 
                  color={currentBackgroundColor ? Colors.light.text : color} 
                  strokeWidth={2} 
                  fill={currentBackgroundColor || 'transparent'} 
                />
                {!currentBackgroundColor && (
                  <View style={styles.bgIconSlash} />
                )}
              </View>
            ),
            label: 'Bg',
            onPress: () => handleToggleExpand('background'),
            expandable: 'background',
          },
          {
            id: 'format',
            icon: (color) => <Bold size={22} color={color} strokeWidth={1.8} />,
            label: 'Format',
            onPress: () => handleToggleExpand('format'),
            expandable: 'format',
          },
        ];

      case 'date':
        return [
          {
            id: 'datePicker',
            icon: (color) => <Calendar size={22} color={color} strokeWidth={1.8} />,
            label: 'Date',
            onPress: () => setShowDatePicker(true),
          },
          {
            id: 'dateFormat',
            icon: (color) => (
              <View style={styles.formatIcon}>
                <Text style={[styles.formatIconText, { color }]}>MM</Text>
                <Text style={[styles.formatIconText, { color }]}>YY</Text>
              </View>
            ),
            label: 'Style',
            onPress: () => handleToggleExpand('dateFormat'),
            expandable: 'dateFormat',
          },
          {
            id: 'font',
            icon: (color) => <Type size={22} color={color} strokeWidth={1.8} />,
            label: 'Font',
            onPress: () => handleToggleExpand('font'),
            expandable: 'font',
          },
          {
            id: 'size',
            icon: (color) => <ALargeSmall size={22} color={color} strokeWidth={1.8} />,
            label: 'Font size',
            onPress: () => handleToggleExpand('size'),
            expandable: 'size',
          },
          {
            id: 'color',
            icon: () => <TextColorIcon size={22} />,
            label: 'Color',
            onPress: () => handleToggleExpand('color'),
            expandable: 'color',
          },
          {
            id: 'background',
            icon: (color) => (
              <View style={styles.bgIconWrapper}>
                <Square 
                  size={20} 
                  color={currentBackgroundColor ? Colors.light.text : color} 
                  strokeWidth={2} 
                  fill={currentBackgroundColor || 'transparent'} 
                />
                {!currentBackgroundColor && (
                  <View style={styles.bgIconSlash} />
                )}
              </View>
            ),
            label: 'Bg',
            onPress: () => handleToggleExpand('background'),
            expandable: 'background',
          },
        ];

      case 'logo':
        return [
          {
            id: 'replace',
            icon: (color) => <RefreshCw size={22} color={color} strokeWidth={1.8} />,
            label: 'Replace',
            onPress: onLogoReplace || (() => {}),
          },
          {
            id: 'opacity',
            icon: (color) => <Circle size={22} color={color} strokeWidth={1.8} />,
            label: 'Opacity',
            onPress: onLogoOpacity || (() => {}),
          },
          {
            id: 'size',
            icon: (color) => <Maximize2 size={22} color={color} strokeWidth={1.8} />,
            label: 'Size',
            onPress: onLogoSize || (() => {}),
          },
        ];

      case 'background':
        // Background element type - shows color picker immediately
        return [];

      case 'theme':
        // Theme element type - shows color picker immediately
        return [];

      default:
        return [];
    }
  };

  // Handle canvas background color selection
  const handleCanvasBackgroundColorSelect = (color: string) => {
    onCanvasBackgroundColorChange?.(color);
  };

  // Handle theme color selection
  const handleThemeColorSelect = (color: string) => {
    onThemeColorChange?.(color);
  };

  const actions = getActions();

  // Render font picker row
  const renderFontPicker = () => (
    <Animated.View 
      style={styles.expandedRow}
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.fontScrollContent}
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

  // Render color picker row
  const renderColorPicker = () => (
    <Animated.View 
      style={styles.expandedRow}
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.colorScrollContent}
        bounces={false}
      >
        {/* Color wheel / add button - opens full picker */}
        <TouchableOpacity 
          style={styles.colorWheelButton} 
          activeOpacity={0.7}
          onPress={handleOpenTextColorPicker}
        >
          <View style={styles.colorWheelGradient}>
            <Plus size={16} color={Colors.light.surface} strokeWidth={2.5} />
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

  // Render font size picker row
  const renderSizePicker = () => (
    <Animated.View 
      style={styles.expandedRow}
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sizeScrollContent}
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

  // Render date format picker row
  const renderDateFormatPicker = () => (
    <Animated.View 
      style={styles.expandedRow}
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateFormatScrollContent}
        bounces={false}
      >
        {DATE_FORMAT_OPTIONS.map((format) => (
          <TouchableOpacity
            key={format.id}
            style={[
              styles.dateFormatOption,
              currentDateFormat === format.id && styles.dateFormatOptionSelected,
            ]}
            onPress={() => handleDateFormatSelect(format.id)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.dateFormatLabel,
              currentDateFormat === format.id && styles.dateFormatLabelSelected,
            ]}>
              {format.label}
            </Text>
            <Text style={[
              styles.dateFormatExample,
              currentDateFormat === format.id && styles.dateFormatExampleSelected,
            ]}>
              {format.example}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );

  // Render background color picker row
  const renderBackgroundPicker = () => (
    <Animated.View 
      style={styles.expandedRow}
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.colorScrollContent}
        bounces={false}
      >
        {/* Custom color picker button */}
        <TouchableOpacity 
          style={styles.colorWheelButton} 
          activeOpacity={0.7}
          onPress={handleOpenBackgroundColorPicker}
        >
          <View style={styles.colorWheelGradient}>
            <Plus size={16} color={Colors.light.surface} strokeWidth={2.5} />
          </View>
        </TouchableOpacity>

        {BACKGROUND_COLOR_PRESETS.map((color, index) => {
          const isSelected = currentBackgroundColor === color || 
            (color === null && !currentBackgroundColor);
          const isTransparent = color === null;
          const isSemiTransparent = color && (color.length === 9 || color.includes('rgba'));
          
          return (
            <TouchableOpacity
              key={color ?? 'transparent'}
              style={[
                styles.bgColorOption,
                isSelected && styles.bgColorOptionSelected,
              ]}
              onPress={() => handleBackgroundSelect(color)}
              activeOpacity={0.7}
            >
              {/* Checkered background for transparency indicator */}
              {(isTransparent || isSemiTransparent) && (
                <View style={styles.checkerboardBg}>
                  <View style={[styles.checkerSquare, styles.checkerDark]} />
                  <View style={styles.checkerSquare} />
                  <View style={styles.checkerSquare} />
                  <View style={[styles.checkerSquare, styles.checkerDark]} />
                </View>
              )}
              {/* Color fill */}
              <View style={[
                styles.bgColorFill,
                color ? { backgroundColor: color } : styles.transparentFill,
              ]}>
                {isTransparent && (
                  <X size={16} color={Colors.light.error} strokeWidth={2.5} />
                )}
              </View>
              {/* Selection ring */}
              {isSelected && <View style={styles.bgColorSelectionRing} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );

  // Render canvas background color picker row (for 'background' element type)
  const renderCanvasBackgroundPicker = () => (
    <Animated.View 
      style={styles.expandedRow}
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.colorScrollContent}
        bounces={false}
      >
        {/* Custom color button - opens full picker */}
        <TouchableOpacity 
          style={styles.colorWheelButton} 
          activeOpacity={0.7}
          onPress={() => {
            setColorPickerMode('background');
            setShowColorPicker(true);
          }}
        >
          <View style={styles.colorWheelGradient}>
            <Plus size={16} color={Colors.light.surface} strokeWidth={2.5} />
          </View>
        </TouchableOpacity>

        {/* Canvas background color presets (15 colors) */}
        {BACKGROUND_COLORS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorOption,
              { backgroundColor: color },
              canvasBackgroundColor === color && styles.colorOptionSelected,
              color === '#FFFFFF' && styles.colorOptionWhite,
            ]}
            onPress={() => handleCanvasBackgroundColorSelect(color)}
            activeOpacity={0.7}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );

  // Render theme color picker row (for 'theme' element type)
  const renderThemeColorPicker = () => (
    <Animated.View 
      style={styles.expandedRow}
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.colorScrollContent}
        bounces={false}
      >
        {/* Custom color button - opens full picker */}
        <TouchableOpacity 
          style={styles.colorWheelButton} 
          activeOpacity={0.7}
          onPress={() => {
            setColorPickerMode('background');
            setShowColorPicker(true);
          }}
        >
          <View style={styles.colorWheelGradient}>
            <Plus size={16} color={Colors.light.surface} strokeWidth={2.5} />
          </View>
        </TouchableOpacity>

        {/* Theme color presets (same as background colors) */}
        {BACKGROUND_COLORS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorOption,
              { backgroundColor: color },
              themeColor === color && styles.colorOptionSelected,
              color === '#FFFFFF' && styles.colorOptionWhite,
            ]}
            onPress={() => handleThemeColorSelect(color)}
            activeOpacity={0.7}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );

  // Render format panel (Bold, Italic, Underline, Strikethrough, aA, Alignment)
  const renderFormatPanel = () => (
    <Animated.View 
      style={styles.formatPanel}
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
    >
      {/* Header */}
      <View style={styles.formatHeader}>
        <Text style={styles.formatTitle}>Format</Text>
        <TouchableOpacity 
          onPress={() => setExpandedOption(null)}
          style={styles.formatCloseButton}
        >
          <X size={20} color={Colors.light.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Text style buttons row */}
      <View style={styles.formatRow}>
        <TouchableOpacity
          style={[
            styles.formatButton,
            currentFormat.bold && styles.formatButtonActive,
          ]}
          onPress={() => handleFormatToggle('bold')}
          activeOpacity={0.7}
        >
          <Bold 
            size={20} 
            color={currentFormat.bold ? Colors.light.accent : Colors.light.text} 
            strokeWidth={2.5} 
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.formatButton,
            currentFormat.italic && styles.formatButtonActive,
          ]}
          onPress={() => handleFormatToggle('italic')}
          activeOpacity={0.7}
        >
          <Italic 
            size={20} 
            color={currentFormat.italic ? Colors.light.accent : Colors.light.text} 
            strokeWidth={2} 
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.formatButton,
            currentFormat.underline && styles.formatButtonActive,
          ]}
          onPress={() => handleFormatToggle('underline')}
          activeOpacity={0.7}
        >
          <Underline 
            size={20} 
            color={currentFormat.underline ? Colors.light.accent : Colors.light.text} 
            strokeWidth={2} 
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.formatButton,
            currentFormat.strikethrough && styles.formatButtonActive,
          ]}
          onPress={() => handleFormatToggle('strikethrough')}
          activeOpacity={0.7}
        >
          <Strikethrough 
            size={20} 
            color={currentFormat.strikethrough ? Colors.light.accent : Colors.light.text} 
            strokeWidth={2} 
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.formatButton}
          activeOpacity={0.7}
        >
          <CaseSensitive 
            size={20} 
            color={Colors.light.text} 
            strokeWidth={2} 
          />
        </TouchableOpacity>
      </View>

      {/* Alignment buttons row */}
      <View style={styles.formatRow}>
        <TouchableOpacity
          style={[
            styles.formatButton,
            styles.formatButtonWide,
            currentFormat.textAlign === 'left' && styles.formatButtonActive,
          ]}
          onPress={() => handleFormatToggle('textAlign', 'left')}
          activeOpacity={0.7}
        >
          <AlignLeft 
            size={20} 
            color={currentFormat.textAlign === 'left' ? Colors.light.accent : Colors.light.text} 
            strokeWidth={2} 
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.formatButton,
            styles.formatButtonWide,
            (currentFormat.textAlign === 'center' || !currentFormat.textAlign) && styles.formatButtonActive,
          ]}
          onPress={() => handleFormatToggle('textAlign', 'center')}
          activeOpacity={0.7}
        >
          <AlignCenter 
            size={20} 
            color={(currentFormat.textAlign === 'center' || !currentFormat.textAlign) ? Colors.light.accent : Colors.light.text} 
            strokeWidth={2} 
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.formatButton,
            styles.formatButtonWide,
            currentFormat.textAlign === 'right' && styles.formatButtonActive,
          ]}
          onPress={() => handleFormatToggle('textAlign', 'right')}
          activeOpacity={0.7}
        >
          <AlignRight 
            size={20} 
            color={currentFormat.textAlign === 'right' ? Colors.light.accent : Colors.light.text} 
            strokeWidth={2} 
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.formatButton,
            styles.formatButtonWide,
            currentFormat.textAlign === 'justify' && styles.formatButtonActive,
          ]}
          onPress={() => handleFormatToggle('textAlign', 'justify')}
          activeOpacity={0.7}
        >
          <AlignJustify 
            size={20} 
            color={currentFormat.textAlign === 'justify' ? Colors.light.accent : Colors.light.text} 
            strokeWidth={2} 
          />
        </TouchableOpacity>
      </View>

      {/* List options row */}
      <View style={styles.formatRow}>
        <TouchableOpacity
          style={[styles.formatButton, styles.formatButtonHalf]}
          activeOpacity={0.7}
        >
          <List size={20} color={Colors.light.text} strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.formatButton, styles.formatButtonHalf]}
          activeOpacity={0.7}
        >
          <ListOrdered size={20} color={Colors.light.text} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  if (!visible || !elementType) {
    return null;
  }

  return (
    <>
    <Animated.View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
    >
      {/* Date Time Picker Modal (for Android it shows as dialog, for iOS inline) */}
      {showDatePicker && elementType === 'date' && (
        <Animated.View 
          style={styles.datePickerRow}
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
        >
          <DateTimePicker
            value={currentDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDatePickerChange}
            style={styles.datePicker}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.datePickerDoneButton}
              onPress={() => setShowDatePicker(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.datePickerDoneText}>Done</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* Expanded options row (above main bar) */}
      {expandedOption === 'font' && renderFontPicker()}
      {expandedOption === 'color' && renderColorPicker()}
      {expandedOption === 'size' && renderSizePicker()}
      {expandedOption === 'format' && renderFormatPanel()}
      {expandedOption === 'dateFormat' && renderDateFormatPicker()}
      {expandedOption === 'background' && elementType !== 'background' && renderBackgroundPicker()}
      
      {/* Canvas background color picker (for 'background' element type - shown always) */}
      {elementType === 'background' && renderCanvasBackgroundPicker()}
      {/* Theme color picker (for 'theme' element type - shown always) */}
      {elementType === 'theme' && renderThemeColorPicker()}
      {/* AI features are now inline buttons - no expandable menu needed */}

      {/* Main context bar */}
      <View style={styles.actionsContainer}>
        {/* Scrollable actions */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionsScroll}
          bounces={false}
          style={styles.scrollView}
        >
          {actions.map((action) => (
            <ContextBarButton 
              key={action.id} 
              action={action}
            />
          ))}
        </ScrollView>

        {/* Confirm/Done button inside container, aligned right */}
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={onConfirm}
          activeOpacity={0.8}
        >
          <Check size={20} color={Colors.light.text} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </Animated.View>

    {/* Color Picker Modal */}
    <ColorPickerModal
      visible={showColorPicker}
      currentColor={
        colorPickerMode === 'text' 
          ? currentColor 
          : (elementType === 'theme' ? themeColor : (currentBackgroundColor || '#000000'))
      }
      title={
        colorPickerMode === 'text' 
          ? 'Text Color' 
          : (elementType === 'theme' ? 'Theme Color' : 'Background Color')
      }
      onSelectColor={(color) => {
        if (colorPickerMode === 'text') {
          onTextColor?.(color);
        } else if (elementType === 'theme') {
          onThemeColorChange?.(color);
        } else {
          onTextBackground?.(color);
        }
      }}
      onClose={() => setShowColorPicker(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.background,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  // Expanded options row
  expandedRow: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 8,
    paddingVertical: 10,
  },
  // Format panel
  formatPanel: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  formatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  formatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  formatCloseButton: {
    padding: 4,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  formatButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surface,
  },
  formatButtonWide: {
    flex: 1,
  },
  formatButtonHalf: {
    flex: 1,
  },
  formatButtonActive: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderColor: Colors.light.accent,
  },
  // Font picker
  fontScrollContent: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
  },
  fontOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  fontOptionSelected: {
    backgroundColor: Colors.light.accent,
  },
  fontOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  fontOptionTextSelected: {
    color: Colors.light.surface,
    fontWeight: '600',
  },
  // Color picker
  colorScrollContent: {
    paddingHorizontal: 12,
    gap: 10,
    alignItems: 'center',
  },
  colorWheelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  colorWheelGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    // Rainbow gradient approximation
    backgroundColor: '#8B5CF6',
    borderWidth: 3,
    borderColor: '#EC4899',
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOptionSelected: {
    borderColor: Colors.light.accent,
    borderWidth: 3,
  },
  colorOptionWhite: {
    borderColor: Colors.light.border,
    borderWidth: 2,
  },
  transparentColorOption: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  // Background color picker improved styles
  bgColorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.light.border,
    position: 'relative',
  },
  bgColorOptionSelected: {
    borderColor: Colors.light.accent,
    borderWidth: 3,
  },
  bgColorFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transparentFill: {
    backgroundColor: 'transparent',
  },
  bgColorSelectionRing: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.light.accent,
  },
  checkerboardBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  checkerSquare: {
    width: '50%',
    height: '50%',
    backgroundColor: '#FFFFFF',
  },
  checkerDark: {
    backgroundColor: '#E0E0E0',
  },
  // Size picker
  sizeScrollContent: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
  },
  sizeOption: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  sizeOptionSelected: {
    backgroundColor: Colors.light.accent,
  },
  sizeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  sizeOptionTextSelected: {
    color: Colors.light.surface,
  },
  // Date format picker
  dateFormatScrollContent: {
    paddingHorizontal: 12,
    gap: 10,
    alignItems: 'center',
  },
  dateFormatOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    minWidth: 90,
  },
  dateFormatOptionSelected: {
    backgroundColor: Colors.light.accent,
  },
  dateFormatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  dateFormatLabelSelected: {
    color: Colors.light.surface,
  },
  dateFormatExample: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  dateFormatExampleSelected: {
    color: Colors.light.surface,
  },
  // Format icon for date style
  formatIcon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  formatIconText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 10,
    textAlign: 'center',
  },
  // Date picker
  datePickerRow: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  datePicker: {
    width: '100%',
    height: 150,
  },
  datePickerDoneButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: Colors.light.accent,
    borderRadius: 10,
    marginTop: 8,
  },
  datePickerDoneText: {
    color: Colors.light.surface,
    fontSize: 15,
    fontWeight: '600',
  },
  // Main actions container
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
    paddingRight: 6,
  },
  scrollView: {
    flex: 1,
  },
  actionsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 14,
    minWidth: 60,
    borderRadius: 8,
  },
  actionIconWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.light.text,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  actionLabelPrimary: {
    color: Colors.light.accent,
    fontWeight: '600',
  },
  confirmButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  // Applied AI state styles
  actionButtonApplied: {
    opacity: 0.85,
  },
  actionIconWrapperApplied: {
    // Optional: slight visual change
  },
  actionLabelApplied: {
    color: '#34C759',
    fontWeight: '600',
  },
  aiBadgeWrapper: {
    position: 'relative',
  },
  appliedCheckBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.light.surface,
  },
  appliedCheckText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Bg icon wrapper for visibility
  bgIconWrapper: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bgIconSlash: {
    position: 'absolute',
    width: 2,
    height: 24,
    backgroundColor: Colors.light.textSecondary,
    transform: [{ rotate: '45deg' }],
  },
});

export default ElementContextBar;
