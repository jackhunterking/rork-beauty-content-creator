import React, { useEffect, useCallback, useMemo } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { CaptureScreen } from "@/components/CaptureScreen";
import { extractSlots, slotToImageSlot } from "@/utils/slotParser";

/**
 * Dynamic capture screen for any slot
 * Route: /capture/[slotId] (e.g., /capture/slot-before, /capture/slot-after)
 * 
 * After capturing an image, navigates to /adjust/[slotId] for position adjustment.
 */
export default function CaptureSlotScreen() {
  const { slotId } = useLocalSearchParams<{ slotId: string }>();
  const router = useRouter();
  const { currentProject } = useApp();
  
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

  const handleContinue = useCallback((media: { uri: string; width: number; height: number }) => {
    if (slotId) {
      // Navigate to adjustment screen with the captured image data
      router.push({
        pathname: `/adjust/${slotId}`,
        params: {
          uri: encodeURIComponent(media.uri),
          width: media.width.toString(),
          height: media.height.toString(),
          isNew: 'true',
        },
      });
    }
  }, [slotId, router]);

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
