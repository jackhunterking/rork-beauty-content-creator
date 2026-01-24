/**
 * AI Studio Home View - iOS Native Design
 * 
 * Clean, minimal design following iOS principles:
 * - Large hero image
 * - Icon-forward action buttons with AI badge
 * - Short labels, no descriptions
 * - High contrast, native feel
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Wand2, ImagePlus, Scissors } from 'lucide-react-native';

import Colors from '@/constants/colors';
import type { AIFeatureKey, Slot, MediaAsset } from '@/types';
import ImageSlotCarousel from './ImageSlotCarousel';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AIStudioHomeViewProps {
  /** All available slots from the template */
  slots: Slot[];
  /** Captured images keyed by slot ID */
  capturedImages: Record<string, MediaAsset | null>;
  /** Currently selected slot ID */
  selectedSlotId: string | null;
  /** Original images for ALL slots (resized if needed for AI limits) - maps slotId to cloud URL */
  transformedImages?: Record<string, string>;
  /** AI enhancements already applied to the currently selected image */
  aiEnhancementsApplied?: AIFeatureKey[];
  /** Callback when user selects a slot in the carousel */
  onSelectSlot: (slotId: string) => void;
  /** Callback when user selects an AI feature */
  onSelectFeature: (featureKey: AIFeatureKey) => void;
  /** Callback when user taps an already-applied feature (to show toast) */
  onAlreadyAppliedTap?: (featureKey: AIFeatureKey) => void;
  /** Callback to skip AI and continue */
  onSkip: () => void;
  /** Callback when user wants to add an image */
  onAddImage?: () => void;
}

/**
 * AIBadge Component
 * 
 * Creates a badge effect where the icon is surrounded by a border,
 * but the top-right corner has a notch where "AI" text sits.
 */
function AIBadge({ children }: { children: React.ReactNode }) {
  return (
    <View style={aiBadgeStyles.container}>
      {/* Border with notch cutout - using 4 border segments */}
      <View style={aiBadgeStyles.borderContainer}>
        {/* Top border - shorter to make room for AI label */}
        <View style={aiBadgeStyles.borderTop} />
        {/* Right border - shorter to make room for AI label */}
        <View style={aiBadgeStyles.borderRight} />
        {/* Bottom border - full width */}
        <View style={aiBadgeStyles.borderBottom} />
        {/* Left border - full height */}
        <View style={aiBadgeStyles.borderLeft} />
      </View>
      
      {/* AI label positioned in the cutoff area */}
      <View style={aiBadgeStyles.aiLabelContainer}>
        <Text style={aiBadgeStyles.aiLabel}>AI</Text>
      </View>
      
      {/* Icon content */}
      <View style={aiBadgeStyles.content}>
        {children}
      </View>
    </View>
  );
}

const aiBadgeStyles = StyleSheet.create({
  container: {
    width: 36,
    height: 36,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  borderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  borderTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 14, // Leave space for AI label
    height: 1.5,
    backgroundColor: Colors.light.ai.primary,
    borderTopLeftRadius: 8,
  },
  borderRight: {
    position: 'absolute',
    top: 12, // Start below AI label
    right: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: Colors.light.ai.primary,
    borderBottomRightRadius: 8,
  },
  borderBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: Colors.light.ai.primary,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  borderLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: Colors.light.ai.primary,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  aiLabelContainer: {
    position: 'absolute',
    top: -3,
    right: -4,
    paddingHorizontal: 2,
    paddingVertical: 0,
    zIndex: 1,
  },
  aiLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.light.ai.primary,
    letterSpacing: 0.2,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

type AIIconType = 'wand' | 'imagePlus' | 'scissors';

interface ActionButtonProps {
  iconType: AIIconType;
  label: string;
  /** Whether this feature has already been applied to the current image */
  isApplied?: boolean;
  /** If true, always call onPress even when applied (e.g., for free color changes) */
  allowReapply?: boolean;
  /** Called when user taps and feature is NOT already applied */
  onPress: () => void;
  /** Called when user taps and feature IS already applied (to show explanation toast) */
  onAppliedPress?: () => void;
}

function ActionButton({ iconType, label, isApplied = false, allowReapply = false, onPress, onAppliedPress }: ActionButtonProps) {
  const iconColor = isApplied ? '#34C759' : Colors.light.ai.primary;
  
  const renderIcon = () => {
    switch (iconType) {
      case 'wand':
        return <Wand2 size={18} color={iconColor} strokeWidth={1.8} />;
      case 'imagePlus':
        return <ImagePlus size={18} color={iconColor} strokeWidth={1.8} />;
      case 'scissors':
        return <Scissors size={18} color={iconColor} strokeWidth={1.8} />;
    }
  };

  const handlePress = () => {
    if (isApplied && !allowReapply) {
      // Feature already applied - show toast instead of navigating (unless re-apply allowed)
      onAppliedPress?.();
    } else {
      // Feature not applied OR re-apply allowed - navigate to feature view
      onPress();
    }
  };
  
  return (
    <TouchableOpacity
      style={[styles.actionButton, isApplied && styles.actionButtonApplied]}
      onPress={handlePress}
      activeOpacity={isApplied ? 0.9 : 0.8}
    >
      <View style={[styles.actionIconContainer, isApplied && styles.actionIconContainerApplied]}>
        <AIBadge>
          {renderIcon()}
        </AIBadge>
        {isApplied && (
          <View style={styles.appliedBadge}>
            <Text style={styles.appliedBadgeText}>✓</Text>
          </View>
        )}
      </View>
      <Text style={[styles.actionLabel, isApplied && styles.actionLabelApplied]}>{label}</Text>
      {isApplied && (
        <Text style={styles.appliedText}>Applied</Text>
      )}
    </TouchableOpacity>
  );
}

export default function AIStudioHomeView({
  slots,
  capturedImages,
  selectedSlotId,
  transformedImages = {},
  aiEnhancementsApplied = [],
  onSelectSlot,
  onSelectFeature,
  onAlreadyAppliedTap,
  onSkip,
  onAddImage,
}: AIStudioHomeViewProps) {
  // Create a modified capturedImages that uses original images for ALL slots
  // This ensures the carousel shows the full image that will be sent to AI
  const displayCapturedImages = useMemo(() => {
    const hasTransformedImages = Object.keys(transformedImages).length > 0;
    if (!hasTransformedImages) {
      return capturedImages;
    }
    
    // Create a new object with transformed URIs for all slots that have them
    const result = { ...capturedImages };
    for (const [slotId, transformedUri] of Object.entries(transformedImages)) {
      const existingImage = capturedImages[slotId];
      if (existingImage && transformedUri) {
        result[slotId] = {
          ...existingImage,
          uri: transformedUri,
        };
      }
    }
    return result;
  }, [capturedImages, transformedImages]);
  
  // Check if any images are available
  const hasAnyImages = useMemo(() => {
    return Object.values(capturedImages).some(img => !!img?.uri);
  }, [capturedImages]);
  
  // Check if the selected slot has an image
  const selectedHasImage = selectedSlotId && capturedImages[selectedSlotId]?.uri;

  return (
    <View style={styles.container}>
      {/* Header - Simple and clean */}
      <View style={styles.header}>
        <Text style={styles.title}>AI Studio</Text>
      </View>

      {/* Large Image Carousel */}
      <View style={styles.carouselContainer}>
        <ImageSlotCarousel
          slots={slots}
          capturedImages={displayCapturedImages}
          selectedSlotId={selectedSlotId}
          onSelectSlot={onSelectSlot}
          onAddImage={onAddImage}
        />
      </View>

      {/* Action Buttons - iOS style with AI badge */}
      {hasAnyImages && selectedHasImage && (
        <View style={styles.actionsContainer}>
          <ActionButton
            iconType="wand"
            label="Auto-Quality"
            isApplied={aiEnhancementsApplied.includes('auto_quality')}
            onPress={() => onSelectFeature('auto_quality')}
            onAppliedPress={() => onAlreadyAppliedTap?.('auto_quality')}
          />
          
          <ActionButton
            iconType="scissors"
            label="Remove BG"
            isApplied={aiEnhancementsApplied.includes('background_remove')}
            onPress={() => onSelectFeature('background_remove')}
            onAppliedPress={() => onAlreadyAppliedTap?.('background_remove')}
          />
          
          <ActionButton
            iconType="imagePlus"
            label="Replace BG"
            isApplied={false}
            onPress={() => onSelectFeature('background_replace')}
          />
        </View>
      )}
    </View>
  );
}

const BUTTON_WIDTH = (SCREEN_WIDTH - 48 - 24) / 3; // 48px side padding, 24px total gap (3 buttons)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 24,
  },
  
  // Header
  header: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  
  // Carousel - Takes up most space
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  
  // Action buttons - More button-like with AI badge styling
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionButtonApplied: {
    backgroundColor: '#F0FFF4', // Light green tint
    borderColor: '#34C759',
  },
  actionIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.light.ai.lightBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  actionIconContainerApplied: {
    backgroundColor: '#E8F8EC', // Lighter green
  },
  appliedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F0FFF4',
  },
  appliedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.text,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  actionLabelApplied: {
    color: '#34C759',
    fontWeight: '600',
  },
  appliedText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#34C759',
    marginTop: 2,
  },
});
