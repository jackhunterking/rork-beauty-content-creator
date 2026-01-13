/**
 * ScaleSlider Component
 * 
 * Instagram-style vertical slider for resizing overlays.
 * Appears on the right edge of the canvas when an overlay is selected.
 * Dragging up increases scale, dragging down decreases it.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface ScaleSliderProps {
  /** Whether the slider is visible */
  visible: boolean;
  /** Current scale value */
  currentScale: number;
  /** Minimum allowed scale */
  minScale: number;
  /** Maximum allowed scale */
  maxScale: number;
  /** Callback when scale changes */
  onScaleChange: (scale: number) => void;
  /** Height of the canvas (used to calculate slider height) */
  canvasHeight: number;
}

// Slider configuration
const SLIDER_WIDTH = 44;
const TRACK_WIDTH = 4;
const THUMB_SIZE = 28;
const VERTICAL_PADDING = 20;
const SLIDER_HEIGHT_RATIO = 0.55; // 55% of canvas height

export function ScaleSlider({
  visible,
  currentScale,
  minScale,
  maxScale,
  onScaleChange,
  canvasHeight,
}: ScaleSliderProps) {
  // Calculate slider dimensions
  const sliderHeight = canvasHeight * SLIDER_HEIGHT_RATIO;
  const trackHeight = sliderHeight - VERTICAL_PADDING * 2;
  const usableTrackHeight = trackHeight - THUMB_SIZE;

  // Animation values
  const opacity = useSharedValue(visible ? 1 : 0);
  const translateX = useSharedValue(visible ? 0 : 20);
  
  // Gesture state
  const thumbPosition = useSharedValue(0);
  const startPosition = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // Ref to store stable callback
  const onScaleChangeRef = useRef(onScaleChange);
  onScaleChangeRef.current = onScaleChange;

  // Stable callback for runOnJS
  const callOnScaleChange = useCallback((scale: number) => {
    onScaleChangeRef.current?.(scale);
  }, []);

  // Trigger haptic feedback
  const triggerHaptic = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Haptics may not be available
    }
  }, []);

  // Convert scale to thumb position (inverted: top = max scale)
  const scaleToPosition = useCallback((scale: number): number => {
    'worklet';
    const clampedScale = Math.max(minScale, Math.min(maxScale, scale));
    const normalized = (clampedScale - minScale) / (maxScale - minScale);
    // Invert: 0 (bottom) = minScale, usableTrackHeight (top) = maxScale
    // But in screen coordinates, Y increases downward, so we invert
    return usableTrackHeight * (1 - normalized);
  }, [minScale, maxScale, usableTrackHeight]);

  // Convert thumb position to scale
  const positionToScale = useCallback((position: number): number => {
    'worklet';
    const clampedPos = Math.max(0, Math.min(usableTrackHeight, position));
    // Invert: top (0) = maxScale, bottom (usableTrackHeight) = minScale
    const normalized = 1 - (clampedPos / usableTrackHeight);
    return minScale + normalized * (maxScale - minScale);
  }, [minScale, maxScale, usableTrackHeight]);

  // Sync thumb position when currentScale changes externally
  useEffect(() => {
    if (!isDragging.value && usableTrackHeight > 0) {
      thumbPosition.value = scaleToPosition(currentScale);
    }
  }, [currentScale, scaleToPosition, usableTrackHeight]);

  // Animate visibility
  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      translateX.value = withTiming(20, { duration: 150 });
    }
  }, [visible]);

  // Pan gesture for slider
  const panGesture = useMemo(() =>
    Gesture.Pan()
      .onStart(() => {
        'worklet';
        isDragging.value = true;
        startPosition.value = thumbPosition.value;
      })
      .onUpdate((event) => {
        'worklet';
        const newPosition = startPosition.value + event.translationY;
        thumbPosition.value = Math.max(0, Math.min(usableTrackHeight, newPosition));
        
        // Calculate and report scale change
        const newScale = positionToScale(thumbPosition.value);
        runOnJS(callOnScaleChange)(newScale);
      })
      .onEnd(() => {
        'worklet';
        isDragging.value = false;
        runOnJS(triggerHaptic)();
      }),
    [usableTrackHeight, positionToScale, callOnScaleChange, triggerHaptic]
  );

  // Tap gesture to jump to position
  const tapGesture = useMemo(() =>
    Gesture.Tap()
      .onEnd((event) => {
        'worklet';
        // Calculate position relative to track
        const tapY = event.y - VERTICAL_PADDING - THUMB_SIZE / 2;
        const newPosition = Math.max(0, Math.min(usableTrackHeight, tapY));
        
        thumbPosition.value = withSpring(newPosition, { damping: 15, stiffness: 200 });
        
        const newScale = positionToScale(newPosition);
        runOnJS(callOnScaleChange)(newScale);
        runOnJS(triggerHaptic)();
      }),
    [usableTrackHeight, positionToScale, callOnScaleChange, triggerHaptic]
  );

  // Combine gestures
  const combinedGesture = useMemo(() =>
    Gesture.Race(panGesture, tapGesture),
    [panGesture, tapGesture]
  );

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
    pointerEvents: opacity.value > 0.5 ? 'auto' : 'none',
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: thumbPosition.value }],
  }));

  // Calculate scale percentage for display
  const scalePercentage = Math.round((currentScale / 1) * 100);

  // Don't render if canvas is too small
  if (canvasHeight < 200) {
    return null;
  }

  // Calculate vertical position to center the slider on the canvas
  const topPosition = (canvasHeight - sliderHeight) / 2;

  return (
    <Animated.View style={[styles.container, containerStyle, { height: sliderHeight, top: topPosition }]}>
      <GestureDetector gesture={combinedGesture}>
        <View style={[styles.sliderArea, { height: sliderHeight }]}>
          {/* Track background */}
          <View style={[styles.track, { height: trackHeight }]}>
            {/* Track fill (from bottom to thumb) */}
            <Animated.View 
              style={[
                styles.trackFill,
                useAnimatedStyle(() => ({
                  height: trackHeight - thumbPosition.value - THUMB_SIZE / 2,
                  bottom: 0,
                })),
              ]} 
            />
          </View>

          {/* Thumb */}
          <Animated.View style={[styles.thumbContainer, { top: VERTICAL_PADDING }, thumbStyle]}>
            <View style={styles.thumb}>
              <View style={styles.thumbInner} />
            </View>
          </Animated.View>

          {/* Scale indicator label */}
          <Animated.View 
            style={[
              styles.labelContainer,
              { top: VERTICAL_PADDING },
              thumbStyle,
            ]}
          >
            <View style={styles.label}>
              <Text style={styles.labelText}>{scalePercentage}%</Text>
            </View>
          </Animated.View>

          {/* Min/Max indicators */}
          <View style={[styles.indicator, styles.indicatorTop]}>
            <Text style={styles.indicatorText}>+</Text>
          </View>
          <View style={[styles.indicator, styles.indicatorBottom]}>
            <Text style={styles.indicatorText}>−</Text>
          </View>
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 8,
    width: SLIDER_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  sliderArea: {
    width: SLIDER_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    width: TRACK_WIDTH,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: TRACK_WIDTH / 2,
    overflow: 'hidden',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: Colors.light.accent,
    borderRadius: TRACK_WIDTH / 2,
  },
  thumbContainer: {
    position: 'absolute',
    left: (SLIDER_WIDTH - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  thumbInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.light.accent,
  },
  labelContainer: {
    position: 'absolute',
    right: SLIDER_WIDTH + 4,
    width: 50,
    alignItems: 'flex-end',
  },
  label: {
    backgroundColor: Colors.light.text,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.surface,
  },
  indicator: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorTop: {
    top: 0,
    left: (SLIDER_WIDTH - 20) / 2,
  },
  indicatorBottom: {
    bottom: 0,
    left: (SLIDER_WIDTH - 20) / 2,
  },
  indicatorText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
  },
});

export default ScaleSlider;
