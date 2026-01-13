import React, { useEffect, useCallback, useMemo, useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { ImageAdjustmentScreen } from "@/components/ImageAdjustmentScreen";
import { extractSlots } from "@/utils/slotParser";
import { MediaAsset } from "@/types";
import { DEFAULT_ADJUSTMENTS } from "@/utils/imageProcessing";

/**
 * Image adjustment screen for a specific slot
 * Route: /adjust/[slotId]?uri=...&width=...&height=...&isNew=true
 * 
 * Can be used in two modes:
 * 1. After capture (isNew=true): Gets image data from URL params
 * 2. Re-adjust existing (isNew=false): Gets image data from currentProject.capturedImages
 */
export default function AdjustSlotScreen() {
  const { slotId, uri, width, height, isNew } = useLocalSearchParams<{ 
    slotId: string;
    uri?: string;
    width?: string;
    height?: string;
    isNew?: string;
  }>();
  
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

  // Determine image data source
  const imageData = useMemo(() => {
    if (isNew === 'true' && uri && width && height) {
      // New capture - use URL params
      return {
        uri: decodeURIComponent(uri),
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        adjustments: DEFAULT_ADJUSTMENTS,
      };
    } else if (slotId && capturedImages[slotId]) {
      // Re-adjusting existing - use captured images
      const existing = capturedImages[slotId];
      return {
        uri: existing.uri,
        width: existing.width,
        height: existing.height,
        adjustments: existing.adjustments || DEFAULT_ADJUSTMENTS,
      };
    }
    return null;
  }, [isNew, uri, width, height, slotId, capturedImages]);

  // If no template or slot, go back
  useEffect(() => {
    if (!template) {
      router.back();
      return;
    }
    
    if (!slot && slotId) {
      router.back();
      return;
    }

    if (!imageData) {
      router.back();
      return;
    }
  }, [template, slot, slotId, imageData, router]);

  const handleConfirm = useCallback((adjustments: { translateX: number; translateY: number; scale: number }) => {
    if (slotId && imageData) {
      const mediaAsset: MediaAsset = {
        uri: imageData.uri,
        width: imageData.width,
        height: imageData.height,
        adjustments,
      };
      setCapturedImage(slotId, mediaAsset);
    }
    
    // Navigate back to editor
    // If this was a new capture, we need to go back twice (capture -> adjust -> editor)
    // If re-adjusting, just go back once
    if (isNew === 'true') {
      router.dismissAll();
      router.replace('/editor');
    } else {
      router.back();
    }
  }, [slotId, imageData, isNew, setCapturedImage, router]);

  const handleCancel = useCallback(() => {
    // If this was a new capture and user cancels, go back to capture screen
    // If re-adjusting, just go back to editor
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
