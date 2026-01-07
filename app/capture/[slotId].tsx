import React, { useEffect, useCallback, useMemo } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import Toast from 'react-native-toast-message';
import { useApp } from "@/contexts/AppContext";
import { CaptureScreen } from "@/components/CaptureScreen";
import { extractSlots, slotToImageSlot } from "@/utils/slotParser";
import { MediaAsset } from "@/types";

/**
 * Dynamic capture screen for any slot
 * Route: /capture/[slotId] (e.g., /capture/slot-before, /capture/slot-after)
 * 
 * Replaces the hardcoded before.tsx and after.tsx screens with a single
 * dynamic route that works for any slot based on layer ID.
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
      Toast.show({
        type: 'error',
        text1: 'No template selected',
        text2: 'Please select a template first',
        position: 'top',
        visibilityTime: 2000,
      });
      router.back();
      return;
    }
    
    if (!slot && slotId) {
      Toast.show({
        type: 'error',
        text1: 'Slot not found',
        text2: `Could not find slot: ${slotId}`,
        position: 'top',
        visibilityTime: 2000,
      });
      router.back();
    }
  }, [template, slot, slotId, router]);

  const handleContinue = useCallback((media: { uri: string; width: number; height: number }) => {
    if (slotId) {
      const mediaAsset: MediaAsset = {
        uri: media.uri,
        width: media.width,
        height: media.height,
      };
      setCapturedImage(slotId, mediaAsset);
    }
    router.back();
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

