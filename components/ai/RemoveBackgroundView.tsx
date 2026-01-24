/**
 * Remove Background View
 * UI for background removal using BiRefNet V2.
 * 
 * OPTIMIZED: Image preparation happens when user clicks Remove,
 * NOT when the sheet opens. This makes sheet opening instant.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import Colors from '@/constants/colors';
import { removeBackground, AIProcessingProgress } from '@/services/aiService';
import { uploadTempImage } from '@/services/tempUploadService';
import { useTieredSubscription } from '@/hooks/usePremiumStatus';
import { captureEvent, POSTHOG_EVENTS } from '@/services/posthogService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Max dimension for AI processing
const MAX_AI_DIMENSION = 1024;

interface RemoveBackgroundViewProps {
  imageUri: string;
  imageSize: { width: number; height: number };
  /** Whether this image has already had background removed */
  isAlreadyEnhanced?: boolean;
  onBack: () => void;
  onStartProcessing: () => void;
  onProgress: (progress: AIProcessingProgress) => void;
  getAbortSignal: () => AbortSignal | undefined;
}

/**
 * Prepare image for AI processing (resize + upload)
 */
async function prepareImageForAI(
  imageUri: string,
  imageSize: { width: number; height: number },
  onProgress: (progress: AIProcessingProgress) => void
): Promise<string> {
  onProgress({
    status: 'submitting',
    message: 'Preparing image...',
    progress: 5,
  });

  let localUri = imageUri;
  const isRemote = imageUri.startsWith('http://') || imageUri.startsWith('https://');

  if (isRemote) {
    const localPath = `${FileSystem.cacheDirectory}ai_prep_${Date.now()}.webp`;
    const downloadResult = await FileSystem.downloadAsync(imageUri, localPath);
    localUri = downloadResult.uri;
  }

  onProgress({
    status: 'submitting',
    message: 'Optimizing for AI...',
    progress: 15,
  });

  const maxDim = Math.max(imageSize.width, imageSize.height);
  if (maxDim > MAX_AI_DIMENSION) {
    const resizeRatio = MAX_AI_DIMENSION / maxDim;
    const newWidth = Math.round(imageSize.width * resizeRatio);
    const newHeight = Math.round(imageSize.height * resizeRatio);

    const resized = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: newWidth, height: newHeight } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.WEBP }
    );
    localUri = resized.uri;
  }

  onProgress({
    status: 'submitting',
    message: 'Uploading to cloud...',
    progress: 25,
  });

  const cloudUrl = await uploadTempImage(localUri, `ai-remove-bg-${Date.now()}`);
  return cloudUrl;
}

export default function RemoveBackgroundView({
  imageUri,
  imageSize,
  isAlreadyEnhanced = false,
  onBack,
  onStartProcessing,
  onProgress,
  getAbortSignal,
}: RemoveBackgroundViewProps) {
  const [isPreparing, setIsPreparing] = useState(false);
  
  // Tiered subscription for Studio-only AI features
  const { canUseAIStudio, requestBGRemove, tier } = useTieredSubscription();
  
  const maxPreviewWidth = SCREEN_WIDTH - 48;
  const maxPreviewHeight = SCREEN_HEIGHT * 0.45;
  const aspectRatio = imageSize.width / imageSize.height;
  
  let previewWidth = maxPreviewWidth;
  let previewHeight = previewWidth / aspectRatio;
  
  if (previewHeight > maxPreviewHeight) {
    previewHeight = maxPreviewHeight;
    previewWidth = previewHeight * aspectRatio;
  }

  // Actual removal logic (called after tier check passes)
  const performRemoval = useCallback(async () => {
    try {
      setIsPreparing(true);
      const cloudUrl = await prepareImageForAI(imageUri, imageSize, onProgress);
      setIsPreparing(false);
      onStartProcessing();
      await removeBackground(cloudUrl, onProgress, getAbortSignal());
    } catch (error) {
      setIsPreparing(false);
      console.error('[RemoveBackgroundView] Failed to prepare image:', error);
      onProgress({
        status: 'failed',
        message: 'Failed to prepare image',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [imageUri, imageSize, onStartProcessing, onProgress, getAbortSignal]);

  // Handle remove button - checks Studio tier first
  const handleRemove = useCallback(async () => {
    if (isAlreadyEnhanced || isPreparing) return;
    
    // Track the AI generation attempt
    captureEvent(POSTHOG_EVENTS.AI_ENHANCEMENT_STARTED, {
      feature: 'remove_background',
      current_tier: tier,
    });

    // Check if user has Studio access
    if (!canUseAIStudio) {
      console.log(`[RemoveBackgroundView] User is ${tier} tier, showing BG Remove paywall`);
      await requestBGRemove();
      return;
    }

    // User has Studio access, proceed with removal
    await performRemoval();
  }, [isAlreadyEnhanced, isPreparing, canUseAIStudio, tier, requestBGRemove, performRemoval]);

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
          <View style={[
            styles.previewWrapper, 
            { width: previewWidth, height: previewHeight },
            isAlreadyEnhanced && styles.previewWrapperEnhanced
          ]}>
            <ExpoImage
              source={{ uri: imageUri }}
              style={styles.preview}
              contentFit="cover"
              transition={200}
            />
            {isAlreadyEnhanced && (
              <View style={styles.enhancedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                <Text style={styles.enhancedBadgeText}>Processed</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.light.textTertiary} />
          <Text style={styles.infoText}>
            {isAlreadyEnhanced
              ? 'Background has already been removed. Recapture or upload a new photo to process again.'
              : 'The result will have a transparent background (PNG)'}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 16 }]}>
        <TouchableOpacity 
          style={[styles.button, (isAlreadyEnhanced || isPreparing) && styles.buttonDisabled]} 
          onPress={handleRemove} 
          activeOpacity={(isAlreadyEnhanced || isPreparing) ? 1 : 0.8}
          disabled={isAlreadyEnhanced || isPreparing}
        >
          {isPreparing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons 
              name={isAlreadyEnhanced ? "checkmark-circle" : "cut-outline"} 
              size={20} 
              color={isAlreadyEnhanced ? Colors.light.textSecondary : "#FFFFFF"} 
            />
          )}
          <Text style={[styles.buttonText, isAlreadyEnhanced && styles.buttonTextDisabled]}>
            {isPreparing 
              ? 'Preparing...' 
              : isAlreadyEnhanced 
                ? 'Already Processed' 
                : 'Remove Background'}
          </Text>
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
  previewWrapperEnhanced: {
    borderColor: '#34C759', // Green to indicate success
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  enhancedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  enhancedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 4,
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
  buttonDisabled: {
    backgroundColor: Colors.light.surfaceSecondary,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  buttonTextDisabled: {
    color: Colors.light.textSecondary,
  },
});
