/**
 * BackgroundPresetPicker Component
 * 
 * Bottom sheet for selecting background replacement presets.
 * Shows preset categories and allows selection for AI background replacement.
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Image,
  Crown,
  X,
  Check,
  Building2,
  Palette,
  TreePine,
  CircleDashed,
  Briefcase,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { fetchBackgroundPresets } from '@/services/aiService';
import type { BackgroundPreset, BackgroundPresetCategory, GroupedBackgroundPresets } from '@/types';

interface BackgroundPresetPickerProps {
  /** Reference to bottom sheet */
  bottomSheetRef: React.RefObject<BottomSheet>;
  /** Whether user has premium access */
  isPremium: boolean;
  /** Currently selected preset ID */
  selectedPresetId: string | null;
  /** Called when a preset is selected */
  onSelectPreset: (preset: BackgroundPreset) => void;
  /** Called to request premium access */
  onRequestPremium: (feature: string) => void;
  /** Called when panel is closed */
  onClose: () => void;
}

const CATEGORY_INFO: Record<BackgroundPresetCategory, { label: string; icon: React.ReactNode }> = {
  studio: { label: 'Studio', icon: <Building2 size={16} color={Colors.light.textSecondary} /> },
  solid: { label: 'Solid', icon: <Palette size={16} color={Colors.light.textSecondary} /> },
  nature: { label: 'Nature', icon: <TreePine size={16} color={Colors.light.textSecondary} /> },
  blur: { label: 'Blur', icon: <CircleDashed size={16} color={Colors.light.textSecondary} /> },
  professional: { label: 'Professional', icon: <Briefcase size={16} color={Colors.light.textSecondary} /> },
};

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
          { backgroundColor: preset.previewColor || '#CCCCCC' }
        ]} 
      />
      
      {/* Selection Indicator */}
      {isSelected && (
        <View style={styles.selectedIndicator}>
          <Check size={14} color={Colors.light.surface} />
        </View>
      )}
      
      {/* Premium Badge */}
      {isLocked && (
        <View style={styles.presetProBadge}>
          <Crown size={10} color={Colors.light.surface} />
        </View>
      )}
      
      {/* Name */}
      <Text style={styles.presetName} numberOfLines={1}>
        {preset.name}
      </Text>
    </TouchableOpacity>
  );
}

interface CategorySectionProps {
  category: BackgroundPresetCategory;
  presets: BackgroundPreset[];
  isPremium: boolean;
  selectedPresetId: string | null;
  onSelectPreset: (preset: BackgroundPreset) => void;
  onRequestPremium: () => void;
}

function CategorySection({
  category,
  presets,
  isPremium,
  selectedPresetId,
  onSelectPreset,
  onRequestPremium,
}: CategorySectionProps) {
  if (presets.length === 0) return null;
  
  const categoryInfo = CATEGORY_INFO[category];
  
  return (
    <View style={styles.categorySection}>
      <View style={styles.categoryHeader}>
        {categoryInfo.icon}
        <Text style={styles.categoryTitle}>{categoryInfo.label}</Text>
      </View>
      <View style={styles.presetsRow}>
        {presets.map(preset => {
          const isLocked = preset.isPremium && !isPremium;
          return (
            <PresetTile
              key={preset.id}
              preset={preset}
              isSelected={preset.id === selectedPresetId}
              isLocked={isLocked}
              onSelect={() => {
                if (isLocked) {
                  onRequestPremium();
                } else {
                  onSelectPreset(preset);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

export function BackgroundPresetPicker({
  bottomSheetRef,
  isPremium,
  selectedPresetId,
  onSelectPreset,
  onRequestPremium,
  onClose,
}: BackgroundPresetPickerProps) {
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['70%'], []);
  
  // Presets state
  const [presets, setPresets] = useState<BackgroundPreset[]>([]);
  const [groupedPresets, setGroupedPresets] = useState<GroupedBackgroundPresets | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Calculate bottom padding with safe area
  const bottomPadding = Math.max(insets.bottom, 20) + 16;

  // Load presets
  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchBackgroundPresets();
      setPresets(result.presets);
      setGroupedPresets(result.grouped);
    } catch (err: any) {
      console.error('[BackgroundPresetPicker] Load error:', err);
      setError(err.message || 'Failed to load presets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestPremium = useCallback(() => {
    onRequestPremium('ai_background_preset');
  }, [onRequestPremium]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  // Categories in display order
  const categoryOrder: BackgroundPresetCategory[] = ['studio', 'solid', 'blur', 'nature', 'professional'];

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.background}
    >
      <BottomSheetScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Image size={20} color="#8B5CF6" />
            </View>
            <Text style={styles.headerTitle}>Choose Background</Text>
          </View>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          Select a background style to replace your image's background
        </Text>

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.loadingText}>Loading presets...</Text>
          </View>
        )}

        {/* Error State */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadPresets} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Presets Grid */}
        {!isLoading && !error && groupedPresets && (
          <View style={styles.presetsContainer}>
            {categoryOrder.map(category => (
              <CategorySection
                key={category}
                category={category}
                presets={groupedPresets[category] || []}
                isPremium={isPremium}
                selectedPresetId={selectedPresetId}
                onSelectPreset={onSelectPreset}
                onRequestPremium={handleRequestPremium}
              />
            ))}
          </View>
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
    marginBottom: 8,
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
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
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
  subtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 20,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  errorBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.surface,
  },
  presetsContainer: {
    gap: 24,
  },
  categorySection: {
    gap: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetTile: {
    width: 80,
    alignItems: 'center',
    gap: 6,
  },
  presetTileSelected: {
    // Additional styling for selected state
  },
  presetPreview: {
    width: 70,
    height: 70,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.borderLight,
    position: 'relative',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 4,
    right: 9,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.light.surface,
  },
  presetProBadge: {
    position: 'absolute',
    top: 4,
    left: 9,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetName: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});

export default BackgroundPresetPicker;
