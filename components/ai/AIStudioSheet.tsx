/**
 * AI Studio Sheet
 * 
 * Main container for AI enhancement features.
 * Large detent bottom sheet (90% of screen height).
 * Contains navigation state for feature-specific views.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import Colors from '@/constants/colors';
import type { AIFeatureKey, BackgroundPreset, Slot, MediaAsset } from '@/types';
import { AIProcessingProgress } from '@/services/aiService';

import AIStudioHomeView from './AIStudioHomeView';
import ImageSlotCarousel from './ImageSlotCarousel';
import AutoQualityView from './AutoQualityView';
import ReplaceBackgroundView from './ReplaceBackgroundView';
import AIProcessingOverlay from './AIProcessingOverlay';
import AISuccessOverlay from './AISuccessOverlay';
import AIErrorView from './AIErrorView';
import PremiumAIPrompt from './PremiumAIPrompt';
import AIAlreadyAppliedToast from './AIAlreadyAppliedToast';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// AI Studio view states
export type AIStudioView = 
  | 'home'
  | 'auto_quality'
  | 'background_replace'
  | 'processing'
  | 'success'
  | 'error';

export interface AIStudioSheetProps {
  bottomSheetRef: React.RefObject<BottomSheetModal>;
  /** All available slots from the template */
  slots: Slot[];
  /** Captured images keyed by slot ID */
  capturedImages: Record<string, MediaAsset | null>;
  /** Currently selected slot ID (if any) */
  selectedSlotId: string | null;
  isPremium: boolean;
  /** Called when AI enhancement is applied - includes slotId, enhanced URI, feature key, and optional background info */
  onApply: (slotId: string, enhancedUri: string, featureKey: AIFeatureKey, backgroundInfo?: AIProcessingProgress['backgroundInfo']) => void;
  onSkip: () => void;
  onUpgrade?: () => void;
  /** Callback when user wants to add an image (navigates to capture) */
  onAddImage?: () => void;
  /** Initial view to navigate to when sheet opens (defaults to 'home') */
  initialView?: AIFeatureKey | 'home';
  /** Navigation trigger - when this changes, force navigate to initialView */
  navTrigger?: number;
  /** CROPPED images for DISPLAY in AI Studio preview (shows user's current view) */
  transformedImages?: Record<string, string>;
  /** ORIGINAL images for AI PROCESSING (full images, not cropped) */
  originalImagesForAI?: Record<string, string>;
}

export default function AIStudioSheet({
  bottomSheetRef,
  slots,
  capturedImages,
  selectedSlotId: externalSelectedSlotId,
  isPremium,
  onApply,
  onSkip,
  onUpgrade,
  onAddImage,
  initialView = 'home',
  navTrigger = 0,
  transformedImages = {},
  originalImagesForAI = {},
}: AIStudioSheetProps) {
  const insets = useSafeAreaInsets();
  
  // Internal selected slot state (initialized from external, can change within sheet)
  const [internalSelectedSlotId, setInternalSelectedSlotId] = useState<string | null>(externalSelectedSlotId);
  
  // Get the currently selected slot's image
  const selectedImage = internalSelectedSlotId ? capturedImages[internalSelectedSlotId] : null;
  // DISPLAY URI: Use cropped/transformed image for preview (shows user's current view)
  const displayUri = internalSelectedSlotId ? transformedImages[internalSelectedSlotId] : null;
  // AI URI: Use original full image for AI processing
  const aiUri = internalSelectedSlotId ? originalImagesForAI[internalSelectedSlotId] : null;
  // imageUri for display - prefer cropped, fallback to original
  const imageUri = displayUri || selectedImage?.uri || '';
  // imageUriForAI - prefer full original, fallback to display
  const imageUriForAI = aiUri || displayUri || selectedImage?.uri || '';
  const imageSize = {
    width: selectedImage?.width || 1080,
    height: selectedImage?.height || 1080,
  };
  
  // Get AI enhancements already applied to this image
  const aiEnhancementsApplied = selectedImage?.aiEnhancementsApplied ?? [];
  
  // Navigation state - initialize based on initialView prop
  const [currentView, setCurrentView] = useState<AIStudioView>(
    initialView === 'home' ? 'home' : initialView
  );
  const [selectedFeature, setSelectedFeature] = useState<AIFeatureKey | null>(
    initialView !== 'home' ? initialView : null
  );
  
  // Navigate when navTrigger changes (indicating a new navigation intent)
  // This ensures clicking a feature button ALWAYS navigates there, even if initialView is the same
  const prevNavTriggerRef = useRef(navTrigger);
  React.useEffect(() => {
    if (navTrigger !== prevNavTriggerRef.current) {
      prevNavTriggerRef.current = navTrigger;
      // Always navigate to the specified view when trigger changes
      if (initialView === 'home') {
        setCurrentView('home');
        setSelectedFeature(null);
      } else {
        setCurrentView(initialView);
        setSelectedFeature(initialView);
      }
    }
  }, [navTrigger, initialView]);
  
  // Sync internal selected slot with external when sheet opens
  React.useEffect(() => {
    if (externalSelectedSlotId) {
      setInternalSelectedSlotId(externalSelectedSlotId);
    }
  }, [externalSelectedSlotId]);
  
  // Handle slot selection from carousel
  const handleSelectSlot = useCallback((slotId: string) => {
    setInternalSelectedSlotId(slotId);
  }, []);
  
  // Processing state
  const [progress, setProgress] = useState<AIProcessingProgress | null>(null);
  const [enhancedImageUri, setEnhancedImageUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Background info for solid/gradient replacement (to display in comparison view)
  const [backgroundInfo, setBackgroundInfo] = useState<AIProcessingProgress['backgroundInfo'] | null>(null);
  
  // Toast state for "already applied" feedback
  const [toastVisible, setToastVisible] = useState(false);
  const [toastFeatureKey, setToastFeatureKey] = useState<AIFeatureKey>('auto_quality');
  
  // For cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Snap points - large detent (95% of screen height)
  // Using 95% ensures the sheet opens nearly full screen
  const snapPoints = React.useMemo(() => ['95%'], []);
  
  // Navigate to feature view
  const handleSelectFeature = useCallback((featureKey: AIFeatureKey) => {
    setSelectedFeature(featureKey);
    setCurrentView(featureKey);
  }, []);
  
  // Handle tap on already-applied feature (show toast instead of navigating)
  const handleAlreadyAppliedTap = useCallback((featureKey: AIFeatureKey) => {
    setToastFeatureKey(featureKey);
    setToastVisible(true);
  }, []);
  
  // Dismiss toast
  const handleDismissToast = useCallback(() => {
    setToastVisible(false);
  }, []);
  
  // Go back to home view
  const handleBack = useCallback(() => {
    setCurrentView('home');
    setSelectedFeature(null);
    setEnhancedImageUri(null);
    setErrorMessage(null);
    setProgress(null);
    setBackgroundInfo(null);
  }, []);
  
  // Handle processing progress
  const handleProgress = useCallback((p: AIProcessingProgress) => {
    setProgress(p);
    
    if (p.status === 'completed' && p.outputUrl) {
      console.log('[AIStudioSheet] Received enhanced URL:', p.outputUrl);
      setEnhancedImageUri(p.outputUrl);
      // Store background info for transparent PNG display in comparison view
      if (p.backgroundInfo) {
        console.log('[AIStudioSheet] Background info received:', p.backgroundInfo.type);
        setBackgroundInfo(p.backgroundInfo);
      } else {
        setBackgroundInfo(null);
      }
      setCurrentView('success');
    } else if (p.status === 'failed') {
      setErrorMessage(p.error || 'Enhancement failed');
      setCurrentView('error');
    }
  }, []);
  
  // Start processing
  const handleStartProcessing = useCallback(() => {
    abortControllerRef.current = new AbortController();
    setCurrentView('processing');
    setProgress({
      status: 'submitting',
      message: 'Starting enhancement...',
      progress: 0,
    });
  }, []);
  
  // Cancel processing
  const handleCancelProcessing = useCallback(() => {
    abortControllerRef.current?.abort();
    handleBack();
  }, [handleBack]);
  
  // Apply enhanced image
  const handleApplyEnhanced = useCallback(() => {
    if (enhancedImageUri && internalSelectedSlotId && selectedFeature) {
      onApply(internalSelectedSlotId, enhancedImageUri, selectedFeature, backgroundInfo || undefined);
      bottomSheetRef.current?.dismiss();
    }
  }, [enhancedImageUri, internalSelectedSlotId, selectedFeature, backgroundInfo, onApply, bottomSheetRef]);
  
  // Try another enhancement
  const handleTryAnother = useCallback(() => {
    setEnhancedImageUri(null);
    setCurrentView('home');
    setSelectedFeature(null);
    setProgress(null);
    setBackgroundInfo(null);
  }, []);
  
  // Retry after error
  const handleRetry = useCallback(() => {
    setErrorMessage(null);
    if (selectedFeature) {
      setCurrentView(selectedFeature);
    } else {
      setCurrentView('home');
    }
  }, [selectedFeature]);
  
  // Skip AI and continue
  const handleSkip = useCallback(() => {
    bottomSheetRef.current?.dismiss();
    onSkip();
  }, [bottomSheetRef, onSkip]);
  
  // Render backdrop
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );
  
  // Get abort signal for processing
  const getAbortSignal = useCallback(() => {
    return abortControllerRef.current?.signal;
  }, []);
  
  // Render current view
  const renderContent = () => {
    // TODO: Re-enable premium check when Superwall is integrated
    // For development, bypass premium check
    // if (!isPremium) {
    //   return (
    //     <PremiumAIPrompt
    //       onUpgrade={onUpgrade || (() => {})}
    //       onClose={handleSkip}
    //     />
    //   );
    // }
    
    switch (currentView) {
      case 'home':
        return (
          <AIStudioHomeView
            slots={slots}
            capturedImages={capturedImages}
            selectedSlotId={internalSelectedSlotId}
            transformedImages={transformedImages}
            aiEnhancementsApplied={aiEnhancementsApplied}
            onSelectSlot={handleSelectSlot}
            onSelectFeature={handleSelectFeature}
            onAlreadyAppliedTap={handleAlreadyAppliedTap}
            onSkip={handleSkip}
            onAddImage={onAddImage}
          />
        );
        
      case 'auto_quality':
        return (
          <AutoQualityView
            imageUri={imageUri}
            aiImageUri={imageUriForAI}
            imageSize={imageSize}
            isAlreadyEnhanced={aiEnhancementsApplied.includes('auto_quality')}
            backgroundInfo={selectedImage?.backgroundInfo}
            onBack={handleBack}
            onStartProcessing={handleStartProcessing}
            onProgress={handleProgress}
            getAbortSignal={getAbortSignal}
          />
        );
        
      case 'background_replace':
        return (
          <ReplaceBackgroundView
            imageUri={imageUri}
            imageSize={imageSize}
            isPremium={isPremium}
            isAlreadyEnhanced={aiEnhancementsApplied.includes('background_replace')}
            transparentPngUrl={selectedImage?.transparentPngUrl}
            currentBackgroundInfo={selectedImage?.backgroundInfo}
            onBack={handleBack}
            onStartProcessing={handleStartProcessing}
            onProgress={handleProgress}
            getAbortSignal={getAbortSignal}
          />
        );
        
      case 'processing':
        return (
          <AIProcessingOverlay
            progress={progress?.progress || 0}
            message={progress?.message || 'Processing...'}
            featureKey={selectedFeature || 'auto_quality'}
            onCancel={handleCancelProcessing}
          />
        );
        
      case 'success':
        // For Auto Quality: use existing backgroundInfo from the image (user's current perceived state)
        // For Replace Background: use the new backgroundInfo from the API response
        const successBackgroundInfo = selectedFeature === 'auto_quality' 
          ? selectedImage?.backgroundInfo 
          : backgroundInfo;
        
        console.log('[AIStudioSheet] Success view - feature:', selectedFeature);
        console.log('[AIStudioSheet] Success view - selectedImage?.backgroundInfo:', selectedImage?.backgroundInfo);
        console.log('[AIStudioSheet] Success view - backgroundInfo state:', backgroundInfo);
        console.log('[AIStudioSheet] Success view - successBackgroundInfo:', successBackgroundInfo);
        
        return (
          <AISuccessOverlay
            originalUri={imageUriForAI}
            enhancedUri={enhancedImageUri!}
            featureKey={selectedFeature || 'auto_quality'}
            onKeepEnhanced={handleApplyEnhanced}
            onRevert={handleTryAnother}
            backgroundInfo={successBackgroundInfo || undefined}
          />
        );
        
      case 'error':
        return (
          <AIErrorView
            error={errorMessage || 'Something went wrong'}
            onRetry={handleRetry}
            onDismiss={handleSkip}
          />
        );
        
      default:
        return null;
    }
  };

  return (
    <>
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        index={0}
        enablePanDownToClose
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.indicator}
        backgroundStyle={styles.sheetBackground}
        style={styles.sheet}
      >
        <BottomSheetView style={[styles.content, { height: SCREEN_HEIGHT * 0.95 - 40 }]}>
          {renderContent()}
        </BottomSheetView>
      </BottomSheetModal>
      
      {/* Toast for "already applied" feedback */}
      <AIAlreadyAppliedToast
        visible={toastVisible}
        featureKey={toastFeatureKey}
        onDismiss={handleDismissToast}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetBackground: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  indicator: {
    backgroundColor: Colors.light.border,
    width: 36,
    height: 4,
  },
  content: {
    flex: 1,
  },
});
