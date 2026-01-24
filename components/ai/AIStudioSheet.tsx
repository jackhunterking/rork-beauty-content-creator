/**
 * AI Studio Sheet
 * 
 * Main container for AI enhancement features.
 * Large detent bottom sheet (90% of screen height).
 * Contains navigation state for feature-specific views.
 * 
 * REFACTORED: Uses unified AIResult pattern to prevent state sync issues.
 * Instead of separate enhancedImageUri and backgroundInfo states,
 * we now use a single pendingResult that contains all AI output data.
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
import type { AIFeatureKey, BackgroundPreset, Slot, MediaAsset, SubscriptionTier } from '@/types';
import { AIProcessingProgress } from '@/services/aiService';
import type { AIResult, BackgroundInfo } from '@/domains/editor/types';
import { useTieredSubscription } from '@/hooks/usePremiumStatus';

import AIStudioHomeView from './AIStudioHomeView';
import ImageSlotCarousel from './ImageSlotCarousel';
import AutoQualityView from './AutoQualityView';
import RemoveBackgroundView from './RemoveBackgroundView';
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
  | 'background_remove'
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
  /** User's subscription tier - used to determine if they can access AI features */
  tier: SubscriptionTier;
  /** Called when AI enhancement is applied - includes complete AIResult */
  onApply: (slotId: string, result: AIResult) => void;
  onSkip: () => void;
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
  tier,
  onApply,
  onSkip,
  onAddImage,
  initialView = 'home',
  navTrigger = 0,
  transformedImages = {},
  originalImagesForAI = {},
}: AIStudioSheetProps) {
  const insets = useSafeAreaInsets();
  
  // Get paywall trigger from subscription hook
  const { requestStudioAccess } = useTieredSubscription();
  
  // Handle upgrade button press - triggers Studio paywall
  const handleUpgrade = useCallback(async () => {
    await requestStudioAccess(undefined, 'ai_studio');
  }, [requestStudioAccess]);
  
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // REFACTORED: Single pendingResult contains ALL AI output data bundled together
  // This prevents the race condition where separate state variables could get out of sync
  const [pendingResult, setPendingResult] = useState<AIResult | null>(null);
  // Track if we've already received a completed result (to ignore duplicate callbacks)
  const hasReceivedResultRef = useRef(false);
  
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
    setPendingResult(null);
    setErrorMessage(null);
    setProgress(null);
    hasReceivedResultRef.current = false;
  }, []);
  
  // Handle processing progress
  // REFACTORED: Accept completed results, but PREFER ones with backgroundInfo
  // For background_replace: aiService returns URL first (no backgroundInfo), then 
  // ReplaceBackgroundView returns the complete result with backgroundInfo
  const handleProgress = useCallback((p: AIProcessingProgress) => {
    setProgress(p);
    
    if (p.status === 'completed' && p.outputUrl) {
      // For background_replace feature: 
      // - aiService webhook fires first with URL but NO backgroundInfo
      // - ReplaceBackgroundView then calls with URL AND backgroundInfo
      // We should PREFER the one with backgroundInfo
      if (hasReceivedResultRef.current) {
        // Already received a result - check if new one has MORE data
        if (p.backgroundInfo && selectedFeature === 'background_replace') {
          // This is the REAL result from ReplaceBackgroundView with the color info
          // Accept it to update the result with backgroundInfo
        } else {
          // Ignore duplicate completed callbacks (e.g., from polling fallback)
          return;
        }
      }
      hasReceivedResultRef.current = true;
      
      // Create complete AIResult with all data bundled together
      // For background_replace AND background_remove: the output IS the transparent PNG, always cache it
      // This allows later color changes without re-running the birefnet API
      const isBackgroundFeature = selectedFeature === 'background_replace' || selectedFeature === 'background_remove';
      const result: AIResult = {
        uri: p.outputUrl,
        featureKey: selectedFeature || 'auto_quality',
        // CRITICAL: For background features, the outputUrl IS the transparent PNG - ALWAYS cache it
        // This allows color changes without re-running the birefnet API
        transparentPngUrl: isBackgroundFeature ? p.outputUrl : undefined,
        backgroundInfo: p.backgroundInfo,
      };
      
      setPendingResult(result);
      setCurrentView('success');
    } else if (p.status === 'failed') {
      setErrorMessage(p.error || 'Enhancement failed');
      setCurrentView('error');
    }
  }, [selectedFeature]);
  
  // Start processing
  const handleStartProcessing = useCallback(() => {
    abortControllerRef.current = new AbortController();
    hasReceivedResultRef.current = false; // Reset for new processing
    setPendingResult(null);
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
  
  // Apply enhanced image - now passes complete AIResult
  const handleApplyEnhanced = useCallback(() => {
    if (pendingResult && internalSelectedSlotId) {
      onApply(internalSelectedSlotId, pendingResult);
      bottomSheetRef.current?.dismiss();
    }
  }, [pendingResult, internalSelectedSlotId, onApply, bottomSheetRef]);
  
  // Try another enhancement
  const handleTryAnother = useCallback(() => {
    setPendingResult(null);
    setCurrentView('home');
    setSelectedFeature(null);
    setProgress(null);
    hasReceivedResultRef.current = false;
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
    // Show premium prompt only for FREE users
    // Pro users should see AI features (with Studio paywall when they try to use them)
    // Studio users have full access
    if (tier === 'free') {
      return (
        <PremiumAIPrompt
          onUpgrade={handleUpgrade}
          onClose={handleSkip}
        />
      );
    }
    
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
        
      case 'background_remove':
        return (
          <RemoveBackgroundView
            imageUri={imageUriForAI}
            imageSize={imageSize}
            isAlreadyEnhanced={aiEnhancementsApplied.includes('background_remove')}
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
        // REFACTORED: Use pendingResult which contains all bundled data
        // For Auto Quality: use existing backgroundInfo from the image (user's current perceived state)
        // For the comparison view:
        // - previousBackgroundInfo: what the user CURRENTLY has (their existing background state)
        // - newBackgroundInfo: what the user WILL GET after applying (the new color/gradient)
        const previousBackgroundInfo = selectedImage?.backgroundInfo;
        const newBackgroundInfo = pendingResult?.backgroundInfo;
        
        return (
          <AISuccessOverlay
            originalUri={imageUriForAI}
            enhancedUri={pendingResult?.uri || ''}
            featureKey={pendingResult?.featureKey || 'auto_quality'}
            onKeepEnhanced={handleApplyEnhanced}
            onRevert={handleTryAnother}
            previousBackgroundInfo={previousBackgroundInfo}
            newBackgroundInfo={newBackgroundInfo}
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
