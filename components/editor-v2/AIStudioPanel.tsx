/**
 * AIStudioPanel Component
 * 
 * Unified AI Studio bottom sheet panel accessible from:
 * 1. Main toolbar (can browse features, prompts for image when selecting)
 * 2. Photo context bar (image already selected)
 * 
 * Features:
 * - Horizontal scrollable feature tabs (Magic Studio style)
 * - Inline expandable options (presets for BG Replacer)
 * - Minimal design with brand-aligned colors
 * - No-image prompt with "Choose Photo" action
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
} from 'react-native-reanimated';
import {
  Sparkles,
  X,
  Camera,
  AlertCircle,
  Check,
  RefreshCw,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { fetchAIConfig } from '@/services/aiService';
import { AIStudioFeatureTab } from './AIStudioFeatureTab';
import type { AIFeatureKey, AIModelConfig } from '@/types';

interface AIStudioPanelProps {
  /** Reference to bottom sheet */
  bottomSheetRef: React.RefObject<BottomSheet>;
  /** Whether user has premium access */
  isPremium: boolean;
  /** Currently selected slot ID (null if no image selected) */
  selectedSlotId: string | null;
  /** Whether an enhancement is being processed */
  isProcessing: boolean;
  /** Currently processing enhancement type */
  processingType: AIFeatureKey | null;
  /** Called when an enhancement should be applied */
  onApplyEnhancement: (featureKey: AIFeatureKey, presetId?: string) => void;
  /** Called to request premium access */
  onRequestPremium: (feature: string) => void;
  /** Called when panel is closed */
  onClose: () => void;
  /** Called to prompt user to select a photo */
  onSelectPhoto?: () => void;
}

export function AIStudioPanel({
  bottomSheetRef,
  isPremium,
  selectedSlotId,
  isProcessing,
  processingType,
  onApplyEnhancement,
  onRequestPremium,
  onClose,
  onSelectPhoto,
}: AIStudioPanelProps) {
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['55%', '80%'], []);
  
  // Feature config state
  const [features, setFeatures] = useState<AIModelConfig[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  
  // UI state
  const [selectedFeature, setSelectedFeature] = useState<AIFeatureKey | null>(null);
  
  // Calculate bottom padding with safe area
  const bottomPadding = Math.max(insets.bottom, 20) + 16;

  // Load AI config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoadingConfig(true);
    setConfigError(null);
    try {
      const config = await fetchAIConfig();
      setFeatures(config);
    } catch (error: any) {
      console.error('[AIStudioPanel] Config load error:', error);
      setConfigError(error.message || 'Failed to load AI features');
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    await loadConfig();
  }, []);

  // Handle feature tab press
  const handleFeaturePress = useCallback((featureKey: AIFeatureKey) => {
    const feature = features.find(f => f.featureKey === featureKey);
    
    // Check premium access
    if (feature?.isPremiumOnly && !isPremium) {
      onRequestPremium(`ai_${featureKey}`);
      return;
    }
    
    // Toggle selection
    if (selectedFeature === featureKey) {
      setSelectedFeature(null);
      setSelectedPresetId(null);
    } else {
      setSelectedFeature(featureKey);
      setSelectedPresetId(null);
    }
  }, [features, isPremium, selectedFeature, onRequestPremium]);


  // Handle apply action
  const handleApply = useCallback(() => {
    if (!selectedFeature) return;
    
    // Check if image is selected
    if (!selectedSlotId) {
      Alert.alert(
        'Select a Photo',
        'Please select a photo first to apply AI enhancements.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Choose Photo', 
            onPress: () => {
              onClose();
              onSelectPhoto?.();
            }
          },
        ]
      );
      return;
    }
    
    // Apply the enhancement
    onApplyEnhancement(selectedFeature, undefined);
  }, [selectedFeature, selectedSlotId, onApplyEnhancement, onClose, onSelectPhoto]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  const hasImageSelected = selectedSlotId !== null;
  const selectedFeatureConfig = features.find(f => f.featureKey === selectedFeature);
  const canApply = selectedFeature !== null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.background}
      onChange={(index) => {
        if (index === -1) {
          // Reset state when closed
          setSelectedFeature(null);
          setSelectedPresetId(null);
        }
      }}
    >
      <BottomSheetScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Sparkles size={20} color={Colors.light.ai.primary} />
            </View>
            <Text style={styles.headerTitle}>AI Studio</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* No Image Warning (if browsing without selection) */}
        {!hasImageSelected && (
          <Animated.View 
            style={styles.noImageBanner}
            entering={FadeIn.duration(200)}
          >
            <Camera size={18} color={Colors.light.textSecondary} />
            <Text style={styles.noImageText}>
              Browse features below, then select a photo to apply
            </Text>
          </Animated.View>
        )}

        {/* Error State */}
        {configError && (
          <View style={styles.errorBox}>
            <AlertCircle size={16} color={Colors.light.error} />
            <Text style={styles.errorText}>{configError}</Text>
            <TouchableOpacity onPress={loadConfig} style={styles.retryButton}>
              <RefreshCw size={14} color={Colors.light.ai.primary} />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading State */}
        {isLoadingConfig && !configError && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.light.ai.primary} />
            <Text style={styles.loadingText}>Loading AI features...</Text>
          </View>
        )}

        {/* Feature Tabs */}
        {!isLoadingConfig && !configError && (
          <>
            <Text style={styles.sectionTitle}>Choose an AI Feature</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featureTabsContent}
              style={styles.featureTabs}
            >
              {features.map((feature) => {
                return (
                  <AIStudioFeatureTab
                    key={`feature-${feature.featureKey}`}
                    feature={feature}
                    isSelected={selectedFeature === feature.featureKey}
                    isPremium={isPremium}
                    isProcessing={isProcessing && processingType === feature.featureKey}
                    onPress={handleFeaturePress}
                  />
                );
              })}
            </ScrollView>

            {/* Expanded Options Area */}
            {selectedFeature && (
              <Animated.View 
                entering={SlideInUp.duration(200).springify()}
                exiting={FadeOut.duration(100)}
              >
                {/* Feature Description */}
                {selectedFeatureConfig && (
                  <View style={styles.featureInfo}>
                    <Text style={styles.featureDescription}>
                      {selectedFeatureConfig.description}
                    </Text>
                  </View>
                )}

                {/* BG Replacer: Show info message - full options available in AI Studio Sheet */}
                {selectedFeature === 'background_replace' && (
                  <View style={styles.simpleActionArea}>
                    <Text style={styles.simpleActionText}>
                      Replace with solid colors, gradients, blur effects, or custom prompts
                    </Text>
                  </View>
                )}

                {/* Simple Features: Show Confirm Area */}
                {selectedFeature !== 'background_replace' && (
                  <View style={styles.simpleActionArea}>
                    <Text style={styles.simpleActionText}>
                      Enhance your photo with AI quality improvement
                    </Text>
                  </View>
                )}

                {/* Apply Button */}
                <TouchableOpacity
                  style={[
                    styles.applyButton,
                    (!canApply || isProcessing) && styles.applyButtonDisabled,
                  ]}
                  onPress={handleApply}
                  disabled={!canApply || isProcessing}
                  activeOpacity={0.8}
                >
                  {isProcessing ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.applyButtonText}>Processing...</Text>
                    </>
                  ) : (
                    <>
                      <Check size={20} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.applyButtonText}>
                        {hasImageSelected ? 'Apply to Photo' : 'Select Photo First'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Empty Feature Selection State */}
            {!selectedFeature && !isLoadingConfig && features.length > 0 && (
              <View style={styles.emptySelectionBox}>
                <Sparkles size={24} color={Colors.light.textTertiary} />
                <Text style={styles.emptySelectionText}>
                  Tap a feature above to get started
                </Text>
              </View>
            )}
          </>
        )}

        {/* Processing Overlay */}
        {isProcessing && (
          <Animated.View 
            style={styles.processingOverlay}
            entering={FadeIn.duration(200)}
          >
            <View style={styles.processingBox}>
              <ActivityIndicator size="large" color={Colors.light.ai.primary} />
              <Text style={styles.processingText}>
                AI is working its magic...
              </Text>
              <Text style={styles.processingSubtext}>
                This may take a few seconds
              </Text>
            </View>
          </Animated.View>
        )}
        
        {/* Bottom safe area padding */}
        <View style={{ height: bottomPadding }} />
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: Colors.light.border,
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.ai.lightBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  noImageText: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(214, 69, 69, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.error,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.light.ai.lightBg,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.ai.primary,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 12,
  },
  featureTabs: {
    marginBottom: 8,
  },
  featureTabsContent: {
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  featureInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
  },
  featureDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
  },
  simpleActionArea: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    alignItems: 'center',
  },
  simpleActionText: {
    fontSize: 14,
    color: Colors.light.text,
    textAlign: 'center',
    lineHeight: 20,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.light.ai.primary,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
  },
  applyButtonDisabled: {
    backgroundColor: Colors.light.textTertiary,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptySelectionBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptySelectionText: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    textAlign: 'center',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  processingBox: {
    alignItems: 'center',
    gap: 12,
    padding: 32,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.ai.primaryDark,
    textAlign: 'center',
  },
  processingSubtext: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});

export default AIStudioPanel;
