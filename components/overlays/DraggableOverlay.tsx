/**
 * DraggableOverlay Component
 * 
 * A container that wraps overlay content with pan, pinch-to-resize,
 * and rotation gestures. Provides Instagram-style interaction.
 */

import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { X, Move } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { OverlayTransform } from '@/types/overlays';

interface DraggableOverlayProps {
  /** Unique overlay ID */
  id: string;
  /** Current transform values */
  transform: OverlayTransform;
  /** Canvas dimensions for calculating absolute positions */
  canvasWidth: number;
  canvasHeight: number;
  /** Whether this overlay is currently selected */
  isSelected: boolean;
  /** Called when overlay is tapped */
  onSelect: () => void;
  /** Called when transform changes */
  onTransformChange: (transform: OverlayTransform) => void;
  /** Called when delete button is pressed */
  onDelete: () => void;
  /** Content to render inside the overlay */
  children: React.ReactNode;
  /** Minimum scale allowed */
  minScale?: number;
  /** Maximum scale allowed */
  maxScale?: number;
}

export function DraggableOverlay({
  id,
  transform,
  canvasWidth,
  canvasHeight,
  isSelected,
  onSelect,
  onTransformChange,
  onDelete,
  children,
  minScale = 0.2,
  maxScale = 3.0,
}: DraggableOverlayProps) {
  // Shared values for animations
  const translateX = useSharedValue(transform.x * canvasWidth);
  const translateY = useSharedValue(transform.y * canvasHeight);
  const scale = useSharedValue(transform.scale);
  const rotation = useSharedValue(transform.rotation);

  // Context for gesture start values
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startRotation = useSharedValue(0);

  // Sync shared values when transform prop changes (e.g., when loading from draft)
  useEffect(() => {
    translateX.value = transform.x * canvasWidth;
    translateY.value = transform.y * canvasHeight;
    scale.value = transform.scale;
    rotation.value = transform.rotation;
  }, [transform.x, transform.y, transform.scale, transform.rotation, canvasWidth, canvasHeight]);

  // Update transform callback with safety guard for division by zero
  const updateTransform = useCallback((
    x: number,
    y: number,
    s: number,
    r: number
  ) => {
    // Safety guard: prevent division by zero
    if (canvasWidth <= 0 || canvasHeight <= 0) return;
    
    onTransformChange({
      x: x / canvasWidth,
      y: y / canvasHeight,
      scale: s,
      rotation: r,
    });
  }, [canvasWidth, canvasHeight, onTransformChange]);

  // Store callbacks in refs to prevent gesture recreation and stale closures
  // This is critical for Reanimated worklets - prevents crashes from stale function references
  const updateTransformRef = useRef(updateTransform);
  const onSelectRef = useRef(onSelect);
  
  // Keep refs up to date
  useEffect(() => {
    updateTransformRef.current = updateTransform;
  }, [updateTransform]);
  
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Pan gesture for moving - with min distance to distinguish from tap
  // Uses refs for callbacks to prevent gesture recreation and stale closures
  const panGesture = useMemo(() => 
    Gesture.Pan()
      .minDistance(5) // Minimum movement before pan activates (prevents triggering on tap)
      .onStart(() => {
        'worklet';
        startX.value = translateX.value;
        startY.value = translateY.value;
      })
      .onUpdate((event) => {
        'worklet';
        translateX.value = startX.value + event.translationX;
        translateY.value = startY.value + event.translationY;
      })
      .onEnd(() => {
        'worklet';
        // Clamp to canvas bounds with some margin
        const margin = 50;
        translateX.value = withSpring(
          Math.max(-margin, Math.min(canvasWidth + margin, translateX.value))
        );
        translateY.value = withSpring(
          Math.max(-margin, Math.min(canvasHeight + margin, translateY.value))
        );
        
        // Use ref to get current callback - prevents stale closure crashes
        runOnJS((x: number, y: number, s: number, r: number) => {
          updateTransformRef.current(x, y, s, r);
        })(
          translateX.value,
          translateY.value,
          scale.value,
          rotation.value
        );
      }),
    [canvasWidth, canvasHeight] // Removed updateTransform - using ref instead
  );

  // Pinch gesture for scaling
  // Uses refs for callbacks to prevent gesture recreation and stale closures
  const pinchGesture = useMemo(() =>
    Gesture.Pinch()
      .onStart(() => {
        'worklet';
        startScale.value = scale.value;
      })
      .onUpdate((event) => {
        'worklet';
        const newScale = startScale.value * event.scale;
        scale.value = Math.max(minScale, Math.min(maxScale, newScale));
      })
      .onEnd(() => {
        'worklet';
        // Use ref to get current callback - prevents stale closure crashes
        runOnJS((x: number, y: number, s: number, r: number) => {
          updateTransformRef.current(x, y, s, r);
        })(
          translateX.value,
          translateY.value,
          scale.value,
          rotation.value
        );
      }),
    [minScale, maxScale] // Removed updateTransform - using ref instead
  );

  // Rotation gesture
  // Uses refs for callbacks to prevent gesture recreation and stale closures
  const rotationGesture = useMemo(() =>
    Gesture.Rotation()
      .onStart(() => {
        'worklet';
        startRotation.value = rotation.value;
      })
      .onUpdate((event) => {
        'worklet';
        // Convert radians to degrees
        const degrees = (event.rotation * 180) / Math.PI;
        rotation.value = startRotation.value + degrees;
      })
      .onEnd(() => {
        'worklet';
        // Snap to 0, 90, 180, 270 if within 5 degrees
        // snapToAngle is now a worklet function - can be called directly
        const snappedRotation = snapToAngle(rotation.value);
        if (Math.abs(snappedRotation - rotation.value) < 5) {
          rotation.value = withSpring(snappedRotation);
        }
        
        // Use ref to get current callback - prevents stale closure crashes
        runOnJS((x: number, y: number, s: number, r: number) => {
          updateTransformRef.current(x, y, s, r);
        })(
          translateX.value,
          translateY.value,
          scale.value,
          rotation.value
        );
      }),
    [] // Empty deps - gesture never recreated, uses refs for callbacks
  );

  // Tap gesture for selection - with max distance to prevent triggering during drag
  // Uses refs for callbacks to prevent gesture recreation and stale closures
  const tapGesture = useMemo(() =>
    Gesture.Tap()
      .maxDuration(250) // Short tap only
      .onEnd(() => {
        'worklet';
        // Use ref to get current callback - prevents stale closure crashes
        runOnJS(() => {
          onSelectRef.current();
        })();
      }),
    [] // Empty deps - gesture never recreated, uses ref for callback
  );

  // Compose manipulation gestures (pan, pinch, rotation work simultaneously)
  const manipulationGestures = useMemo(() =>
    Gesture.Simultaneous(
      panGesture,
      Gesture.Simultaneous(pinchGesture, rotationGesture)
    ),
    [panGesture, pinchGesture, rotationGesture]
  );

  // Final gesture composition using Exclusive - tap only fires if manipulation doesn't activate
  // This prevents tap from firing during drag/pinch operations
  const allGestures = useMemo(() =>
    Gesture.Exclusive(manipulationGestures, tapGesture),
    [manipulationGestures, tapGesture]
  );

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  // Selection indicator style
  const selectionStyle = useAnimatedStyle(() => ({
    borderWidth: isSelected ? 2 : 0,
    borderColor: Colors.light.accent,
    borderStyle: 'dashed',
  }));

  return (
    <GestureDetector gesture={allGestures}>
      <Animated.View
        style={[
          styles.container,
          animatedStyle,
        ]}
      >
        <Animated.View style={[styles.content, selectionStyle]}>
          {children}
        </Animated.View>

        {/* Selection handles and delete button */}
        {isSelected && (
          <>
            {/* Delete button */}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={onDelete}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={14} color={Colors.light.surface} />
            </TouchableOpacity>

            {/* Move indicator */}
            <View style={styles.moveIndicator}>
              <Move size={12} color={Colors.light.accent} />
            </View>

            {/* Corner handles for resize indication */}
            <View style={[styles.handle, styles.handleTopLeft]} />
            <View style={[styles.handle, styles.handleTopRight]} />
            <View style={[styles.handle, styles.handleBottomLeft]} />
            <View style={[styles.handle, styles.handleBottomRight]} />
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Snap angle to nearest 90 degree increment
 * IMPORTANT: This is a worklet function - runs on UI thread during gesture callbacks
 */
function snapToAngle(angle: number): number {
  'worklet'; // CRITICAL: This directive allows the function to run on UI thread in Reanimated worklets
  const normalized = ((angle % 360) + 360) % 360;
  const snapAngles = [0, 90, 180, 270, 360];
  
  let closest = 0;
  let minDiff = Math.abs(normalized - 0);
  
  for (const snap of snapAngles) {
    const diff = Math.abs(normalized - snap);
    if (diff < minDiff) {
      minDiff = diff;
      closest = snap;
    }
  }
  
  return closest === 360 ? 0 : closest;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 8,
    borderRadius: 4,
  },
  deleteButton: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.error,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  moveIndicator: {
    position: 'absolute',
    top: -12,
    left: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.light.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  handle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.surface,
    borderWidth: 2,
    borderColor: Colors.light.accent,
  },
  handleTopLeft: {
    top: -5,
    left: -5,
  },
  handleTopRight: {
    top: -5,
    right: -5,
  },
  handleBottomLeft: {
    bottom: -5,
    left: -5,
  },
  handleBottomRight: {
    bottom: -5,
    right: -5,
  },
});

export default DraggableOverlay;
