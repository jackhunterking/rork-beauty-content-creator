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
import type { Slot, MediaAsset } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Constants for carousel sizing - Larger images that maximize screen
const CAROUSEL_HEIGHT = SCREEN_HEIGHT * 0.48; // ~48% of screen height
const ITEM_WIDTH = SCREEN_WIDTH * 0.75;
const ITEM_SPACING = 16;
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
  onPress: () => void;
  onAddImage?: () => void;
  index: number;
  totalCount: number;
}

function SlotItem({ slot, image, isSelected, onPress, onAddImage, index, totalCount }: SlotItemProps) {
  const hasImage = !!image?.uri;
  
  // Render background for transparent PNGs (AI background replacement)
  const renderBackground = () => {
    if (!image?.backgroundInfo) return null;
    
    if (image.backgroundInfo.type === 'solid' && image.backgroundInfo.solidColor) {
      return (
        <View 
          style={[styles.slotImage, { backgroundColor: image.backgroundInfo.solidColor, position: 'absolute' }]} 
        />
      );
    }
    
    if (image.backgroundInfo.type === 'gradient' && image.backgroundInfo.gradient) {
      return (
        <LinearGradient
          colors={image.backgroundInfo.gradient.colors}
          {...getGradientPoints(image.backgroundInfo.gradient.direction)}
          style={[styles.slotImage, { position: 'absolute' }]}
        />
      );
    }
    
    return null;
  };
  
  return (
    <TouchableOpacity
      style={[
        styles.slotItem,
        isSelected && hasImage && styles.slotItemSelected,
        !hasImage && styles.slotItemEmpty,
      ]}
      onPress={hasImage ? onPress : onAddImage}
      activeOpacity={0.8}
    >
      {hasImage ? (
        <>
          {/* Background color/gradient for transparent PNGs */}
          {renderBackground()}
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
  
  // Auto-select first filled slot if none selected
  useEffect(() => {
    if (!selectedSlotId && filledSlots.length > 0) {
      onSelectSlot(filledSlots[0].layerId);
    }
  }, [selectedSlotId, filledSlots, onSelectSlot]);
  
  // Scroll to selected slot when it changes
  useEffect(() => {
    if (selectedSlotIndex >= 0 && scrollViewRef.current) {
      const scrollX = selectedSlotIndex * (ITEM_WIDTH + ITEM_SPACING);
      scrollViewRef.current.scrollTo({ x: scrollX, animated: true });
      setCurrentIndex(selectedSlotIndex);
    }
  }, [selectedSlotIndex]);
  
  // Handle scroll end to snap and select slot
  const handleScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (ITEM_WIDTH + ITEM_SPACING));
    const clampedIndex = Math.max(0, Math.min(index, slots.length - 1));
    
    setCurrentIndex(clampedIndex);
    
    // Only select if the slot has an image
    const slot = slots[clampedIndex];
    if (slot && capturedImages[slot.layerId]?.uri) {
      onSelectSlot(slot.layerId);
    }
  }, [slots, capturedImages, onSelectSlot]);
  
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
  
  // Calculate snap offsets for ALL slots (both filled and empty)
  const snapOffsets = useMemo(() => {
    return slots.map((_, index) => index * (ITEM_WIDTH + ITEM_SPACING));
  }, [slots]);
  
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
        {/* Render all slots at equal sizes */}
        {slots.map((slot, index) => {
          const image = capturedImages[slot.layerId];
          const hasImage = !!image?.uri;
          const isSelected = slot.layerId === selectedSlotId;
          
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
                onPress={() => hasImage && onSelectSlot(slot.layerId)}
                onAddImage={onAddImage}
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
  },
  slotItemWrapper: {
    width: ITEM_WIDTH,
  },
  slotItem: {
    width: ITEM_WIDTH,
    height: CAROUSEL_HEIGHT,
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
