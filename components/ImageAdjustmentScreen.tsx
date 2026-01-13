/**
 * ImageAdjustmentScreen Component
 * 
 * Full-screen interface for adjusting image position and zoom within a slot frame.
 * Features:
 * - Pinch-to-zoom (1.0x to 3.0x)
 * - Pan/drag to reposition
 * - Constraint logic: image edges never inside frame bounds
 * - Reset button to restore default position
 * - Done button to confirm adjustments
 */

import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { ChevronLeft, RotateCcw, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import {
  MIN_ADJUSTMENT_SCALE,
  MAX_ADJUSTMENT_SCALE,
  DEFAULT_ADJUSTMENTS,
} from '@/utils/imageProcessing';

const AnimatedImage = Animated.createAnimatedComponent(Image);

// Frame padding from screen edges
const FRAME_HORIZONTAL_PADDING = 20;
const FRAME_VERTICAL_PADDING = 100;

interface ImageAdjustmentScreenProps {
  /** Image URI to adjust */
  imageUri: string;
  /** Width of the source image in pixels */
  imageWidth: number;
  /** Height of the source image in pixels */
  imageHeight: number;
  /** Target slot width in pixels */
  slotWidth: number;
  /** Target slot height in pixels */
  slotHeight: number;
  /** Current adjustments */
  initialAdjustments?: {
    translateX: number;
    translateY: number;
    scale: number;
  };
  /** Slot label (e.g., "Before", "After") */
  label: string;
  /** Called when user confirms adjustments */
  onConfirm: (adjustments: { translateX: number; translateY: number; scale: number }) => void;
  /** Called when user cancels */
  onCancel: () => void;
}

export function ImageAdjustmentScreen({
  imageUri,
  imageWidth,
  imageHeight,
  slotWidth,
  slotHeight,
  initialAdjustments,
  label,
  onConfirm,
  onCancel,
}: ImageAdjustmentScreenProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Calculate frame dimensions to fit on screen
  const frameDimensions = useMemo(() => {
    const maxFrameWidth = screenWidth - FRAME_HORIZONTAL_PADDING * 2;
    const maxFrameHeight = screenHeight - FRAME_VERTICAL_PADDING * 2;
    const slotAspect = slotWidth / slotHeight;
    
    let frameWidth = maxFrameWidth;
    let frameHeight = frameWidth / slotAspect;
    
    if (frameHeight > maxFrameHeight) {
      frameHeight = maxFrameHeight;
      frameWidth = frameHeight * slotAspect;
    }
    
    return { width: frameWidth, height: frameHeight };
  }, [screenWidth, screenHeight, slotWidth, slotHeight]);

  // Calculate base image size (fills frame at scale 1.0)
  const imageAspect = imageWidth / imageHeight;
  const frameAspect = frameDimensions.width / frameDimensions.height;

  const baseImageSize = useMemo(() => {
    if (imageAspect > frameAspect) {
      // Image is wider - height fills frame
      return {
        width: frameDimensions.height * imageAspect,
        height: frameDimensions.height,
      };
    } else {
      // Image is taller - width fills frame
      return {
        width: frameDimensions.width,
        height: frameDimensions.width / imageAspect,
      };
    }
  }, [imageAspect, frameAspect, frameDimensions]);

  // Shared values for gestures
  const scale = useSharedValue(initialAdjustments?.scale || DEFAULT_ADJUSTMENTS.scale);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Context values for gesture start positions
  const startScale = useSharedValue(1);
  const startTranslateX = useSharedValue(0);
  const startTranslateY = useSharedValue(0);

  // Store callbacks in refs to prevent stale closures in worklets
  const onConfirmRef = useRef(onConfirm);
  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  // Initialize translation from adjustments
  useEffect(() => {
    if (initialAdjustments) {
      const currentScale = initialAdjustments.scale;
      const scaledWidth = baseImageSize.width * currentScale;
      const scaledHeight = baseImageSize.height * currentScale;
      const excessWidth = Math.max(0, scaledWidth - frameDimensions.width);
      const excessHeight = Math.max(0, scaledHeight - frameDimensions.height);
      
      translateX.value = initialAdjustments.translateX * excessWidth;
      translateY.value = initialAdjustments.translateY * excessHeight;
      scale.value = currentScale;
    }
  }, [initialAdjustments, baseImageSize, frameDimensions]);

  // Calculate max translation for current scale
  const getMaxTranslation = useCallback((currentScale: number) => {
    'worklet';
    const scaledWidth = baseImageSize.width * currentScale;
    const scaledHeight = baseImageSize.height * currentScale;
    
    const maxX = Math.max(0, (scaledWidth - frameDimensions.width) / 2);
    const maxY = Math.max(0, (scaledHeight - frameDimensions.height) / 2);
    
    return { maxX, maxY };
  }, [baseImageSize, frameDimensions]);

  // Clamp translation to bounds
  const clampTranslation = useCallback((tx: number, ty: number, currentScale: number) => {
    'worklet';
    const { maxX, maxY } = getMaxTranslation(currentScale);
    return {
      x: Math.max(-maxX, Math.min(maxX, tx)),
      y: Math.max(-maxY, Math.min(maxY, ty)),
    };
  }, [getMaxTranslation]);

  // Pan gesture
  const panGesture = useMemo(() => 
    Gesture.Pan()
      .onStart(() => {
        'worklet';
        startTranslateX.value = translateX.value;
        startTranslateY.value = translateY.value;
      })
      .onUpdate((event) => {
        'worklet';
        const newX = startTranslateX.value + event.translationX;
        const newY = startTranslateY.value + event.translationY;
        const clamped = clampTranslation(newX, newY, scale.value);
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      .onEnd(() => {
        'worklet';
        // Snap to clamped position with spring
        const clamped = clampTranslation(translateX.value, translateY.value, scale.value);
        translateX.value = withSpring(clamped.x, { damping: 20 });
        translateY.value = withSpring(clamped.y, { damping: 20 });
      }),
    [clampTranslation]
  );

  // Pinch gesture
  const pinchGesture = useMemo(() =>
    Gesture.Pinch()
      .onStart(() => {
        'worklet';
        startScale.value = scale.value;
        startTranslateX.value = translateX.value;
        startTranslateY.value = translateY.value;
      })
      .onUpdate((event) => {
        'worklet';
        const newScale = Math.max(
          MIN_ADJUSTMENT_SCALE,
          Math.min(MAX_ADJUSTMENT_SCALE, startScale.value * event.scale)
        );
        scale.value = newScale;
        
        // Adjust translation to keep centered during zoom
        const scaleRatio = newScale / startScale.value;
        const newX = startTranslateX.value * scaleRatio;
        const newY = startTranslateY.value * scaleRatio;
        const clamped = clampTranslation(newX, newY, newScale);
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      .onEnd(() => {
        'worklet';
        // Snap scale and translation with spring
        const clamped = clampTranslation(translateX.value, translateY.value, scale.value);
        translateX.value = withSpring(clamped.x, { damping: 20 });
        translateY.value = withSpring(clamped.y, { damping: 20 });
      }),
    [clampTranslation]
  );

  // Combine gestures
  const composedGesture = useMemo(() =>
    Gesture.Simultaneous(panGesture, pinchGesture),
    [panGesture, pinchGesture]
  );

  // Animated styles
  const imageAnimatedStyle = useAnimatedStyle(() => {
    const scaledWidth = baseImageSize.width * scale.value;
    const scaledHeight = baseImageSize.height * scale.value;
    
    return {
      width: scaledWidth,
      height: scaledHeight,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });

  // Handle reset
  const handleReset = useCallback(() => {
    scale.value = withSpring(DEFAULT_ADJUSTMENTS.scale, { damping: 20 });
    translateX.value = withSpring(0, { damping: 20 });
    translateY.value = withSpring(0, { damping: 20 });
  }, [scale, translateX, translateY]);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    // Convert pixel translation back to relative (-0.5 to 0.5) format
    const currentScale = scale.value;
    const scaledWidth = baseImageSize.width * currentScale;
    const scaledHeight = baseImageSize.height * currentScale;
    const excessWidth = Math.max(0, scaledWidth - frameDimensions.width);
    const excessHeight = Math.max(0, scaledHeight - frameDimensions.height);
    
    const relativeX = excessWidth > 0 ? translateX.value / excessWidth : 0;
    const relativeY = excessHeight > 0 ? translateY.value / excessHeight : 0;
    
    onConfirmRef.current({
      translateX: relativeX,
      translateY: relativeY,
      scale: currentScale,
    });
  }, [baseImageSize, frameDimensions, scale, translateX, translateY]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={onCancel}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={24} color={Colors.light.surface} />
            <Text style={styles.headerButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>{label}</Text>
          
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={handleReset}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <RotateCcw size={20} color={Colors.light.surface} />
          </TouchableOpacity>
        </View>

        {/* Frame and Image */}
        <View style={styles.frameContainer}>
          <View
            style={[
              styles.frame,
              {
                width: frameDimensions.width,
                height: frameDimensions.height,
              },
            ]}
          >
            <GestureDetector gesture={composedGesture}>
              <AnimatedImage
                source={{ uri: imageUri }}
                style={[styles.image, imageAnimatedStyle]}
                contentFit="cover"
              />
            </GestureDetector>
            
            {/* Frame border overlay */}
            <View style={styles.frameBorder} pointerEvents="none" />
          </View>
          
          {/* Instructions */}
          <Text style={styles.instructions}>
            Pinch to zoom • Drag to position
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
            activeOpacity={0.8}
          >
            <Check size={20} color={Colors.light.surface} />
            <Text style={styles.confirmButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 70,
  },
  headerButtonText: {
    color: Colors.light.surface,
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    color: Colors.light.surface,
    fontSize: 18,
    fontWeight: '600',
  },
  frameContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    overflow: 'hidden',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  frameBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
  },
  image: {
    position: 'absolute',
  },
  instructions: {
    marginTop: 20,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 10 : 20,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.accent,
    paddingVertical: 16,
    borderRadius: 14,
  },
  confirmButtonText: {
    color: Colors.light.surface,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ImageAdjustmentScreen;
