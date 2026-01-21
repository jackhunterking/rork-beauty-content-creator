/**
 * AI Processing Overlay
 * 
 * Full-screen overlay shown during AI processing.
 * Features animated progress and cancel option.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AIProcessingOverlayProps {
  progress: number;
  message: string;
  featureKey: string;
  onCancel: () => void;
}

// Animated sparkle component
function AnimatedSparkle({ delay, x, y }: { delay: number; x: number; y: number }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);
  
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: delay }),
        withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.in(Easing.ease) }),
      ),
      -1
    );
    
    scale.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: delay }),
        withTiming(1, { duration: 400, easing: Easing.out(Easing.back) }),
        withTiming(0.3, { duration: 600, easing: Easing.in(Easing.ease) }),
      ),
      -1
    );
  }, [delay, opacity, scale]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  
  return (
    <Animated.View
      style={[
        styles.sparkle,
        { left: x, top: y },
        animatedStyle,
      ]}
    >
      <Ionicons name="star" size={16} color={Colors.light.accent} />
    </Animated.View>
  );
}

// Animated progress ring
function ProgressRing({ progress }: { progress: number }) {
  const rotation = useSharedValue(0);
  
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2000, easing: Easing.linear }),
      -1
    );
  }, [rotation]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  
  return (
    <Animated.View style={[styles.progressRing, animatedStyle]}>
      <View style={styles.progressRingInner}>
        <Ionicons name="sparkles" size={32} color={Colors.light.accent} />
      </View>
    </Animated.View>
  );
}

export default function AIProcessingOverlay({
  progress,
  message,
  featureKey,
  onCancel,
}: AIProcessingOverlayProps) {
  const currentProgress = progress || 0;
  
  // Get status message based on feature
  const getStatusMessage = () => {
    if (message) return message;
    
    switch (featureKey) {
      case 'auto_quality':
        return 'Enhancing quality...';
      case 'background_remove':
        return 'Removing background...';
      case 'background_replace':
        return 'Replacing background...';
      default:
        return 'Processing...';
    }
  };
  
  // Generate sparkle positions
  const sparkles = React.useMemo(() => [
    { x: SCREEN_WIDTH * 0.15, y: 120, delay: 0 },
    { x: SCREEN_WIDTH * 0.75, y: 150, delay: 200 },
    { x: SCREEN_WIDTH * 0.25, y: 280, delay: 400 },
    { x: SCREEN_WIDTH * 0.8, y: 260, delay: 600 },
    { x: SCREEN_WIDTH * 0.5, y: 340, delay: 800 },
  ], []);

  return (
    <View style={styles.container}>
      {/* Sparkle particles */}
      {sparkles.map((sparkle, index) => (
        <AnimatedSparkle
          key={index}
          delay={sparkle.delay}
          x={sparkle.x}
          y={sparkle.y}
        />
      ))}
      
      {/* Center content */}
      <View style={styles.centerContent}>
        <ProgressRing progress={currentProgress} />
        
        <Text style={styles.statusText}>{getStatusMessage()}</Text>
        
        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <Animated.View
              style={[
                styles.progressBarFill,
                { width: `${Math.max(currentProgress, 5)}%` },
              ]}
            />
          </View>
          <Text style={styles.progressPercent}>{Math.round(currentProgress)}%</Text>
        </View>
        
        <Text style={styles.estimateText}>Usually takes 10-40 seconds</Text>
      </View>
      
      {/* Cancel button */}
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={onCancel}
        activeOpacity={0.7}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  sparkle: {
    position: 'absolute',
  },
  centerContent: {
    alignItems: 'center',
  },
  progressRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.light.ai.lightBg,
    borderTopColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  progressRingInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.ai.lightBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.light.accent,
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.accent,
    width: 40,
    textAlign: 'right',
  },
  estimateText: {
    fontSize: 14,
    color: Colors.light.textTertiary,
  },
  cancelButton: {
    position: 'absolute',
    bottom: 40,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
});
