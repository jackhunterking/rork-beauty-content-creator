import React, { useEffect, useCallback, useMemo } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { CaptureScreen } from "@/components/CaptureScreen";
import { extractSlots, slotToImageSlot } from "@/utils/slotParser";
import { MediaAsset } from "@/types";

/**
 * Dynamic capture screen for any slot
 * Route: /capture/[slotId] (e.g., /capture/slot-before, /capture/slot-after)
 * 
 * After capturing and adjusting an image, directly sets it in the app context
 * and returns to the editor (preserving editor state including overlays).
 */
export default function CaptureSlotScreen() {
  const { slotId } = useLocalSearchParams<{ slotId: string }>();
  const router = useRouter();
  const { currentProject, setCapturedImage } = useApp();
  
  const template = currentProject.template;
  
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

  // If no template is selected, go back
  useEffect(() => {
    if (!template) {
      router.back();
      return;
    }
    
    if (!slot && slotId) {
      router.back();
    }
  }, [template, slot, slotId, router]);

  // Handle continue - directly set the captured image and return to editor
  const handleContinue = useCallback((media: { 
    uri: string; 
    width: number; 
    height: number;
    adjustments: {
      translateX: number;
      translateY: number;
      scale: number;
    };
  }) => {
    if (slotId) {
      console.log('[CaptureSlot] Setting captured image for slot:', slotId, {
        uri: media.uri.substring(0, 50) + '...',
        width: media.width,
        height: media.height,
        adjustments: media.adjustments,
      });
      
      // Create media asset with adjustments
      const mediaAsset: MediaAsset = {
        uri: media.uri,
        width: media.width,
        height: media.height,
        adjustments: media.adjustments,
      };
      
      // Set the captured image directly in the app context
      setCapturedImage(slotId, mediaAsset);
      
      // Navigate back to the existing editor screen (preserves overlays!)
      router.back();
    }
  }, [slotId, setCapturedImage, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // Convert Slot to ImageSlot format for CaptureScreen compatibility
  const imageSlot = useMemo(() => 
    slot ? slotToImageSlot(slot) : undefined,
    [slot]
  );

  return (
    <CaptureScreen
      slot={imageSlot}
      title={slot?.label || 'Photo'}
      onContinue={handleContinue}
      onBack={handleBack}
    />
  );
}
