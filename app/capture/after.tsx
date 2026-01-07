import React, { useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import Toast from 'react-native-toast-message';
import { useApp } from "@/contexts/AppContext";
import { CaptureScreen } from "@/components/CaptureScreen";

export default function AfterScreen() {
  const router = useRouter();
  const { currentProject, setAfterMedia } = useApp();
  
  const afterSlot = currentProject.template?.afterSlot;

  // If no template is selected, go back
  useEffect(() => {
    if (!currentProject.template) {
      Toast.show({
        type: 'error',
        text1: 'No template selected',
        text2: 'Please select a template first',
        position: 'top',
        visibilityTime: 2000,
      });
      router.back();
    }
  }, [currentProject.template, router]);

  const handleContinue = useCallback((media: { uri: string; width: number; height: number }) => {
    setAfterMedia(media);
    router.back();
  }, [setAfterMedia, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <CaptureScreen
      slot={afterSlot}
      title="After"
      onContinue={handleContinue}
      onBack={handleBack}
    />
  );
}
