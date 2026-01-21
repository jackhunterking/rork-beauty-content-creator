/**
 * Remove Background View
 * 
 * UI for background removal with mode selection.
 * Offers Portrait, Product, and Other modes.
 */

import React, { useState, useCallback } from 'react';
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
import { removeBackground, AIProcessingProgress } from '@/services/aiService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ModelType = 'General' | 'Portrait' | 'Product';

interface ModeOption {
  id: ModelType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    id: 'Portrait',
    label: 'Portrait',
    icon: 'person',
    description: 'People & faces',
  },
  {
    id: 'Product',
    label: 'Product',
    icon: 'cube-outline',
    description: 'Objects & items',
  },
  {
    id: 'General',
    label: 'Other',
    icon: 'apps-outline',
    description: 'General use',
  },
];

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
  const [selectedMode, setSelectedMode] = useState<ModelType>('Portrait');
  
  // Calculate preview dimensions
  const maxPreviewWidth = SCREEN_WIDTH - 48;
  const maxPreviewHeight = SCREEN_HEIGHT * 0.38;
  const aspectRatio = imageSize.width / imageSize.height;
  
  let previewWidth = maxPreviewWidth;
  let previewHeight = previewWidth / aspectRatio;
  
  if (previewHeight > maxPreviewHeight) {
    previewHeight = maxPreviewHeight;
    previewWidth = previewHeight * aspectRatio;
  }

  const handleRemove = useCallback(async () => {
    onStartProcessing();
    
    await removeBackground(
      imageUri,
      selectedMode,
      onProgress,
      getAbortSignal()
    );
  }, [imageUri, selectedMode, onStartProcessing, onProgress, getAbortSignal]);

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
        <Text style={styles.title}>Remove Background</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Image Preview with checkered pattern hint */}
      <View style={styles.previewContainer}>
        <View style={styles.previewWrapper}>
          <Image
            source={{ uri: imageUri }}
            style={[styles.preview, { width: previewWidth, height: previewHeight }]}
            resizeMode="cover"
          />
        </View>
      </View>

      {/* Mode Selection */}
      <View style={styles.modeSection}>
        <Text style={styles.modeLabel}>What's in your photo?</Text>
        
        <View style={styles.modeOptions}>
          {MODE_OPTIONS.map((mode) => (
            <TouchableOpacity
              key={mode.id}
              style={[
                styles.modeOption,
                selectedMode === mode.id && styles.modeOptionSelected,
              ]}
              onPress={() => setSelectedMode(mode.id)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.modeIconContainer,
                selectedMode === mode.id && styles.modeIconContainerSelected,
              ]}>
                <Ionicons
                  name={mode.icon}
                  size={22}
                  color={selectedMode === mode.id ? '#FFFFFF' : Colors.light.textSecondary}
                />
              </View>
              <Text style={[
                styles.modeTitle,
                selectedMode === mode.id && styles.modeTitleSelected,
              ]}>
                {mode.label}
              </Text>
              <Text style={styles.modeDescription}>{mode.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Info Note */}
      <View style={styles.infoContainer}>
        <Ionicons name="information-circle-outline" size={18} color={Colors.light.textTertiary} />
        <Text style={styles.infoText}>
          The result will have a transparent background (PNG)
        </Text>
      </View>

      {/* Remove Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={handleRemove}
          activeOpacity={0.8}
        >
          <Ionicons name="cut-outline" size={20} color="#FFFFFF" />
          <Text style={styles.removeButtonText}>Remove Background</Text>
        </TouchableOpacity>
        
        <Text style={styles.timeEstimate}>Usually takes 10-20 seconds</Text>
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
    alignItems: 'center',
    marginVertical: 16,
  },
  previewWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  preview: {
    borderRadius: 14,
  },
  modeSection: {
    marginBottom: 16,
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  modeOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modeOption: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  modeOptionSelected: {
    borderColor: Colors.light.accent,
    backgroundColor: Colors.light.ai.lightBg,
  },
  modeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  modeIconContainerSelected: {
    backgroundColor: Colors.light.accent,
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 2,
  },
  modeTitleSelected: {
    color: Colors.light.accent,
  },
  modeDescription: {
    fontSize: 11,
    color: Colors.light.textTertiary,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  buttonContainer: {
    alignItems: 'center',
    paddingBottom: 8,
    marginTop: 'auto',
  },
  removeButton: {
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
  removeButtonText: {
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
