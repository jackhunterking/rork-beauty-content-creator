/**
 * Auto Quality View
 * 
 * Minimal UI for quality enhancement.
 * No user options - uses optimized defaults.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { enhanceQuality, AIProcessingProgress } from '@/services/aiService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AutoQualityViewProps {
  imageUri: string;
  imageSize: { width: number; height: number };
  onBack: () => void;
  onStartProcessing: () => void;
  onProgress: (progress: AIProcessingProgress) => void;
  getAbortSignal: () => AbortSignal | undefined;
}

export default function AutoQualityView({
  imageUri,
  imageSize,
  onBack,
  onStartProcessing,
  onProgress,
  getAbortSignal,
}: AutoQualityViewProps) {
  // Calculate preview dimensions
  const maxPreviewWidth = SCREEN_WIDTH - 48;
  const maxPreviewHeight = SCREEN_HEIGHT * 0.45;
  const aspectRatio = imageSize.width / imageSize.height;
  
  let previewWidth = maxPreviewWidth;
  let previewHeight = previewWidth / aspectRatio;
  
  if (previewHeight > maxPreviewHeight) {
    previewHeight = maxPreviewHeight;
    previewWidth = previewHeight * aspectRatio;
  }

  const handleEnhance = useCallback(async () => {
    onStartProcessing();
    
    await enhanceQuality(
      imageUri,
      onProgress,
      getAbortSignal()
    );
  }, [imageUri, onStartProcessing, onProgress, getAbortSignal]);

  return (
    <View style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Ultra Quality</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Full Image Preview */}
      <View style={styles.previewContainer}>
        <Image
          source={{ uri: imageUri }}
          style={[styles.preview, { width: previewWidth, height: previewHeight }]}
          resizeMode="cover"
        />
      </View>

      {/* Description */}
      <View style={styles.descriptionContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="sparkles" size={20} color={Colors.light.accent} />
        </View>
        <Text style={styles.description}>
          Enhance quality and sharpen your photo using AI upscaling technology
        </Text>
      </View>

      {/* Benefits */}
      <View style={styles.benefitsContainer}>
        <View style={styles.benefitRow}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.light.success} />
          <Text style={styles.benefitText}>2x resolution enhancement</Text>
        </View>
        <View style={styles.benefitRow}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.light.success} />
          <Text style={styles.benefitText}>Smart sharpening & detail recovery</Text>
        </View>
        <View style={styles.benefitRow}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.light.success} />
          <Text style={styles.benefitText}>Perfect for zoomed-in images</Text>
        </View>
      </View>

      {/* Enhance Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.enhanceButton}
          onPress={handleEnhance}
          activeOpacity={0.8}
        >
          <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          <Text style={styles.enhanceButtonText}>Enhance Now</Text>
        </TouchableOpacity>
        
        <Text style={styles.timeEstimate}>Usually takes 20-40 seconds</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  preview: {
    borderRadius: 14,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  descriptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.ai.lightBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  iconContainer: {
    marginRight: 12,
  },
  description: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },
  benefitsContainer: {
    marginBottom: 20,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  benefitText: {
    marginLeft: 10,
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  buttonContainer: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  enhanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.accent,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  enhanceButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  timeEstimate: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.light.textTertiary,
  },
});
