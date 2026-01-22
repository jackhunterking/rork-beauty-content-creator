import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Template, CapturedImages, Slot } from '@/types';
import { SlotRegion } from './SlotRegion';
import { extractSlots, scaleSlots } from '@/utils/slotParser';
import Colors from '@/constants/colors';
import { withCacheBust } from '@/services/imageUtils';
import { LayeredCanvas } from './LayeredCanvas';
import { getGradientPoints } from '@/constants/gradients';
// Image processing constants moved inline for clarity

const CANVAS_PADDING = 20;

// Selection indicator colors - subtle and professional
const SELECTION_COLOR = '#007AFF'; // iOS blue - cleaner than purple
const SELECTION_BORDER_WIDTH = 2.5;

// Crop mode colors
const CROP_BORDER_COLOR = Colors.light.accent;
const CROP_GRID_COLOR = 'rgba(255, 255, 255, 0.6)';
const CROP_OVERFLOW_OPACITY = 0.4;

interface CropModeConfig {
  slotId: string;
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  initialScale: number;
  initialTranslateX: number;
  initialTranslateY: number;
  initialRotation: number;
  rotation: number; // Current rotation from slider
  onAdjustmentChange: (adjustments: { scale: number; translateX: number; translateY: number; rotation: number }) => void;
}

/**
 * ManipulationModeConfig - Same as CropModeConfig but rotation is read-only
 * Used when slot is selected (before clicking "Resize")
 */
interface ManipulationModeConfig {
  slotId: string;
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  initialScale: number;
  initialTranslateX: number;
  initialTranslateY: number;
  rotation: number; // Read-only - uses existing adjustments
  /** Background info for transparent PNGs (from AI background replacement) */
  backgroundInfo?: {
    type: 'solid' | 'gradient';
    solidColor?: string;
    gradient?: {
      type: 'linear';
      colors: [string, string];
      direction: 'vertical' | 'horizontal' | 'diagonal-tl' | 'diagonal-tr';
    };
  };
  onAdjustmentChange: (adjustments: { scale: number; translateX: number; translateY: number; rotation: number }) => void;
  onTapOutsideSlot?: () => void; // Called when user taps outside the slot to deselect
}

interface TemplateCanvasProps {
  template: Template;
  onSlotPress: (slotId: string) => void;
  /** Rendered preview from Templated.io (shown when photos are added) */
  renderedPreviewUri?: string | null;
  /** Whether a render is in progress */
  isRendering?: boolean;
  /** Called when the cached preview image fails to load (e.g., expired URL) */
  onPreviewError?: () => void;
  /** Called when the preview image has loaded and is ready for capture */
  onPreviewLoad?: () => void;
  /** Currently selected slot ID for selection highlight */
  selectedSlotId?: string | null;
  /** Manipulation mode - pan/pinch without rotation (when slot is selected) */
  manipulationMode?: ManipulationModeConfig | null;
  /** Crop mode configuration - full resize with rotation */
  cropMode?: CropModeConfig | null;
  /** Background color for LayeredCanvas mode (when frameOverlayUrl is available) */
  backgroundColor?: string;
  /** Theme color for theme layers in LayeredCanvas mode */
  themeColor?: string;
  /** Captured images for LayeredCanvas mode */
  capturedImages?: CapturedImages;
  /** Whether to use client-side LayeredCanvas compositing instead of Templated.io preview */
  useClientSideCompositing?: boolean;
  /** Children to render on top of the canvas (overlays) */
  children?: React.ReactNode;
}

/**
 * Clean selection indicator - just a border to show what's being edited
 * No resize handles since the frame is not resizable
 */
function SelectionOverlay({ slot }: { slot: Slot }) {
  // Animation values for smooth entrance
  const opacity = useSharedValue(0);
  const borderOpacity = useSharedValue(0.6);
  
  React.useEffect(() => {
    // Smooth fade in
    opacity.value = withTiming(1, { duration: 200 });
    
    // Subtle pulse animation for the border
    borderOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.6, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const animatedBorderStyle = useAnimatedStyle(() => ({
    opacity: borderOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.selectionContainer,
        {
          left: slot.x,
          top: slot.y,
          width: slot.width,
          height: slot.height,
        },
        animatedContainerStyle,
      ]}
      pointerEvents="none"
    >
      {/* Clean selection border - no handles */}
      <Animated.View style={[styles.selectionBorder, animatedBorderStyle]} />
      
      {/* Inner highlight overlay for better visibility */}
      <View style={styles.selectionInnerHighlight} />
    </Animated.View>
  );
}

/**
 * CropOverlay - Gesture-based resize with pinch, pan, and rotation
 * 
 * Logic:
 * - At scale 1.0, image exactly fills the slot (cover fit)
 * - User can zoom in (scale > 1.0) to see less of the image
 * - User can zoom out (scale down to 1.0) but not smaller
 * - Rotation is visual only - doesn't affect scale constraints
 * - Translation is clamped so image always covers the slot
 */
function CropOverlay({
  slot,
  imageUri,
  imageWidth,
  imageHeight,
  initialScale,
  initialTranslateX,
  initialTranslateY,
  initialRotation,
  currentRotation,
  onAdjustmentChange,
}: {
  slot: Slot;
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  initialScale: number;
  initialTranslateX: number;
  initialTranslateY: number;
  initialRotation: number;
  currentRotation: number; // From slider
  onAdjustmentChange: (adjustments: { scale: number; translateX: number; translateY: number; rotation: number }) => void;
}) {
  const slotWidth = slot.width;
  const slotHeight = slot.height;
  const slotX = slot.x;
  const slotY = slot.y;

  // Calculate base image size - this is the size where image exactly fills slot (cover fit)
  // This is constant and doesn't change with rotation
  const baseImageSize = useMemo(() => {
    const imageAspect = imageWidth / imageHeight;
    const slotAspect = slotWidth / slotHeight;

    if (imageAspect > slotAspect) {
      // Image is wider - height fits, width overflows
      return {
        width: slotHeight * imageAspect,
        height: slotHeight,
      };
    } else {
      // Image is taller - width fits, height overflows
      return {
        width: slotWidth,
        height: slotWidth / imageAspect,
      };
    }
  }, [imageWidth, imageHeight, slotWidth, slotHeight]);

  // Gesture state - scale 1.0 = image exactly fills slot
  const scale = useSharedValue(Math.max(1, initialScale));
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(initialRotation);
  
  const startScale = useSharedValue(1);
  const startTranslateX = useSharedValue(0);
  const startTranslateY = useSharedValue(0);

  // Constants
  const MAX_SCALE = 5.0; // Maximum zoom in
  const BASE_MIN_SCALE = 1.0; // Image exactly fills slot at 0° rotation
  
  // Calculate minimum scale needed when rotating (any non-zero angle)
  // For the image to cover the slot at ANY rotation angle:
  // The image's smallest dimension must be >= the slot's diagonal
  const minScaleForRotation = useMemo(() => {
    const slotDiagonal = Math.sqrt(slotWidth * slotWidth + slotHeight * slotHeight);
    const minImageDimension = Math.min(baseImageSize.width, baseImageSize.height);
    // Add 5% safety buffer
    return (slotDiagonal / minImageDimension) * 1.05;
  }, [slotWidth, slotHeight, baseImageSize]);

  // Current minimum scale depends on whether we're rotating or not
  const currentMinScale = useMemo(() => {
    // If rotating (non-zero), use the rotation-safe minimum
    // If not rotating (0°), use base minimum (1.0)
    return currentRotation === 0 ? BASE_MIN_SCALE : minScaleForRotation;
  }, [currentRotation, minScaleForRotation]);

  // Initialize with saved adjustments (only once)
  // Note: initialTranslateX/Y are normalized values in ROTATED coordinates (u/maxU, v/maxV)
  const hasInitialized = React.useRef(false);
  React.useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    // Determine initial min scale based on initial rotation
    const minScale = initialRotation === 0 ? BASE_MIN_SCALE : minScaleForRotation;
    const effectiveScale = Math.max(minScale, initialScale);
    scale.value = effectiveScale;
    rotation.value = initialRotation;
    
    // Calculate max translation in rotated coordinate system
    const scaledWidth = baseImageSize.width * effectiveScale;
    const scaledHeight = baseImageSize.height * effectiveScale;
    const halfW = scaledWidth / 2;
    const halfH = scaledHeight / 2;
    const halfSlotW = slotWidth / 2;
    const halfSlotH = slotHeight / 2;
    
    const angleRad = (initialRotation * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const absCos = Math.abs(cos);
    const absSin = Math.abs(sin);
    
    // Max translation in rotated coordinates
    const maxU = Math.max(0, halfW - (halfSlotW * absCos + halfSlotH * absSin));
    const maxV = Math.max(0, halfH - (halfSlotW * absSin + halfSlotH * absCos));
    
    // Denormalize: convert normalized rotated coords to actual rotated coords (u, v)
    const u = initialTranslateX * maxU;
    const v = initialTranslateY * maxV;
    
    // Convert rotated coords (u, v) back to screen coords (tx, ty)
    // Inverse of: u = tx*cos + ty*sin, v = -tx*sin + ty*cos
    // So: tx = u*cos - v*sin, ty = u*sin + v*cos
    translateX.value = u * cos - v * sin;
    translateY.value = u * sin + v * cos;
  }, []);
  
  // Get max translation in rotated coordinates for normalization
  // NOTE: Defined before the useEffect that depends on it
  const getMaxUV = useCallback((currentScale: number, rotationDeg: number) => {
    'worklet';
    const scaledWidth = baseImageSize.width * currentScale;
    const scaledHeight = baseImageSize.height * currentScale;
    const halfW = scaledWidth / 2;
    const halfH = scaledHeight / 2;
    const halfSlotW = slotWidth / 2;
    const halfSlotH = slotHeight / 2;
    
    const angleRad = (rotationDeg * Math.PI) / 180;
    const absCos = Math.abs(Math.cos(angleRad));
    const absSin = Math.abs(Math.sin(angleRad));
    
    return {
      maxU: Math.max(0, halfW - (halfSlotW * absCos + halfSlotH * absSin)),
      maxV: Math.max(0, halfH - (halfSlotW * absSin + halfSlotH * absCos)),
    };
  }, [baseImageSize, slotWidth, slotHeight]);

  // Report adjustment to parent - normalize in ROTATED coordinates
  // This ensures the saved values can be properly reconstructed
  // NOTE: Defined before the useEffect that depends on it
  const reportAdjustment = useCallback(() => {
    const currentScale = scale.value;
    const currentRot = rotation.value;
    const tx = translateX.value;
    const ty = translateY.value;
    
    // Convert screen coords (tx, ty) to rotated coords (u, v)
    const angleRad = (currentRot * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const u = tx * cos + ty * sin;
    const v = -tx * sin + ty * cos;
    
    // Get max values in rotated coordinates
    const { maxU, maxV } = getMaxUV(currentScale, currentRot);
    
    const adjustments = {
      scale: currentScale,
      translateX: maxU > 0 ? u / maxU : 0,
      translateY: maxV > 0 ? v / maxV : 0,
      rotation: currentRot,
    };
    
    // Report normalized values in rotated coordinate system
    // translateX now represents normalized U, translateY represents normalized V
    onAdjustmentChange(adjustments);
  }, [getMaxUV, onAdjustmentChange, scale, translateX, translateY, rotation, baseImageSize, slotWidth, slotHeight]);

  // Respond to rotation changes from slider
  React.useEffect(() => {
    if (!hasInitialized.current) return;
    
    // Update rotation value
    rotation.value = currentRotation;
    
    // Calculate dynamic minimum scale for current position and new rotation
    const tx = translateX.value;
    const ty = translateY.value;
    const halfSlotW = slotWidth / 2;
    const halfSlotH = slotHeight / 2;
    const baseHalfW = baseImageSize.width / 2;
    const baseHalfH = baseImageSize.height / 2;
    
    const angleRad = (currentRotation * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    
    // Calculate minimum scale needed for current position at new rotation
    const corners = [
      { x: halfSlotW, y: halfSlotH },
      { x: -halfSlotW, y: halfSlotH },
      { x: -halfSlotW, y: -halfSlotH },
      { x: halfSlotW, y: -halfSlotH },
    ];
    
    let dynamicMinScale = BASE_MIN_SCALE;
    for (const corner of corners) {
      const cx = corner.x - tx;
      const cy = corner.y - ty;
      const localX = cx * cos + cy * sin;
      const localY = -cx * sin + cy * cos;
      const scaleForX = Math.abs(localX) / baseHalfW;
      const scaleForY = Math.abs(localY) / baseHalfH;
      dynamicMinScale = Math.max(dynamicMinScale, scaleForX, scaleForY);
    }
    
    // If current scale is below the required minimum, scale up
    const effectiveScale = Math.max(scale.value, dynamicMinScale);
    const scaleWasAdjusted = scale.value < dynamicMinScale;
    if (scaleWasAdjusted) {
      scale.value = dynamicMinScale;
    }
    
    // Re-clamp translation using ROTATED coordinate system
    const scaledWidth = baseImageSize.width * effectiveScale;
    const scaledHeight = baseImageSize.height * effectiveScale;
    const halfW = scaledWidth / 2;
    const halfH = scaledHeight / 2;
    const absCos = Math.abs(cos);
    const absSin = Math.abs(sin);
    
    // Max translation in rotated coordinates
    const maxU = Math.max(0, halfW - (halfSlotW * absCos + halfSlotH * absSin));
    const maxV = Math.max(0, halfH - (halfSlotW * absSin + halfSlotH * absCos));
    
    // Convert current (tx, ty) to rotated coordinates
    const u = tx * cos + ty * sin;
    const v = -tx * sin + ty * cos;
    
    // Clamp in rotated coordinates
    const uClamped = Math.max(-maxU, Math.min(maxU, u));
    const vClamped = Math.max(-maxV, Math.min(maxV, v));
    
    // Convert back to (tx, ty)
    translateX.value = uClamped * cos - vClamped * sin;
    translateY.value = uClamped * sin + vClamped * cos;
    
    // CRITICAL FIX: Report the adjusted values back to parent!
    // This ensures the corrected scale (to prevent black corners) is used when saving
    reportAdjustment();
  }, [currentRotation, baseImageSize, slotWidth, slotHeight, reportAdjustment]);

  // Clamp translation to keep ROTATED image covering slot
  // 
  // KEY INSIGHT: When an image is rotated, the valid translation region is NOT
  // an axis-aligned rectangle in (tx, ty) space - it's a ROTATED rectangle!
  // Clamping tx and ty independently doesn't work because they're coupled through rotation.
  // 
  // CORRECT APPROACH: Clamp in the ROTATED coordinate system, then convert back.
  // 
  // For a slot corner to be inside the rotated image, we transform it to image-local coords.
  // The valid (tx, ty) region forms a rectangle in ROTATED coordinates (u, v):
  //   u = tx * cos(θ) + ty * sin(θ)     (translation along rotated X axis)
  //   v = -tx * sin(θ) + ty * cos(θ)    (translation along rotated Y axis)
  //
  // Bounds in rotated coordinates:
  //   |u| ≤ maxU = halfW - (halfSlotW * |cos| + halfSlotH * |sin|)
  //   |v| ≤ maxV = halfH - (halfSlotW * |sin| + halfSlotH * |cos|)
  
  const clampTranslation = useCallback((tx: number, ty: number, currentScale: number, rotationDeg: number) => {
    'worklet';
    const scaledWidth = baseImageSize.width * currentScale;
    const scaledHeight = baseImageSize.height * currentScale;
    const halfW = scaledWidth / 2;
    const halfH = scaledHeight / 2;
    const halfSlotW = slotWidth / 2;
    const halfSlotH = slotHeight / 2;
    
    const angleRad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const absCos = Math.abs(cos);
    const absSin = Math.abs(sin);
    
    // Maximum safe translation in ROTATED coordinates
    // This represents how far the image extends past the slot in each rotated axis
    const maxU = Math.max(0, halfW - (halfSlotW * absCos + halfSlotH * absSin));
    const maxV = Math.max(0, halfH - (halfSlotW * absSin + halfSlotH * absCos));
    
    // Convert (tx, ty) to rotated coordinates (u, v)
    const u = tx * cos + ty * sin;
    const v = -tx * sin + ty * cos;
    
    // Clamp in rotated coordinate system
    const uClamped = Math.max(-maxU, Math.min(maxU, u));
    const vClamped = Math.max(-maxV, Math.min(maxV, v));
    
    // Convert back to (tx, ty) using inverse rotation
    // tx = u * cos - v * sin
    // ty = u * sin + v * cos
    return {
      x: uClamped * cos - vClamped * sin,
      y: uClamped * sin + vClamped * cos,
    };
  }, [baseImageSize, slotWidth, slotHeight]);

  // Pan gesture - drag to reposition
  const panGesture = useMemo(() =>
    Gesture.Pan()
      .onStart(() => {
        'worklet';
        startTranslateX.value = translateX.value;
        startTranslateY.value = translateY.value;
      })
      .onUpdate((event) => {
        'worklet';
        // Pass rotation to clampTranslation to account for rotated image coverage
        const clamped = clampTranslation(
          startTranslateX.value + event.translationX,
          startTranslateY.value + event.translationY,
          scale.value,
          rotation.value
        );
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      .onEnd(() => {
        'worklet';
        runOnJS(reportAdjustment)();
      }),
    [clampTranslation, reportAdjustment]
  );

  // Calculate the minimum scale needed for the rotated image to cover the slot
  // at the current translation position. This allows zooming out until an edge touches.
  const getMinScaleForPosition = useCallback((tx: number, ty: number, rotationDeg: number) => {
    'worklet';
    const halfSlotW = slotWidth / 2;
    const halfSlotH = slotHeight / 2;
    const baseHalfW = baseImageSize.width / 2;
    const baseHalfH = baseImageSize.height / 2;
    
    const angleRad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    
    // For each slot corner, calculate the minimum scale needed
    // Slot corners relative to slot center (which is image center at tx=ty=0)
    const corners = [
      { x: halfSlotW, y: halfSlotH },
      { x: -halfSlotW, y: halfSlotH },
      { x: -halfSlotW, y: -halfSlotH },
      { x: halfSlotW, y: -halfSlotH },
    ];
    
    let minScale = BASE_MIN_SCALE; // Absolute minimum
    
    for (const corner of corners) {
      // Corner position relative to image center (accounting for translation)
      const cx = corner.x - tx;
      const cy = corner.y - ty;
      
      // Transform to image-local coordinates (rotate back)
      const localX = cx * cos + cy * sin;
      const localY = -cx * sin + cy * cos;
      
      // For corner to be inside image: |localX| ≤ halfW * scale, |localY| ≤ halfH * scale
      // So: scale ≥ |localX| / baseHalfW and scale ≥ |localY| / baseHalfH
      const scaleForX = Math.abs(localX) / baseHalfW;
      const scaleForY = Math.abs(localY) / baseHalfH;
      
      minScale = Math.max(minScale, scaleForX, scaleForY);
    }
    
    return minScale;
  }, [slotWidth, slotHeight, baseImageSize]);

  // Pinch gesture - zoom in/out with DYNAMIC minimum scale based on position
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
        const proposedScale = startScale.value * event.scale;
        
        // Calculate the minimum scale needed at current position
        // This allows zooming out until an edge touches the slot
        const dynamicMinScale = getMinScaleForPosition(
          startTranslateX.value,
          startTranslateY.value,
          rotation.value
        );
        
        // Clamp scale between dynamic minimum and maximum
        const newScale = Math.max(dynamicMinScale, Math.min(MAX_SCALE, proposedScale));
        scale.value = newScale;
        
        // Adjust translation proportionally and clamp
        const scaleRatio = newScale / startScale.value;
        const clamped = clampTranslation(
          startTranslateX.value * scaleRatio,
          startTranslateY.value * scaleRatio,
          newScale,
          rotation.value
        );
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      .onEnd(() => {
        'worklet';
        runOnJS(reportAdjustment)();
      }),
    [clampTranslation, reportAdjustment, getMinScaleForPosition]
  );

  // Combine gestures (pan + pinch only, rotation via slider)
  const composedGesture = useMemo(() =>
    Gesture.Simultaneous(panGesture, pinchGesture),
    [panGesture, pinchGesture]
  );

  // Calculate image bounds for rendering
  const getImageBounds = useCallback((s: number, tx: number, ty: number) => {
    'worklet';
    const scaledWidth = baseImageSize.width * s;
    const scaledHeight = baseImageSize.height * s;
    // Center the image on the slot, then apply translation
    const left = slotX + (slotWidth - scaledWidth) / 2 + tx;
    const top = slotY + (slotHeight - scaledHeight) / 2 + ty;
    return { left, top, width: scaledWidth, height: scaledHeight };
  }, [baseImageSize, slotX, slotY, slotWidth, slotHeight]);

  // Animated style for the overflow image (dimmed, shows full image with rotation)
  const overflowImageStyle = useAnimatedStyle(() => {
    const bounds = getImageBounds(scale.value, translateX.value, translateY.value);
    return {
      position: 'absolute' as const,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  // Animated style for the image inside the slot (full opacity, clipped)
  const slotImageStyle = useAnimatedStyle(() => {
    const bounds = getImageBounds(scale.value, translateX.value, translateY.value);
    return {
      position: 'absolute' as const,
      left: bounds.left - slotX,
      top: bounds.top - slotY,
      width: bounds.width,
      height: bounds.height,
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  // Animated style for the border around the full image
  const borderStyle = useAnimatedStyle(() => {
    const bounds = getImageBounds(scale.value, translateX.value, translateY.value);
    return {
      position: 'absolute' as const,
      left: bounds.left - 2,
      top: bounds.top - 2,
      width: bounds.width + 4,
      height: bounds.height + 4,
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Dim the canvas */}
      <View style={cropStyles.canvasOverlay} />

      {/* Gesture area */}
      <GestureDetector gesture={composedGesture}>
        <View style={StyleSheet.absoluteFill}>
          {/* Overflow image at reduced opacity */}
          <Animated.View style={[overflowImageStyle, { opacity: CROP_OVERFLOW_OPACITY }]}>
            <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Slot window - full opacity with grid */}
      <View
        style={[cropStyles.slotWindow, { left: slotX, top: slotY, width: slotWidth, height: slotHeight }]}
        pointerEvents="none"
      >
        <View style={cropStyles.slotClip}>
          <Animated.View style={slotImageStyle}>
            <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
        </View>

        {/* Grid */}
        <View style={cropStyles.grid}>
          <View style={[cropStyles.gridLine, cropStyles.vLine, { left: '33.33%' }]} />
          <View style={[cropStyles.gridLine, cropStyles.vLine, { left: '66.66%' }]} />
          <View style={[cropStyles.gridLine, cropStyles.hLine, { top: '33.33%' }]} />
          <View style={[cropStyles.gridLine, cropStyles.hLine, { top: '66.66%' }]} />
        </View>
      </View>

      {/* Border around full image */}
      <Animated.View style={[cropStyles.imageBorder, borderStyle]} pointerEvents="none" />
    </View>
  );
}

/**
 * ManipulationOverlay - Pan and pinch gestures WITHOUT rotation
 * 
 * Same visual appearance as CropOverlay but:
 * - No rotation gesture (rotation is read-only from existing adjustments)
 * - Used when slot is selected, before clicking "Resize"
 * - ContextualToolbar remains visible (not CropToolbar)
 */
function ManipulationOverlay({
  slot,
  imageUri,
  imageWidth,
  imageHeight,
  initialScale,
  initialTranslateX,
  initialTranslateY,
  currentRotation, // Read-only
  backgroundInfo,
  onAdjustmentChange,
  onTapOutsideSlot,
}: {
  slot: Slot;
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  initialScale: number;
  initialTranslateX: number;
  initialTranslateY: number;
  currentRotation: number; // Read-only - from existing adjustments
  backgroundInfo?: ManipulationModeConfig['backgroundInfo'];
  onAdjustmentChange: (adjustments: { scale: number; translateX: number; translateY: number; rotation: number }) => void;
  onTapOutsideSlot?: () => void;
}) {
  const slotWidth = slot.width;
  const slotHeight = slot.height;
  const slotX = slot.x;
  const slotY = slot.y;

  // Calculate base image size - this is the size where image exactly fills slot (cover fit)
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

  // Gesture state - scale 1.0 = image exactly fills slot
  // Rotation is READ-ONLY (passed through unchanged)
  const scale = useSharedValue(Math.max(1, initialScale));
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(currentRotation);
  
  const startScale = useSharedValue(1);
  const startTranslateX = useSharedValue(0);
  const startTranslateY = useSharedValue(0);

  // Constants
  const MAX_SCALE = 5.0;
  const BASE_MIN_SCALE = 1.0;
  
  // Calculate minimum scale needed when rotating
  const minScaleForRotation = useMemo(() => {
    const slotDiagonal = Math.sqrt(slotWidth * slotWidth + slotHeight * slotHeight);
    const minImageDimension = Math.min(baseImageSize.width, baseImageSize.height);
    return (slotDiagonal / minImageDimension) * 1.05;
  }, [slotWidth, slotHeight, baseImageSize]);

  // Current minimum scale depends on rotation
  const currentMinScale = useMemo(() => {
    return currentRotation === 0 ? BASE_MIN_SCALE : minScaleForRotation;
  }, [currentRotation, minScaleForRotation]);

  // Initialize with saved adjustments (only once)
  const hasInitialized = React.useRef(false);
  React.useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    const minScale = currentRotation === 0 ? BASE_MIN_SCALE : minScaleForRotation;
    const effectiveScale = Math.max(minScale, initialScale);
    scale.value = effectiveScale;
    rotation.value = currentRotation;
    
    // Calculate max translation in rotated coordinate system
    const scaledWidth = baseImageSize.width * effectiveScale;
    const scaledHeight = baseImageSize.height * effectiveScale;
    const halfW = scaledWidth / 2;
    const halfH = scaledHeight / 2;
    const halfSlotW = slotWidth / 2;
    const halfSlotH = slotHeight / 2;
    
    const angleRad = (currentRotation * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const absCos = Math.abs(cos);
    const absSin = Math.abs(sin);
    
    const maxU = Math.max(0, halfW - (halfSlotW * absCos + halfSlotH * absSin));
    const maxV = Math.max(0, halfH - (halfSlotW * absSin + halfSlotH * absCos));
    
    const u = initialTranslateX * maxU;
    const v = initialTranslateY * maxV;
    
    translateX.value = u * cos - v * sin;
    translateY.value = u * sin + v * cos;
  }, []);

  // Clamp translation to keep rotated image covering slot
  const clampTranslation = useCallback((tx: number, ty: number, currentScale: number, rotationDeg: number) => {
    'worklet';
    const scaledWidth = baseImageSize.width * currentScale;
    const scaledHeight = baseImageSize.height * currentScale;
    const halfW = scaledWidth / 2;
    const halfH = scaledHeight / 2;
    const halfSlotW = slotWidth / 2;
    const halfSlotH = slotHeight / 2;
    
    const angleRad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const absCos = Math.abs(cos);
    const absSin = Math.abs(sin);
    
    const maxU = Math.max(0, halfW - (halfSlotW * absCos + halfSlotH * absSin));
    const maxV = Math.max(0, halfH - (halfSlotW * absSin + halfSlotH * absCos));
    
    const u = tx * cos + ty * sin;
    const v = -tx * sin + ty * cos;
    
    const uClamped = Math.max(-maxU, Math.min(maxU, u));
    const vClamped = Math.max(-maxV, Math.min(maxV, v));
    
    return {
      x: uClamped * cos - vClamped * sin,
      y: uClamped * sin + vClamped * cos,
    };
  }, [baseImageSize, slotWidth, slotHeight]);
  
  // Get max translation in rotated coordinates for normalization
  const getMaxUV = useCallback((currentScale: number, rotationDeg: number) => {
    'worklet';
    const scaledWidth = baseImageSize.width * currentScale;
    const scaledHeight = baseImageSize.height * currentScale;
    const halfW = scaledWidth / 2;
    const halfH = scaledHeight / 2;
    const halfSlotW = slotWidth / 2;
    const halfSlotH = slotHeight / 2;
    
    const angleRad = (rotationDeg * Math.PI) / 180;
    const absCos = Math.abs(Math.cos(angleRad));
    const absSin = Math.abs(Math.sin(angleRad));
    
    return {
      maxU: Math.max(0, halfW - (halfSlotW * absCos + halfSlotH * absSin)),
      maxV: Math.max(0, halfH - (halfSlotW * absSin + halfSlotH * absCos)),
    };
  }, [baseImageSize, slotWidth, slotHeight]);

  // Report adjustment to parent - rotation passes through unchanged
  const reportAdjustment = useCallback(() => {
    const currentScale = scale.value;
    const currentRot = rotation.value;
    const tx = translateX.value;
    const ty = translateY.value;
    
    const angleRad = (currentRot * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const u = tx * cos + ty * sin;
    const v = -tx * sin + ty * cos;
    
    const { maxU, maxV } = getMaxUV(currentScale, currentRot);
    
    const adjustments = {
      scale: currentScale,
      translateX: maxU > 0 ? u / maxU : 0,
      translateY: maxV > 0 ? v / maxV : 0,
      rotation: currentRot, // Pass through unchanged
    };
    
    onAdjustmentChange(adjustments);
  }, [getMaxUV, onAdjustmentChange, scale, translateX, translateY, rotation]);

  // Pan gesture - drag to reposition
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
          scale.value,
          rotation.value
        );
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      .onEnd(() => {
        'worklet';
        runOnJS(reportAdjustment)();
      }),
    [clampTranslation, reportAdjustment]
  );

  // Calculate minimum scale needed for rotated image to cover slot
  const getMinScaleForPosition = useCallback((tx: number, ty: number, rotationDeg: number) => {
    'worklet';
    const halfSlotW = slotWidth / 2;
    const halfSlotH = slotHeight / 2;
    const baseHalfW = baseImageSize.width / 2;
    const baseHalfH = baseImageSize.height / 2;
    
    const angleRad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    
    const corners = [
      { x: halfSlotW, y: halfSlotH },
      { x: -halfSlotW, y: halfSlotH },
      { x: -halfSlotW, y: -halfSlotH },
      { x: halfSlotW, y: -halfSlotH },
    ];
    
    let minScale = BASE_MIN_SCALE;
    
    for (const corner of corners) {
      const cx = corner.x - tx;
      const cy = corner.y - ty;
      const localX = cx * cos + cy * sin;
      const localY = -cx * sin + cy * cos;
      const scaleForX = Math.abs(localX) / baseHalfW;
      const scaleForY = Math.abs(localY) / baseHalfH;
      minScale = Math.max(minScale, scaleForX, scaleForY);
    }
    
    return minScale;
  }, [slotWidth, slotHeight, baseImageSize]);

  // Pinch gesture - zoom in/out
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
        const proposedScale = startScale.value * event.scale;
        const dynamicMinScale = getMinScaleForPosition(
          startTranslateX.value,
          startTranslateY.value,
          rotation.value
        );
        const newScale = Math.max(dynamicMinScale, Math.min(MAX_SCALE, proposedScale));
        scale.value = newScale;
        
        const scaleRatio = newScale / startScale.value;
        const clamped = clampTranslation(
          startTranslateX.value * scaleRatio,
          startTranslateY.value * scaleRatio,
          newScale,
          rotation.value
        );
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      .onEnd(() => {
        'worklet';
        runOnJS(reportAdjustment)();
      }),
    [clampTranslation, reportAdjustment, getMinScaleForPosition]
  );

  // Tap gesture - any tap on the canvas deselects the slot
  // Pan/pinch gestures still work for manipulation
  const tapGesture = useMemo(() =>
    Gesture.Tap()
      .onEnd(() => {
        'worklet';
        // Any tap on the canvas should deselect
        if (onTapOutsideSlot) {
          runOnJS(onTapOutsideSlot)();
        }
      }),
    [onTapOutsideSlot]
  );

  // Combine gestures (pan + pinch + tap - NO rotation)
  const composedGesture = useMemo(() =>
    Gesture.Race(
      tapGesture,
      Gesture.Simultaneous(panGesture, pinchGesture)
    ),
    [tapGesture, panGesture, pinchGesture]
  );

  // Calculate image bounds for rendering
  const getImageBounds = useCallback((s: number, tx: number, ty: number) => {
    'worklet';
    const scaledWidth = baseImageSize.width * s;
    const scaledHeight = baseImageSize.height * s;
    const left = slotX + (slotWidth - scaledWidth) / 2 + tx;
    const top = slotY + (slotHeight - scaledHeight) / 2 + ty;
    return { left, top, width: scaledWidth, height: scaledHeight };
  }, [baseImageSize, slotX, slotY, slotWidth, slotHeight]);

  // Animated style for the overflow image
  const overflowImageStyle = useAnimatedStyle(() => {
    const bounds = getImageBounds(scale.value, translateX.value, translateY.value);
    return {
      position: 'absolute' as const,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  // Animated style for the image inside the slot
  const slotImageStyle = useAnimatedStyle(() => {
    const bounds = getImageBounds(scale.value, translateX.value, translateY.value);
    return {
      position: 'absolute' as const,
      left: bounds.left - slotX,
      top: bounds.top - slotY,
      width: bounds.width,
      height: bounds.height,
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  // Animated style for the border around the full image
  const borderStyle = useAnimatedStyle(() => {
    const bounds = getImageBounds(scale.value, translateX.value, translateY.value);
    return {
      position: 'absolute' as const,
      left: bounds.left - 2,
      top: bounds.top - 2,
      width: bounds.width + 4,
      height: bounds.height + 4,
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Dim the canvas */}
      <View style={cropStyles.canvasOverlay} />

      {/* Gesture area */}
      <GestureDetector gesture={composedGesture}>
        <View style={StyleSheet.absoluteFill}>
          {/* Overflow image at reduced opacity */}
          <Animated.View style={[overflowImageStyle, { opacity: CROP_OVERFLOW_OPACITY }]}>
            {/* Background for transparent PNG */}
            {backgroundInfo?.type === 'solid' && backgroundInfo.solidColor && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: backgroundInfo.solidColor }]} />
            )}
            {backgroundInfo?.type === 'gradient' && backgroundInfo.gradient && (
              <LinearGradient
                colors={backgroundInfo.gradient.colors}
                {...getGradientPoints(backgroundInfo.gradient.direction)}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Slot window - full opacity with grid */}
      <View
        style={[cropStyles.slotWindow, { left: slotX, top: slotY, width: slotWidth, height: slotHeight }]}
        pointerEvents="none"
      >
        <View style={cropStyles.slotClip}>
          {/* Background color/gradient for transparent PNGs */}
          {backgroundInfo?.type === 'solid' && backgroundInfo.solidColor && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: backgroundInfo.solidColor }]} />
          )}
          {backgroundInfo?.type === 'gradient' && backgroundInfo.gradient && (
            <LinearGradient
              colors={backgroundInfo.gradient.colors}
              {...getGradientPoints(backgroundInfo.gradient.direction)}
              style={StyleSheet.absoluteFill}
            />
          )}
          <Animated.View style={slotImageStyle}>
            <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
        </View>

        {/* Grid */}
        <View style={cropStyles.grid}>
          <View style={[cropStyles.gridLine, cropStyles.vLine, { left: '33.33%' }]} />
          <View style={[cropStyles.gridLine, cropStyles.vLine, { left: '66.66%' }]} />
          <View style={[cropStyles.gridLine, cropStyles.hLine, { top: '33.33%' }]} />
          <View style={[cropStyles.gridLine, cropStyles.hLine, { top: '66.66%' }]} />
        </View>
      </View>

      {/* Border around full image */}
      <Animated.View style={[cropStyles.imageBorder, borderStyle]} pointerEvents="none" />
    </View>
  );
}

/**
 * TemplateCanvas - Renders template preview with invisible slot tap targets
 * 
 * Preview Priority:
 * 1. renderedPreviewUri (if user has added photos)
 * 2. templatedPreviewUrl (template preview)
 * 3. Fallback: thumbnail
 * 
 * Slot regions are invisible tap targets - template design shows through
 */
export function TemplateCanvas({
  template,
  onSlotPress,
  renderedPreviewUri,
  isRendering = false,
  onPreviewError,
  onPreviewLoad,
  selectedSlotId = null,
  manipulationMode = null,
  cropMode = null,
  backgroundColor = '#FFFFFF',
  themeColor,
  capturedImages = {},
  useClientSideCompositing = false,
  children,
}: TemplateCanvasProps) {
  // Use reactive window dimensions to handle screen rotation and dynamic updates
  const { width: screenWidth } = useWindowDimensions();
  const maxCanvasWidth = screenWidth - CANVAS_PADDING * 2;

  // Calculate display dimensions to fit canvas on screen
  const { displayWidth, displayHeight } = useMemo(() => {
    const aspectRatio = template.canvasWidth / template.canvasHeight;
    
    let width = maxCanvasWidth;
    let height = width / aspectRatio;
    
    // If too tall, constrain by height instead
    const maxHeight = screenWidth * 1.2; // Max height is 120% of screen width
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    
    return {
      displayWidth: width,
      displayHeight: height,
    };
  }, [template.canvasWidth, template.canvasHeight, maxCanvasWidth, screenWidth]);

  // Extract slots from template and scale to display dimensions
  const scaledSlots = useMemo(() => {
    const slots = extractSlots(template);
    return scaleSlots(
      slots,
      template.canvasWidth,
      template.canvasHeight,
      displayWidth,
      displayHeight
    );
  }, [template, displayWidth, displayHeight]);

  // Find the manipulation slot
  const manipulationSlot = useMemo(() => {
    if (!manipulationMode) return null;
    return scaledSlots.find(s => s.layerId === manipulationMode.slotId) || null;
  }, [manipulationMode, scaledSlots]);

  // Find the crop slot
  const cropSlot = useMemo(() => {
    if (!cropMode) return null;
    return scaledSlots.find(s => s.layerId === cropMode.slotId) || null;
  }, [cropMode, scaledSlots]);

  // Preview priority:
  // 1. renderedPreviewUri (if user has added photos)
  // 2. templatedPreviewUrl (template preview)
  // 3. Fallback: thumbnail
  //
  // Cache busting is applied to local files (file://) to ensure
  // updated content (e.g., with overlays) is displayed correctly.
  const previewUrl = useMemo(() => {
    // If we have a rendered preview (user added photos), use it
    if (renderedPreviewUri) {
      // Apply cache busting for local files
      // This ensures updated previews (with overlays) are displayed
      const cacheBusted = withCacheBust(renderedPreviewUri, Date.now());
      return cacheBusted || renderedPreviewUri;
    }
    
    // Before photos are added, show template preview
    return template.templatedPreviewUrl || template.thumbnail;
  }, [renderedPreviewUri, template.templatedPreviewUrl, template.thumbnail]);

  // Use LayeredCanvas when useClientSideCompositing is enabled
  // LayeredCanvas renders all layers directly from Templated.io API data
  const shouldUseLayeredCanvas = useClientSideCompositing && template.layersJson && template.layersJson.length > 0;

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.canvas,
          {
            width: displayWidth,
            height: displayHeight,
          },
        ]}
      >
        {/* Client-side LayeredCanvas - renders all layers directly from Templated.io API */}
        {shouldUseLayeredCanvas ? (
          <LayeredCanvas
            template={template}
            capturedImages={capturedImages}
            backgroundColor={backgroundColor}
            themeColor={themeColor}
            canvasWidth={displayWidth}
            canvasHeight={displayHeight}
          >
            {children}
          </LayeredCanvas>
        ) : (
          /* Traditional Templated.io preview */
          <Image
            source={{ uri: previewUrl }}
            style={styles.previewImage}
            contentFit="cover"
            transition={200}
            onLoad={() => {
              // Notify parent that the preview image has loaded
              if (onPreviewLoad) {
                onPreviewLoad();
              }
            }}
            onError={() => {
              // If the rendered preview fails to load (e.g., expired URL),
              // notify parent to trigger a fresh render
              if (renderedPreviewUri && onPreviewError) {
                console.warn('[TemplateCanvas] Cached preview failed to load, requesting re-render');
                onPreviewError();
              }
            }}
          />
        )}

        {/* Slot tap targets with placeholder - hidden during manipulation or crop mode */}
        {!manipulationMode && !cropMode && (() => {
          console.log(`[TemplateCanvas] Rendering ${scaledSlots.length} slot regions`);
          scaledSlots.forEach(s => console.log(`[TemplateCanvas] Slot ${s.layerId}: x=${s.x.toFixed(0)}, y=${s.y.toFixed(0)}, w=${s.width.toFixed(0)}, h=${s.height.toFixed(0)}`));
          return scaledSlots.map(slot => (
            <SlotRegion
              key={slot.layerId}
              slot={slot}
              onPress={() => onSlotPress(slot.layerId)}
              isEmpty={!capturedImages?.[slot.layerId]}
            />
          ));
        })()}

        {/* Canva-style selection overlay - hidden during manipulation or crop mode */}
        {!manipulationMode && !cropMode && selectedSlotId && scaledSlots.find(s => s.layerId === selectedSlotId) && (
          <SelectionOverlay 
            slot={scaledSlots.find(s => s.layerId === selectedSlotId)!} 
          />
        )}

        {/* Manipulation overlay - pan/pinch without rotation (when slot is selected) */}
        {manipulationMode && manipulationSlot && !cropMode && (
          <ManipulationOverlay
            slot={manipulationSlot}
            imageUri={manipulationMode.imageUri}
            imageWidth={manipulationMode.imageWidth}
            imageHeight={manipulationMode.imageHeight}
            initialScale={manipulationMode.initialScale}
            initialTranslateX={manipulationMode.initialTranslateX}
            initialTranslateY={manipulationMode.initialTranslateY}
            currentRotation={manipulationMode.rotation}
            backgroundInfo={manipulationMode.backgroundInfo}
            onAdjustmentChange={manipulationMode.onAdjustmentChange}
            onTapOutsideSlot={manipulationMode.onTapOutsideSlot}
          />
        )}

        {/* Crop overlay - full resize with rotation */}
        {cropMode && cropSlot && (
          <CropOverlay
            slot={cropSlot}
            imageUri={cropMode.imageUri}
            imageWidth={cropMode.imageWidth}
            imageHeight={cropMode.imageHeight}
            initialScale={cropMode.initialScale}
            initialTranslateX={cropMode.initialTranslateX}
            initialTranslateY={cropMode.initialTranslateY}
            initialRotation={cropMode.initialRotation}
            currentRotation={cropMode.rotation}
            onAdjustmentChange={cropMode.onAdjustmentChange}
          />
        )}

        {/* Rendering Overlay - shown while Templated.io is processing */}
        {isRendering && (
          <View style={styles.renderingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.renderingText}>Updating preview...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  canvas: {
    borderRadius: 6,
    overflow: 'hidden', // Clip crop overlay to canvas bounds
    backgroundColor: Colors.light.surfaceSecondary,
    // Glass UI border effect
    borderWidth: 1,
    borderColor: Colors.light.glassEdge,
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 6,
  },
  renderingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    borderRadius: 6,
  },
  renderingText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  // Clean selection indicator - no resize handles
  selectionContainer: {
    position: 'absolute',
    zIndex: 50,
  },
  selectionBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: SELECTION_BORDER_WIDTH,
    borderColor: SELECTION_COLOR,
    borderRadius: 4,
  },
  selectionInnerHighlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SELECTION_COLOR,
    opacity: 0.08,
    borderRadius: 2,
  },
});

const cropStyles = StyleSheet.create({
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
    backgroundColor: CROP_GRID_COLOR,
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
    borderColor: CROP_BORDER_COLOR,
    borderRadius: 4,
  },
});

export default TemplateCanvas;
