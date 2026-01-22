/**
 * Replace Background View
 * 
 * UI for background replacement with three input modes:
 * 1. Solid Colors - Exact hex color (uses birefnet + canvas composite)
 * 2. Gradient - Linear gradient (uses birefnet + canvas composite)
 * 3. Custom - AI-generated scene from text prompt (uses background_change model)
 * 
 * The Solid and Gradient modes guarantee pixel-perfect colors since they
 * use birefnet for background removal and client-side canvas compositing.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import Colors from '@/constants/colors';
import {
  replaceBackgroundWithPrompt,
  replaceBackgroundWithExactColor,
  replaceBackgroundWithGradient,
  AIProcessingProgress,
} from '@/services/aiService';
import { uploadTempImage } from '@/services/tempUploadService';
import { useTieredSubscription } from '@/hooks/usePremiumStatus';
import { captureEvent, POSTHOG_EVENTS } from '@/services/posthogService';
import { 
  GRADIENT_PRESETS, 
  GRADIENT_DIRECTIONS,
  DEFAULT_GRADIENT,
  getGradientPoints,
  createGradient,
} from '@/constants/gradients';
import { ColorPickerModal } from '@/components/editor-v2/ColorPickerModal';
import type { 
  BackgroundMode, 
  GradientConfig, 
  GradientDirection,
  GradientPreset 
} from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Max dimension for AI processing
const MAX_AI_DIMENSION = 1024;

// Color presets - organized in rows for visual appeal
const COLOR_PRESETS: string[] = [
  // Neutrals
  '#FFFFFF', '#F5F5F5', '#E0E0E0', '#9E9E9E', '#616161', '#212121', '#000000',
  // Warm colors
  '#FFEBEE', '#FFCDD2', '#EF9A9A', '#EF5350', '#E53935', '#C62828', '#B71C1C',
  // Cool colors
  '#E3F2FD', '#BBDEFB', '#90CAF9', '#42A5F5', '#1E88E5', '#1565C0', '#0D47A1',
  // Nature
  '#E8F5E9', '#C8E6C9', '#A5D6A7', '#66BB6A', '#43A047', '#2E7D32', '#1B5E20',
  // Pastels
  '#FDF5E6', '#FFE4E1', '#FFDAB9', '#E6E6FA', '#B0E0E6', '#F0FFF0',
];

// Hue spectrum for the rainbow bar
const HUE_COLORS = ['#FF0000', '#FF8000', '#FFFF00', '#80FF00', '#00FF00', '#00FF80', '#00FFFF', '#0080FF', '#0000FF', '#8000FF', '#FF00FF', '#FF0080', '#FF0000'];

/**
 * Helper to check if a color is light (for contrast)
 */
function isLightColor(color: string): boolean {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return true;
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 186;
}

/**
 * Validate hex color
 */
function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
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

  return await uploadTempImage(localUri, `ai-replace-bg-${Date.now()}`);
}

interface ReplaceBackgroundViewProps {
  imageUri: string;
  imageSize: { width: number; height: number };
  isPremium: boolean;
  isAlreadyEnhanced?: boolean;
  /** Cached transparent PNG URL from previous birefnet run - skip birefnet if available */
  transparentPngUrl?: string;
  /** Current background info for displaying in preview */
  currentBackgroundInfo?: {
    type: 'solid' | 'gradient';
    solidColor?: string;
    gradient?: GradientConfig;
  };
  onBack: () => void;
  onStartProcessing: () => void;
  onProgress: (progress: AIProcessingProgress) => void;
  getAbortSignal: () => AbortSignal | undefined;
}

export default function ReplaceBackgroundView({
  imageUri,
  imageSize,
  isPremium,
  isAlreadyEnhanced = false,
  transparentPngUrl: cachedTransparentPngUrl,
  currentBackgroundInfo,
  onBack,
  onStartProcessing,
  onProgress,
  getAbortSignal,
}: ReplaceBackgroundViewProps) {
  // Tiered subscription for Studio-only AI features
  const { canUseAIStudio, requestStudioAccess, tier } = useTieredSubscription();
  
  // Input mode state
  const [activeTab, setActiveTab] = useState<BackgroundMode>('solid');
  
  // Custom prompt state
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Color state
  const [selectedColor, setSelectedColor] = useState<string>('#FFFFFF');
  const [hexInput, setHexInput] = useState('#FFFFFF');
  
  // Gradient state
  const [selectedGradient, setSelectedGradient] = useState<GradientConfig>(DEFAULT_GRADIENT);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>('sunset'); // Track which preset is selected
  const [customGradientStart, setCustomGradientStart] = useState('#FF6B6B');
  const [customGradientEnd, setCustomGradientEnd] = useState('#4ECDC4');
  const [customGradientDirection, setCustomGradientDirection] = useState<GradientDirection>('vertical');
  const [showCustomGradient, setShowCustomGradient] = useState(false);
  
  // Color picker modal state for custom gradient
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [editingColorType, setEditingColorType] = useState<'start' | 'end'>('start');
  
  // Processing state
  const [isPreparing, setIsPreparing] = useState(false);
  
  // Calculate preview dimensions
  const maxPreviewWidth = SCREEN_WIDTH - 48;
  const maxPreviewHeight = 120;
  const aspectRatio = imageSize.width / imageSize.height;
  
  let previewWidth = maxPreviewWidth;
  let previewHeight = previewWidth / aspectRatio;
  
  if (previewHeight > maxPreviewHeight) {
    previewHeight = maxPreviewHeight;
    previewWidth = previewHeight * aspectRatio;
  }

  // Check if apply button should be enabled
  const canApply = useMemo(() => {
    if (isPreparing) return false;
    
    // Custom mode: always available as long as there's a prompt
    // Each custom prompt generates a unique background via AI
    if (activeTab === 'custom') {
      return customPrompt.trim().length > 0;
    }
    
    // Solid/Gradient modes: always allow (uses cached PNG if available - free!)
    return true;
  }, [activeTab, customPrompt, isPreparing]);


  // Actual apply logic (called after tier check passes)
  const performApply = useCallback(async () => {
    try {
      setIsPreparing(true);
      
      // Skip image preparation if we have a cached transparent PNG (for color changes)
      // Only solid/gradient modes can use the cache
      const hasCachedPng = cachedTransparentPngUrl && activeTab !== 'custom';
      
      let cloudUrl = '';
      if (!hasCachedPng) {
        cloudUrl = await prepareImageForAI(imageUri, imageSize, onProgress);
      }
      
      setIsPreparing(false);
      onStartProcessing();
      
      if (activeTab === 'custom') {
        // Use AI background replacement for custom prompts
        await replaceBackgroundWithPrompt(cloudUrl, customPrompt.trim(), onProgress, getAbortSignal());
      } else {
        // Use birefnet for solid/gradient - returns transparent PNG
        // The transparent PNG will be shown over the selected color in the comparison view
        
        let transparentPngUrl: string;
        
        // Check if we have a cached transparent PNG (from previous color change)
        if (cachedTransparentPngUrl) {
          console.log('[ReplaceBackgroundView] Using cached transparent PNG:', cachedTransparentPngUrl);
          console.log('[ReplaceBackgroundView] SKIPPING birefnet API call - cost saved!');
          
          transparentPngUrl = cachedTransparentPngUrl;
          
          // Show brief animation to give AI feedback feel
          onProgress({
            status: 'processing',
            message: 'Applying color...',
            progress: 30,
          });
          
          // Simulate brief processing for UX (color change is instant but we want AI feel)
          await new Promise(resolve => setTimeout(resolve, 400));
          
          onProgress({
            status: 'processing',
            message: 'Finalizing...',
            progress: 80,
          });
          
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          // Need to run birefnet to get transparent PNG
          console.log('[ReplaceBackgroundView] No cached PNG - calling birefnet API');
          
          onProgress({
            status: 'processing',
            message: 'Removing background...',
            progress: 30,
          });

          // Remove background - returns transparent PNG
          const removeResult = activeTab === 'solid'
            ? await replaceBackgroundWithExactColor(cloudUrl, onProgress, getAbortSignal())
            : await replaceBackgroundWithGradient(cloudUrl, onProgress, getAbortSignal());

          if (!removeResult.success || !removeResult.outputUrl) {
            throw new Error(removeResult.error || 'Background removal failed');
          }

          console.log('[ReplaceBackgroundView] Background removed, transparent PNG:', removeResult.outputUrl);
          transparentPngUrl = removeResult.outputUrl;
        }
        
        // Return the transparent PNG - the comparison view and editor will handle
        // displaying it over the selected background color
        // Note: We pass the selected color/gradient info for the comparison view
        onProgress({
          status: 'completed',
          message: 'Background replaced!',
          progress: 100,
          outputUrl: transparentPngUrl,
          // Pass background info for the comparison view to use
          backgroundInfo: {
            type: activeTab,
            solidColor: activeTab === 'solid' ? selectedColor : undefined,
            gradient: activeTab === 'gradient' ? selectedGradient : undefined,
          },
        });
      }
    } catch (error) {
      setIsPreparing(false);
      console.error('[ReplaceBackgroundView] Error:', error);
      onProgress({
        status: 'failed',
        message: 'Failed to process image',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [activeTab, customPrompt, selectedColor, selectedGradient, imageUri, imageSize, cachedTransparentPngUrl, onStartProcessing, onProgress, getAbortSignal]);

  // Handle apply button - checks Studio tier first
  const handleApply = useCallback(async () => {
    // Block if preparing
    if (isPreparing) return;
    
    // Track the AI generation attempt
    captureEvent(POSTHOG_EVENTS.AI_ENHANCEMENT_STARTED, {
      feature: 'replace_background',
      mode: activeTab,
      current_tier: tier,
    });

    // Check if user has Studio access
    if (!canUseAIStudio) {
      console.log(`[ReplaceBackgroundView] User is ${tier} tier, showing Studio paywall`);
      await requestStudioAccess(
        () => performApply(),
        'replace_background'
      );
      return;
    }

    // User has Studio access, proceed with apply
    await performApply();
  }, [isPreparing, activeTab, canUseAIStudio, tier, requestStudioAccess, performApply]);

  // Handle color selection from preset
  const handleColorSelect = useCallback((color: string) => {
    setSelectedColor(color);
    setHexInput(color);
  }, []);

  // Handle hex input change
  const handleHexInputChange = useCallback((text: string) => {
    // Clean and format input
    let hex = text.replace(/[^a-fA-F0-9#]/g, '');
    if (!hex.startsWith('#')) hex = '#' + hex;
    hex = hex.slice(0, 7).toUpperCase();
    setHexInput(hex);
    
    // Update color if valid
    if (isValidHex(hex)) {
      setSelectedColor(hex);
    }
  }, []);

  // Handle gradient preset selection
  const handleGradientSelect = useCallback((preset: GradientPreset) => {
    setSelectedGradient(preset.config);
    setSelectedPresetId(preset.id);
    setShowCustomGradient(false);
  }, []);

  // Handle custom gradient update
  const handleCustomGradientUpdate = useCallback(() => {
    setSelectedGradient(createGradient(customGradientStart, customGradientEnd, customGradientDirection));
    setSelectedPresetId(null); // Clear preset selection when using custom
  }, [customGradientStart, customGradientEnd, customGradientDirection]);

  // Handle color picker for custom gradient
  const handleOpenColorPicker = useCallback((type: 'start' | 'end') => {
    setEditingColorType(type);
    setColorPickerVisible(true);
  }, []);

  const handleColorPickerSelect = useCallback((color: string) => {
    if (editingColorType === 'start') {
      setCustomGradientStart(color);
    } else {
      setCustomGradientEnd(color);
    }
    setColorPickerVisible(false);
  }, [editingColorType]);

  // Update custom gradient when colors/direction change
  useEffect(() => {
    if (showCustomGradient) {
      handleCustomGradientUpdate();
    }
  }, [showCustomGradient, handleCustomGradientUpdate]);

  // Render tab selector
  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {(['solid', 'gradient', 'custom'] as BackgroundMode[]).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTab === tab && styles.tabActive]}
          onPress={() => setActiveTab(tab)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={
              tab === 'solid' ? 'color-fill-outline' : 
              tab === 'gradient' ? 'color-palette-outline' : 
              'text-outline'
            } 
            size={14} 
            color={activeTab === tab ? Colors.light.accent : Colors.light.textSecondary} 
          />
          <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
            {tab === 'solid' ? 'Solid' : tab === 'gradient' ? 'Gradient' : 'Custom'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Render custom prompt content
  const renderCustomContent = () => (
    <View style={styles.sectionContent}>
      <Text style={styles.inputLabel}>Describe your background</Text>
      <TextInput
        style={styles.promptInput}
        value={customPrompt}
        onChangeText={setCustomPrompt}
        placeholder="e.g., beach sunset with palm trees"
        placeholderTextColor={Colors.light.textTertiary}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />
      <View style={styles.tipsContainer}>
        <Ionicons name="bulb-outline" size={14} color={Colors.light.accent} />
        <Text style={styles.tipText}>Be specific about lighting, colors, and atmosphere</Text>
      </View>
    </View>
  );

  // Render solid color content with inline picker
  const renderSolidContent = () => (
    <View style={styles.sectionContent}>
      {/* Selected color preview */}
      <View style={styles.selectedColorContainer}>
        <View style={[styles.selectedColorPreview, { backgroundColor: selectedColor }]}>
          {isLightColor(selectedColor) && <View style={styles.selectedColorBorder} />}
        </View>
        <View style={styles.selectedColorInfo}>
          <Text style={styles.selectedColorLabel}>Selected Color</Text>
          <View style={styles.hexInputContainer}>
            <TextInput
              style={styles.hexInput}
              value={hexInput}
              onChangeText={handleHexInputChange}
              placeholder="#FFFFFF"
              placeholderTextColor={Colors.light.textTertiary}
              autoCapitalize="characters"
              maxLength={7}
            />
          </View>
        </View>
      </View>

      {/* Rainbow hue bar */}
      <View style={styles.hueBarContainer}>
        <LinearGradient
          colors={HUE_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.hueBar}
        />
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hueScrollContent}
        >
          {HUE_COLORS.slice(0, -1).map((color, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.hueTouchArea}
              onPress={() => handleColorSelect(color)}
              activeOpacity={0.7}
            />
          ))}
        </ScrollView>
      </View>

      {/* Color presets grid */}
      <Text style={styles.presetsLabel}>Presets</Text>
      <View style={styles.colorGrid}>
        {COLOR_PRESETS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorSwatch,
              { backgroundColor: color },
              selectedColor === color && styles.colorSwatchSelected,
            ]}
            onPress={() => handleColorSelect(color)}
            activeOpacity={0.7}
          >
            {selectedColor === color && (
              <Ionicons 
                name="checkmark" 
                size={16} 
                color={isLightColor(color) ? '#000' : '#FFF'} 
              />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Render gradient content
  const renderGradientContent = () => {
    const gradientPoints = getGradientPoints(selectedGradient.direction);
    const hasSelection = selectedPresetId !== null || showCustomGradient;
    
    return (
      <View style={styles.sectionContent}>
        {/* Selected gradient preview - only show when preset selected or custom active */}
        {hasSelection && (
          <View style={styles.selectedGradientContainer}>
            <LinearGradient
              colors={selectedGradient.colors}
              start={gradientPoints.start}
              end={gradientPoints.end}
              style={styles.selectedGradientPreview}
            />
            <View style={styles.selectedGradientInfo}>
              <Text style={styles.selectedColorLabel}>Selected Gradient</Text>
              <Text style={styles.gradientColors}>
                {selectedGradient.colors[0]} → {selectedGradient.colors[1]}
              </Text>
            </View>
          </View>
        )}

        {/* Gradient presets */}
        <Text style={styles.presetsLabel}>Presets</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gradientPresetsScroll}
        >
          {GRADIENT_PRESETS.map((preset) => {
            const points = getGradientPoints(preset.config.direction);
            const isSelected = selectedPresetId === preset.id && !showCustomGradient;
            
            return (
              <TouchableOpacity
                key={preset.id}
                style={styles.gradientPresetItem}
                onPress={() => handleGradientSelect(preset)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.gradientPresetSwatchWrapper,
                  isSelected && styles.gradientPresetSwatchWrapperSelected,
                ]}>
                  <LinearGradient
                    colors={preset.config.colors}
                    start={points.start}
                    end={points.end}
                    style={styles.gradientPresetSwatch}
                  />
                </View>
                <Text style={[
                  styles.gradientPresetName,
                  isSelected && styles.gradientPresetNameSelected,
                ]} numberOfLines={1}>
                  {preset.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Custom gradient toggle */}
        <TouchableOpacity
          style={[
            styles.customGradientToggle,
            showCustomGradient && styles.customGradientToggleActive,
          ]}
          onPress={() => setShowCustomGradient(!showCustomGradient)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={showCustomGradient ? 'chevron-up' : 'add-circle-outline'} 
            size={18} 
            color={Colors.light.accent} 
          />
          <Text style={styles.customGradientToggleText}>
            {showCustomGradient ? 'Hide Custom' : 'Create Custom Gradient'}
          </Text>
        </TouchableOpacity>

        {/* Custom gradient builder */}
        {showCustomGradient && (
          <View style={styles.customGradientBuilder}>
            <View style={styles.customGradientRow}>
              <View style={styles.customGradientColorInput}>
                <Text style={styles.customGradientLabel}>Start Color</Text>
                <TouchableOpacity 
                  style={styles.customGradientColorRow}
                  onPress={() => handleOpenColorPicker('start')}
                  activeOpacity={0.7}
                >
                  <View 
                    style={[
                      styles.customGradientColorPreview, 
                      { backgroundColor: customGradientStart }
                    ]} 
                  />
                  <View style={styles.customGradientHexDisplay}>
                    <Text style={styles.customGradientHexText}>{customGradientStart}</Text>
                    <Ionicons name="chevron-forward" size={14} color={Colors.light.textTertiary} />
                  </View>
                </TouchableOpacity>
              </View>
              <View style={styles.customGradientColorInput}>
                <Text style={styles.customGradientLabel}>End Color</Text>
                <TouchableOpacity 
                  style={styles.customGradientColorRow}
                  onPress={() => handleOpenColorPicker('end')}
                  activeOpacity={0.7}
                >
                  <View 
                    style={[
                      styles.customGradientColorPreview, 
                      { backgroundColor: customGradientEnd }
                    ]} 
                  />
                  <View style={styles.customGradientHexDisplay}>
                    <Text style={styles.customGradientHexText}>{customGradientEnd}</Text>
                    <Ionicons name="chevron-forward" size={14} color={Colors.light.textTertiary} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
            
            <Text style={styles.customGradientLabel}>Direction</Text>
            <View style={styles.directionButtons}>
              {GRADIENT_DIRECTIONS.map((dir) => (
                <TouchableOpacity
                  key={dir.value}
                  style={[
                    styles.directionButton,
                    customGradientDirection === dir.value && styles.directionButtonActive,
                  ]}
                  onPress={() => setCustomGradientDirection(dir.value)}
                  activeOpacity={0.7}
                >
                  <View style={dir.rotation ? { transform: [{ rotate: `${dir.rotation}deg` }] } : undefined}>
                    <Ionicons 
                      name={dir.icon as any} 
                      size={16} 
                      color={customGradientDirection === dir.value ? Colors.light.accent : Colors.light.textSecondary} 
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="close" size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Replace Background</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Image Preview - shows current image with background color if available */}
        <View style={styles.imagePreviewContainer}>
          <View style={[styles.imagePreviewWrapper, { width: previewWidth, height: previewHeight }]}>
            {/* Background color/gradient for transparent PNG */}
            {currentBackgroundInfo?.type === 'solid' && currentBackgroundInfo.solidColor && (
              <View style={[styles.imagePreview, { backgroundColor: currentBackgroundInfo.solidColor, position: 'absolute' }]} />
            )}
            {currentBackgroundInfo?.type === 'gradient' && currentBackgroundInfo.gradient && (
              <LinearGradient
                colors={currentBackgroundInfo.gradient.colors}
                {...getGradientPoints(currentBackgroundInfo.gradient.direction)}
                style={[styles.imagePreview, { position: 'absolute' }]}
              />
            )}
            <ExpoImage source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" transition={200} />
          </View>
        </View>

        {/* Tab Selector */}
        {renderTabs()}

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'solid' && renderSolidContent()}
          {activeTab === 'gradient' && renderGradientContent()}
          {activeTab === 'custom' && renderCustomContent()}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.applyButton, !canApply && styles.applyButtonDisabled]}
          onPress={handleApply}
          disabled={!canApply}
          activeOpacity={0.8}
        >
          {isPreparing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          )}
          <Text style={styles.applyButtonText}>
            {isPreparing ? 'Preparing...' : 'Apply Background'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Color Picker Modal for Custom Gradient */}
      <ColorPickerModal
        visible={colorPickerVisible}
        currentColor={editingColorType === 'start' ? customGradientStart : customGradientEnd}
        title={editingColorType === 'start' ? 'Start Color' : 'End Color'}
        onSelectColor={handleColorPickerSelect}
        onClose={() => setColorPickerVisible(false)}
      />
    </View>
  );
}

const SWATCH_SIZE = 40;
const SWATCHES_PER_ROW = 7;
const SWATCH_GAP = (SCREEN_WIDTH - 40 - (SWATCH_SIZE * SWATCHES_PER_ROW)) / (SWATCHES_PER_ROW - 1);

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  scrollView: { 
    flex: 1,
  },
  scrollContent: { 
    paddingHorizontal: 20, 
    paddingBottom: 140,
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
  
  // Image preview
  imagePreviewContainer: { 
    alignItems: 'center', 
    marginVertical: 12,
  },
  imagePreviewWrapper: { 
    borderRadius: 14, 
    overflow: 'hidden', 
    backgroundColor: Colors.light.surfaceSecondary, 
    borderWidth: 2, 
    borderColor: Colors.light.accent,
  },
  imagePreviewWrapperEnhanced: { 
    borderColor: '#34C759',
  },
  imagePreview: { 
    width: '100%', 
    height: '100%',
  },
  enhancedBadge: { 
    position: 'absolute', 
    top: 8, 
    right: 8, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#34C759', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 16,
  },
  enhancedBadgeText: { 
    fontSize: 11, 
    fontWeight: '600', 
    color: '#FFFFFF', 
    marginLeft: 3,
  },
  alreadyEnhancedMessage: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: Colors.light.surfaceSecondary, 
    borderRadius: 10, 
    padding: 12, 
    marginBottom: 16,
  },
  alreadyEnhancedText: { 
    flex: 1, 
    marginLeft: 8, 
    fontSize: 13, 
    color: Colors.light.textSecondary, 
    lineHeight: 18,
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
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 10, 
    borderRadius: 10, 
    gap: 4,
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
    fontSize: 13, 
    fontWeight: '600', 
    color: Colors.light.textSecondary,
  },
  tabTextActive: { 
    color: Colors.light.accent,
  },
  tabContent: { 
    minHeight: 200,
  },
  
  // Section content
  sectionContent: { 
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
    minHeight: 80, 
    borderWidth: 1, 
    borderColor: Colors.light.border,
  },
  tipsContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 12, 
    gap: 6,
  },
  tipText: { 
    fontSize: 12, 
    color: Colors.light.textSecondary,
  },
  
  // Selected color preview
  selectedColorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  selectedColorPreview: {
    width: 56,
    height: 56,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  selectedColorBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  selectedColorInfo: {
    flex: 1,
    marginLeft: 14,
  },
  selectedColorLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.textSecondary,
    marginBottom: 6,
  },
  hexInputContainer: {
    backgroundColor: Colors.light.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  hexInput: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Colors.light.text,
  },
  exactColorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  exactColorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34C759',
  },
  
  // Hue bar
  hueBarContainer: {
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  hueBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hueScrollContent: {
    flexDirection: 'row',
    flex: 1,
  },
  hueTouchArea: {
    flex: 1,
    height: 32,
  },
  
  // Color presets
  presetsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SWATCH_GAP,
  },
  colorSwatch: { 
    width: SWATCH_SIZE, 
    height: SWATCH_SIZE, 
    borderRadius: SWATCH_SIZE / 2, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 2, 
    borderColor: Colors.light.border,
  },
  colorSwatchSelected: { 
    borderColor: Colors.light.accent,
    borderWidth: 3,
  },
  
  // Gradient styles
  selectedGradientContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  selectedGradientPreview: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  selectedGradientInfo: {
    flex: 1,
    marginLeft: 14,
  },
  gradientColors: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Colors.light.text,
  },
  gradientPresetsScroll: {
    paddingVertical: 4,
    gap: 12,
  },
  gradientPresetItem: {
    alignItems: 'center',
    marginRight: 12,
  },
  gradientPresetSwatchWrapper: {
    padding: 3,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gradientPresetSwatchWrapperSelected: {
    borderColor: Colors.light.accent,
    backgroundColor: 'rgba(196, 164, 132, 0.1)',
  },
  gradientPresetSwatch: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  gradientPresetName: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.light.textSecondary,
    marginTop: 6,
    maxWidth: 70,
    textAlign: 'center',
  },
  gradientPresetNameSelected: {
    color: Colors.light.accent,
    fontWeight: '600',
  },
  customGradientToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 16,
    gap: 6,
    borderRadius: 10,
  },
  customGradientToggleActive: {
    backgroundColor: 'rgba(196, 164, 132, 0.1)',
  },
  customGradientToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.accent,
  },
  customGradientBuilder: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  customGradientRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  customGradientColorInput: {
    flex: 1,
  },
  customGradientLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  customGradientColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customGradientColorPreview: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  customGradientHexInput: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Colors.light.text,
  },
  customGradientHexDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  customGradientHexText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Colors.light.text,
  },
  directionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  directionButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionButtonActive: {
    borderColor: Colors.light.accent,
    backgroundColor: 'rgba(var(--accent-rgb), 0.1)',
  },
  
  // Footer
  footer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    paddingHorizontal: 20, 
    paddingTop: 12, 
    paddingBottom: 16, 
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
  applyButtonTextDisabled: { 
    color: Colors.light.textSecondary,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 4,
  },
  footerInfoText: {
    fontSize: 12,
    color: Colors.light.textTertiary,
  },
});
