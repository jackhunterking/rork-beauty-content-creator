/**
 * EditableSlot Component
 * 
 * A photo slot that supports direct manipulation (pinch, pan, rotate).
 * When selected, shows transform handles and responds to gestures.
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Plus, Sparkles } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { TransformState, DEFAULT_TRANSFORM, SlotWithTransform } from './types';

const AnimatedImage = Animated.createAnimatedComponent(Image);

interface EditableSlotProps {
  /** Slot data with transform state */
  slot: SlotWithTransform;
  /** Whether this slot is currently selected */
  isSelected: boolean;
  /** Scale factor for canvas display */
  canvasScale: number;
  /** Called when slot is tapped */
  onPress: () => void;
  /** Called when transform changes during gesture */
  onTransformChange: (slotId: string, transform: Partial<TransformState>) => void;
  /** Called when gesture starts */
  onGestureStart?: () => void;
  /** Called when gesture ends */
  onGestureEnd?: () => void;
}

export function EditableSlot({
  slot,
  isSelected,
  canvasScale,
  onPress,
  onTransformChange,
  onGestureStart,
  onGestureEnd,
}: EditableSlotProps) {
  const hasImage = !!slot.media?.uri;
  
  // Shared values for gestures
  const scale = useSharedValue(slot.transform.scale);
  const translateX = useSharedValue(slot.transform.translateX);
  const translateY = useSharedValue(slot.transform.translateY);
  const rotation = useSharedValue(slot.transform.rotation);
  
  // Gesture context values
  const startScale = useSharedValue(1);
  const startTranslateX = useSharedValue(0);
  const startTranslateY = useSharedValue(0);
  const startRotation = useSharedValue(0);

  // Sync shared values when slot transform changes from outside
  React.useEffect(() => {
    scale.value = slot.transform.scale;
    translateX.value = slot.transform.translateX;
    translateY.value = slot.transform.translateY;
    rotation.value = slot.transform.rotation;
  }, [slot.transform]);

  // Calculate scaled slot dimensions
  const scaledWidth = slot.width * canvasScale;
  const scaledHeight = slot.height * canvasScale;
  const scaledX = slot.x * canvasScale;
  const scaledY = slot.y * canvasScale;

  // Pan gesture for repositioning image within slot
  const panGesture = useMemo(() => 
    Gesture.Pan()
      .enabled(isSelected && hasImage)
      .onStart(() => {
        'worklet';
        startTranslateX.value = translateX.value;
        startTranslateY.value = translateY.value;
        if (onGestureStart) runOnJS(onGestureStart)();
      })
      .onUpdate((event) => {
        'worklet';
        translateX.value = startTranslateX.value + event.translationX;
        translateY.value = startTranslateY.value + event.translationY;
      })
      .onEnd(() => {
        'worklet';
        // Clamp translation based on scale
        const maxTranslate = (scale.value - 1) * scaledWidth / 2;
        translateX.value = withSpring(
          Math.max(-maxTranslate, Math.min(maxTranslate, translateX.value)),
          { damping: 20 }
        );
        translateY.value = withSpring(
          Math.max(-maxTranslate, Math.min(maxTranslate, translateY.value)),
          { damping: 20 }
        );
        
        runOnJS(onTransformChange)(slot.layerId, {
          translateX: translateX.value,
          translateY: translateY.value,
        });
        if (onGestureEnd) runOnJS(onGestureEnd)();
      }),
    [isSelected, hasImage, scaledWidth, slot.layerId]
  );

  // Pinch gesture for scaling
  const pinchGesture = useMemo(() =>
    Gesture.Pinch()
      .enabled(isSelected && hasImage)
      .onStart(() => {
        'worklet';
        startScale.value = scale.value;
        if (onGestureStart) runOnJS(onGestureStart)();
      })
      .onUpdate((event) => {
        'worklet';
        const newScale = Math.max(0.5, Math.min(3.0, startScale.value * event.scale));
        scale.value = newScale;
      })
      .onEnd(() => {
        'worklet';
        runOnJS(onTransformChange)(slot.layerId, {
          scale: scale.value,
        });
        if (onGestureEnd) runOnJS(onGestureEnd)();
      }),
    [isSelected, hasImage, slot.layerId]
  );

  // Rotation gesture
  const rotationGesture = useMemo(() =>
    Gesture.Rotation()
      .enabled(isSelected && hasImage)
      .onStart(() => {
        'worklet';
        startRotation.value = rotation.value;
        if (onGestureStart) runOnJS(onGestureStart)();
      })
      .onUpdate((event) => {
        'worklet';
        rotation.value = startRotation.value + (event.rotation * 180 / Math.PI);
      })
      .onEnd(() => {
        'worklet';
        runOnJS(onTransformChange)(slot.layerId, {
          rotation: rotation.value,
        });
        if (onGestureEnd) runOnJS(onGestureEnd)();
      }),
    [isSelected, hasImage, slot.layerId]
  );

  // Combine gestures
  const composedGesture = useMemo(() =>
    Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture),
    [panGesture, pinchGesture, rotationGesture]
  );

  // Animated styles for the image
  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  // Tap handler
  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  return (
    <View
      style={[
        styles.container,
        {
          left: scaledX,
          top: scaledY,
          width: scaledWidth,
          height: scaledHeight,
        },
      ]}
    >
      {/* Content area - either image or placeholder */}
      <TouchableOpacity
        style={styles.touchArea}
        onPress={handlePress}
        activeOpacity={hasImage ? 0.95 : 0.7}
      >
        {hasImage ? (
          <GestureDetector gesture={composedGesture}>
            <Animated.View style={[styles.imageContainer, imageAnimatedStyle]}>
              <Image
                source={{ uri: slot.media!.uri }}
                style={styles.image}
                contentFit="cover"
              />
              {/* AI Enhanced badge */}
              {slot.aiEnhanced && (
                <View style={styles.aiEnhancedBadge}>
                  <Sparkles size={10} color={Colors.light.surface} />
                </View>
              )}
            </Animated.View>
          </GestureDetector>
        ) : (
          <View style={styles.placeholder}>
            <View style={styles.placeholderIcon}>
              <Plus size={24} color={Colors.light.textTertiary} />
            </View>
            <Text style={styles.placeholderText}>Tap to add</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Selection border */}
      {isSelected && (
        <View style={styles.selectionBorder} pointerEvents="none" />
      )}

      {/* Empty slot dashed border */}
      {!hasImage && !isSelected && (
        <View style={styles.emptyBorder} pointerEvents="none" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 4,
  },
  touchArea: {
    flex: 1,
  },
  imageContainer: {
    flex: 1,
  },
  image: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  placeholderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.textTertiary,
  },
  selectionBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: Colors.light.accent,
    borderRadius: 4,
  },
  emptyBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
    borderRadius: 4,
  },
  aiEnhancedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default EditableSlot;
