import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { ImagePlus, ChevronLeft, Zap, ZapOff, SwitchCamera, RefreshCw } from "lucide-react-native";
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import Colors from "@/constants/colors";
import { FrameOverlay } from "@/components/FrameOverlay";
import { 
  processImageForAdjustment,
  MIN_ADJUSTMENT_SCALE,
  MAX_ADJUSTMENT_SCALE,
  DEFAULT_ADJUSTMENTS,
} from "@/utils/imageProcessing";
import { ImageSlot, FramePositionInfo } from "@/types";
import { AvailableArea, calculateFrameForAvailableArea } from "@/utils/frameCalculator";
import { uploadCapturedImage } from "@/domains/shared";

const AnimatedImage = Animated.createAnimatedComponent(Image);

// UI element height constants
// These values must match the actual rendered heights of the UI components
const TOP_BAR_HEIGHT = 60; // Back button + title + padding
const BOTTOM_CONTROLS_HEIGHT = 140; // Capture button area + padding
const FRAME_VERTICAL_PADDING = 16; // Extra breathing room above/below frame

interface CapturedMedia {
  uri: string;
  width: number;
  height: number;
  adjustments: {
    translateX: number;
    translateY: number;
    scale: number;
  };
}

interface CaptureScreenProps {
  slot: ImageSlot | undefined;
  title: string;
  onContinue: (media: CapturedMedia) => void;
  onBack: () => void;
  /** Optional: Initial image from library picker (skips camera, goes straight to adjustment) */
  initialImage?: {
    uri: string;
    width: number;
    height: number;
  };
}

export function CaptureScreen({ slot, title, onContinue, onBack, initialImage }: CaptureScreenProps) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const isMountedRef = useRef(true);
  const isCapturingRef = useRef(false);
  
  // Store pending adjustments for retry
  const pendingUploadRef = useRef<{
    uri: string;
    adjustments: { translateX: number; translateY: number; scale: number };
  } | null>(null);
  
  // Get safe area insets for proper positioning
  const insets = useSafeAreaInsets();
  
  // Use reactive window dimensions to handle Dynamic Island and screen rotation
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // ============================================
  // Image Adjustment Gesture State
  // ============================================
  
  // Shared values for gestures
  const scale = useSharedValue(DEFAULT_ADJUSTMENTS.scale);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Context values for gesture start positions
  const startScale = useSharedValue(1);
  const startTranslateX = useSharedValue(0);
  const startTranslateY = useSharedValue(0);

  // Store callbacks in refs for stable references in worklets
  const onContinueRef = useRef(onContinue);
  useEffect(() => {
    onContinueRef.current = onContinue;
  }, [onContinue]);
  
  // Calculate the available area for the frame
  // This is the space between the top bar and bottom controls
  const availableArea: AvailableArea = useMemo(() => {
    // Top of available area: safe area top + top bar height + padding
    const top = insets.top + TOP_BAR_HEIGHT + FRAME_VERTICAL_PADDING;
    // Bottom of available area: screen height - safe area bottom - bottom controls - padding
    const bottom = screenHeight - insets.bottom - BOTTOM_CONTROLS_HEIGHT - FRAME_VERTICAL_PADDING;
    
    return {
      top,
      bottom,
      screenWidth: screenWidth,
      screenHeight: screenHeight,
      horizontalPadding: 16, // Small horizontal padding for aesthetics
    };
  }, [insets.top, insets.bottom, screenWidth, screenHeight]);

  // Calculate frame dimensions using slot and available area
  const frameDimensions = useMemo(() => {
    if (!slot) return { width: 0, height: 0, top: 0, left: 0 };
    return calculateFrameForAvailableArea(slot, availableArea);
  }, [slot, availableArea]);

  // Calculate base image size (fills frame at scale 1.0)
  const baseImageSize = useMemo(() => {
    if (!slot || imageSize.width === 0 || imageSize.height === 0) {
      return { width: 0, height: 0 };
    }

    const imageAspect = imageSize.width / imageSize.height;
    const frameAspect = frameDimensions.width / frameDimensions.height;

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
  }, [slot, imageSize, frameDimensions]);

  // Reset gesture values when a new image is captured
  useEffect(() => {
    if (previewUri) {
      scale.value = DEFAULT_ADJUSTMENTS.scale;
      translateX.value = 0;
      translateY.value = 0;
    }
  }, [previewUri]);

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

  // Pan gesture for repositioning
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

  // Pinch gesture for scaling
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

  // Animated styles for the preview image
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

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const processAndSetImage = useCallback(async (
    uri: string, 
    width: number, 
    height: number,
    useFramePosition: boolean = true
  ) => {
    if (!slot) return;
    
    setIsProcessing(true);
    try {
      // Calculate frame position for camera-aware cropping
      // This maps the frame overlay position to the actual sensor coordinates,
      // accounting for the zoom/crop difference between preview and captured image
      let framePosition: FramePositionInfo | undefined;
      
      if (useFramePosition) {
        const frame = calculateFrameForAvailableArea(slot, availableArea);
        framePosition = {
          // Frame position and dimensions on screen
          frameTop: frame.top,
          frameLeft: frame.left,
          frameWidth: frame.width,
          frameHeight: frame.height,
          // Screen dimensions for coordinate mapping
          screenWidth: availableArea.screenWidth,
          screenHeight: availableArea.screenHeight,
        };
      }
      
      // Process image for adjustment - keeps oversized for pan/zoom capability
      const processed = await processImageForAdjustment(
        uri, 
        width, 
        height, 
        slot.width, 
        slot.height,
        framePosition
      );
      
      if (isMountedRef.current) {
        setPreviewUri(processed.uri);
        setImageSize({ width: processed.width, height: processed.height });
      }
    } catch (error) {
      // Processing error - user will see empty preview
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [slot, availableArea]);

  // Handle initial image from library picker or existing image (passed via props)
  useEffect(() => {
    if (initialImage && slot && !previewUri) {
      // Process the library/existing image (no frame position since it wasn't taken through camera preview)
      processAndSetImage(initialImage.uri, initialImage.width, initialImage.height, false);
    }
  }, [initialImage, slot, processAndSetImage, previewUri]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturingRef.current || !slot) return;

    isCapturingRef.current = true;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
      });

      if (photo && isMountedRef.current) {
        await processAndSetImage(photo.uri, photo.width, photo.height);
      }
    } catch (error) {
      // Capture error - user can retry
    } finally {
      isCapturingRef.current = false;
    }
  }, [slot, processAndSetImage]);

  const handleImport = useCallback(async () => {
    if (!slot) return;
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      // Use center crop for library imports (no frame position)
      // since imported images weren't taken through the camera preview
      await processAndSetImage(asset.uri, asset.width, asset.height, false);
    }
  }, [slot, processAndSetImage]);

  const handleContinue = useCallback(async () => {
    if (!previewUri || !slot) return;
    
    // Convert pixel translation back to relative (-0.5 to 0.5) format
    const currentScale = scale.value;
    const scaledWidth = baseImageSize.width * currentScale;
    const scaledHeight = baseImageSize.height * currentScale;
    const excessWidth = Math.max(0, scaledWidth - frameDimensions.width);
    const excessHeight = Math.max(0, scaledHeight - frameDimensions.height);
    
    const relativeX = excessWidth > 0 ? translateX.value / excessWidth : 0;
    const relativeY = excessHeight > 0 ? translateY.value / excessHeight : 0;
    
    const adjustments = {
      translateX: relativeX,
      translateY: relativeY,
      scale: currentScale,
    };
    
    // Store for potential retry
    pendingUploadRef.current = { uri: previewUri, adjustments };
    
    // Clear any previous error
    setUploadError(null);
    setIsUploading(true);
    
    try {
      // Upload the image to Supabase immediately (cloud-first approach)
      // This returns a durable Supabase URL instead of a fragile iOS temp file URI
      const supabaseUrl = await uploadCapturedImage(previewUri, slot.layerId || 'slot');
      
      if (!isMountedRef.current) return;
      
      // Call onContinue with the Supabase URL instead of local URI
      onContinue({
        uri: supabaseUrl,
        width: imageSize.width,
        height: imageSize.height,
        adjustments,
      });
    } catch (error) {
      if (isMountedRef.current) {
        setUploadError(error instanceof Error ? error.message : 'Upload failed');
      }
    } finally {
      if (isMountedRef.current) {
        setIsUploading(false);
      }
    }
  }, [previewUri, imageSize, onContinue, baseImageSize, frameDimensions, scale, translateX, translateY, slot]);

  // Retry upload after failure
  const handleRetryUpload = useCallback(async () => {
    if (!pendingUploadRef.current || !slot) return;
    
    const { adjustments } = pendingUploadRef.current;
    
    setUploadError(null);
    setIsUploading(true);
    
    try {
      const supabaseUrl = await uploadCapturedImage(previewUri!, slot.layerId || 'slot');
      
      if (!isMountedRef.current) return;
      
      onContinue({
        uri: supabaseUrl,
        width: imageSize.width,
        height: imageSize.height,
        adjustments,
      });
    } catch (error) {
      if (isMountedRef.current) {
        setUploadError(error instanceof Error ? error.message : 'Upload failed');
      }
    } finally {
      if (isMountedRef.current) {
        setIsUploading(false);
      }
    }
  }, [previewUri, imageSize, onContinue, slot]);

  const handleRetake = useCallback(() => {
    setPreviewUri(null);
    setImageSize({ width: 0, height: 0 });
  }, []);

  // Back button always goes directly back to editor - no intermediate states
  const handleBackPress = useCallback(() => {
    onBack();
  }, [onBack]);

  const toggleFlash = useCallback(() => {
    setFlashEnabled(prev => !prev);
  }, []);

  const toggleCameraFacing = useCallback(() => {
    setCameraFacing(prev => prev === 'back' ? 'front' : 'back');
  }, []);

  // Permission not yet determined
  if (!permission) {
    return <View style={styles.container} />;
  }

  // Permission denied - show request UI
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.permissionContainer} edges={['top', 'bottom']}>
          <Text style={styles.permissionText}>Camera access is required</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // Main capture UI with proper z-index layering:
  // Layer 1 (bottom): Camera - zIndex 1
  // Layer 2 (middle): Frame Mask - zIndex 2
  // Layer 3 (top): UI Controls - zIndex 3
  return (
    <BottomSheetModalProvider>
    <View style={styles.container}>
      {/* LAYER 1: Camera (z-index: 1) - only renders when not in preview mode */}
      {!previewUri && (
        <View style={styles.cameraLayer}>
          <CameraView 
            ref={cameraRef} 
            style={StyleSheet.absoluteFillObject} 
            facing={cameraFacing}
            enableTorch={flashEnabled && cameraFacing === 'back'}
          />
        </View>
      )}

      {/* LAYER 2: Frame Mask Overlay (z-index: 2) */}
      {/* Black mask around the frame, with camera/preview visible inside */}
      {/* pointerEvents="none" when in preview mode to allow gestures to reach the image */}
      {slot && (
        <View style={styles.maskLayer} pointerEvents={previewUri ? "none" : "auto"}>
          {/* FrameOverlay shows the mask - we handle preview image separately for gestures */}
          <FrameOverlay 
            slot={slot} 
            label={previewUri ? undefined : `${title}: ${slot.width}x${slot.height}`}
            previewUri={undefined} // Never pass preview URI - we render it with gestures below
            availableArea={availableArea}
          />
        </View>
      )}

      {/* LAYER 2.5: Interactive Preview Image with Gestures */}
      {previewUri && slot && (
        <GestureHandlerRootView 
          style={[
            styles.previewImageContainer,
            {
              top: frameDimensions.top,
              left: frameDimensions.left,
              width: frameDimensions.width,
              height: frameDimensions.height,
            }
          ]}
        >
          <GestureDetector gesture={composedGesture}>
            <AnimatedImage
              source={{ uri: previewUri }}
              style={[styles.previewImage, imageAnimatedStyle]}
              contentFit="cover"
            />
          </GestureDetector>
          {/* Frame border overlay */}
          <View style={styles.previewFrameBorder} pointerEvents="none" />
        </GestureHandlerRootView>
      )}

      {/* LAYER 3: UI Controls (z-index: 3) - always on top */}
      {/* pointerEvents="box-none" allows touch events to pass through to layers below */}
      <SafeAreaView style={styles.controlsLayer} edges={['top', 'bottom']} pointerEvents="box-none">
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <ChevronLeft size={24} color={Colors.light.surface} />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          {previewUri ? (
            <View style={styles.spacer} />
          ) : (
            <TouchableOpacity style={styles.headerFlashButton} onPress={toggleFlash}>
              {flashEnabled ? (
                <Zap size={20} color={Colors.light.accent} />
              ) : (
                <ZapOff size={20} color={Colors.light.surface} />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Flexible space - pointerEvents="none" to not block gesture detection */}
        <View style={styles.flex} pointerEvents="none" />

        {/* Bottom Controls */}
        {previewUri ? (
          <View style={styles.previewActionsContainer}>
            {uploadError ? (
              // Upload error state with retry option
              <View style={styles.uploadErrorContainer}>
                <Text style={styles.uploadErrorText}>Upload failed</Text>
                <Text style={styles.uploadErrorDetail}>{uploadError}</Text>
                <View style={styles.previewActions}>
                  <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
                    <Text style={styles.retakeText}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.retryButton} 
                    onPress={handleRetryUpload}
                    disabled={isUploading}
                  >
                    <RefreshCw size={18} color={Colors.light.text} style={{ marginRight: 6 }} />
                    <Text style={styles.continueText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Normal preview state - Retake/Continue layout
              <>
                {/* Primary Actions Row - Retake and Continue */}
                <View style={styles.previewActions}>
                  <TouchableOpacity 
                    style={[styles.retakeButton, isUploading && styles.buttonDisabled]} 
                    onPress={handleRetake}
                    disabled={isUploading}
                  >
                    <Text style={styles.retakeText}>Retake</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.continueButton, isUploading && styles.buttonDisabled]}
                    onPress={handleContinue}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color={Colors.light.text} />
                    ) : (
                      <Text style={styles.continueText}>Continue</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={styles.captureControls}>
            <TouchableOpacity style={styles.importButton} onPress={handleImport}>
              <ImagePlus size={22} color={Colors.light.surface} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.flipCameraButton} onPress={toggleCameraFacing}>
              <SwitchCamera size={22} color={Colors.light.surface} />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {/* Processing Overlay - highest z-index */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
          <Text style={styles.processingText}>Processing image...</Text>
        </View>
      )}

    </View>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Black background so any gaps appear black
  },
  flex: {
    flex: 1,
  },
  // Layer 1: Camera at the bottom
  cameraLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  // Layer 2: Frame mask in the middle
  maskLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  // Layer 3: UI controls on top
  controlsLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.surface,
  },
  spacer: {
    width: 40,
  },
  headerFlashButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  importButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(60,60,60,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipCameraButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(60,60,60,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: Colors.light.surface,
  },
  captureButtonInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Colors.light.surface,
  },
  previewActionsContainer: {
    paddingBottom: 40,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  previewImageContainer: {
    position: 'absolute',
    zIndex: 2.5,
    overflow: 'hidden',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  previewImage: {
    position: 'absolute',
  },
  previewFrameBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 4,
  },
  retakeButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    alignItems: 'center',
  },
  retakeText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.surface,
  },
  continueButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    alignItems: 'center',
  },
  continueText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  uploadErrorContainer: {
    paddingHorizontal: 20,
  },
  uploadErrorText: {
    textAlign: 'center',
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  uploadErrorDetail: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    marginBottom: 16,
  },
  retryButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10, // Highest z-index for processing overlay
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.surface,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    color: Colors.light.surface,
    marginBottom: 20,
    textAlign: 'center',
  },
  permissionButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: Colors.light.accent,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
});

export default CaptureScreen;
