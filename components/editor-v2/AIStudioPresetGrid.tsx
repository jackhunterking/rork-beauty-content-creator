/**
 * AIStudioPresetGrid Component
 * 
 * Inline expandable preset grid for background replacement feature.
 * Used within the AI Studio panel when BG Replacer is selected.
 * Minimal design with brand-aligned colors.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
} from 'react-native-reanimated';
import {
  Check,
  Crown,
  Building2,
  Palette,
  TreePine,
  CircleDashed,
  Briefcase,
  RefreshCw,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { fetchBackgroundPresets } from '@/services/aiService';
import type { BackgroundPreset, BackgroundPresetCategory, GroupedBackgroundPresets } from '@/types';

/**
 * Category configuration with icons and labels
 */
const CATEGORY_CONFIG: Record<BackgroundPresetCategory, { label: string; icon: (color: string) => React.ReactNode }> = {
  studio: { 
    label: 'Studio', 
    icon: (color) => <Building2 size={14} color={color} strokeWidth={2} /> 
  },
  solid: { 
    label: 'Solid', 
    icon: (color) => <Palette size={14} color={color} strokeWidth={2} /> 
  },
  nature: { 
    label: 'Nature', 
    icon: (color) => <TreePine size={14} color={color} strokeWidth={2} /> 
  },
  blur: { 
    label: 'Blur', 
    icon: (color) => <CircleDashed size={14} color={color} strokeWidth={2} /> 
  },
  professional: { 
    label: 'Pro', 
    icon: (color) => <Briefcase size={14} color={color} strokeWidth={2} /> 
  },
};

const CATEGORY_ORDER: BackgroundPresetCategory[] = ['studio', 'solid', 'blur', 'nature', 'professional'];

interface PresetTileProps {
  preset: BackgroundPreset;
  isSelected: boolean;
  isLocked: boolean;
  onSelect: () => void;
}

function PresetTile({ preset, isSelected, isLocked, onSelect }: PresetTileProps) {
  return (
    <TouchableOpacity
      style={[
        styles.presetTile,
        isSelected && styles.presetTileSelected,
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      {/* Background Color Preview */}
      <View 
        style={[
          styles.presetPreview,
          { backgroundColor: preset.previewColor || '#CCCCCC' },
          isSelected && styles.presetPreviewSelected,
        ]} 
      />
      
      {/* Selection Indicator */}
      {isSelected && (
        <View style={styles.selectedIndicator}>
          <Check size={12} color="#FFFFFF" strokeWidth={3} />
        </View>
      )}
      
      {/* Premium Badge */}
      {isLocked && (
        <View style={styles.presetProBadge}>
          <Crown size={8} color="#FFFFFF" />
        </View>
      )}
      
      {/* Name */}
      <Text style={[
        styles.presetName,
        isSelected && styles.presetNameSelected,
      ]} numberOfLines={1}>
        {preset.name}
      </Text>
    </TouchableOpacity>
  );
}

interface AIStudioPresetGridProps {
  /** Whether user has premium access */
  isPremium: boolean;
  /** Currently selected preset ID */
  selectedPresetId: string | null;
  /** Called when a preset is selected */
  onSelectPreset: (preset: BackgroundPreset) => void;
  /** Called to request premium access */
  onRequestPremium: (feature: string) => void;
}

export function AIStudioPresetGrid({
  isPremium,
  selectedPresetId,
  onSelectPreset,
  onRequestPremium,
}: AIStudioPresetGridProps) {
  // State
  const [groupedPresets, setGroupedPresets] = useState<GroupedBackgroundPresets | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<BackgroundPresetCategory>('studio');

  // Load presets on mount
  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchBackgroundPresets();
      setGroupedPresets(result.grouped);
      
      // Auto-select first category with presets
      for (const category of CATEGORY_ORDER) {
        if (result.grouped[category]?.length > 0) {
          setSelectedCategory(category);
          break;
        }
      }
    } catch (err: any) {
      console.error('[AIStudioPresetGrid] Load error:', err);
      setError(err.message || 'Failed to load presets');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresetSelect = useCallback((preset: BackgroundPreset) => {
    const isLocked = preset.isPremium && !isPremium;
    if (isLocked) {
      onRequestPremium('ai_background_preset');
    } else {
      onSelectPreset(preset);
    }
  }, [isPremium, onSelectPreset, onRequestPremium]);

  // Get presets for selected category
  const categoryPresets = groupedPresets?.[selectedCategory] || [];

  // Loading state
  if (isLoading) {
    return (
      <Animated.View 
        style={styles.loadingContainer}
        entering={FadeIn.duration(200)}
      >
        <ActivityIndicator size="small" color={Colors.light.ai.primary} />
        <Text style={styles.loadingText}>Loading backgrounds...</Text>
      </Animated.View>
    );
  }

  // Error state
  if (error) {
    return (
      <Animated.View 
        style={styles.errorContainer}
        entering={FadeIn.duration(200)}
      >
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={loadPresets}
          activeOpacity={0.7}
        >
          <RefreshCw size={14} color={Colors.light.ai.primary} />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View 
      style={styles.container}
      entering={SlideInDown.duration(250).springify()}
      exiting={FadeOut.duration(150)}
    >
      {/* Category Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryTabsContent}
        style={styles.categoryTabs}
      >
        {CATEGORY_ORDER.map((category) => {
          const config = CATEGORY_CONFIG[category];
          const isActive = selectedCategory === category;
          const hasPresets = (groupedPresets?.[category]?.length || 0) > 0;
          
          if (!hasPresets) return null;
          
          return (
            <TouchableOpacity
              key={`cat-${category}`}
              style={[
                styles.categoryTab,
                isActive && styles.categoryTabActive,
              ]}
              onPress={() => setSelectedCategory(category)}
              activeOpacity={0.7}
            >
              {config.icon(isActive ? Colors.light.ai.primary : Colors.light.textSecondary)}
              <Text style={[
                styles.categoryTabText,
                isActive && styles.categoryTabTextActive,
              ]}>
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Presets Grid */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetsGridContent}
        style={styles.presetsGrid}
      >
        {categoryPresets.map((preset) => {
          return (
            <PresetTile
              key={`preset-${preset.id}`}
              preset={preset}
              isSelected={preset.id === selectedPresetId}
              isLocked={preset.isPremium && !isPremium}
              onSelect={() => handlePresetSelect(preset)}
            />
          );
        })}
      </ScrollView>

      {/* Selection hint */}
      {selectedPresetId && (
        <Text style={styles.selectionHint}>
          Tap "Apply" to replace the background
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
  },
  loadingContainer: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 16,
    padding: 24,
    marginTop: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  errorContainer: {
    backgroundColor: 'rgba(214, 69, 69, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    fontSize: 13,
    color: Colors.light.error,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.light.ai.lightBg,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.ai.primary,
  },
  categoryTabs: {
    marginBottom: 12,
  },
  categoryTabsContent: {
    gap: 8,
    paddingHorizontal: 2,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  categoryTabActive: {
    backgroundColor: Colors.light.ai.lightBg,
    borderColor: Colors.light.ai.primary,
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  categoryTabTextActive: {
    color: Colors.light.ai.primary,
  },
  presetsGrid: {
    marginBottom: 4,
  },
  presetsGridContent: {
    gap: 10,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  presetTile: {
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  presetTileSelected: {
    // Additional styling for selected state handled in children
  },
  presetPreview: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.borderLight,
  },
  presetPreviewSelected: {
    borderColor: Colors.light.ai.primary,
    borderWidth: 3,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.light.ai.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.light.surface,
  },
  presetProBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetName: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    maxWidth: 64,
  },
  presetNameSelected: {
    color: Colors.light.ai.primaryDark,
    fontWeight: '600',
  },
  selectionHint: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default AIStudioPresetGrid;
