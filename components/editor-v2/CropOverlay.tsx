/**
 * CropOverlay Component
 * 
 * Canva-style inline crop mode:
 * - The SLOT stays in its original position (the "viewport")
 * - The IMAGE can extend beyond the slot and is draggable/zoomable
 * - Inside the slot = full opacity with grid (what will be visible in final)
 * - Outside the slot = reduced opacity (being cropped out)
 * - Single border around the IMAGE bounds (not the slot)
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import Colors from '@/constants/colors';

const BORDER_COLOR = Colors.light.accent;
const GRID_COLOR = 'rgba(255, 255, 255, 0.6)';
const OVERFLOW_OPACITY = 0.4;

const MIN_SCALE = 1.0;
const MAX_SCALE = 4.0;

interface CropOverlayProps {
  slotX: number;
  slotY: number;
  slotWidth: number;
  slotHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  initialScale: number;
  initialTranslateX: number;
  initialTranslateY: number;
  onAdjustmentChange: (adjustments: {
    scale: number;
    translateX: number;
    translateY: number;
  }) => void;
}

export function CropOverlay({
  slotX,
  slotY,
  slotWidth,
  slotHeight,
  canvasWidth,
  canvasHeight,
  imageUri,
  imageWidth,
  imageHeight,
  initialScale,
  initialTranslateX,
  initialTranslateY,
  onAdjustmentChange,
}: CropOverlayProps) {
  // Gesture state
  const scale = useSharedValue(initialScale);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const startScale = useSharedValue(initialScale);
  const startTranslateX = useSharedValue(0);
  const startTranslateY = useSharedValue(0);

  // Calculate base image size (fills slot at scale 1.0)
  const baseImageSize = useMemo(() => {
    const imageAspect = imageWidth / imageHeight;
    const slotAspect = slotWidth / slotHeight;

    if (imageAspect > slotAspect) {
      return {
        width: slotHeight * imageAspect,
        height: slotHeight,
      };
    } else {
      return {
        width: slotWidth,
        height: slotWidth / imageAspect,
      };
    }
  }, [imageWidth, imageHeight, slotWidth, slotHeight]);

  // Initialize with saved adjustments
  React.useEffect(() => {
    const scaledWidth = baseImageSize.width * initialScale;
    const scaledHeight = baseImageSize.height * initialScale;
    const excessWidth = Math.max(0, scaledWidth - slotWidth);
    const excessHeight = Math.max(0, scaledHeight - slotHeight);
    
    translateX.value = initialTranslateX * excessWidth;
    translateY.value = initialTranslateY * excessHeight;
    scale.value = initialScale;
  }, []);

  const getMaxTranslation = useCallback((currentScale: number) => {
    'worklet';
    const scaledWidth = baseImageSize.width * currentScale;
    const scaledHeight = baseImageSize.height * currentScale;
    return {
      maxX: Math.max(0, (scaledWidth - slotWidth) / 2),
      maxY: Math.max(0, (scaledHeight - slotHeight) / 2),
    };
  }, [baseImageSize, slotWidth, slotHeight]);

  const clampTranslation = useCallback((tx: number, ty: number, currentScale: number) => {
    'worklet';
    const { maxX, maxY } = getMaxTranslation(currentScale);
    return {
      x: Math.max(-maxX, Math.min(maxX, tx)),
      y: Math.max(-maxY, Math.min(maxY, ty)),
    };
  }, [getMaxTranslation]);

  const reportAdjustment = useCallback(() => {
    const currentScale = scale.value;
    const scaledWidth = baseImageSize.width * currentScale;
    const scaledHeight = baseImageSize.height * currentScale;
    const excessWidth = Math.max(0, scaledWidth - slotWidth);
    const excessHeight = Math.max(0, scaledHeight - slotHeight);
    
    onAdjustmentChange({
      scale: currentScale,
      translateX: excessWidth > 0 ? translateX.value / excessWidth : 0,
      translateY: excessHeight > 0 ? translateY.value / excessHeight : 0,
    });
  }, [baseImageSize, slotWidth, slotHeight, onAdjustmentChange, scale, translateX, translateY]);

  const panGesture = useMemo(() =>
    Gesture.Pan()
      .onStart(() => {
        'worklet';
        startTranslateX.value = translateX.value;
        startTranslateY.value = translateY.value;
      })
      .onUpdate((event) => {
        'worklet';
        const clamped = clampTranslation(
          startTranslateX.value + event.translationX,
          startTranslateY.value + event.translationY,
          scale.value
        );
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      .onEnd(() => {
        'worklet';
        const clamped = clampTranslation(translateX.value, translateY.value, scale.value);
        translateX.value = withSpring(clamped.x, { damping: 20 });
        translateY.value = withSpring(clamped.y, { damping: 20 });
        runOnJS(reportAdjustment)();
      }),
    [clampTranslation, reportAdjustment]
  );

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
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, startScale.value * event.scale));
        scale.value = newScale;
        
        const scaleRatio = newScale / startScale.value;
        const clamped = clampTranslation(
          startTranslateX.value * scaleRatio,
          startTranslateY.value * scaleRatio,
          newScale
        );
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      .onEnd(() => {
        'worklet';
        const clamped = clampTranslation(translateX.value, translateY.value, scale.value);
        translateX.value = withSpring(clamped.x, { damping: 20 });
        translateY.value = withSpring(clamped.y, { damping: 20 });
        runOnJS(reportAdjustment)();
      }),
    [clampTranslation, reportAdjustment]
  );

  const composedGesture = useMemo(() =>
    Gesture.Simultaneous(panGesture, pinchGesture),
    [panGesture, pinchGesture]
  );

  // Image position/size (can extend beyond slot)
  const getImageBounds = useCallback((s: number, tx: number, ty: number) => {
    'worklet';
    const scaledWidth = baseImageSize.width * s;
    const scaledHeight = baseImageSize.height * s;
    // Image is centered on slot, then offset by translation
    const left = slotX + (slotWidth - scaledWidth) / 2 + tx;
    const top = slotY + (slotHeight - scaledHeight) / 2 + ty;
    return { left, top, width: scaledWidth, height: scaledHeight };
  }, [baseImageSize, slotX, slotY, slotWidth, slotHeight]);

  // Animated style for the overflow image (reduced opacity, with border)
  const overflowImageStyle = useAnimatedStyle(() => {
    const bounds = getImageBounds(scale.value, translateX.value, translateY.value);
    return {
      position: 'absolute' as const,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
  });

  // Animated style for the image inside slot (full opacity, clipped)
  const slotImageStyle = useAnimatedStyle(() => {
    const bounds = getImageBounds(scale.value, translateX.value, translateY.value);
    // Position relative to slot origin
    return {
      position: 'absolute' as const,
      left: bounds.left - slotX,
      top: bounds.top - slotY,
      width: bounds.width,
      height: bounds.height,
    };
  });

  // Border around the full image
  const borderStyle = useAnimatedStyle(() => {
    const bounds = getImageBounds(scale.value, translateX.value, translateY.value);
    return {
      position: 'absolute' as const,
      left: bounds.left - 2,
      top: bounds.top - 2,
      width: bounds.width + 4,
      height: bounds.height + 4,
    };
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Semi-transparent canvas overlay */}
      <View style={styles.canvasOverlay} />

      {/* Gesture area covers the whole canvas */}
      <GestureDetector gesture={composedGesture}>
        <View style={StyleSheet.absoluteFill}>
          {/* Overflow image at reduced opacity */}
          <Animated.View style={[overflowImageStyle, { opacity: OVERFLOW_OPACITY }]}>
            <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Slot window - shows full opacity image with grid */}
      <View
        style={[styles.slotWindow, { left: slotX, top: slotY, width: slotWidth, height: slotHeight }]}
        pointerEvents="none"
      >
        {/* Full opacity image clipped to slot */}
        <View style={styles.slotClip}>
          <Animated.View style={slotImageStyle}>
            <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
        </View>

        {/* Grid lines */}
        <View style={styles.grid}>
          <View style={[styles.gridLine, styles.vLine, { left: '33.33%' }]} />
          <View style={[styles.gridLine, styles.vLine, { left: '66.66%' }]} />
          <View style={[styles.gridLine, styles.hLine, { top: '33.33%' }]} />
          <View style={[styles.gridLine, styles.hLine, { top: '66.66%' }]} />
        </View>
      </View>

      {/* Border around the full image */}
      <Animated.View style={[styles.imageBorder, borderStyle]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  canvasOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  slotWindow: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 2,
  },
  slotClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: GRID_COLOR,
  },
  vLine: {
    width: 1,
    top: 0,
    bottom: 0,
  },
  hLine: {
    height: 1,
    left: 0,
    right: 0,
  },
  imageBorder: {
    borderWidth: 2,
    borderColor: BORDER_COLOR,
    borderRadius: 4,
  },
});

export default CropOverlay;
