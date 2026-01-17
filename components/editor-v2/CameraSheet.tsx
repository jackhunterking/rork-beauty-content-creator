/**
 * CameraSheet Component
 * 
 * Bottom sheet camera for quick photo capture without leaving the editor.
 * Shows camera preview with the canvas visible (dimmed) behind.
 */

import React, { useCallback, useRef, useState, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  X, 
  Zap, 
  ZapOff, 
  SwitchCamera,
  ImagePlus,
} from 'lucide-react-native';
import Colors from '@/constants/colors';

interface CameraSheetProps {
  /** Reference to bottom sheet */
  bottomSheetRef: React.RefObject<BottomSheet>;
  /** Label for the slot being captured */
  slotLabel: string;
  /** Called when a photo is captured or selected */
  onCapture: (uri: string, width: number, height: number) => void;
  /** Called when sheet is closed without capturing */
  onClose: () => void;
}

export function CameraSheet({
  bottomSheetRef,
  slotLabel,
  onCapture,
  onClose,
}: CameraSheetProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const snapPoints = useMemo(() => ['80%'], []);
  
  // Calculate camera container dimensions explicitly
  // Sheet is 80% of screen, minus header (~64px) and controls (~120px)
  const sheetContentHeight = screenHeight * 0.8;
  const headerHeight = 64;
  const controlsHeight = 120;
  const cameraHeight = sheetContentHeight - headerHeight - controlsHeight - insets.bottom - 32; // 32 for margins

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
      });

      if (photo) {
        onCapture(photo.uri, photo.width, photo.height);
        bottomSheetRef.current?.close();
      }
    } catch (error) {
      console.error('Failed to capture photo:', error);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, onCapture, bottomSheetRef]);

  const handlePickFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onCapture(asset.uri, asset.width, asset.height);
      bottomSheetRef.current?.close();
    }
  }, [onCapture, bottomSheetRef]);

  const toggleFlash = useCallback(() => {
    setFlashEnabled(prev => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    setCameraFacing(prev => prev === 'back' ? 'front' : 'back');
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.7}
      />
    ),
    []
  );

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      onClose();
      // Reset camera ready state when sheet closes
      setIsCameraReady(false);
    }
  }, [onClose]);

  // Permission not granted
  if (!permission?.granted) {
    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        onChange={handleSheetChange}
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.background}
      >
        <BottomSheetView style={styles.permissionContent}>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to take photos for your templates.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onChange={handleSheetChange}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.background}
    >
      <BottomSheetView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => bottomSheetRef.current?.close()}
          >
            <X size={24} color={Colors.light.surface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{slotLabel}</Text>
          <TouchableOpacity
            style={styles.flashButton}
            onPress={toggleFlash}
          >
            {flashEnabled ? (
              <Zap size={22} color={Colors.light.accent} />
            ) : (
              <ZapOff size={22} color={Colors.light.surface} />
            )}
          </TouchableOpacity>
        </View>

        {/* Camera Preview */}
        <View style={[styles.cameraContainer, { height: Math.max(cameraHeight, 200) }]}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={cameraFacing}
            enableTorch={flashEnabled && cameraFacing === 'back'}
            onCameraReady={() => setIsCameraReady(true)}
          />
          {!isCameraReady && (
            <View style={styles.cameraLoading}>
              <ActivityIndicator size="large" color={Colors.light.surface} />
              <Text style={styles.cameraLoadingText}>Starting camera...</Text>
            </View>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Library Button */}
          <TouchableOpacity
            style={styles.sideButton}
            onPress={handlePickFromLibrary}
          >
            <ImagePlus size={24} color={Colors.light.surface} />
          </TouchableOpacity>

          {/* Capture Button */}
          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCapture}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <ActivityIndicator size="small" color={Colors.light.text} />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>

          {/* Flip Camera Button */}
          <TouchableOpacity
            style={styles.sideButton}
            onPress={toggleCamera}
          >
            <SwitchCamera size={24} color={Colors.light.surface} />
          </TouchableOpacity>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: 40,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.surface,
  },
  flashButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraContainer: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  cameraLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  cameraLoadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 24,
    paddingHorizontal: 40,
  },
  sideButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: Colors.light.surface,
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.surface,
  },
  // Permission screen
  permissionContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.surface,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: Colors.light.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
});

export default CameraSheet;
