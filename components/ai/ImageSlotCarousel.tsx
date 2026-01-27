/**
 * Image Slot Carousel
 * 
 * Horizontal scrollable carousel for selecting images in AI Studio.
 * Shows all template slots with their captured images.
 * 
 * Features:
 * - Both filled and empty slots shown at same size, swipeable
 * - Empty slots show "Add a photo" and are clickable
 * - Pagination dots indicate current position
 * - Current selection indicator
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import Colors from '@/constants/colors';
import { getGradientPoints } from '@/constants/gradients';
import { TransformedImagePreview } from './TransformedImagePreview';
import type { Slot, MediaAsset } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Max bounds for carousel items - actual size determined by slot AR
const MAX_ITEM_HEIGHT = SCREEN_HEIGHT * 0.48; // ~48% of screen height
const MAX_ITEM_WIDTH = SCREEN_WIDTH * 0.75;
const ITEM_SPACING = 16;
const SIDE_PADDING = (SCREEN_WIDTH - MAX_ITEM_WIDTH) / 2;

/**
 * Calculate display dimensions for a slot based on its aspect ratio.
 * Ensures the slot fits within max bounds while preserving its AR.
 */
function calculateSlotDisplaySize(slot: Slot): { width: number; height: number } {
  const slotAR = slot.width / slot.height;
  let width = MAX_ITEM_WIDTH;
  let height = width / slotAR;
  
  // If too tall, constrain by height instead
  if (height > MAX_ITEM_HEIGHT) {
    height = MAX_ITEM_HEIGHT;
    width = height * slotAR;
  }
  
  return { width, height };
}

export interface ImageSlotCarouselProps {
  /** All available slots from the template */
  slots: Slot[];
  /** Captured images keyed by slot ID */
  capturedImages: Record<string, MediaAsset | null>;
  /** Currently selected slot ID */
  selectedSlotId: string | null;
  /** Callback when user selects a slot */
  onSelectSlot: (slotId: string) => void;
  /** Callback when no images are available and user taps add */
  onAddImage?: () => void;
}

interface SlotItemProps {
  slot: Slot;
  image: MediaAsset | null;
  isSelected: boolean;
  onPress: () => void;
  onAddImage?: () => void;
  index: number;
  totalCount: number;
  displaySize: { width: number; height: number };
}

function SlotItem({ slot, image, isSelected, onPress, onAddImage, index, totalCount, displaySize }: SlotItemProps) {
  const hasImage = !!image?.uri;
  
  // Get image dimensions (fallback to display size for aspect ratio)
  const imageSize = image ? { width: image.width || displaySize.width, height: image.height || displaySize.height } : displaySize;
  
  return (
    <TouchableOpacity
      style={[
        styles.slotItem,
        { width: displaySize.width, height: displaySize.height },
        isSelected && hasImage && styles.slotItemSelected,
        !hasImage && styles.slotItemEmpty,
      ]}
      onPress={hasImage ? onPress : onAddImage}
      activeOpacity={0.8}
    >
      {hasImage ? (
        <>
          <TransformedImagePreview
            imageUri={image.uri!}
            imageSize={imageSize}
            containerSize={displaySize}
            adjustments={image.adjustments}
            backgroundInfo={image.backgroundInfo}
            borderRadius={18}
            borderWidth={0}
            borderColor="transparent"
          />
          {/* Selection indicator */}
          {isSelected && (
            <View style={styles.selectedBadge}>
              <Ionicons name="checkmark" size={14} color="#FFF" />
            </View>
          )}
        </>
      ) : (
        <TouchableOpacity 
          style={styles.emptySlotContent}
          onPress={onAddImage}
          activeOpacity={0.8}
        >
          <View style={styles.addPhotoIconContainer}>
            <Ionicons name="add" size={32} color={Colors.light.accent} />
          </View>
          <Text style={styles.addPhotoText}>Add a photo</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export default function ImageSlotCarousel({
  slots,
  capturedImages,
  selectedSlotId,
  onSelectSlot,
  onAddImage,
}: ImageSlotCarouselProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Get filled slots (slots with images)
  const filledSlots = slots.filter(slot => capturedImages[slot.layerId]?.uri);
  const hasAnyImages = filledSlots.length > 0;
  
  // Find index of selected slot in all slots
  const selectedSlotIndex = slots.findIndex(slot => slot.layerId === selectedSlotId);
  
  // Calculate display sizes for all slots
  const slotDisplaySizes = useMemo(() => {
    return slots.map(slot => calculateSlotDisplaySize(slot));
  }, [slots]);
  
  // Calculate max height across all slots for container sizing
  const maxSlotHeight = useMemo(() => {
    return Math.max(...slotDisplaySizes.map(s => s.height));
  }, [slotDisplaySizes]);
  
  // Auto-select first filled slot if none selected
  useEffect(() => {
    if (!selectedSlotId && filledSlots.length > 0) {
      onSelectSlot(filledSlots[0].layerId);
    }
  }, [selectedSlotId, filledSlots, onSelectSlot]);
  
  // Scroll to selected slot when it changes
  useEffect(() => {
    if (selectedSlotIndex >= 0 && scrollViewRef.current && snapOffsets[selectedSlotIndex] !== undefined) {
      const scrollX = snapOffsets[selectedSlotIndex];
      scrollViewRef.current.scrollTo({ x: scrollX, animated: true });
      setCurrentIndex(selectedSlotIndex);
    }
  }, [selectedSlotIndex, snapOffsets]);
  
  // Handle scroll end to snap and select slot
  const handleScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    
    // Find closest snap offset
    let closestIndex = 0;
    let minDiff = Math.abs(offsetX - snapOffsets[0]);
    for (let i = 1; i < snapOffsets.length; i++) {
      const diff = Math.abs(offsetX - snapOffsets[i]);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    
    const clampedIndex = Math.max(0, Math.min(closestIndex, slots.length - 1));
    setCurrentIndex(clampedIndex);
    
    // Only select if the slot has an image
    const slot = slots[clampedIndex];
    if (slot && capturedImages[slot.layerId]?.uri) {
      onSelectSlot(slot.layerId);
    }
  }, [slots, capturedImages, onSelectSlot, snapOffsets]);
  
  // No images state
  if (!hasAnyImages) {
    return (
      <View style={[styles.noImagesContainer, { height: MAX_ITEM_HEIGHT + 48 }]}>
        <View style={styles.noImagesContent}>
          <View style={styles.noImagesIconContainer}>
            <Ionicons name="images-outline" size={48} color={Colors.light.textTertiary} />
          </View>
          <Text style={styles.noImagesTitle}>No Images Yet</Text>
          <Text style={styles.noImagesSubtitle}>
            Add photos to your template first to use AI features
          </Text>
          {onAddImage && (
            <TouchableOpacity
              style={styles.addImageButton}
              onPress={onAddImage}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#FFF" />
              <Text style={styles.addImageButtonText}>Add Image</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }
  
  // Calculate snap offsets for ALL slots - based on actual widths
  const snapOffsets = useMemo(() => {
    let offset = 0;
    return slots.map((_, index) => {
      const currentOffset = offset;
      if (index < slots.length - 1) {
        offset += slotDisplaySizes[index].width + ITEM_SPACING;
      }
      return currentOffset;
    });
  }, [slots, slotDisplaySizes]);
  
  // Render carousel with all slots at equal sizes - swipeable
  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled={false}
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: SIDE_PADDING }
        ]}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
      >
        {/* Render all slots with their own dimensions based on slot AR */}
        {slots.map((slot, index) => {
          const image = capturedImages[slot.layerId];
          const hasImage = !!image?.uri;
          const isSelected = slot.layerId === selectedSlotId;
          const displaySize = slotDisplaySizes[index];
          
          return (
            <View
              key={slot.layerId}
              style={[
                styles.slotItemWrapper,
                { width: displaySize.width, height: maxSlotHeight },
                index < slots.length - 1 && { marginRight: ITEM_SPACING },
              ]}
            >
              <SlotItem
                slot={slot}
                image={image}
                isSelected={isSelected && hasImage}
                onPress={() => hasImage && onSelectSlot(slot.layerId)}
                onAddImage={onAddImage}
                index={index}
                totalCount={slots.length}
                displaySize={displaySize}
              />
            </View>
          );
        })}
      </ScrollView>
      
      {/* Pagination dots */}
      <View style={styles.pagination}>
        {slots.map((slot, index) => {
          const hasImage = !!capturedImages[slot.layerId]?.uri;
          const isCurrent = index === currentIndex;
          
          return (
            <View
              key={slot.layerId}
              style={[
                styles.paginationDot,
                isCurrent && styles.paginationDotActive,
                !hasImage && !isCurrent && styles.paginationDotEmpty,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  scrollContent: {
    paddingVertical: 8,
    alignItems: 'center', // Center items vertically when heights differ
  },
  slotItemWrapper: {
    // Width and height set dynamically based on slot AR
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotItem: {
    // Width and height set dynamically based on slot AR
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  slotItemSelected: {
    borderColor: Colors.light.accent,
  },
  slotItemEmpty: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 2,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
  },
  slotImage: {
    width: '100%',
    height: '100%',
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Empty slot "Add a photo" content
  emptySlotContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  addPhotoIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.light.ai.lightBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.light.accent,
    borderStyle: 'dashed',
  },
  addPhotoText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.accent,
    textAlign: 'center',
  },
  
  // No images state
  noImagesContainer: {
    // Height set dynamically based on max slot height
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  noImagesContent: {
    alignItems: 'center',
  },
  noImagesIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noImagesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  noImagesSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  addImageButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Pagination
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
  },
  paginationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.border,
  },
  paginationDotActive: {
    backgroundColor: Colors.light.accent,
    width: 24,
  },
  paginationDotEmpty: {
    backgroundColor: Colors.light.border,
    opacity: 0.5,
  },
});
