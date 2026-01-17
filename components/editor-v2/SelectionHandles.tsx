/**
 * SelectionHandles Component
 * 
 * Visual transform handles that appear when an element is selected.
 * Provides corner handles for scaling and a rotation handle at the top.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { RotateCw } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { TransformState } from './types';

// Handle size (touch target vs visual)
const HANDLE_TOUCH_SIZE = 44;
const HANDLE_VISUAL_SIZE = 12;
const ROTATION_HANDLE_OFFSET = 24;

interface SelectionHandlesProps {
  /** Position and size of the selected element */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Current transform state */
  transform: TransformState;
  /** Whether handles are visible */
  visible: boolean;
  /** Called when transform changes */
  onTransformChange: (transform: Partial<TransformState>) => void;
  /** Called when transform gesture starts */
  onTransformStart?: () => void;
  /** Called when transform gesture ends */
  onTransformEnd?: () => void;
  /** Whether to show rotation handle */
  showRotation?: boolean;
  /** Minimum scale allowed */
  minScale?: number;
  /** Maximum scale allowed */
  maxScale?: number;
}

type HandlePosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

interface CornerHandleProps {
  position: HandlePosition;
  onScaleChange: (scaleDelta: number, position: HandlePosition) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
}

function CornerHandle({ 
  position, 
  onScaleChange,
  onGestureStart,
  onGestureEnd,
}: CornerHandleProps) {
  const scale = useSharedValue(1);
  const startDistance = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onStart((event) => {
      'worklet';
      startDistance.value = Math.sqrt(
        event.absoluteX * event.absoluteX + 
        event.absoluteY * event.absoluteY
      );
      runOnJS(onGestureStart)();
    })
    .onUpdate((event) => {
      'worklet';
      const currentDistance = Math.sqrt(
        (event.absoluteX + event.translationX) * (event.absoluteX + event.translationX) +
        (event.absoluteY + event.translationY) * (event.absoluteY + event.translationY)
      );
      const scaleDelta = event.translationX * 0.005; // Simplified scale calculation
      runOnJS(onScaleChange)(scaleDelta, position);
    })
    .onEnd(() => {
      'worklet';
      runOnJS(onGestureEnd)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Position styles based on handle location
  const positionStyle: ViewStyle = {
    ...(position.includes('top') ? { top: -HANDLE_TOUCH_SIZE / 2 } : { bottom: -HANDLE_TOUCH_SIZE / 2 }),
    ...(position.includes('Left') ? { left: -HANDLE_TOUCH_SIZE / 2 } : { right: -HANDLE_TOUCH_SIZE / 2 }),
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.handleTouchArea, positionStyle, animatedStyle]}>
        <View style={styles.handleVisual} />
      </Animated.View>
    </GestureDetector>
  );
}

interface RotationHandleProps {
  onRotationChange: (rotation: number) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
}

function RotationHandle({ 
  onRotationChange,
  onGestureStart,
  onGestureEnd,
}: RotationHandleProps) {
  const startAngle = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      runOnJS(onGestureStart)();
    })
    .onUpdate((event) => {
      'worklet';
      // Calculate rotation based on horizontal movement
      const rotation = event.translationX * 0.5; // degrees per pixel
      runOnJS(onRotationChange)(rotation);
    })
    .onEnd(() => {
      'worklet';
      runOnJS(onGestureEnd)();
    });

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.rotationHandleContainer}>
        <View style={styles.rotationLine} />
        <View style={styles.rotationHandle}>
          <RotateCw size={14} color={Colors.light.surface} />
        </View>
      </View>
    </GestureDetector>
  );
}

export function SelectionHandles({
  bounds,
  transform,
  visible,
  onTransformChange,
  onTransformStart,
  onTransformEnd,
  showRotation = true,
  minScale = 0.5,
  maxScale = 3.0,
}: SelectionHandlesProps) {
  const opacity = useSharedValue(visible ? 1 : 0);

  // Animate visibility
  React.useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 150 });
  }, [visible]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    pointerEvents: opacity.value > 0.5 ? 'auto' : 'none',
  }));

  const handleScaleChange = useCallback((scaleDelta: number, position: HandlePosition) => {
    const newScale = Math.max(minScale, Math.min(maxScale, transform.scale + scaleDelta));
    onTransformChange({ scale: newScale });
  }, [transform.scale, onTransformChange, minScale, maxScale]);

  const handleRotationChange = useCallback((rotationDelta: number) => {
    onTransformChange({ rotation: transform.rotation + rotationDelta });
  }, [transform.rotation, onTransformChange]);

  const handleGestureStart = useCallback(() => {
    onTransformStart?.();
  }, [onTransformStart]);

  const handleGestureEnd = useCallback(() => {
    onTransformEnd?.();
  }, [onTransformEnd]);

  const handles: HandlePosition[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

  return (
    <Animated.View
      style={[
        styles.container,
        containerAnimatedStyle,
        {
          left: bounds.x,
          top: bounds.y,
          width: bounds.width,
          height: bounds.height,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Selection Border */}
      <View style={styles.selectionBorder} />

      {/* Corner Handles */}
      {handles.map((position) => (
        <CornerHandle
          key={position}
          position={position}
          onScaleChange={handleScaleChange}
          onGestureStart={handleGestureStart}
          onGestureEnd={handleGestureEnd}
        />
      ))}

      {/* Rotation Handle */}
      {showRotation && (
        <RotationHandle
          onRotationChange={handleRotationChange}
          onGestureStart={handleGestureStart}
          onGestureEnd={handleGestureEnd}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
  selectionBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: Colors.light.accent,
    borderRadius: 4,
  },
  handleTouchArea: {
    position: 'absolute',
    width: HANDLE_TOUCH_SIZE,
    height: HANDLE_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleVisual: {
    width: HANDLE_VISUAL_SIZE,
    height: HANDLE_VISUAL_SIZE,
    borderRadius: HANDLE_VISUAL_SIZE / 2,
    backgroundColor: Colors.light.surface,
    borderWidth: 2,
    borderColor: Colors.light.accent,
    // Shadow for visibility
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  rotationHandleContainer: {
    position: 'absolute',
    top: -ROTATION_HANDLE_OFFSET - 20,
    left: '50%',
    marginLeft: -12,
    alignItems: 'center',
  },
  rotationLine: {
    width: 1,
    height: ROTATION_HANDLE_OFFSET,
    backgroundColor: Colors.light.accent,
  },
  rotationHandle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default SelectionHandles;
