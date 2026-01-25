/**
 * Auto Quality View
 * Minimal UI for quality enhancement.
 * 
 * OPTIMIZED: Image preparation (resize + upload) happens here when user clicks Enhance,
 * NOT when the sheet opens. This makes sheet opening instant.
 */

import React, { useCallback, useState, useRef } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { captureRef } from 'react-native-view-shot';

import Colors from '@/constants/colors';
import { getGradientPoints } from '@/constants/gradients';
import { enhanceQuality, AIProcessingProgress } from '@/services/aiService';
import { uploadTempImage } from '@/domains/shared';
import { useTieredSubscription } from '@/hooks/usePremiumStatus';
import { captureEvent, POSTHOG_EVENTS } from '@/services/posthogService';
import type { MediaAsset } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = 380;
const IMAGE_WIDTH = SCREEN_WIDTH * 0.8;

// Max dimension for AI processing - 768px keeps processing fast (under 20s)
// Note: fal.ai creative-upscaler has a max of 4,194,304 pixels (2048×2048)
// We use 768 to keep processing fast and API costs low
const MAX_AI_DIMENSION = 768;

interface AutoQualityViewProps {
  /** Image URI for DISPLAY (local or remote - used for preview) */
  imageUri: string;
  /** Image URI for AI PROCESSING (full original image) - falls back to imageUri if not provided */
  aiImageUri?: string;
  imageSize: { width: number; height: number };
  /** Whether this image has already been enhanced with auto_quality */
  isAlreadyEnhanced?: boolean;
  /** Background info for transparent PNGs (from AI background replacement) */
  backgroundInfo?: MediaAsset['backgroundInfo'];
  onBack: () => void;
  onStartProcessing: () => void;
  onProgress: (progress: AIProcessingProgress) => void;
  getAbortSignal: () => AbortSignal | undefined;
}

/**
 * Prepare image for AI processing:
 * 1. Download if remote URL
 * 2. Resize if too large (keeps AI processing fast)
 * 3. Upload to cloud for AI service access
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

  // Step 1: Download if remote
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

  // Step 2: Resize if too large (keeps AI processing fast)
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

  // Step 3: Upload to cloud for AI service
  const cloudUrl = await uploadTempImage(localUri, `ai-enhance-${Date.now()}`);
  
  return cloudUrl;
}

export default function AutoQualityView({
  imageUri,
  aiImageUri,
  imageSize,
  isAlreadyEnhanced = false,
  backgroundInfo,
  onBack,
  onStartProcessing,
  onProgress,
  getAbortSignal,
}: AutoQualityViewProps) {
  const [isPreparing, setIsPreparing] = useState(false);
  
  // Tiered subscription for Studio-only AI features
  const { canUseAIStudio, requestAutoQuality, tier } = useTieredSubscription();
  
  // Ref for the hidden compositing view (used when backgroundInfo exists)
  const compositingViewRef = useRef<View>(null);
  
  // Use aiImageUri for AI processing (full original), fallback to imageUri
  const imageUriForAI = aiImageUri || imageUri;
  
  // Dimensions for the compositing view (matches AI processing max dimension)
  const compositingSize = (() => {
    const maxDim = Math.max(imageSize.width, imageSize.height);
    if (maxDim <= MAX_AI_DIMENSION) {
      return { width: imageSize.width, height: imageSize.height };
    }
    const ratio = MAX_AI_DIMENSION / maxDim;
    return {
      width: Math.round(imageSize.width * ratio),
      height: Math.round(imageSize.height * ratio),
    };
  })();
  
  // Render background for transparent PNGs (AI background replacement)
  const renderBackground = () => {
    if (!backgroundInfo) return null;
    
    if (backgroundInfo.type === 'solid' && backgroundInfo.solidColor) {
      return (
        <View 
          style={[styles.image, { backgroundColor: backgroundInfo.solidColor, position: 'absolute' }]} 
        />
      );
    }
    
    if (backgroundInfo.type === 'gradient' && backgroundInfo.gradient) {
      return (
        <LinearGradient
          colors={backgroundInfo.gradient.colors}
          {...getGradientPoints(backgroundInfo.gradient.direction)}
          style={[styles.image, { position: 'absolute' }]}
        />
      );
    }
    
    return null;
  };
  
  // Actual enhancement logic (called after tier check passes)
  const performEnhancement = useCallback(async () => {
    try {
      setIsPreparing(true);
      
      let imageToProcess = imageUriForAI;
      let sizeToProcess = imageSize;
      
      // If backgroundInfo exists, composite the image with its background first
      // This ensures Auto Quality works on what the user SEES, not the transparent PNG
      if (backgroundInfo && compositingViewRef.current) {
        console.log('[AutoQualityView] Compositing image with background before AI processing');
        onProgress({
          status: 'submitting',
          message: 'Compositing image...',
          progress: 5,
        });
        
        try {
          // Capture the compositing view (which renders background + image)
          // IMPORTANT: Use pixelRatio: 1 to avoid device scaling (3x on iPhone)
          // Otherwise the image becomes too large for the AI API (max 4,194,304 pixels)
          const compositedUri = await captureRef(compositingViewRef, {
            format: 'png',
            quality: 1,
            result: 'tmpfile',
            pixelRatio: 1, // Capture at actual size, not device pixel density
            width: compositingSize.width,  // Explicit size to ensure consistency
            height: compositingSize.height,
          });
          
          console.log('[AutoQualityView] Composited image created:', compositedUri);
          console.log('[AutoQualityView] Compositing size:', compositingSize);
          
          // Safety resize: ensure the captured image is within API limits
          // This handles edge cases where the capture might be larger than expected
          const resized = await ImageManipulator.manipulateAsync(
            compositedUri,
            [{ resize: { width: compositingSize.width, height: compositingSize.height } }],
            { compress: 0.9, format: ImageManipulator.SaveFormat.PNG }
          );
          
          console.log('[AutoQualityView] Resized composited image:', resized.uri);
          imageToProcess = resized.uri;
          sizeToProcess = compositingSize;
        } catch (captureError) {
          console.warn('[AutoQualityView] Failed to composite, falling back to original:', captureError);
          // Fall back to original image if compositing fails
        }
      }
      
      // Prepare image for AI (resize + upload) - this is the deferred work
      const cloudUrl = await prepareImageForAI(imageToProcess, sizeToProcess, onProgress);
      
      setIsPreparing(false);
      onStartProcessing();
      
      // Now send to AI for enhancement
      await enhanceQuality(cloudUrl, onProgress, getAbortSignal());
    } catch (error) {
      setIsPreparing(false);
      console.error('[AutoQualityView] Failed to prepare image:', error);
      onProgress({
        status: 'failed',
        message: 'Failed to prepare image',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [imageUriForAI, imageSize, onStartProcessing, onProgress, getAbortSignal, backgroundInfo, compositingSize]);

  // Handle enhance button - checks Studio tier first
  const handleEnhance = useCallback(async () => {
    if (isAlreadyEnhanced || isPreparing) return;
    
    // Track the AI generation attempt
    captureEvent(POSTHOG_EVENTS.AI_ENHANCEMENT_STARTED, {
      feature: 'auto_quality',
      current_tier: tier,
    });

    // Check if user has Studio access
    if (!canUseAIStudio) {
      console.log(`[AutoQualityView] User is ${tier} tier, showing Auto Quality paywall`);
      await requestAutoQuality();
      return;
    }

    // User has Studio access, proceed with enhancement
    await performEnhancement();
  }, [isAlreadyEnhanced, isPreparing, canUseAIStudio, tier, requestAutoQuality, performEnhancement]);

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
          <Text style={styles.title}>Auto Quality</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.imageContainer}>
          <View style={[styles.imageWrapper, isAlreadyEnhanced && styles.imageWrapperEnhanced]}>
            {/* Background color/gradient for transparent PNGs */}
            {renderBackground()}
            <ExpoImage
              source={{ uri: imageUri }}
              style={styles.image}
              contentFit="cover"
              transition={200}
            />
            {isAlreadyEnhanced && (
              <View style={styles.enhancedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                <Text style={styles.enhancedBadgeText}>Enhanced</Text>
              </View>
            )}
          </View>
          <Text style={styles.description}>
            {isAlreadyEnhanced
              ? 'AI enhancement already applied. Re-applying may reduce image quality. Capture a new photo to enhance again.'
              : 'Enhance resolution and sharpen details with AI'}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 16 }]}>
        <TouchableOpacity 
          style={[styles.button, (isAlreadyEnhanced || isPreparing) && styles.buttonDisabled]} 
          onPress={handleEnhance} 
          activeOpacity={(isAlreadyEnhanced || isPreparing) ? 1 : 0.8}
          disabled={isAlreadyEnhanced || isPreparing}
        >
          {isPreparing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons 
              name={isAlreadyEnhanced ? "checkmark-circle" : "sparkles"} 
              size={20} 
              color={isAlreadyEnhanced ? Colors.light.textSecondary : "#FFFFFF"} 
            />
          )}
          <Text style={[styles.buttonText, isAlreadyEnhanced && styles.buttonTextDisabled]}>
            {isPreparing 
              ? 'Preparing...' 
              : isAlreadyEnhanced 
                ? 'Enhancement Applied' 
                : 'Improve Quality With AI'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Hidden compositing view - renders background + image for capture */}
      {/* This is positioned off-screen but still renders so captureRef can capture it */}
      {backgroundInfo && (
        <View
          ref={compositingViewRef}
          style={{
            position: 'absolute',
            left: -9999, // Off-screen
            top: 0,
            width: compositingSize.width,
            height: compositingSize.height,
            overflow: 'hidden',
          }}
          collapsable={false} // Required for captureRef to work on Android
        >
          {/* Background */}
          {backgroundInfo.type === 'solid' && backgroundInfo.solidColor && (
            <View 
              style={{
                position: 'absolute',
                width: compositingSize.width,
                height: compositingSize.height,
                backgroundColor: backgroundInfo.solidColor,
              }} 
            />
          )}
          {backgroundInfo.type === 'gradient' && backgroundInfo.gradient && (
            <LinearGradient
              colors={backgroundInfo.gradient.colors}
              {...getGradientPoints(backgroundInfo.gradient.direction)}
              style={{
                position: 'absolute',
                width: compositingSize.width,
                height: compositingSize.height,
              }}
            />
          )}
          {/* Image on top */}
          <ExpoImage
            source={{ uri: imageUriForAI }}
            style={{
              width: compositingSize.width,
              height: compositingSize.height,
            }}
            contentFit="cover"
          />
        </View>
      )}
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
  imageContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  imageWrapper: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 2,
    borderColor: Colors.light.accent,
  },
  imageWrapperEnhanced: {
    borderColor: '#34C759', // Green to indicate success
  },
  image: {
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
  description: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 16,
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
