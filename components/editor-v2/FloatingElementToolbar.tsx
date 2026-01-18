/**
 * FloatingElementToolbar Component
 * 
 * Floating toolbar that appears above selected elements on the canvas.
 * Follows Canva's pattern: positioned above the element, shows quick actions,
 * auto-repositions to stay visible on screen.
 */

import React, { useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import {
  Copy,
  Trash2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// iOS-native spring configuration
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.8,
};

// Toolbar dimensions
const TOOLBAR_HEIGHT = 44;
const TOOLBAR_PADDING = 8;
const BUTTON_SIZE = 36;
const TOOLBAR_GAP = 4;

/**
 * Element types that can be selected
 */
export type FloatingToolbarElementType = 'photo' | 'text' | 'date' | 'logo';

/**
 * Position information for the selected element
 */
export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FloatingElementToolbarProps {
  /** Type of selected element */
  elementType: FloatingToolbarElementType | null;
  /** Whether the toolbar is visible */
  visible: boolean;
  /** Position of the selected element on canvas */
  elementPosition?: ElementPosition;
  /** Canvas offset from top of screen */
  canvasTop?: number;
  /** Actions */
  onDuplicate?: () => void;
  onDelete?: () => void;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger';
}

function ToolbarButton({
  icon,
  onPress,
  disabled = false,
  variant = 'default',
}: ToolbarButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'danger' && styles.buttonDanger,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      {icon}
    </TouchableOpacity>
  );
}

export function FloatingElementToolbar({
  elementType,
  visible,
  elementPosition,
  canvasTop = 0,
  onDuplicate,
  onDelete,
}: FloatingElementToolbarProps) {
  // Pre-calculate toolbar width OUTSIDE the worklet (FIX for Hypothesis A)
  // This must be calculated before useAnimatedStyle since it's a regular JS function
  // Overlays: 2 buttons (duplicate, delete)
  const toolbarWidth = useMemo(() => {
    const buttonCount = elementType ? 2 : 0;
    return TOOLBAR_PADDING * 2 + buttonCount * BUTTON_SIZE + (buttonCount - 1) * TOOLBAR_GAP;
  }, [elementType]);

  // Calculate toolbar position
  const toolbarPosition = useMemo(() => {
    if (!elementPosition) {
      return { top: 100, left: SCREEN_WIDTH / 2 - 100 };
    }

    // Position above the element
    let top = elementPosition.y - TOOLBAR_HEIGHT - 12;

    // If too close to top, position below instead
    if (top < canvasTop + 20) {
      top = elementPosition.y + elementPosition.height + 12;
    }

    // Center horizontally on the element
    let left = elementPosition.x + elementPosition.width / 2;

    // Clamp to screen bounds using pre-calculated width
    left = Math.max(toolbarWidth / 2 + 16, Math.min(left, SCREEN_WIDTH - toolbarWidth / 2 - 16));

    return { top, left };
  }, [elementPosition, canvasTop, toolbarWidth]);

  // Animated style for smooth positioning
  // NOTE: Removed opacity animation here - FadeIn/FadeOut layout animations handle opacity
  const animatedStyle = useAnimatedStyle(() => {
    return {
      top: withSpring(toolbarPosition.top, SPRING_CONFIG),
      left: withSpring(toolbarPosition.left, SPRING_CONFIG),
      // opacity removed - handled by entering/exiting animations
      transform: [
        { translateX: -toolbarWidth / 2 }, // Using pre-calculated value instead of function call
        { scale: withSpring(visible ? 1 : 0.9, SPRING_CONFIG) },
      ],
    };
  }, [toolbarPosition, visible, toolbarWidth]);

  // Get actions - all overlay types show duplicate and delete
  const renderActions = () => {
    if (!elementType) return null;
    
    return (
      <>
        <ToolbarButton
          key="duplicate"
          icon={<Copy size={18} color={Colors.light.textSecondary} strokeWidth={2} />}
          onPress={onDuplicate || (() => {})}
        />
        <ToolbarButton
          key="delete"
          icon={<Trash2 size={18} color={Colors.light.error} strokeWidth={2} />}
          onPress={onDelete || (() => {})}
          variant="danger"
        />
      </>
    );
  };

  if (!visible || !elementType) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.container, animatedStyle]}
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
      pointerEvents="box-none"
    >
      <View style={styles.toolbar}>{renderActions()}</View>
    </Animated.View>
  );
}

// getToolbarWidth function removed - calculation moved inline to useMemo to avoid worklet issues

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    paddingHorizontal: TOOLBAR_PADDING,
    paddingVertical: 4,
    gap: TOOLBAR_GAP,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  buttonDanger: {
    backgroundColor: 'rgba(214, 69, 69, 0.1)',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});

export default FloatingElementToolbar;
