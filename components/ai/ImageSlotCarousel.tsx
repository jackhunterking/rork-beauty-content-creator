/**
 * Image Slot Carousel
 * 
 * Horizontal scrollable carousel for selecting images in AI Studio.
 * Shows all template slots with their captured images.
 * 
 * Features:
 * - Slidable between images that have content
 * - Empty slots are visible but grayed out and not slidable to
 * - "Add an image first" message when no images exist
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

import Colors from '@/constants/colors';
import type { Slot, MediaAsset } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Constants for carousel sizing - Large hero image
const CAROUSEL_HEIGHT = 380;
const ITEM_WIDTH = SCREEN_WIDTH * 0.8;
const ITEM_SPACING = 12;
const SIDE_PADDING = (SCREEN_WIDTH - ITEM_WIDTH) / 2;

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
  isNextEmpty: boolean;
  onPress: () => void;
  index: number;
  totalCount: number;
}

function SlotItem({ slot, image, isSelected, isNextEmpty, onPress, index, totalCount }: SlotItemProps) {
  const hasImage = !!image?.uri;
  
  return (
    <TouchableOpacity
      style={[
        styles.slotItem,
        isSelected && styles.slotItemSelected,
        !hasImage && styles.slotItemEmpty,
      ]}
      onPress={onPress}
      activeOpacity={hasImage ? 0.8 : 1}
      disabled={!hasImage}
    >
      {hasImage ? (
        <>
          <ExpoImage
            source={{ uri: image.uri }}
            style={styles.slotImage}
            contentFit="cover"
            transition={200}
          />
          {/* Selection indicator */}
          {isSelected && (
            <View style={styles.selectedBadge}>
              <Ionicons name="checkmark" size={14} color="#FFF" />
            </View>
          )}
        </>
      ) : (
        <View style={styles.emptySlotContent}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="image-outline" size={32} color={Colors.light.textTertiary} />
          </View>
          <Text style={styles.emptySlotText}>No Image</Text>
        </View>
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
  
  // Find the index of the currently selected slot among filled slots
  const selectedFilledIndex = filledSlots.findIndex(slot => slot.layerId === selectedSlotId);
  
  // Auto-select first filled slot if none selected
  useEffect(() => {
    if (!selectedSlotId && filledSlots.length > 0) {
      onSelectSlot(filledSlots[0].layerId);
    }
  }, [selectedSlotId, filledSlots, onSelectSlot]);
  
  // Scroll to selected slot when it changes
  useEffect(() => {
    if (selectedFilledIndex >= 0 && scrollViewRef.current) {
      const scrollX = selectedFilledIndex * (ITEM_WIDTH + ITEM_SPACING);
      scrollViewRef.current.scrollTo({ x: scrollX, animated: true });
      setCurrentIndex(selectedFilledIndex);
    }
  }, [selectedFilledIndex]);
  
  // Handle scroll end to snap to nearest filled slot
  const handleScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (ITEM_WIDTH + ITEM_SPACING));
    const clampedIndex = Math.max(0, Math.min(index, filledSlots.length - 1));
    
    if (clampedIndex !== currentIndex && filledSlots[clampedIndex]) {
      setCurrentIndex(clampedIndex);
      onSelectSlot(filledSlots[clampedIndex].layerId);
    }
  }, [currentIndex, filledSlots, onSelectSlot]);
  
  // No images state
  if (!hasAnyImages) {
    return (
      <View style={styles.noImagesContainer}>
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
  
  // Single image - show without scrolling but with empty slot preview
  if (filledSlots.length === 1) {
    const filledSlot = filledSlots[0];
    const filledImage = capturedImages[filledSlot.layerId];
    
    // Find empty slots to show as grayed out previews
    const emptySlots = slots.filter(slot => !capturedImages[slot.layerId]?.uri);
    
    return (
      <View style={styles.container}>
        <View style={styles.singleImageContainer}>
          {/* Main filled image */}
          <View style={styles.singleImageWrapper}>
            <SlotItem
              slot={filledSlot}
              image={filledImage}
              isSelected={true}
              isNextEmpty={emptySlots.length > 0}
              onPress={() => {}}
              index={0}
              totalCount={1}
            />
          </View>
          
          {/* Preview of next empty slot (grayed out) */}
          {emptySlots.length > 0 && (
            <View style={styles.emptySlotPreview}>
              <View style={styles.emptySlotPreviewInner}>
                <Ionicons name="image-outline" size={24} color={Colors.light.textTertiary} />
                <Text style={styles.emptySlotPreviewText}>{emptySlots[0].label}</Text>
              </View>
            </View>
          )}
        </View>
        
        {/* Pagination dots */}
        <View style={styles.pagination}>
          <View style={[styles.paginationDot, styles.paginationDotActive]} />
          {emptySlots.map((slot, index) => (
            <View key={slot.layerId} style={[styles.paginationDot, styles.paginationDotEmpty]} />
          ))}
        </View>
      </View>
    );
  }
  
  // Calculate snap offsets - only snap to filled slots
  const snapOffsets = useMemo(() => {
    const offsets: number[] = [];
    let currentOffset = 0;
    
    slots.forEach((slot, index) => {
      const hasImage = !!capturedImages[slot.layerId]?.uri;
      if (hasImage) {
        offsets.push(currentOffset);
      }
      currentOffset += ITEM_WIDTH + ITEM_SPACING;
    });
    
    return offsets;
  }, [slots, capturedImages]);
  
  // Find the maximum scroll position (last filled slot)
  const maxScrollX = useMemo(() => {
    if (snapOffsets.length === 0) return 0;
    return snapOffsets[snapOffsets.length - 1];
  }, [snapOffsets]);
  
  // Handle scroll with bounds checking to prevent scrolling to empty slots
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    
    // Clamp scroll to not go past the last filled slot
    if (offsetX > maxScrollX + 50 && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x: maxScrollX, animated: true });
    }
  }, [maxScrollX]);
  
  // Multiple images - show scrollable carousel
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
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Render all slots - filled ones are interactive, empty ones are grayed out */}
        {slots.map((slot, index) => {
          const image = capturedImages[slot.layerId];
          const hasImage = !!image?.uri;
          const isSelected = slot.layerId === selectedSlotId;
          
          // Check if next slot is empty (for visual indicator)
          const nextSlot = slots[index + 1];
          const isNextEmpty = nextSlot && !capturedImages[nextSlot.layerId]?.uri;
          
          return (
            <View
              key={slot.layerId}
              style={[
                styles.slotItemWrapper,
                index < slots.length - 1 && { marginRight: ITEM_SPACING },
              ]}
            >
              <SlotItem
                slot={slot}
                image={image}
                isSelected={isSelected && hasImage}
                isNextEmpty={isNextEmpty}
                onPress={() => hasImage && onSelectSlot(slot.layerId)}
                index={index}
                totalCount={slots.length}
              />
            </View>
          );
        })}
      </ScrollView>
      
      {/* Pagination dots */}
      <View style={styles.pagination}>
        {slots.map((slot, index) => {
          const hasImage = !!capturedImages[slot.layerId]?.uri;
          const isSelected = slot.layerId === selectedSlotId;
          
          return (
            <View
              key={slot.layerId}
              style={[
                styles.paginationDot,
                isSelected && hasImage && styles.paginationDotActive,
                !hasImage && styles.paginationDotEmpty,
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
    paddingVertical: 16,
  },
  scrollContent: {
    paddingVertical: 8,
  },
  slotItemWrapper: {
    width: ITEM_WIDTH,
  },
  slotItem: {
    width: ITEM_WIDTH,
    height: CAROUSEL_HEIGHT,
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceSecondary,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  slotItemSelected: {
    borderColor: Colors.light.accent,
  },
  slotItemEmpty: {
    opacity: 0.5,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  slotImage: {
    width: '100%',
    height: '100%',
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptySlotText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textTertiary,
    marginBottom: 4,
  },
  
  // No images state
  noImagesContainer: {
    height: CAROUSEL_HEIGHT + 48,
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
  
  // Single image with empty preview
  singleImageContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  singleImageWrapper: {
    width: ITEM_WIDTH,
  },
  emptySlotPreview: {
    width: 70,
    height: CAROUSEL_HEIGHT - 60,
    marginLeft: 8,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    opacity: 0.4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
  },
  emptySlotPreviewInner: {
    alignItems: 'center',
    gap: 4,
  },
  emptySlotPreviewText: {
    fontSize: 10,
    color: Colors.light.textTertiary,
    fontWeight: '500',
  },
  
  // Pagination
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.border,
  },
  paginationDotActive: {
    backgroundColor: Colors.light.accent,
    width: 20,
  },
  paginationDotEmpty: {
    backgroundColor: Colors.light.border,
    opacity: 0.5,
  },
});
