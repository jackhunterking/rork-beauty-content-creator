/**
 * Remove Background View
 * UI for background removal using BiRefNet V2.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';

import Colors from '@/constants/colors';
import { removeBackground, AIProcessingProgress } from '@/services/aiService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface RemoveBackgroundViewProps {
  imageUri: string;
  imageSize: { width: number; height: number };
  onBack: () => void;
  onStartProcessing: () => void;
  onProgress: (progress: AIProcessingProgress) => void;
  getAbortSignal: () => AbortSignal | undefined;
}

export default function RemoveBackgroundView({
  imageUri,
  imageSize,
  onBack,
  onStartProcessing,
  onProgress,
  getAbortSignal,
}: RemoveBackgroundViewProps) {
  const maxPreviewWidth = SCREEN_WIDTH - 48;
  const maxPreviewHeight = SCREEN_HEIGHT * 0.45;
  const aspectRatio = imageSize.width / imageSize.height;
  
  let previewWidth = maxPreviewWidth;
  let previewHeight = previewWidth / aspectRatio;
  
  if (previewHeight > maxPreviewHeight) {
    previewHeight = maxPreviewHeight;
    previewWidth = previewHeight * aspectRatio;
  }

  const handleRemove = useCallback(async () => {
    onStartProcessing();
    await removeBackground(imageUri, onProgress, getAbortSignal());
  }, [imageUri, onStartProcessing, onProgress, getAbortSignal]);

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="close" size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Remove Background</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.previewContainer}>
          <View style={[styles.previewWrapper, { width: previewWidth, height: previewHeight }]}>
            <ExpoImage
              source={{ uri: imageUri }}
              style={styles.preview}
              contentFit="cover"
              transition={200}
            />
          </View>
        </View>

        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.light.textTertiary} />
          <Text style={styles.infoText}>
            The result will have a transparent background (PNG)
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 16 }]}>
        <TouchableOpacity style={styles.button} onPress={handleRemove} activeOpacity={0.8}>
          <Ionicons name="cut-outline" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Remove Background</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.light.text,
  },
  placeholder: {
    width: 40,
  },
  previewContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  previewWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 2,
    borderColor: Colors.light.accent,
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  // STANDARD FOOTER - same across all AI views
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.light.background,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.text,
    borderRadius: 14,
    paddingVertical: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});
