/**
 * Replace Background View
 * 
 * UI for background replacement with preset categories.
 * Shows categorized preset grid for easy selection.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import type { BackgroundPreset, BackgroundPresetCategory } from '@/types';
import {
  fetchBackgroundPresetsDirect,
  replaceBackgroundWithPreset,
  AIProcessingProgress,
} from '@/services/aiService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Fallback presets if database is empty
const FALLBACK_PRESETS: BackgroundPreset[] = [
  { id: 'studio-white', name: 'Clean White', category: 'studio', previewColor: '#FFFFFF', isPremium: false, sortOrder: 1 },
  { id: 'studio-gray', name: 'Soft Gray', category: 'studio', previewColor: '#E5E5E5', isPremium: false, sortOrder: 2 },
  { id: 'studio-dark', name: 'Dark Studio', category: 'studio', previewColor: '#2C2C2C', isPremium: false, sortOrder: 3 },
  { id: 'solid-cream', name: 'Cream', category: 'solid', previewColor: '#FDF5E6', isPremium: false, sortOrder: 4 },
  { id: 'solid-blush', name: 'Blush', category: 'solid', previewColor: '#FFE4E1', isPremium: false, sortOrder: 5 },
  { id: 'solid-sage', name: 'Sage', category: 'solid', previewColor: '#9DC183', isPremium: false, sortOrder: 6 },
  { id: 'nature-beach', name: 'Beach', category: 'nature', previewColor: '#87CEEB', isPremium: true, sortOrder: 7 },
  { id: 'nature-forest', name: 'Forest', category: 'nature', previewColor: '#228B22', isPremium: true, sortOrder: 8 },
  { id: 'pro-office', name: 'Modern Office', category: 'professional', previewColor: '#708090', isPremium: true, sortOrder: 9 },
  { id: 'pro-marble', name: 'Marble', category: 'professional', previewColor: '#F5F5F5', isPremium: true, sortOrder: 10 },
];

const CATEGORY_LABELS: Record<BackgroundPresetCategory, string> = {
  studio: 'Studio',
  solid: 'Solid Colors',
  nature: 'Nature',
  blur: 'Blur Effects',
  professional: 'Professional',
};

const CATEGORY_ORDER: BackgroundPresetCategory[] = ['studio', 'solid', 'nature', 'professional', 'blur'];

interface ReplaceBackgroundViewProps {
  imageUri: string;
  imageSize: { width: number; height: number };
  isPremium: boolean;
  onBack: () => void;
  onStartProcessing: () => void;
  onProgress: (progress: AIProcessingProgress) => void;
  getAbortSignal: () => AbortSignal | undefined;
}

export default function ReplaceBackgroundView({
  imageUri,
  imageSize,
  isPremium,
  onBack,
  onStartProcessing,
  onProgress,
  getAbortSignal,
}: ReplaceBackgroundViewProps) {
  const [presets, setPresets] = useState<BackgroundPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<BackgroundPreset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Calculate preview dimensions
  const maxPreviewWidth = SCREEN_WIDTH - 48;
  const maxPreviewHeight = 180;
  const aspectRatio = imageSize.width / imageSize.height;
  
  let previewWidth = maxPreviewWidth;
  let previewHeight = previewWidth / aspectRatio;
  
  if (previewHeight > maxPreviewHeight) {
    previewHeight = maxPreviewHeight;
    previewWidth = previewHeight * aspectRatio;
  }

  // Load presets
  useEffect(() => {
    async function loadPresets() {
      try {
        const data = await fetchBackgroundPresetsDirect();
        if (data.length > 0) {
          setPresets(data);
        } else {
          setPresets(FALLBACK_PRESETS);
        }
      } catch (error) {
        console.error('Failed to load presets:', error);
        setPresets(FALLBACK_PRESETS);
      } finally {
        setIsLoading(false);
      }
    }
    loadPresets();
  }, []);

  // Group presets by category
  const groupedPresets = React.useMemo(() => {
    const groups: Partial<Record<BackgroundPresetCategory, BackgroundPreset[]>> = {};
    for (const preset of presets) {
      const category = preset.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category]!.push(preset);
    }
    return groups;
  }, [presets]);

  const handleReplace = useCallback(async () => {
    if (!selectedPreset) return;
    
    onStartProcessing();
    
    await replaceBackgroundWithPreset(
      imageUri,
      selectedPreset.id,
      onProgress,
      getAbortSignal()
    );
  }, [imageUri, selectedPreset, onStartProcessing, onProgress, getAbortSignal]);

  const handlePresetSelect = useCallback((preset: BackgroundPreset) => {
    // Check if locked (premium preset, non-premium user)
    if (preset.isPremium && !isPremium) {
      // Could show upgrade prompt here
      return;
    }
    setSelectedPreset(preset);
  }, [isPremium]);

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
        <Text style={styles.title}>Replace Background</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Image Preview */}
      <View style={styles.previewContainer}>
        <Image
          source={{ uri: imageUri }}
          style={[styles.preview, { width: previewWidth, height: previewHeight }]}
          resizeMode="cover"
        />
        {selectedPreset && (
          <View style={styles.selectedIndicator}>
            <View style={[styles.presetColorDot, { backgroundColor: selectedPreset.previewColor }]} />
            <Text style={styles.selectedPresetName}>{selectedPreset.name}</Text>
          </View>
        )}
      </View>

      {/* Preset Grid */}
      <View style={styles.presetsSection}>
        <Text style={styles.sectionLabel}>Choose a background</Text>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.light.accent} />
          </View>
        ) : (
          <ScrollView
            style={styles.presetsScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.presetsScrollContent}
          >
            {CATEGORY_ORDER.map((category) => {
              const categoryPresets = groupedPresets[category];
              if (!categoryPresets || categoryPresets.length === 0) return null;
              
              return (
                <View key={category} style={styles.categorySection}>
                  <Text style={styles.categoryLabel}>{CATEGORY_LABELS[category]}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.presetRow}
                  >
                    {categoryPresets.map((preset) => {
                      const isSelected = selectedPreset?.id === preset.id;
                      const isLocked = preset.isPremium && !isPremium;
                      
                      return (
                        <TouchableOpacity
                          key={preset.id}
                          style={[
                            styles.presetItem,
                            isSelected && styles.presetItemSelected,
                          ]}
                          onPress={() => handlePresetSelect(preset)}
                          activeOpacity={0.7}
                        >
                          {preset.previewUrl ? (
                            <Image
                              source={{ uri: preset.previewUrl }}
                              style={styles.presetImage}
                            />
                          ) : (
                            <View
                              style={[styles.presetColor, { backgroundColor: preset.previewColor }]}
                            />
                          )}
                          {isSelected && (
                            <View style={styles.selectedCheck}>
                              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                            </View>
                          )}
                          {isLocked && (
                            <View style={styles.lockedOverlay}>
                              <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
                            </View>
                          )}
                          <Text
                            style={[styles.presetName, isLocked && styles.presetNameLocked]}
                            numberOfLines={1}
                          >
                            {preset.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Apply Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.applyButton,
            !selectedPreset && styles.applyButtonDisabled,
          ]}
          onPress={handleReplace}
          disabled={!selectedPreset}
          activeOpacity={0.8}
        >
          <Ionicons name="image-outline" size={20} color="#FFFFFF" />
          <Text style={styles.applyButtonText}>Apply Background</Text>
        </TouchableOpacity>
        
        <Text style={styles.timeEstimate}>Usually takes 20-40 seconds</Text>
      </View>
    </View>
  );
}

const PRESET_SIZE = 64;

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
    marginVertical: 12,
  },
  preview: {
    borderRadius: 14,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  selectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.light.ai.lightBg,
    borderRadius: 20,
  },
  presetColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  selectedPresetName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.accent,
  },
  presetsSection: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetsScroll: {
    flex: 1,
  },
  presetsScrollContent: {
    paddingBottom: 16,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  presetRow: {
    paddingRight: 20,
  },
  presetItem: {
    width: PRESET_SIZE + 16,
    alignItems: 'center',
    marginRight: 8,
  },
  presetItemSelected: {
    // No visual change on container
  },
  presetColor: {
    width: PRESET_SIZE,
    height: PRESET_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  presetImage: {
    width: PRESET_SIZE,
    height: PRESET_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  selectedCheck: {
    position: 'absolute',
    top: 0,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 8,
    width: PRESET_SIZE,
    height: PRESET_SIZE,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetName: {
    marginTop: 4,
    fontSize: 11,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  presetNameLocked: {
    color: Colors.light.textTertiary,
  },
  buttonContainer: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  applyButton: {
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
  applyButtonDisabled: {
    backgroundColor: Colors.light.border,
    shadowOpacity: 0,
  },
  applyButtonText: {
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
