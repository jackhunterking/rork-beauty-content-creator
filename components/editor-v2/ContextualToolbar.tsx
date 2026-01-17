/**
 * ContextualToolbar Component
 * 
 * iOS-native style bottom sheet toolbar that appears when an element is selected.
 * Features native iOS spring animations, swipe-to-dismiss gesture, and proper haptics.
 * Shows actions relevant to the selected element type (photo, text, logo, etc.)
 */

import React, { useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ViewStyle, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import {
  RefreshCw,
  Maximize2,
  Sparkles,
  Trash2,
  Type,
  Palette,
  AlignCenter,
  Image as ImageIcon,
  Circle,
  Crown,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { SelectableType } from './types';

// iOS-native spring configuration
// These values match UIKit's default spring animation
const IOS_SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

// Dismiss threshold - how far to drag before dismissing
const DISMISS_THRESHOLD = 80;

interface ContextualToolbarProps {
  /** Type of selected element */
  selectionType: SelectableType | null;
  /** Whether the toolbar is visible */
  visible: boolean;
  /** Whether user has premium access */
  isPremium: boolean;
  /** Actions for photo selection */
  onPhotoReplace?: () => void;
  onPhotoResize?: () => void;
  onPhotoAI?: () => void;
  onPhotoDelete?: () => void;
  /** Actions for text/date selection */
  onTextFont?: () => void;
  onTextColor?: () => void;
  onTextStyle?: () => void;
  onTextDelete?: () => void;
  /** Actions for logo selection */
  onLogoReplace?: () => void;
  onLogoOpacity?: () => void;
  onLogoShape?: () => void;
  onLogoDelete?: () => void;
  /** Request premium access */
  onRequestPremium?: (feature: string) => void;
  /** Called when user wants to deselect */
  onDeselect?: () => void;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  isPro?: boolean;
  isPremium: boolean;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'ai';
}

function ToolbarButton({
  icon,
  label,
  onPress,
  isPro = false,
  isPremium,
  disabled = false,
  variant = 'default',
}: ToolbarButtonProps) {
  const showProBadge = isPro && !isPremium;

  const buttonStyle: ViewStyle[] = [
    styles.button,
    variant === 'danger' && styles.buttonDanger,
    variant === 'ai' && styles.buttonAI,
    disabled && styles.buttonDisabled,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {showProBadge && (
        <View style={styles.proBadge}>
          <Crown size={8} color={Colors.light.surface} />
        </View>
      )}
      <View style={[
        styles.iconWrapper,
        variant === 'ai' && styles.iconWrapperAI,
      ]}>
        {icon}
      </View>
      <Text style={[
        styles.buttonLabel,
        variant === 'danger' && styles.buttonLabelDanger,
        variant === 'ai' && styles.buttonLabelAI,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function ContextualToolbar({
  selectionType,
  visible,
  isPremium,
  onPhotoReplace,
  onPhotoResize,
  onPhotoAI,
  onPhotoDelete,
  onTextFont,
  onTextColor,
  onTextStyle,
  onTextDelete,
  onLogoReplace,
  onLogoOpacity,
  onLogoShape,
  onLogoDelete,
  onRequestPremium,
  onDeselect,
}: ContextualToolbarProps) {
  const insets = useSafeAreaInsets();
  
  // Animation values
  const translateY = useSharedValue(300); // Start off-screen
  const isDragging = useSharedValue(false);
  
  // Trigger haptic feedback
  const triggerHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    'worklet';
    translateY.value = withSpring(300, IOS_SPRING_CONFIG);
    if (onDeselect) {
      runOnJS(onDeselect)();
    }
  }, [onDeselect, translateY]);

  // Show animation when visible changes
  React.useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, IOS_SPRING_CONFIG);
      triggerHaptic();
    } else {
      translateY.value = withSpring(300, IOS_SPRING_CONFIG);
    }
  }, [visible, translateY, triggerHaptic]);

  // Pan gesture for swipe-to-dismiss (iOS-native feel)
  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((event) => {
      // Only allow downward dragging with rubber-banding for upward
      if (event.translationY < 0) {
        // Rubber-band effect when pulling up (iOS-style resistance)
        translateY.value = event.translationY * 0.3;
      } else {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      isDragging.value = false;
      
      // Dismiss if dragged past threshold or with high velocity
      if (event.translationY > DISMISS_THRESHOLD || event.velocityY > 500) {
        runOnJS(triggerHaptic)();
        handleDismiss();
      } else {
        // Spring back to original position
        translateY.value = withSpring(0, IOS_SPRING_CONFIG);
      }
    });

  // Animated styles
  const animatedContainerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [0, 200],
      [1, 0.5],
      Extrapolation.CLAMP
    );
    
    return {
      transform: [{ translateY: translateY.value }],
      opacity,
    };
  });

  // Animated handle style (subtle scale when dragging)
  const animatedHandleStyle = useAnimatedStyle(() => {
    const scale = isDragging.value ? 1.2 : 1;
    const width = isDragging.value ? 44 : 36;
    
    return {
      transform: [{ scaleY: scale }],
      width: withSpring(width, { damping: 15, stiffness: 200 }),
    };
  });

  // App colors for toolbar
  const TOOLBAR_COLORS = {
    primary: Colors.light.accent,
    secondary: Colors.light.textSecondary,
    destructive: Colors.light.error,
    ai: Colors.light.accent,
  };

  // Photo toolbar: Replace, Resize (includes crop + rotate), AI Edit, Delete
  const renderPhotoToolbar = () => (
    <>
      <ToolbarButton
        icon={<RefreshCw size={22} color={TOOLBAR_COLORS.primary} strokeWidth={2} />}
        label="Replace"
        onPress={onPhotoReplace || (() => {})}
        isPremium={isPremium}
      />
      <ToolbarButton
        icon={<Maximize2 size={22} color={TOOLBAR_COLORS.secondary} strokeWidth={2} />}
        label="Resize"
        onPress={onPhotoResize || (() => {})}
        isPremium={isPremium}
      />
      <ToolbarButton
        icon={<Sparkles size={22} color={TOOLBAR_COLORS.ai} strokeWidth={2} />}
        label="AI Edit"
        onPress={onPhotoAI || (() => {})}
        isPro
        isPremium={isPremium}
        variant="ai"
      />
      <ToolbarButton
        icon={<Trash2 size={22} color={TOOLBAR_COLORS.destructive} strokeWidth={2} />}
        label="Delete"
        onPress={onPhotoDelete || (() => {})}
        isPremium={isPremium}
        variant="danger"
      />
    </>
  );

  const renderTextToolbar = () => (
    <>
      <ToolbarButton
        icon={<Type size={22} color={TOOLBAR_COLORS.primary} strokeWidth={2} />}
        label="Font"
        onPress={onTextFont || (() => {})}
        isPremium={isPremium}
      />
      <ToolbarButton
        icon={<Palette size={22} color={TOOLBAR_COLORS.primary} strokeWidth={2} />}
        label="Color"
        onPress={onTextColor || (() => {})}
        isPremium={isPremium}
      />
      <ToolbarButton
        icon={<AlignCenter size={22} color={TOOLBAR_COLORS.secondary} strokeWidth={2} />}
        label="Style"
        onPress={onTextStyle || (() => {})}
        isPremium={isPremium}
      />
      <ToolbarButton
        icon={<Trash2 size={22} color={TOOLBAR_COLORS.destructive} strokeWidth={2} />}
        label="Delete"
        onPress={onTextDelete || (() => {})}
        isPremium={isPremium}
        variant="danger"
      />
    </>
  );

  const renderLogoToolbar = () => (
    <>
      <ToolbarButton
        icon={<RefreshCw size={22} color={TOOLBAR_COLORS.primary} strokeWidth={2} />}
        label="Replace"
        onPress={onLogoReplace || (() => {})}
        isPremium={isPremium}
      />
      <ToolbarButton
        icon={<Circle size={22} color={TOOLBAR_COLORS.secondary} strokeWidth={2} />}
        label="Opacity"
        onPress={onLogoOpacity || (() => {})}
        isPremium={isPremium}
      />
      <ToolbarButton
        icon={<ImageIcon size={22} color={TOOLBAR_COLORS.secondary} strokeWidth={2} />}
        label="Shape"
        onPress={onLogoShape || (() => {})}
        isPremium={isPremium}
      />
      <ToolbarButton
        icon={<Trash2 size={22} color={TOOLBAR_COLORS.destructive} strokeWidth={2} />}
        label="Delete"
        onPress={onLogoDelete || (() => {})}
        isPremium={isPremium}
        variant="danger"
      />
    </>
  );

  const renderToolbarContent = () => {
    switch (selectionType) {
      case 'slot':
        return renderPhotoToolbar();
      case 'text':
      case 'date':
        return renderTextToolbar();
      case 'logo':
        return renderLogoToolbar();
      default:
        return null;
    }
  };

  // Get label based on selection type
  const getSelectionLabel = () => {
    switch (selectionType) {
      case 'slot': return 'Photo';
      case 'text': return 'Text';
      case 'date': return 'Date';
      case 'logo': return 'Logo';
      default: return 'Element';
    }
  };

  // Don't render if not visible or no selection
  if (!selectionType) {
    return null;
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, 16) },
          animatedContainerStyle,
        ]}
      >
        {/* iOS-style handle */}
        <View style={styles.handleContainer}>
          <Animated.View style={[styles.handle, animatedHandleStyle]} />
        </View>

        {/* Header with selection label */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.selectionDot} />
            <Text style={styles.selectionLabel}>{getSelectionLabel()}</Text>
          </View>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onDeselect}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.dismissText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Toolbar actions */}
        <View style={styles.toolbar}>
          {renderToolbarContent()}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.surface,
    // iOS standard corner radius for sheets
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    // iOS-style shadow (softer, more diffused)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    // iOS standard handle dimensions
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(60, 60, 67, 0.3)', // iOS system gray
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60, 60, 67, 0.12)', // iOS separator color
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.accent,
  },
  selectionLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
    letterSpacing: -0.4, // iOS SF Pro tracking
  },
  dismissButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dismissText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.accent, // iOS tint color style
    letterSpacing: -0.4,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    paddingTop: 16,
    paddingBottom: 8,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: Colors.light.surfaceSecondary,
    minWidth: 72,
    position: 'relative',
  },
  buttonDanger: {
    backgroundColor: 'rgba(214, 69, 69, 0.1)',
  },
  buttonAI: {
    backgroundColor: 'rgba(201, 168, 124, 0.15)',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconWrapperAI: {
    backgroundColor: 'rgba(201, 168, 124, 0.15)',
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.text,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  buttonLabelDanger: {
    color: Colors.light.error,
  },
  buttonLabelAI: {
    color: Colors.light.accent,
  },
  proBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});

export default ContextualToolbar;
