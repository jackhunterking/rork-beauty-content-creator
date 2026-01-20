/**
 * EditorMainToolbar Component
 * 
 * Canva-style main toolbar that sits directly on the canvas without background.
 * Features horizontally scrollable menu items with icon + label.
 * Supports inline expandable menus (like AI feature selection).
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
} from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { AIFeatureMenu } from './AIFeatureMenu';
import type { AIFeatureKey } from '@/types';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * Available tools in the main toolbar
 */
export type MainToolbarItem = 
  | 'background'
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
    label: 'Background',
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
}: EditorMainToolbarProps) {
  const insets = useSafeAreaInsets();

  // Filter items if custom list provided
  const displayItems = items
    ? TOOLBAR_ITEMS.filter((item) => items.includes(item.id))
    : TOOLBAR_ITEMS;

  const handleToolPress = useCallback((tool: MainToolbarItem) => {
    if (tool === 'ai') {
      // Toggle AI menu expansion
      if (expandedTool === 'ai') {
        onExpandedToolChange?.(null);
      } else {
        onExpandedToolChange?.('ai');
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

      {/* Main Toolbar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
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
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    gap: 8,
  },
  toolbarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    minWidth: 56,
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
});

export default EditorMainToolbar;
