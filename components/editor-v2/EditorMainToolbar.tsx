/**
 * EditorMainToolbar Component
 * 
 * Canva-style main toolbar that sits directly on the canvas without background.
 * Features horizontally scrollable menu items with icon + label.
 * Supports inline expandable menus (like AI feature selection, background/theme color pickers).
 * 
 * The toolbar intentionally cuts off the last item to indicate scrollability.
 */

import React, { useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Type,
  Calendar,
  Image as ImageIcon,
  Sparkles,
  Palette,
  Layers,
  Plus,
  Check,
} from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import Colors, { BACKGROUND_COLORS } from '@/constants/colors';
import { AIFeatureMenu } from './AIFeatureMenu';
import type { AIFeatureKey } from '@/types';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * Available tools in the main toolbar
 */
export type MainToolbarItem = 
  | 'background'
  | 'theme'
  | 'text'
  | 'date'
  | 'logo'
  | 'ai'
  | 'elements'
  | 'adjust';

interface ToolbarItemConfig {
  id: MainToolbarItem;
  icon: (color: string) => React.ReactNode;
  label: string;
}

const TOOLBAR_ITEMS: ToolbarItemConfig[] = [
  {
    id: 'background',
    icon: (color) => <Palette size={24} color={color} strokeWidth={1.8} />,
    label: 'BG',
  },
  {
    id: 'theme',
    icon: (color) => <Layers size={24} color={color} strokeWidth={1.8} />,
    label: 'Theme',
  },
  {
    id: 'text',
    icon: (color) => <Type size={24} color={color} strokeWidth={1.8} />,
    label: 'Text',
  },
  {
    id: 'date',
    icon: (color) => <Calendar size={24} color={color} strokeWidth={1.8} />,
    label: 'Date',
  },
  {
    id: 'logo',
    icon: (color) => <ImageIcon size={24} color={color} strokeWidth={1.8} />,
    label: 'Logo',
  },
  {
    id: 'ai',
    icon: (color) => <Sparkles size={24} color={color} strokeWidth={1.8} />,
    label: 'AI Studio',
  },
];

interface ToolbarButtonProps {
  item: ToolbarItemConfig;
  disabled?: boolean;
  onPress: () => void;
}

function ToolbarButton({
  item,
  disabled = false,
  onPress,
}: ToolbarButtonProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.92, { damping: 15 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15 });
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconColor = disabled
    ? Colors.light.textTertiary
    : Colors.light.text;

  return (
    <AnimatedTouchable
      style={[styles.toolbarButton, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View style={styles.iconWrapper}>
        {item.icon(iconColor)}
      </View>

      {/* Label */}
      <Text
        style={[
          styles.buttonLabel,
          disabled && styles.buttonLabelDisabled,
        ]}
      >
        {item.label}
      </Text>
    </AnimatedTouchable>
  );
}

interface EditorMainToolbarProps {
  /** Currently active tool (if any) */
  activeTool?: MainToolbarItem | null;
  /** Callback when a tool is selected */
  onToolSelect: (tool: MainToolbarItem) => void;
  /** Whether toolbar is disabled (e.g., during processing) */
  disabled?: boolean;
  /** Custom items to show (default is all items) */
  items?: MainToolbarItem[];
  /** Whether to show the toolbar */
  visible?: boolean;
  /** AI-related props */
  isPremium?: boolean;
  isAIProcessing?: boolean;
  aiProcessingType?: AIFeatureKey | null;
  onAIFeatureSelect?: (featureKey: AIFeatureKey) => void;
  onRequestPremium?: (feature: string) => void;
  /** Currently expanded tool (for inline menus) */
  expandedTool?: MainToolbarItem | null;
  /** Callback when expanded tool changes */
  onExpandedToolChange?: (tool: MainToolbarItem | null) => void;
  /** Background color props (for 'background' tool) */
  backgroundColor?: string;
  onBackgroundColorChange?: (color: string) => void;
  /** Theme color props (for 'theme' tool) */
  themeColor?: string;
  onThemeColorChange?: (color: string) => void;
}

export function EditorMainToolbar({
  activeTool = null,
  onToolSelect,
  disabled = false,
  items,
  visible = true,
  isPremium = false,
  isAIProcessing = false,
  aiProcessingType = null,
  onAIFeatureSelect,
  onRequestPremium,
  expandedTool = null,
  onExpandedToolChange,
  backgroundColor = '#FFFFFF',
  onBackgroundColorChange,
  themeColor,
  onThemeColorChange,
}: EditorMainToolbarProps) {
  const insets = useSafeAreaInsets();

  // Filter items if custom list provided - Theme is always visible
  const displayItems = items
    ? TOOLBAR_ITEMS.filter((item) => items.includes(item.id))
    : TOOLBAR_ITEMS;

  const handleToolPress = useCallback((tool: MainToolbarItem) => {
    if (tool === 'ai' || tool === 'background' || tool === 'theme') {
      // Toggle expandable menu
      if (expandedTool === tool) {
        onExpandedToolChange?.(null);
      } else {
        onExpandedToolChange?.(tool);
      }
    } else {
      // Close any expanded menu and select the tool
      onExpandedToolChange?.(null);
      onToolSelect(tool);
    }
  }, [expandedTool, onExpandedToolChange, onToolSelect]);

  const handleAIFeatureSelect = useCallback((featureKey: AIFeatureKey) => {
    onExpandedToolChange?.(null);
    onAIFeatureSelect?.(featureKey);
  }, [onExpandedToolChange, onAIFeatureSelect]);

  // Handle background color selection
  const handleBackgroundColorSelect = useCallback((color: string) => {
    onBackgroundColorChange?.(color);
  }, [onBackgroundColorChange]);

  // Handle theme color selection
  const handleThemeColorSelect = useCallback((color: string) => {
    onThemeColorChange?.(color);
  }, [onThemeColorChange]);

  // Close color picker and confirm
  const handleColorPickerConfirm = useCallback(() => {
    onExpandedToolChange?.(null);
  }, [onExpandedToolChange]);

  if (!visible) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 8) },
      ]}
    >
      {/* Expanded AI Menu */}
      {expandedTool === 'ai' && (
        <Animated.View 
          style={styles.expandedMenuContainer}
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
        >
          <AIFeatureMenu
            isPremium={isPremium}
            isProcessing={isAIProcessing}
            processingType={aiProcessingType}
            onSelectFeature={handleAIFeatureSelect}
            onRequestPremium={onRequestPremium || (() => {})}
            onClose={() => onExpandedToolChange?.(null)}
          />
        </Animated.View>
      )}

      {/* Expanded Background Color Picker */}
      {expandedTool === 'background' && (
        <Animated.View 
          style={styles.colorPickerContainer}
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.colorScrollContent}
            bounces={false}
          >
            {/* Custom color button */}
            <TouchableOpacity 
              style={styles.colorWheelButton} 
              activeOpacity={0.7}
            >
              <View style={styles.colorWheelGradient}>
                <Plus size={16} color={Colors.light.surface} strokeWidth={2.5} />
              </View>
            </TouchableOpacity>

            {/* Background color presets */}
            {BACKGROUND_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  backgroundColor === color && styles.colorOptionSelected,
                  color === '#FFFFFF' && styles.colorOptionWhite,
                ]}
                onPress={() => handleBackgroundColorSelect(color)}
                activeOpacity={0.7}
              />
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Expanded Theme Color Picker */}
      {expandedTool === 'theme' && (
        <Animated.View 
          style={styles.colorPickerContainer}
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.colorScrollContent}
            bounces={false}
          >
            {/* Custom color button */}
            <TouchableOpacity 
              style={styles.colorWheelButton} 
              activeOpacity={0.7}
            >
              <View style={styles.colorWheelGradient}>
                <Plus size={16} color={Colors.light.surface} strokeWidth={2.5} />
              </View>
            </TouchableOpacity>

            {/* Theme color presets */}
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
      )}

      {/* Main Toolbar */}
      <View style={styles.mainToolbarRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          style={styles.scrollView}
        >
          {displayItems.map((item) => (
            <ToolbarButton
              key={item.id}
              item={item}
              disabled={disabled}
              onPress={() => handleToolPress(item.id)}
            />
          ))}
        </ScrollView>

        {/* Confirm button - only shown when color picker is expanded */}
        {(expandedTool === 'background' || expandedTool === 'theme') && (
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleColorPickerConfirm}
            activeOpacity={0.8}
          >
            <Check size={20} color={Colors.light.text} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // No background - sits directly on canvas
    backgroundColor: 'transparent',
    paddingTop: 8,
  },
  expandedMenuContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  // Color picker styles
  colorPickerContainer: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
  },
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
  // Main toolbar row with optional confirm button
  mainToolbarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    // flexGrow allows centering when content fits on screen
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 0,
    // Minimum width ensures overflow on smaller screens
    // 6 buttons × 68px = 408px - will overflow on screens < 408px
    minWidth: 420,
  },
  toolbarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    width: 68,
    borderRadius: 12,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  buttonLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.light.text,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  buttonLabelDisabled: {
    color: Colors.light.textTertiary,
  },
  confirmButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 4,
  },
});

export default EditorMainToolbar;
