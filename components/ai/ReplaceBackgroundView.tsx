/**
 * Replace Background View
 * 
 * UI for background replacement with three input modes:
 * 1. Presets - Categorized background presets (studio, nature, professional, blur)
 * 2. Custom - Text input for custom background description
 * 3. Color - Solid color picker with presets and hex input
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';

import Colors from '@/constants/colors';
import type { BackgroundPreset, BackgroundPresetCategory } from '@/types';
import { COLOR_PRESETS } from '@/types/overlays';
import {
  fetchBackgroundPresetsDirect,
  replaceBackgroundWithPreset,
  replaceBackgroundWithPrompt,
  replaceBackgroundWithColor,
  AIProcessingProgress,
} from '@/services/aiService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Tab types
type InputMode = 'presets' | 'custom' | 'color';

// Fallback presets if database is empty (excluding solid colors)
const FALLBACK_PRESETS: BackgroundPreset[] = [
  { id: 'studio-white', name: 'Clean White', category: 'studio', previewColor: '#FFFFFF', isPremium: false, sortOrder: 1 },
  { id: 'studio-gray', name: 'Soft Gray', category: 'studio', previewColor: '#E5E5E5', isPremium: false, sortOrder: 2 },
  { id: 'studio-dark', name: 'Dark Studio', category: 'studio', previewColor: '#2C2C2C', isPremium: false, sortOrder: 3 },
  { id: 'nature-beach', name: 'Beach', category: 'nature', previewColor: '#87CEEB', isPremium: false, sortOrder: 7 },
  { id: 'nature-forest', name: 'Forest', category: 'nature', previewColor: '#228B22', isPremium: false, sortOrder: 8 },
  { id: 'pro-office', name: 'Modern Office', category: 'professional', previewColor: '#708090', isPremium: false, sortOrder: 9 },
  { id: 'pro-marble', name: 'Marble', category: 'professional', previewColor: '#F5F5F5', isPremium: false, sortOrder: 10 },
];

const CATEGORY_LABELS: Record<BackgroundPresetCategory, string> = {
  studio: 'Studio',
  solid: 'Solid Colors',
  nature: 'Nature',
  blur: 'Blur Effects',
  professional: 'Professional',
};

// Exclude 'solid' from preset categories - we have a dedicated Color tab
const CATEGORY_ORDER: BackgroundPresetCategory[] = ['studio', 'nature', 'professional', 'blur'];

// Preset colors for the color picker (reuse from overlays but add more background-friendly colors)
const BACKGROUND_COLOR_PRESETS: string[] = [
  '#FFFFFF',  // White
  '#F5F5F5',  // Off-white
  '#E5E5E5',  // Light gray
  '#000000',  // Black
  '#1A1A1A',  // Near black
  '#FDF5E6',  // Cream
  '#FFE4E1',  // Blush pink
  '#FFE4C4',  // Bisque
  '#FFDAB9',  // Peach
  '#87CEEB',  // Sky blue
  '#E6E6FA',  // Lavender
  '#9DC183',  // Sage
];

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
  // Input mode state
  const [activeTab, setActiveTab] = useState<InputMode>('presets');
  
  // Preset state
  const [presets, setPresets] = useState<BackgroundPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<BackgroundPreset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Custom prompt state
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Color state
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [hexInput, setHexInput] = useState('');
  
  // Calculate preview dimensions
  const maxPreviewWidth = SCREEN_WIDTH - 48;
  const maxPreviewHeight = 160;
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
        // Filter out solid colors - we have a dedicated tab for that
        const filteredData = data.filter(p => p.category !== 'solid');
        if (filteredData.length > 0) {
          setPresets(filteredData);
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
  const groupedPresets = useMemo(() => {
    const groups: Partial<Record<BackgroundPresetCategory, BackgroundPreset[]>> = {};
    for (const preset of presets) {
      const category = preset.category;
      if (category === 'solid') continue; // Skip solid colors
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category]!.push(preset);
    }
    return groups;
  }, [presets]);

  // Check if apply button should be enabled
  const canApply = useMemo(() => {
    switch (activeTab) {
      case 'presets':
        return selectedPreset !== null;
      case 'custom':
        return customPrompt.trim().length > 0;
      case 'color':
        return selectedColor !== null;
      default:
        return false;
    }
  }, [activeTab, selectedPreset, customPrompt, selectedColor]);

  // Handle apply
  const handleApply = useCallback(async () => {
    onStartProcessing();
    
    switch (activeTab) {
      case 'presets':
        if (selectedPreset) {
          await replaceBackgroundWithPreset(
            imageUri,
            selectedPreset.id,
            onProgress,
            getAbortSignal()
          );
        }
        break;
      case 'custom':
        if (customPrompt.trim()) {
          await replaceBackgroundWithPrompt(
            imageUri,
            customPrompt.trim(),
            onProgress,
            getAbortSignal()
          );
        }
        break;
      case 'color':
        if (selectedColor) {
          await replaceBackgroundWithColor(
            imageUri,
            selectedColor,
            onProgress,
            getAbortSignal()
          );
        }
        break;
    }
  }, [activeTab, selectedPreset, customPrompt, selectedColor, imageUri, onStartProcessing, onProgress, getAbortSignal]);

  // Handle preset selection
  const handlePresetSelect = useCallback((preset: BackgroundPreset) => {
    if (preset.isPremium && !isPremium) {
      return;
    }
    setSelectedPreset(preset);
  }, [isPremium]);

  // Handle color selection
  const handleColorSelect = useCallback((color: string) => {
    setSelectedColor(color);
    setHexInput(color);
  }, []);

  // Handle hex input change
  const handleHexInputChange = useCallback((text: string) => {
    // Clean and format hex
    let hex = text.replace(/[^a-fA-F0-9#]/g, '');
    if (!hex.startsWith('#')) {
      hex = '#' + hex;
    }
    hex = hex.slice(0, 7).toUpperCase();
    setHexInput(hex);
    
    // Validate and set color if valid
    if (/^#[A-F0-9]{6}$/i.test(hex)) {
      setSelectedColor(hex);
    }
  }, []);

  // Reset selection when changing tabs
  const handleTabChange = useCallback((tab: InputMode) => {
    setActiveTab(tab);
  }, []);

  // Render tab selector
  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {(['presets', 'custom', 'color'] as InputMode[]).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTab === tab && styles.tabActive]}
          onPress={() => handleTabChange(tab)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
            {tab === 'presets' ? 'Presets' : tab === 'custom' ? 'Custom' : 'Color'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Render presets tab content
  const renderPresetsContent = () => (
    <View style={styles.presetsContent}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.light.accent} />
        </View>
      ) : (
        CATEGORY_ORDER.map((category) => {
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
                      style={styles.presetItem}
                      onPress={() => handlePresetSelect(preset)}
                      activeOpacity={0.7}
                    >
                      {preset.previewUrl ? (
                        <ExpoImage
                          source={{ uri: preset.previewUrl }}
                          style={[styles.presetImage, isSelected && styles.presetImageSelected]}
                        />
                      ) : (
                        <View
                          style={[
                            styles.presetColor,
                            { backgroundColor: preset.previewColor },
                            isSelected && styles.presetColorSelected,
                          ]}
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
        })
      )}
    </View>
  );

  // Render custom prompt tab content
  const renderCustomContent = () => (
    <View style={styles.customContent}>
      <Text style={styles.inputLabel}>Describe your background</Text>
      <TextInput
        style={styles.promptInput}
        value={customPrompt}
        onChangeText={setCustomPrompt}
        placeholder="beach sunset with palm trees"
        placeholderTextColor={Colors.light.textTertiary}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        autoCapitalize="none"
        autoCorrect={false}
      />
      
      <View style={styles.tipsContainer}>
        <View style={styles.tipsHeader}>
          <Ionicons name="bulb-outline" size={16} color={Colors.light.accent} />
          <Text style={styles.tipsTitle}>Tips</Text>
        </View>
        <Text style={styles.tipText}>• Be specific about lighting and atmosphere</Text>
        <Text style={styles.tipText}>• Describe colors you want to see</Text>
        <Text style={styles.tipText}>• Example: "modern office with floor-to-ceiling windows"</Text>
      </View>
    </View>
  );

  // Render color picker tab content
  const renderColorContent = () => (
    <View style={styles.colorContent}>
      <Text style={styles.inputLabel}>Choose a solid color</Text>
      
      {/* Color presets row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.colorRow}
      >
        {BACKGROUND_COLOR_PRESETS.map((color) => {
          const isSelected = selectedColor === color;
          return (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorSwatch,
                { backgroundColor: color },
                isSelected && styles.colorSwatchSelected,
                color === '#FFFFFF' && styles.colorSwatchLight,
              ]}
              onPress={() => handleColorSelect(color)}
              activeOpacity={0.7}
            >
              {isSelected && (
                <Ionicons 
                  name="checkmark" 
                  size={18} 
                  color={color === '#FFFFFF' || color === '#F5F5F5' || color === '#E5E5E5' ? '#000000' : '#FFFFFF'} 
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      
      {/* Hex input */}
      <Text style={[styles.inputLabel, { marginTop: 20 }]}>Or enter a hex code</Text>
      <View style={styles.hexInputContainer}>
        <View 
          style={[
            styles.hexPreview, 
            { backgroundColor: selectedColor || '#CCCCCC' },
            (!selectedColor || selectedColor === '#FFFFFF') && styles.hexPreviewLight,
          ]} 
        />
        <TextInput
          style={styles.hexInput}
          value={hexInput}
          onChangeText={handleHexInputChange}
          placeholder="#FFFFFF"
          placeholderTextColor={Colors.light.textTertiary}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
        />
      </View>
      
      {/* Selected color preview */}
      {selectedColor && (
        <View style={styles.selectedColorPreview}>
          <View style={[styles.selectedColorBox, { backgroundColor: selectedColor }]} />
          <Text style={styles.selectedColorText}>Selected: {selectedColor}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Scrollable Content Area */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
          <View style={[styles.previewWrapper, { width: previewWidth, height: previewHeight }]}>
            <ExpoImage
              source={{ uri: imageUri }}
              style={styles.preview}
              contentFit="cover"
              transition={200}
            />
          </View>
        </View>

        {/* Tab Selector */}
        {renderTabs()}

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'presets' && renderPresetsContent()}
          {activeTab === 'custom' && renderCustomContent()}
          {activeTab === 'color' && renderColorContent()}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: 16 }]}>
        <TouchableOpacity
          style={[
            styles.applyButton,
            !canApply && styles.applyButtonDisabled,
          ]}
          onPress={handleApply}
          disabled={!canApply}
          activeOpacity={0.8}
        >
          <Ionicons name="image-outline" size={20} color="#FFFFFF" />
          <Text style={styles.applyButtonText}>Apply Background</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const PRESET_SIZE = 64;
const COLOR_SWATCH_SIZE = 44;

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
    marginVertical: 12,
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
  
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: Colors.light.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  tabTextActive: {
    color: Colors.light.accent,
  },
  
  // Tab content area
  tabContent: {
    minHeight: 100,
  },
  
  // Presets styles
  presetsContent: {
    // Same as customContent and colorContent - just a View container
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
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
  presetColor: {
    width: PRESET_SIZE,
    height: PRESET_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  presetColorSelected: {
    borderColor: Colors.light.accent,
    borderWidth: 3,
  },
  presetImage: {
    width: PRESET_SIZE,
    height: PRESET_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  presetImageSelected: {
    borderColor: Colors.light.accent,
    borderWidth: 3,
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
  
  // Custom prompt styles
  customContent: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  promptInput: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.light.text,
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  tipsContainer: {
    marginTop: 16,
    backgroundColor: Colors.light.ai.lightBg,
    borderRadius: 12,
    padding: 14,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.accent,
    marginLeft: 6,
  },
  tipText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  
  // Color picker styles
  colorContent: {
    flex: 1,
  },
  colorRow: {
    paddingVertical: 8,
  },
  colorSwatch: {
    width: COLOR_SWATCH_SIZE,
    height: COLOR_SWATCH_SIZE,
    borderRadius: COLOR_SWATCH_SIZE / 2,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: Colors.light.accent,
    borderWidth: 3,
  },
  colorSwatchLight: {
    borderColor: Colors.light.border,
  },
  hexInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  hexPreview: {
    width: 48,
    height: 48,
  },
  hexPreviewLight: {
    borderRightWidth: 1,
    borderRightColor: Colors.light.border,
  },
  hexInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Colors.light.text,
  },
  selectedColorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 10,
  },
  selectedColorBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  selectedColorText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.light.background,
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
});
