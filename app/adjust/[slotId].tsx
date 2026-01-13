import React, { useEffect, useCallback, useMemo } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { ImageAdjustmentScreen } from "@/components/ImageAdjustmentScreen";
import { extractSlots } from "@/utils/slotParser";
import { MediaAsset } from "@/types";
import { DEFAULT_ADJUSTMENTS } from "@/utils/imageProcessing";

/**
 * Image adjustment screen for re-adjusting existing slot images
 * Route: /adjust/[slotId]
 * 
 * This screen is used when user taps "Adjust Position" on an existing image
 * in the editor. New captures now include adjustment in the CaptureScreen itself.
 * 
 * Gets image data from currentProject.capturedImages based on slotId.
 */
export default function AdjustSlotScreen() {
  const { slotId } = useLocalSearchParams<{ slotId: string }>();
  
  const router = useRouter();
  const { currentProject, setCapturedImage } = useApp();
  
  const template = currentProject.template;
  const capturedImages = currentProject.capturedImages;
  
  // Extract slots from template
  const slots = useMemo(() => 
    template ? extractSlots(template) : [], 
    [template]
  );
  
  // Find the specific slot by layer ID
  const slot = useMemo(() => 
    slots.find(s => s.layerId === slotId),
    [slots, slotId]
  );

  // Get image data from captured images (re-adjusting existing)
  const imageData = useMemo(() => {
    if (slotId && capturedImages[slotId]?.uri) {
      const existing = capturedImages[slotId];
      return {
        uri: existing.uri,
        width: existing.width,
        height: existing.height,
        adjustments: existing.adjustments || DEFAULT_ADJUSTMENTS,
      };
    }
    return null;
  }, [slotId, capturedImages]);

  // If no template, slot, or image data, go back
  useEffect(() => {
    if (!template) {
      console.log('[AdjustSlot] No template, going back');
      router.back();
      return;
    }
    
    if (!slot && slotId) {
      console.log('[AdjustSlot] No slot found for:', slotId);
      router.back();
      return;
    }

    if (!imageData) {
      console.log('[AdjustSlot] No image data for slot:', slotId);
      router.back();
      return;
    }
  }, [template, slot, slotId, imageData, router]);

  const handleConfirm = useCallback((adjustments: { translateX: number; translateY: number; scale: number }) => {
    if (slotId && imageData) {
      console.log('[AdjustSlot] Confirming adjustments for slot:', slotId, adjustments);
      
      const mediaAsset: MediaAsset = {
        uri: imageData.uri,
        width: imageData.width,
        height: imageData.height,
        adjustments,
      };
      setCapturedImage(slotId, mediaAsset);
    }
    
    // Navigate back to editor - this preserves the editor state including overlays
    router.back();
  }, [slotId, imageData, setCapturedImage, router]);

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  // Don't render if we don't have required data
  if (!slot || !imageData) {
    return null;
  }

  return (
    <ImageAdjustmentScreen
      imageUri={imageData.uri}
      imageWidth={imageData.width}
      imageHeight={imageData.height}
      slotWidth={slot.width}
      slotHeight={slot.height}
      initialAdjustments={imageData.adjustments}
      label={slot.label}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}
