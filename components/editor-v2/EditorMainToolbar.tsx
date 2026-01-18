/**
 * EditorMainToolbar Component
 * 
 * Canva-style main toolbar that sits directly on the canvas without background.
 * Features horizontally scrollable menu items with icon + label.
 * Transparent background, minimal design.
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
  Camera,
  Type,
  Calendar,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Palette,
} from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import Colors from '@/constants/colors';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * Available tools in the main toolbar
 */
export type MainToolbarItem = 
  | 'photo'
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
    id: 'photo',
    icon: (color) => <Camera size={24} color={color} strokeWidth={1.8} />,
    label: 'Photo',
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
    label: 'AI',
  },
];

interface ToolbarButtonProps {
  item: ToolbarItemConfig;
  isActive: boolean;
  disabled?: boolean;
  onPress: () => void;
}

function ToolbarButton({
  item,
  isActive,
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

  const iconColor = isActive
    ? Colors.light.accent
    : disabled
    ? Colors.light.textTertiary
    : Colors.light.textSecondary;

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
          isActive && styles.buttonLabelActive,
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
}

export function EditorMainToolbar({
  activeTool = null,
  onToolSelect,
  disabled = false,
  items,
  visible = true,
}: EditorMainToolbarProps) {
  const insets = useSafeAreaInsets();

  // Filter items if custom list provided
  const displayItems = items
    ? TOOLBAR_ITEMS.filter((item) => items.includes(item.id))
    : TOOLBAR_ITEMS;

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
            isActive={activeTool === item.id}
            disabled={disabled}
            onPress={() => onToolSelect(item.id)}
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
    color: Colors.light.textSecondary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  buttonLabelActive: {
    color: Colors.light.accent,
    fontWeight: '600',
  },
  buttonLabelDisabled: {
    color: Colors.light.textTertiary,
  },
});

export default EditorMainToolbar;
