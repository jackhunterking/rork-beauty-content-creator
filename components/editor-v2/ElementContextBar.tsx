/**
 * ElementContextBar Component
 * 
 * Context-aware toolbar that replaces the main toolbar when an element is selected.
 * Follows Canva's pattern: no background, horizontal scroll, element-specific options,
 * checkmark to confirm/deselect.
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
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  useSharedValue,
} from 'react-native-reanimated';
import {
  RefreshCw,
  Type,
  Palette,
  Maximize2,
  AlignCenter,
  Sun,
  Image as ImageIcon,
  Circle,
  Sparkles,
  Check,
  Sliders,
} from 'lucide-react-native';
import Colors from '@/constants/colors';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * Element types for context bar
 */
export type ContextBarElementType = 'photo' | 'text' | 'date' | 'logo';

interface ContextBarAction {
  id: string;
  icon: (color: string) => React.ReactNode;
  label: string;
  onPress: () => void;
  isPrimary?: boolean;
}

interface ContextBarButtonProps {
  action: ContextBarAction;
}

function ContextBarButton({ action }: ContextBarButtonProps) {
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

  const iconColor = action.isPrimary
    ? Colors.light.accent
    : Colors.light.textSecondary;

  return (
    <AnimatedTouchable
      style={[styles.actionButton, animatedStyle]}
      onPress={action.onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.7}
    >
      <View style={styles.actionIconWrapper}>{action.icon(iconColor)}</View>
      <Text
        style={[
          styles.actionLabel,
          action.isPrimary && styles.actionLabelPrimary,
        ]}
      >
        {action.label}
      </Text>
    </AnimatedTouchable>
  );
}

interface ElementContextBarProps {
  /** Type of selected element */
  elementType: ContextBarElementType | null;
  /** Whether the bar is visible */
  visible: boolean;
  /** Photo actions */
  onPhotoReplace?: () => void;
  onPhotoAdjust?: () => void;
  onPhotoAI?: () => void;
  onPhotoResize?: () => void;
  /** Text/Date actions */
  onTextFont?: () => void;
  onTextColor?: () => void;
  onTextSize?: () => void;
  onTextAlign?: () => void;
  /** Logo actions */
  onLogoReplace?: () => void;
  onLogoOpacity?: () => void;
  onLogoSize?: () => void;
  /** Common actions */
  onConfirm?: () => void;
}

export function ElementContextBar({
  elementType,
  visible,
  onPhotoReplace,
  onPhotoAdjust,
  onPhotoAI,
  onPhotoResize,
  onTextFont,
  onTextColor,
  onTextSize,
  onTextAlign,
  onLogoReplace,
  onLogoOpacity,
  onLogoSize,
  onConfirm,
}: ElementContextBarProps) {
  const insets = useSafeAreaInsets();

  // Get actions based on element type
  const getActions = (): ContextBarAction[] => {
    switch (elementType) {
      case 'photo':
        return [
          {
            id: 'replace',
            icon: (color) => <RefreshCw size={22} color={color} strokeWidth={1.8} />,
            label: 'Replace',
            onPress: onPhotoReplace || (() => {}),
            isPrimary: true,
          },
          {
            id: 'adjust',
            icon: (color) => <Sliders size={22} color={color} strokeWidth={1.8} />,
            label: 'Adjust',
            onPress: onPhotoAdjust || (() => {}),
          },
          {
            id: 'resize',
            icon: (color) => <Maximize2 size={22} color={color} strokeWidth={1.8} />,
            label: 'Resize',
            onPress: onPhotoResize || (() => {}),
          },
          {
            id: 'ai',
            icon: (color) => <Sparkles size={22} color={Colors.light.accent} strokeWidth={1.8} />,
            label: 'AI Edit',
            onPress: onPhotoAI || (() => {}),
            isPrimary: true,
          },
        ];

      case 'text':
      case 'date':
        return [
          {
            id: 'font',
            icon: (color) => <Type size={22} color={color} strokeWidth={1.8} />,
            label: 'Font',
            onPress: onTextFont || (() => {}),
            isPrimary: true,
          },
          {
            id: 'color',
            icon: (color) => <Palette size={22} color={color} strokeWidth={1.8} />,
            label: 'Color',
            onPress: onTextColor || (() => {}),
          },
          {
            id: 'size',
            icon: (color) => <Maximize2 size={22} color={color} strokeWidth={1.8} />,
            label: 'Size',
            onPress: onTextSize || (() => {}),
          },
          {
            id: 'align',
            icon: (color) => <AlignCenter size={22} color={color} strokeWidth={1.8} />,
            label: 'Style',
            onPress: onTextAlign || (() => {}),
          },
        ];

      case 'logo':
        return [
          {
            id: 'replace',
            icon: (color) => <RefreshCw size={22} color={color} strokeWidth={1.8} />,
            label: 'Replace',
            onPress: onLogoReplace || (() => {}),
            isPrimary: true,
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

      default:
        return [];
    }
  };

  const actions = getActions();

  if (!visible || !elementType) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
    >
      <View style={styles.content}>
        {/* Actions scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionsScroll}
          bounces={false}
        >
          {actions.map((action) => (
            <ContextBarButton key={action.id} action={action} />
          ))}
        </ScrollView>

        {/* Confirm/Done button */}
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={onConfirm}
          activeOpacity={0.7}
        >
          <Check size={24} color={Colors.light.surface} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    // No background - transparent like Canva
    backgroundColor: 'transparent',
    paddingTop: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  actionsScroll: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    minWidth: 56,
  },
  actionIconWrapper: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.light.textSecondary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  actionLabelPrimary: {
    color: Colors.light.accent,
    fontWeight: '600',
  },
  confirmButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default ElementContextBar;
