/**
 * ContextualToolbar Component
 * 
 * Floating toolbar that appears below a selected element.
 * Shows actions relevant to the selected element type (photo, text, logo, etc.)
 */

import React, { useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import {
  RefreshCw,
  Sliders,
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
import { SelectableType, ContextualAction } from './types';

interface ContextualToolbarProps {
  /** Type of selected element */
  selectionType: SelectableType | null;
  /** Whether the toolbar is visible */
  visible: boolean;
  /** Position to anchor the toolbar (below selection) */
  anchorY: number;
  /** Whether user has premium access */
  isPremium: boolean;
  /** Actions for photo selection */
  onPhotoReplace?: () => void;
  onPhotoAdjust?: () => void;
  onPhotoAI?: () => void;
  onPhotoRemove?: () => void;
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
  anchorY,
  isPremium,
  onPhotoReplace,
  onPhotoAdjust,
  onPhotoAI,
  onPhotoRemove,
  onTextFont,
  onTextColor,
  onTextStyle,
  onTextDelete,
  onLogoReplace,
  onLogoOpacity,
  onLogoShape,
  onLogoDelete,
  onRequestPremium,
}: ContextualToolbarProps) {
  // Render different toolbars based on selection type
  const renderPhotoToolbar = () => (
    <>
      <ToolbarButton
        icon={<RefreshCw size={20} color={Colors.light.text} />}
        label="Replace"
        onPress={onPhotoReplace || (() => {})}
        isPremium={isPremium}
      />
      <ToolbarButton
        icon={<Sliders size={20} color={Colors.light.text} />}
        label="Adjust"
        onPress={onPhotoAdjust || (() => {})}
        isPremium={isPremium}
      />
      <ToolbarButton
        icon={<Sparkles size={20} color="#8B5CF6" />}
        label="AI"
        onPress={onPhotoAI || (() => {})}
        isPro
        isPremium={isPremium}
        variant="ai"
      />
      <ToolbarButton
        icon={<Trash2 size={20} color={Colors.light.error} />}
        label="Remove"
        onPress={onPhotoRemove || (() => {})}
        isPremium={isPremium}
        variant="danger"
      />
    </>
  );

  const renderTextToolbar = () => (
    <>
      <ToolbarButton
        icon={<Type size={20} color={Colors.light.text} />}
        label="Font"
        onPress={onTextFont || (() => {})}
        isPremium={isPremium}
      />
      <ToolbarButton
        icon={<Palette size={20} color={Colors.light.text} />}
        label="Color"
        onPress={onTextColor || (() => {})}
        isPremium={isPremium}
      />
      <ToolbarButton
        icon={<AlignCenter size={20} color={Colors.light.text} />}
        label="Style"
        onPress={onTextStyle || (() => {})}
        isPremium={isPremium}
      />
      <ToolbarButton
        icon={<Trash2 size={20} color={Colors.light.error} />}
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
        icon={<RefreshCw size={20} color={Colors.light.text} />}
        label="Replace"
        onPress={onLogoReplace || (() => {})}
        isPremium={isPremium}
      />
      <ToolbarButton
        icon={<Circle size={20} color={Colors.light.text} />}
        label="Opacity"
        onPress={onLogoOpacity || (() => {})}
        isPremium={isPremium}
      />
      <ToolbarButton
        icon={<ImageIcon size={20} color={Colors.light.text} />}
        label="Shape"
        onPress={onLogoShape || (() => {})}
        isPremium={isPremium}
      />
      <ToolbarButton
        icon={<Trash2 size={20} color={Colors.light.error} />}
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

  if (!visible || !selectionType) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.container, { top: anchorY + 8 }]}
      entering={SlideInDown.duration(200).springify()}
      exiting={SlideOutDown.duration(150)}
    >
      <View style={styles.toolbar}>
        {renderToolbarContent()}
      </View>
      {/* Arrow pointing up to selection */}
      <View style={styles.arrow} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 100,
  },
  toolbar: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 8,
    gap: 4,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    // Border
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  arrow: {
    position: 'absolute',
    top: -6,
    left: '50%',
    marginLeft: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: Colors.light.surface,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    minWidth: 70,
    position: 'relative',
  },
  buttonDanger: {
    backgroundColor: 'rgba(214, 69, 69, 0.1)',
  },
  buttonAI: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconWrapperAI: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  buttonLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  buttonLabelDanger: {
    color: Colors.light.error,
  },
  buttonLabelAI: {
    color: '#8B5CF6',
  },
  proBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});

export default ContextualToolbar;
