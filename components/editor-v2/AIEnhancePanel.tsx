/**
 * AIEnhancePanel Component
 * 
 * Bottom sheet panel showing AI enhancement options.
 * Fetches configuration dynamically from Supabase.
 * Displays credit balance and handles premium access.
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Sparkles, 
  Scissors,
  Image,
  Crown,
  X,
  Coins,
  AlertCircle,
  RefreshCw,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAICredits } from '@/hooks/useAICredits';
import { fetchAIConfig } from '@/services/aiService';
import type { AIFeatureKey, AIModelConfig } from '@/types';

interface AIEnhancePanelProps {
  /** Reference to bottom sheet */
  bottomSheetRef: React.RefObject<BottomSheet>;
  /** Whether user has premium access */
  isPremium: boolean;
  /** Currently selected slot ID (for applying enhancements) */
  selectedSlotId: string | null;
  /** Whether an enhancement is being processed */
  isProcessing: boolean;
  /** Currently processing enhancement type */
  processingType: AIFeatureKey | null;
  /** Called when an enhancement is selected */
  onSelectEnhancement: (type: AIFeatureKey, presetId?: string) => void;
  /** Called to request premium access */
  onRequestPremium: (feature: string) => void;
  /** Called when panel is closed */
  onClose: () => void;
  /** Called when background replace is selected (opens preset picker) */
  onOpenBackgroundPicker?: () => void;
}

function getIcon(featureKey: string, color: string, size: number = 24) {
  switch (featureKey) {
    case 'auto_quality':
      return <Sparkles size={size} color={color} />;
    case 'background_remove':
      return <Scissors size={size} color={color} />;
    case 'background_replace':
      return <Image size={size} color={color} />;
    default:
      return <Sparkles size={size} color={color} />;
  }
}

interface EnhancementCardProps {
  feature: AIModelConfig;
  isPremium: boolean;
  creditsRemaining: number;
  isProcessing: boolean;
  isThisProcessing: boolean;
  onSelect: () => void;
}

function EnhancementCard({
  feature,
  isPremium,
  creditsRemaining,
  isProcessing,
  isThisProcessing,
  onSelect,
}: EnhancementCardProps) {
  const isLocked = feature.isPremiumOnly && !isPremium;
  const isDisabled = isProcessing && !isThisProcessing;
  const insufficientCredits = !isLocked && creditsRemaining < feature.costCredits;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isDisabled && styles.cardDisabled,
        isThisProcessing && styles.cardProcessing,
        insufficientCredits && styles.cardInsufficientCredits,
      ]}
      onPress={onSelect}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {/* PRO Badge */}
      {isLocked && (
        <View style={styles.proBadge}>
          <Crown size={10} color={Colors.light.surface} />
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>
      )}

      {/* Cost Badge */}
      {!isLocked && (
        <View style={[styles.costBadge, insufficientCredits && styles.costBadgeInsufficient]}>
          <Coins size={10} color={insufficientCredits ? '#EF4444' : '#8B5CF6'} />
          <Text style={[styles.costBadgeText, insufficientCredits && styles.costBadgeTextInsufficient]}>
            {feature.costCredits}
          </Text>
        </View>
      )}

      {/* Icon */}
      <View style={styles.cardIcon}>
        {isThisProcessing ? (
          <ActivityIndicator size="small" color="#8B5CF6" />
        ) : (
          getIcon(feature.featureKey, '#8B5CF6')
        )}
      </View>

      {/* Content */}
      <Text style={styles.cardTitle}>{feature.displayName}</Text>
      <Text style={styles.cardDescription} numberOfLines={2}>
        {feature.description}
      </Text>
    </TouchableOpacity>
  );
}

export function AIEnhancePanel({
  bottomSheetRef,
  isPremium,
  selectedSlotId,
  isProcessing,
  processingType,
  onSelectEnhancement,
  onRequestPremium,
  onClose,
  onOpenBackgroundPicker,
}: AIEnhancePanelProps) {
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['60%'], []);
  
  // AI Credits hook
  const { credits, isLoading: creditsLoading, refreshCredits } = useAICredits();
  
  // Feature config state
  const [features, setFeatures] = useState<AIModelConfig[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  
  // Calculate bottom padding with safe area
  const bottomPadding = Math.max(insets.bottom, 20) + 16;

  // Load AI config
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
      console.error('[AIEnhancePanel] Config load error:', error);
      setConfigError(error.message || 'Failed to load AI features');
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleSelectEnhancement = useCallback((featureKey: AIFeatureKey) => {
    const feature = features.find(f => f.featureKey === featureKey);
    
    // Check premium access
    if (feature?.isPremiumOnly && !isPremium) {
      onRequestPremium(`ai_${featureKey}`);
      return;
    }
    
    // Check credits
    if (credits && credits.creditsRemaining < (feature?.costCredits || 0)) {
      // Could show a credits depleted modal here
      onRequestPremium('ai_credits_depleted');
      return;
    }
    
    // For background replace, open the preset picker
    if (featureKey === 'background_replace' && onOpenBackgroundPicker) {
      onOpenBackgroundPicker();
      return;
    }
    
    onSelectEnhancement(featureKey);
  }, [features, isPremium, credits, onSelectEnhancement, onRequestPremium, onOpenBackgroundPicker]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadConfig(), refreshCredits()]);
  }, [refreshCredits]);

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

  const creditsRemaining = credits?.creditsRemaining ?? 0;

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
        refreshControl={
          <RefreshControl 
            refreshing={isLoadingConfig || creditsLoading} 
            onRefresh={handleRefresh}
            tintColor="#8B5CF6"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Sparkles size={20} color="#8B5CF6" />
            </View>
            <Text style={styles.headerTitle}>AI Enhancements</Text>
          </View>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Credits Display */}
        <View style={styles.creditsBox}>
          <View style={styles.creditsLeft}>
            <Coins size={18} color="#8B5CF6" />
            <Text style={styles.creditsLabel}>AI Credits</Text>
          </View>
          <View style={styles.creditsRight}>
            {creditsLoading ? (
              <ActivityIndicator size="small" color="#8B5CF6" />
            ) : (
              <>
                <Text style={styles.creditsValue}>{creditsRemaining}</Text>
                {credits && (
                  <Text style={styles.creditsReset}>
                    Resets in {credits.daysUntilReset} days
                  </Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* Info Text */}
        {!selectedSlotId && (
          <View style={styles.infoBox}>
            <AlertCircle size={16} color={Colors.light.textSecondary} />
            <Text style={styles.infoText}>
              Select a photo first to apply AI enhancements
            </Text>
          </View>
        )}

        {/* Error State */}
        {configError && (
          <View style={styles.errorBox}>
            <AlertCircle size={16} color="#EF4444" />
            <Text style={styles.errorText}>{configError}</Text>
            <TouchableOpacity onPress={loadConfig} style={styles.retryButton}>
              <RefreshCw size={14} color="#8B5CF6" />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading State */}
        {isLoadingConfig && !configError && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.loadingText}>Loading AI features...</Text>
          </View>
        )}

        {/* Enhancement Options Grid */}
        {!isLoadingConfig && !configError && (
          <View style={styles.grid}>
            {features.map((feature) => (
              <EnhancementCard
                key={feature.featureKey}
                feature={feature}
                isPremium={isPremium}
                creditsRemaining={creditsRemaining}
                isProcessing={isProcessing}
                isThisProcessing={processingType === feature.featureKey}
                onSelect={() => handleSelectEnhancement(feature.featureKey)}
              />
            ))}
          </View>
        )}

        {/* Empty State */}
        {!isLoadingConfig && !configError && features.length === 0 && (
          <View style={styles.emptyBox}>
            <Sparkles size={32} color={Colors.light.textSecondary} />
            <Text style={styles.emptyText}>
              No AI features available at the moment
            </Text>
          </View>
        )}

        {/* Processing Info */}
        {isProcessing && (
          <View style={styles.processingBox}>
            <ActivityIndicator size="small" color="#8B5CF6" />
            <Text style={styles.processingText}>
              Processing your image with AI...
            </Text>
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
    marginBottom: 16,
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
  creditsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  creditsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  creditsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  creditsRight: {
    alignItems: 'flex-end',
  },
  creditsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  creditsReset: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#EF4444',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 6,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B5CF6',
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
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardProcessing: {
    borderColor: '#8B5CF6',
    borderWidth: 2,
  },
  cardInsufficientCredits: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  proBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.surface,
  },
  costBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  costBadgeInsufficient: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  costBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  costBadgeTextInsufficient: {
    color: '#EF4444',
  },
  processingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  processingText: {
    fontSize: 13,
    color: '#8B5CF6',
    fontWeight: '500',
  },
});

export default AIEnhancePanel;
