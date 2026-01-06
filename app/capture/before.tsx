import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { ImagePlus, ChevronLeft } from "lucide-react-native";
import React, { useState, useCallback, useRef, useEffect } from "react";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

export default function BeforeScreen() {
  const router = useRouter();
  const { setBeforeMedia } = useApp();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
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

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturingRef.current) return;

    isCapturingRef.current = true;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
      });

      if (photo && isMountedRef.current) {
        setPreviewUri(photo.uri);
        setImageSize({ width: photo.width, height: photo.height });
        Toast.show({
          type: 'success',
          text1: 'Photo captured',
          text2: 'Review and continue',
          position: 'top',
          visibilityTime: 2000,
        });
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
  }, []);

  const handleImport = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPreviewUri(asset.uri);
      setImageSize({ width: asset.width, height: asset.height });
      Toast.show({
        type: 'success',
        text1: 'Photo imported',
        text2: 'Review and continue',
        position: 'top',
        visibilityTime: 2000,
      });
    }
  }, []);

  const handleContinue = useCallback(() => {
    if (previewUri) {
      setBeforeMedia({
        uri: previewUri,
        width: imageSize.width,
        height: imageSize.height,
      });
      router.push('/capture/after');
    }
  }, [previewUri, imageSize, setBeforeMedia, router]);

  const handleRetake = useCallback(() => {
    setPreviewUri(null);
  }, []);

  if (previewUri) {
    return (
      <View style={styles.container}>
        <Image
          source={{ uri: previewUri }}
          style={styles.fullPreview}
          contentFit="cover"
        />
        <SafeAreaView style={styles.previewOverlay} edges={['top', 'bottom']}>
          <View style={styles.previewTopBar}>
            <TouchableOpacity style={styles.backButton} onPress={handleRetake}>
              <ChevronLeft size={24} color={Colors.light.surface} />
            </TouchableOpacity>
            <View style={{ width: 40 }} />
          </View>
          
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!permission) {
    return <View style={styles.container} />;
  }

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

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ChevronLeft size={24} color={Colors.light.surface} />
            </TouchableOpacity>
            <Text style={styles.title}>Before</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.bottomControls}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleImport}>
              <ImagePlus size={22} color={Colors.light.surface} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            
            <View style={{ width: 48 }} />
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.text,
  },
  camera: {
    flex: 1,
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
    textAlign: 'center' as const,
  },
  permissionButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: Colors.light.accent,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  overlay: {
    flex: 1,
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
    fontWeight: '700' as const,
    color: Colors.light.surface,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  secondaryButton: {
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
  fullPreview: {
    flex: 1,
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  previewTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
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
    fontWeight: '600' as const,
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
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
});
