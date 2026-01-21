/**
 * AI Studio Home View - iOS Native Design
 * 
 * Clean, minimal design following iOS principles:
 * - Large hero image
 * - Icon-forward action buttons
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
import { Ionicons } from '@expo/vector-icons';

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
  /** Pre-processed/transformed images for ALL slots (with adjustments applied) - maps slotId to URI */
  transformedImages?: Record<string, string>;
  /** Callback when user selects a slot in the carousel */
  onSelectSlot: (slotId: string) => void;
  /** Callback when user selects an AI feature */
  onSelectFeature: (featureKey: AIFeatureKey) => void;
  /** Callback to skip AI and continue */
  onSkip: () => void;
  /** Callback when user wants to add an image */
  onAddImage?: () => void;
}

interface ActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

function ActionButton({ icon, label, onPress }: ActionButtonProps) {
  return (
    <TouchableOpacity
      style={styles.actionButton}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.actionIconContainer}>
        <Ionicons name={icon} size={26} color="#FFFFFF" />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AIStudioHomeView({
  slots,
  capturedImages,
  selectedSlotId,
  transformedImages = {},
  onSelectSlot,
  onSelectFeature,
  onSkip,
  onAddImage,
}: AIStudioHomeViewProps) {
  // Create a modified capturedImages that uses transformed images for ALL slots
  // This ensures the carousel shows the current cropped/zoomed state for each image
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

      {/* Action Buttons - iOS style */}
      {hasAnyImages && selectedHasImage && (
        <View style={styles.actionsContainer}>
          <ActionButton
            icon="sparkles"
            label="Auto Quality"
            onPress={() => onSelectFeature('auto_quality')}
          />
          
          <ActionButton
            icon="cut-outline"
            label="Remove BG"
            onPress={() => onSelectFeature('background_remove')}
          />
          
          <ActionButton
            icon="image-outline"
            label="Replace BG"
            onPress={() => onSelectFeature('background_replace')}
          />
        </View>
      )}
    </View>
  );
}

const BUTTON_WIDTH = (SCREEN_WIDTH - 48 - 24) / 3; // 48px side padding, 24px total gaps

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
  
  // Action buttons - More button-like
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
  actionIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
});
