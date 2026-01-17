/**
 * ToolDock Component
 * 
 * Fixed bottom toolbar with tool icons for the canvas editor.
 * Inspired by Instagram and Photoshop mobile editing interfaces.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  ImagePlus, 
  Type, 
  Calendar, 
  Image as ImageIcon, 
  Sparkles,
  Crown,
} from 'lucide-react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring,
  interpolateColor,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { ToolType } from './types';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface ToolDockProps {
  /** Currently active tool */
  activeTool: ToolType;
  /** Callback when a tool is selected */
  onToolSelect: (tool: ToolType) => void;
  /** Whether the user has premium status */
  isPremium: boolean;
  /** Whether tools are disabled (e.g., during processing) */
  disabled?: boolean;
}

interface ToolButtonProps {
  tool: ToolType;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  isPro?: boolean;
  isPremium: boolean;
  disabled?: boolean;
  onPress: () => void;
}

function ToolButton({ 
  tool, 
  icon, 
  label, 
  isActive, 
  isPro = false,
  isPremium,
  disabled,
  onPress,
}: ToolButtonProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.92, { damping: 15 });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const showProBadge = isPro && !isPremium;

  return (
    <AnimatedTouchable
      style={[styles.toolButton, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={0.8}
    >
      {/* PRO Badge */}
      {showProBadge && (
        <View style={styles.proBadge}>
          <Crown size={8} color={Colors.light.surface} />
        </View>
      )}
      
      {/* Icon Container */}
      <View style={[
        styles.iconContainer,
        isActive && styles.iconContainerActive,
      ]}>
        {icon}
      </View>
      
      {/* Label */}
      <Text style={[
        styles.toolLabel,
        isActive && styles.toolLabelActive,
        disabled && styles.toolLabelDisabled,
      ]}>
        {label}
      </Text>
      
      {/* Active Indicator */}
      {isActive && <View style={styles.activeIndicator} />}
    </AnimatedTouchable>
  );
}

export function ToolDock({ 
  activeTool, 
  onToolSelect, 
  isPremium,
  disabled = false,
}: ToolDockProps) {
  const insets = useSafeAreaInsets();

  const tools: Array<{
    id: ToolType;
    icon: (active: boolean) => React.ReactNode;
    label: string;
    isPro?: boolean;
  }> = [
    {
      id: 'photo',
      icon: (active) => (
        <ImagePlus 
          size={24} 
          color={active ? Colors.light.accent : Colors.light.textSecondary} 
        />
      ),
      label: 'Photo',
    },
    {
      id: 'text',
      icon: (active) => (
        <Type 
          size={24} 
          color={active ? Colors.light.accent : Colors.light.textSecondary} 
        />
      ),
      label: 'Text',
      isPro: true,
    },
    {
      id: 'date',
      icon: (active) => (
        <Calendar 
          size={24} 
          color={active ? Colors.light.accent : Colors.light.textSecondary} 
        />
      ),
      label: 'Date',
      isPro: true,
    },
    {
      id: 'logo',
      icon: (active) => (
        <ImageIcon 
          size={24} 
          color={active ? Colors.light.accent : Colors.light.textSecondary} 
        />
      ),
      label: 'Logo',
      isPro: true,
    },
    {
      id: 'enhance',
      icon: (active) => (
        <Sparkles 
          size={24} 
          color={active ? '#8B5CF6' : Colors.light.textSecondary} 
        />
      ),
      label: 'AI',
      isPro: true,
    },
  ];

  return (
    <View style={[
      styles.container,
      { paddingBottom: Math.max(insets.bottom, 8) }
    ]}>
      <View style={styles.toolsRow}>
        {tools.map((tool) => (
          <ToolButton
            key={tool.id}
            tool={tool.id}
            icon={tool.icon(activeTool === tool.id)}
            label={tool.label}
            isActive={activeTool === tool.id}
            isPro={tool.isPro}
            isPremium={isPremium}
            disabled={disabled}
            onPress={() => onToolSelect(tool.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
    paddingTop: 8,
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
  },
  toolButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    minWidth: 64,
    position: 'relative',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconContainerActive: {
    backgroundColor: 'rgba(201, 168, 124, 0.15)',
  },
  toolLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  toolLabelActive: {
    color: Colors.light.accent,
    fontWeight: '600',
  },
  toolLabelDisabled: {
    color: Colors.light.textTertiary,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.accent,
  },
  proBadge: {
    position: 'absolute',
    top: 2,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});

export default ToolDock;
