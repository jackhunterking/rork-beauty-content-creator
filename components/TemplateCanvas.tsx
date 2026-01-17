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
import { 
  MIN_ADJUSTMENT_SCALE, 
  MAX_ADJUSTMENT_SCALE 
} from '@/utils/imageProcessing';

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
  rotation: number;
  onAdjustmentChange: (adjustments: { scale: number; translateX: number; translateY: number }) => void;
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
 * CropOverlay - Canva-style inline crop with rotation
 * Rendered inside the canvas so coordinates align perfectly
 */
function CropOverlay({
  slot,
  imageUri,
  imageWidth,
  imageHeight,
  initialScale,
  initialTranslateX,
  initialTranslateY,
  rotation,
  onAdjustmentChange,
}: {
  slot: Slot;
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  initialScale: number;
  initialTranslateX: number;
  initialTranslateY: number;
  rotation: number;
  onAdjustmentChange: (adjustments: { scale: number; translateX: number; translateY: number }) => void;
}) {
  const slotWidth = slot.width;
  const slotHeight = slot.height;
  const slotX = slot.x;
  const slotY = slot.y;

  // Gesture state
  const scale = useSharedValue(initialScale);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const startScale = useSharedValue(initialScale);
  const startTranslateX = useSharedValue(0);
  const startTranslateY = useSharedValue(0);

  // Calculate the rotated image dimensions
  // When ImageManipulator rotates an image, it creates a new bounding box
  // that encompasses the entire rotated image
  const rotatedImageDimensions = useMemo(() => {
    if (rotation === 0) {
      return { width: imageWidth, height: imageHeight };
    }
    
    const radians = Math.abs(rotation) * (Math.PI / 180);
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    
    // The rotated bounding box dimensions
    const rotatedWidth = imageWidth * cos + imageHeight * sin;
    const rotatedHeight = imageWidth * sin + imageHeight * cos;
    
    return { width: rotatedWidth, height: rotatedHeight };
  }, [imageWidth, imageHeight, rotation]);

  // Calculate base image size using rotated dimensions (fills slot at scale 1.0)
  const baseImageSize = useMemo(() => {
    const imageAspect = rotatedImageDimensions.width / rotatedImageDimensions.height;
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
  }, [rotatedImageDimensions, slotWidth, slotHeight]);

  // Minimum scale is always 1.0 - user has full control over zoom
  // The final processing will handle any gaps from rotation
  const minScale = MIN_ADJUSTMENT_SCALE; // 1.0

  // Initialize with saved adjustments (runs only once when entering resize mode)
  const hasInitialized = React.useRef(false);
  React.useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    const effectiveScale = Math.max(initialScale, minScale);
    const scaledWidth = baseImageSize.width * effectiveScale;
    const scaledHeight = baseImageSize.height * effectiveScale;
    const excessWidth = Math.max(0, scaledWidth - slotWidth);
    const excessHeight = Math.max(0, scaledHeight - slotHeight);
    
    translateX.value = initialTranslateX * excessWidth;
    translateY.value = initialTranslateY * excessHeight;
    scale.value = effectiveScale;
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
        // Minimum scale is 1.0 - user has full control
        const newScale = Math.max(minScale, Math.min(MAX_ADJUSTMENT_SCALE, startScale.value * event.scale));
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
    [clampTranslation, reportAdjustment, minScale]
  );

  const composedGesture = useMemo(() =>
    Gesture.Simultaneous(panGesture, pinchGesture),
    [panGesture, pinchGesture]
  );

  // Image bounds calculation
  const getImageBounds = useCallback((s: number, tx: number, ty: number) => {
    'worklet';
    const scaledWidth = baseImageSize.width * s;
    const scaledHeight = baseImageSize.height * s;
    const left = slotX + (slotWidth - scaledWidth) / 2 + tx;
    const top = slotY + (slotHeight - scaledHeight) / 2 + ty;
    return { left, top, width: scaledWidth, height: scaledHeight };
  }, [baseImageSize, slotX, slotY, slotWidth, slotHeight]);

  // Calculate rotation compensation factor
  // When we rotate via CSS, the image bounding box stays the same
  // But ImageManipulator creates a larger bounding box
  // We compensate by scaling up the image to simulate the larger bounds
  const rotationCompensation = useMemo(() => {
    if (rotation === 0) return 1;
    
    const radians = Math.abs(rotation) * (Math.PI / 180);
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    
    // The rotated bounding box is larger by this factor (approximately)
    const expansionFactor = Math.max(
      (imageWidth * cos + imageHeight * sin) / imageWidth,
      (imageWidth * sin + imageHeight * cos) / imageHeight
    );
    
    return expansionFactor;
  }, [rotation, imageWidth, imageHeight]);

  // Overflow image style (reduced opacity, with rotation)
  const overflowImageStyle = useAnimatedStyle(() => {
    const bounds = getImageBounds(scale.value, translateX.value, translateY.value);
    
    // Apply rotation compensation to make preview match final output
    const compensatedWidth = bounds.width * rotationCompensation;
    const compensatedHeight = bounds.height * rotationCompensation;
    const compensatedLeft = bounds.left - (compensatedWidth - bounds.width) / 2;
    const compensatedTop = bounds.top - (compensatedHeight - bounds.height) / 2;
    
    return {
      position: 'absolute' as const,
      left: compensatedLeft,
      top: compensatedTop,
      width: compensatedWidth,
      height: compensatedHeight,
      transform: [{ rotate: `${rotation}deg` }],
    };
  });

  // Image inside slot (full opacity, clipped, with rotation)
  const slotImageStyle = useAnimatedStyle(() => {
    const bounds = getImageBounds(scale.value, translateX.value, translateY.value);
    
    // Apply rotation compensation
    const compensatedWidth = bounds.width * rotationCompensation;
    const compensatedHeight = bounds.height * rotationCompensation;
    const compensatedLeft = (bounds.left - slotX) - (compensatedWidth - bounds.width) / 2;
    const compensatedTop = (bounds.top - slotY) - (compensatedHeight - bounds.height) / 2;
    
    return {
      position: 'absolute' as const,
      left: compensatedLeft,
      top: compensatedTop,
      width: compensatedWidth,
      height: compensatedHeight,
      transform: [{ rotate: `${rotation}deg` }],
    };
  });

  // Border around full image (follows compensated dimensions)
  const borderStyle = useAnimatedStyle(() => {
    const bounds = getImageBounds(scale.value, translateX.value, translateY.value);
    
    // Apply rotation compensation
    const compensatedWidth = bounds.width * rotationCompensation;
    const compensatedHeight = bounds.height * rotationCompensation;
    const compensatedLeft = bounds.left - (compensatedWidth - bounds.width) / 2;
    const compensatedTop = bounds.top - (compensatedHeight - bounds.height) / 2;
    
    return {
      position: 'absolute' as const,
      left: compensatedLeft - 2,
      top: compensatedTop - 2,
      width: compensatedWidth + 4,
      height: compensatedHeight + 4,
      transform: [{ rotate: `${rotation}deg` }],
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
            rotation={cropMode.rotation}
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
