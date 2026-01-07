import React, { useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import Toast from 'react-native-toast-message';
import { useApp } from "@/contexts/AppContext";
import { CaptureScreen } from "@/components/CaptureScreen";

export default function BeforeScreen() {
  const router = useRouter();
  const { currentProject, setBeforeMedia } = useApp();
  
  const beforeSlot = currentProject.template?.beforeSlot;

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
    setBeforeMedia(media);
    router.back();
  }, [setBeforeMedia, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <CaptureScreen
      slot={beforeSlot}
      title="Before"
      onContinue={handleContinue}
      onBack={handleBack}
    />
  );
}
