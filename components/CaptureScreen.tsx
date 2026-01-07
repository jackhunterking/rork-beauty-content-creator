import React, { useState, useCallback, useRef, useEffect } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { ImagePlus, ChevronLeft } from "lucide-react-native";
import Colors from "@/constants/colors";
import { FrameOverlay } from "@/components/FrameOverlay";
import { processImageForSlot } from "@/utils/imageProcessing";
import { ImageSlot } from "@/types";

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

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const processAndSetImage = useCallback(async (uri: string, width: number, height: number) => {
    if (!slot) return;
    
    setIsProcessing(true);
    try {
      const processed = await processImageForSlot(uri, width, height, slot);
      
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
  }, [slot]);

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
      await processAndSetImage(asset.uri, asset.width, asset.height);
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

  // Main capture UI - single unified structure
  return (
    <View style={styles.container}>
      {/* Background Layer - Camera always visible (FrameOverlay will black out around preview) */}
      <CameraView 
        ref={cameraRef} 
        style={StyleSheet.absoluteFillObject} 
        facing="back"
      />

      {/* Frame Overlay - handles both camera guide and preview display */}
      {/* When previewUri is set, the captured image displays inside the frame */}
      {/* The overlay becomes fully opaque to hide the camera behind it */}
      {slot && (
        <FrameOverlay 
          slot={slot} 
          label={`${title}: ${slot.width}x${slot.height}`}
          previewUri={previewUri || undefined}
        />
      )}

      {/* UI Controls Overlay */}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
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

      {/* Processing Overlay */}
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
    backgroundColor: Colors.light.text,
  },
  flex: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
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
