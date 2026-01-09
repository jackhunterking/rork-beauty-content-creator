import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { ImagePlus, ChevronLeft } from "lucide-react-native";
import Colors from "@/constants/colors";
import { FrameOverlay } from "@/components/FrameOverlay";
import { processImageForDimensions } from "@/utils/imageProcessing";
import { ImageSlot, FramePositionInfo } from "@/types";
import { AvailableArea, calculateFrameForAvailableArea } from "@/utils/frameCalculator";

// UI element height constants
// These values must match the actual rendered heights of the UI components
const TOP_BAR_HEIGHT = 60; // Back button + title + padding
const BOTTOM_CONTROLS_HEIGHT = 140; // Capture button area + padding
const FRAME_VERTICAL_PADDING = 16; // Extra breathing room above/below frame

interface CapturedMedia {
  uri: string;
  width: number;
  height: number;
}

interface CaptureScreenProps {
  slot: ImageSlot | undefined;
  title: string;
  onContinue: (media: CapturedMedia) => void;
  onBack: () => void;
}

export function CaptureScreen({ slot, title, onContinue, onBack }: CaptureScreenProps) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const isMountedRef = useRef(true);
  const isCapturingRef = useRef(false);
  
  // Get safe area insets for proper positioning
  const insets = useSafeAreaInsets();
  
  // Use reactive window dimensions to handle Dynamic Island and screen rotation
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  
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
      
      const processed = await processImageForDimensions(
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
        Toast.show({
          type: 'success',
          text1: 'Photo captured',
          text2: `Cropped to ${processed.width}x${processed.height}`,
          position: 'top',
          visibilityTime: 2000,
        });
      }
    } catch (error) {
      console.error('Failed to process image:', error);
      if (isMountedRef.current) {
        Toast.show({
          type: 'error',
          text1: 'Processing failed',
          text2: 'Please try again',
          position: 'top',
          visibilityTime: 2000,
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [slot, availableArea]);

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
      console.error('Failed to take picture:', error);
      if (isMountedRef.current) {
        Toast.show({
          type: 'error',
          text1: 'Capture failed',
          text2: 'Please try again',
          position: 'top',
          visibilityTime: 2000,
        });
      }
    } finally {
      isCapturingRef.current = false;
    }
  }, [slot, processAndSetImage]);

  const handleImport = useCallback(async () => {
    if (!slot) return;
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  const handleContinue = useCallback(() => {
    if (previewUri) {
      onContinue({
        uri: previewUri,
        width: imageSize.width,
        height: imageSize.height,
      });
    }
  }, [previewUri, imageSize, onContinue]);

  const handleRetake = useCallback(() => {
    setPreviewUri(null);
    setImageSize({ width: 0, height: 0 });
  }, []);

  const handleBackPress = useCallback(() => {
    if (previewUri) {
      handleRetake();
    } else {
      onBack();
    }
  }, [previewUri, handleRetake, onBack]);

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
    <View style={styles.container}>
      {/* LAYER 1: Camera (z-index: 1) - only renders when not in preview mode */}
      {!previewUri && (
        <View style={styles.cameraLayer}>
          <CameraView 
            ref={cameraRef} 
            style={StyleSheet.absoluteFillObject} 
            facing="back"
          />
        </View>
      )}

      {/* LAYER 2: Frame Mask Overlay (z-index: 2) */}
      {/* Black mask around the frame, with camera/preview visible inside */}
      {slot && (
        <View style={styles.maskLayer}>
          <FrameOverlay 
            slot={slot} 
            label={`${title}: ${slot.width}x${slot.height}`}
            previewUri={previewUri || undefined}
            availableArea={availableArea}
          />
        </View>
      )}

      {/* LAYER 3: UI Controls (z-index: 3) - always on top */}
      <SafeAreaView style={styles.controlsLayer} edges={['top', 'bottom']}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <ChevronLeft size={24} color={Colors.light.surface} />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          {previewUri ? (
            <View style={styles.dimensionBadge}>
              <Text style={styles.dimensionText}>{imageSize.width}x{imageSize.height}</Text>
            </View>
          ) : (
            <View style={styles.spacer} />
          )}
        </View>

        {/* Flexible space */}
        <View style={styles.flex} />

        {/* Bottom Controls */}
        {previewUri ? (
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueText}>Continue</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.captureControls}>
            <TouchableOpacity style={styles.importButton} onPress={handleImport}>
              <ImagePlus size={22} color={Colors.light.surface} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            
            <View style={styles.spacerLarge} />
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
  spacerLarge: {
    width: 50,
  },
  dimensionBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dimensionText: {
    color: Colors.light.surface,
    fontSize: 12,
    fontWeight: '600',
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
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 40,
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
