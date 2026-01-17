import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
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
import { Template } from '@/types';
import { SlotRegion } from './SlotRegion';
import { extractSlots, scaleSlots, Slot } from '@/utils/slotParser';
import Colors from '@/constants/colors';
import { withCacheBust } from '@/services/imageUtils';
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

interface TemplateCanvasProps {
  template: Template;
  onSlotPress: (slotId: string) => void;
  /** Rendered preview from Templated.io (shown when photos are added) */
  renderedPreviewUri?: string | null;
  /** Whether a render is in progress */
  isRendering?: boolean;
  /** Called when the cached preview image fails to load (e.g., expired URL) */
  onPreviewError?: () => void;
  /** Whether user has premium status - affects which preview is shown */
  isPremium?: boolean;
  /** Called when the preview image has loaded and is ready for capture */
  onPreviewLoad?: () => void;
  /** Currently selected slot ID for selection highlight */
  selectedSlotId?: string | null;
  /** Crop mode configuration */
  cropMode?: CropModeConfig | null;
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
  const hasInitialized = React.useRef(false);
  React.useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    // Determine initial min scale based on initial rotation
    const minScale = initialRotation === 0 ? BASE_MIN_SCALE : minScaleForRotation;
    const effectiveScale = Math.max(minScale, initialScale);
    scale.value = effectiveScale;
    rotation.value = initialRotation;
    
    // Calculate translation from normalized values
    const scaledWidth = baseImageSize.width * effectiveScale;
    const scaledHeight = baseImageSize.height * effectiveScale;
    const maxTx = Math.max(0, (scaledWidth - slotWidth) / 2);
    const maxTy = Math.max(0, (scaledHeight - slotHeight) / 2);
    
    translateX.value = initialTranslateX * maxTx;
    translateY.value = initialTranslateY * maxTy;
  }, []);
  
  // Respond to rotation changes from slider
  React.useEffect(() => {
    if (!hasInitialized.current) return;
    
    // Update rotation value
    rotation.value = currentRotation;
    
    // Determine required minimum scale
    const requiredMinScale = currentRotation === 0 ? BASE_MIN_SCALE : minScaleForRotation;
    
    // If current scale is below required minimum, scale up immediately
    if (scale.value < requiredMinScale) {
      scale.value = requiredMinScale;
      
      // Re-clamp translation after scale change
      const scaledWidth = baseImageSize.width * requiredMinScale;
      const scaledHeight = baseImageSize.height * requiredMinScale;
      const maxTx = Math.max(0, (scaledWidth - slotWidth) / 2);
      const maxTy = Math.max(0, (scaledHeight - slotHeight) / 2);
      
      translateX.value = Math.max(-maxTx, Math.min(maxTx, translateX.value));
      translateY.value = Math.max(-maxTy, Math.min(maxTy, translateY.value));
    }
  }, [currentRotation, minScaleForRotation, baseImageSize, slotWidth, slotHeight]);

  // Get max translation for current scale
  const getMaxTranslation = useCallback((currentScale: number) => {
    'worklet';
    const scaledWidth = baseImageSize.width * currentScale;
    const scaledHeight = baseImageSize.height * currentScale;
    return {
      maxX: Math.max(0, (scaledWidth - slotWidth) / 2),
      maxY: Math.max(0, (scaledHeight - slotHeight) / 2),
    };
  }, [baseImageSize, slotWidth, slotHeight]);

  // Clamp translation to keep image covering slot
  const clampTranslation = useCallback((tx: number, ty: number, currentScale: number) => {
    'worklet';
    const { maxX, maxY } = getMaxTranslation(currentScale);
    return {
      x: Math.max(-maxX, Math.min(maxX, tx)),
      y: Math.max(-maxY, Math.min(maxY, ty)),
    };
  }, [getMaxTranslation]);

  // Report adjustment to parent
  const reportAdjustment = useCallback(() => {
    const currentScale = scale.value;
    const currentRotation = rotation.value;
    const { maxX, maxY } = getMaxTranslation(currentScale);
    
    onAdjustmentChange({
      scale: currentScale,
      translateX: maxX > 0 ? translateX.value / maxX : 0,
      translateY: maxY > 0 ? translateY.value / maxY : 0,
      rotation: currentRotation,
    });
  }, [getMaxTranslation, onAdjustmentChange, scale, translateX, translateY, rotation]);

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
          scale.value
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

  // Pinch gesture - zoom in/out (minimum scale depends on rotation state)
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
        // Enforce current minimum scale (depends on whether rotating)
        const newScale = Math.max(currentMinScale, Math.min(MAX_SCALE, startScale.value * event.scale));
        scale.value = newScale;
        
        // Adjust translation proportionally and clamp
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
        runOnJS(reportAdjustment)();
      }),
    [clampTranslation, reportAdjustment, currentMinScale]
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
 * TemplateCanvas - Renders template preview with invisible slot tap targets
 * 
 * Preview Priority (based on premium status):
 * 1. renderedPreviewUri (if user has added photos - watermark controlled by isPremium)
 * 2. For FREE users: watermarkedPreviewUrl (shows watermark upfront in editor)
 * 3. For PRO users: templatedPreviewUrl (clean preview)
 * 4. Fallback: thumbnail
 * 
 * Slot regions are invisible tap targets - template design shows through
 */
export function TemplateCanvas({
  template,
  onSlotPress,
  renderedPreviewUri,
  isRendering = false,
  onPreviewError,
  isPremium = false,
  onPreviewLoad,
  selectedSlotId = null,
  cropMode = null,
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

  // Find the crop slot
  const cropSlot = useMemo(() => {
    if (!cropMode) return null;
    return scaledSlots.find(s => s.layerId === cropMode.slotId) || null;
  }, [cropMode, scaledSlots]);

  // Preview priority based on premium status:
  // 1. renderedPreviewUri (if user has added photos)
  // 2. For FREE users: watermarkedPreviewUrl (shows watermark upfront)
  // 3. For PRO users: templatedPreviewUrl (clean)
  // 4. Fallback: thumbnail
  //
  // Cache busting is applied to local files (file://) to ensure
  // updated content (e.g., with overlays) is displayed correctly.
  const previewUrl = useMemo(() => {
    let url: string;
    
    // If we have a rendered preview (user added photos), use it
    if (renderedPreviewUri) {
      // Apply cache busting for local files
      // This ensures updated previews (with overlays) are displayed
      const cacheBusted = withCacheBust(renderedPreviewUri, Date.now());
      return cacheBusted || renderedPreviewUri;
    }
    
    // Before photos are added, show appropriate preview based on premium status
    if (isPremium) {
      // Pro users see clean preview
      url = template.templatedPreviewUrl || template.thumbnail;
    } else {
      // Free users see watermarked preview so they know upfront
      url = template.watermarkedPreviewUrl || template.templatedPreviewUrl || template.thumbnail;
    }
    
    return url;
  }, [renderedPreviewUri, isPremium, template.watermarkedPreviewUrl, template.templatedPreviewUrl, template.thumbnail]);

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
        {/* Preview Image */}
        <Image
          source={{ uri: previewUrl }}
          style={styles.previewImage}
          contentFit="cover"
          transition={200}
          onLoad={() => {
            // Notify parent that the preview image has loaded
            if (onPreviewLoad) {
              console.log('[TemplateCanvas] Preview image loaded:', previewUrl?.substring(0, 50) + '...');
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

        {/* Invisible slot tap targets - hidden during crop mode */}
        {!cropMode && scaledSlots.map(slot => (
          <SlotRegion
            key={slot.layerId}
            slot={slot}
            onPress={() => onSlotPress(slot.layerId)}
          />
        ))}

        {/* Canva-style selection overlay for selected slot - hidden during crop mode */}
        {!cropMode && selectedSlotId && scaledSlots.find(s => s.layerId === selectedSlotId) && (
          <SelectionOverlay 
            slot={scaledSlots.find(s => s.layerId === selectedSlotId)!} 
          />
        )}

        {/* Crop overlay - rendered inside canvas for perfect alignment */}
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
