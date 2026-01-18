/**
 * AIEnhancePanel Component
 * 
 * Bottom sheet panel showing AI enhancement options.
 * Scaffolded for future AI integration.
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Sparkles, 
  User, 
  Palette, 
  ZoomIn,
  Crown,
  X,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { AIEnhancementType, AIEnhancementOption } from './types';

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
  processingType: AIEnhancementType | null;
  /** Called when an enhancement is selected */
  onSelectEnhancement: (type: AIEnhancementType) => void;
  /** Called to request premium access */
  onRequestPremium: (feature: string) => void;
  /** Called when panel is closed */
  onClose: () => void;
}

const AI_ENHANCEMENTS: AIEnhancementOption[] = [
  {
    id: 'auto_enhance',
    name: 'Auto Enhance',
    description: 'One-tap improvement for lighting, color, and sharpness',
    icon: 'sparkles',
    isPro: true,
  },
  {
    id: 'portrait_retouch',
    name: 'Portrait Retouch',
    description: 'Skin smoothing and blemish removal',
    icon: 'user',
    isPro: true,
  },
  {
    id: 'color_correct',
    name: 'Color Correct',
    description: 'Fix white balance and exposure',
    icon: 'palette',
    isPro: true,
  },
  {
    id: 'upscale',
    name: 'Upscale 4x',
    description: 'AI-powered image upscaling for better quality',
    icon: 'zoom',
    isPro: true,
  },
];

function getIcon(iconName: string, color: string) {
  const size = 24;
  switch (iconName) {
    case 'sparkles':
      return <Sparkles size={size} color={color} />;
    case 'user':
      return <User size={size} color={color} />;
    case 'palette':
      return <Palette size={size} color={color} />;
    case 'zoom':
      return <ZoomIn size={size} color={color} />;
    default:
      return <Sparkles size={size} color={color} />;
  }
}

interface EnhancementCardProps {
  option: AIEnhancementOption;
  isPremium: boolean;
  isProcessing: boolean;
  isThisProcessing: boolean;
  onSelect: () => void;
}

function EnhancementCard({
  option,
  isPremium,
  isProcessing,
  isThisProcessing,
  onSelect,
}: EnhancementCardProps) {
  const isLocked = option.isPro && !isPremium;
  const isDisabled = isProcessing && !isThisProcessing;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isDisabled && styles.cardDisabled,
        isThisProcessing && styles.cardProcessing,
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

      {/* Icon */}
      <View style={styles.cardIcon}>
        {isThisProcessing ? (
          <ActivityIndicator size="small" color="#8B5CF6" />
        ) : (
          getIcon(option.icon, '#8B5CF6')
        )}
      </View>

      {/* Content */}
      <Text style={styles.cardTitle}>{option.name}</Text>
      <Text style={styles.cardDescription} numberOfLines={2}>
        {option.description}
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
}: AIEnhancePanelProps) {
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['55%'], []);
  
  // Calculate bottom padding with safe area
  const bottomPadding = Math.max(insets.bottom, 20) + 16;

  const handleSelectEnhancement = useCallback((type: AIEnhancementType) => {
    const option = AI_ENHANCEMENTS.find(e => e.id === type);
    if (option?.isPro && !isPremium) {
      onRequestPremium(`ai_${type}`);
      return;
    }
    onSelectEnhancement(type);
  }, [isPremium, onSelectEnhancement, onRequestPremium]);

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
      <BottomSheetView style={styles.content}>
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

        {/* Info Text */}
        {!selectedSlotId && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Select a photo first to apply AI enhancements
            </Text>
          </View>
        )}

        {/* Enhancement Options Grid */}
        <View style={styles.grid}>
          {AI_ENHANCEMENTS.map((option) => (
            <EnhancementCard
              key={option.id}
              option={option}
              isPremium={isPremium}
              isProcessing={isProcessing}
              isThisProcessing={processingType === option.id}
              onSelect={() => handleSelectEnhancement(option.id)}
            />
          ))}
        </View>

        {/* Coming Soon Note */}
        <View style={styles.comingSoonBox}>
          <Text style={styles.comingSoonText}>
            ✨ AI features coming soon. Stay tuned!
          </Text>
        </View>
        
        {/* Bottom safe area padding */}
        <View style={{ height: bottomPadding }} />
      </BottomSheetView>
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
  infoBox: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
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
  comingSoonBox: {
    marginTop: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  comingSoonText: {
    fontSize: 13,
    color: '#8B5CF6',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default AIEnhancePanel;
