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
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import Colors from '@/constants/Colors';
import type { AIFeatureKey, BackgroundPreset } from '@/types';
import { AIProcessingProgress } from '@/services/aiService';

import AIStudioHomeView from './AIStudioHomeView';
import AutoQualityView from './AutoQualityView';
import RemoveBackgroundView from './RemoveBackgroundView';
import ReplaceBackgroundView from './ReplaceBackgroundView';
import AIProcessingOverlay from './AIProcessingOverlay';
import AISuccessOverlay from './AISuccessOverlay';
import AIErrorView from './AIErrorView';
import PremiumAIPrompt from './PremiumAIPrompt';

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
  bottomSheetRef: React.RefObject<BottomSheet>;
  imageUri: string;
  imageSize: { width: number; height: number };
  isPremium: boolean;
  onApply: (enhancedUri: string) => void;
  onSkip: () => void;
  onUpgrade?: () => void;
}

export default function AIStudioSheet({
  bottomSheetRef,
  imageUri,
  imageSize,
  isPremium,
  onApply,
  onSkip,
  onUpgrade,
}: AIStudioSheetProps) {
  const insets = useSafeAreaInsets();
  
  // Navigation state
  const [currentView, setCurrentView] = useState<AIStudioView>('home');
  const [selectedFeature, setSelectedFeature] = useState<AIFeatureKey | null>(null);
  
  // Processing state
  const [progress, setProgress] = useState<AIProcessingProgress | null>(null);
  const [enhancedImageUri, setEnhancedImageUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // For cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Snap points - large detent (90%)
  const snapPoints = React.useMemo(() => [SCREEN_HEIGHT * 0.9], []);
  
  // Navigate to feature view
  const handleSelectFeature = useCallback((featureKey: AIFeatureKey) => {
    setSelectedFeature(featureKey);
    setCurrentView(featureKey);
  }, []);
  
  // Go back to home view
  const handleBack = useCallback(() => {
    setCurrentView('home');
    setSelectedFeature(null);
    setEnhancedImageUri(null);
    setErrorMessage(null);
    setProgress(null);
  }, []);
  
  // Handle processing progress
  const handleProgress = useCallback((p: AIProcessingProgress) => {
    setProgress(p);
    
    if (p.status === 'completed' && p.outputUrl) {
      setEnhancedImageUri(p.outputUrl);
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
    if (enhancedImageUri) {
      onApply(enhancedImageUri);
      bottomSheetRef.current?.close();
    }
  }, [enhancedImageUri, onApply, bottomSheetRef]);
  
  // Try another enhancement
  const handleTryAnother = useCallback(() => {
    setEnhancedImageUri(null);
    setCurrentView('home');
    setSelectedFeature(null);
    setProgress(null);
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
    bottomSheetRef.current?.close();
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
    // Show premium prompt for non-premium users
    if (!isPremium) {
      return (
        <PremiumAIPrompt
          onUpgrade={onUpgrade || (() => {})}
          onClose={handleSkip}
        />
      );
    }
    
    switch (currentView) {
      case 'home':
        return (
          <AIStudioHomeView
            imageUri={imageUri}
            imageSize={imageSize}
            onSelectFeature={handleSelectFeature}
            onSkip={handleSkip}
          />
        );
        
      case 'auto_quality':
        return (
          <AutoQualityView
            imageUri={imageUri}
            imageSize={imageSize}
            onBack={handleBack}
            onStartProcessing={handleStartProcessing}
            onProgress={handleProgress}
            getAbortSignal={getAbortSignal}
          />
        );
        
      case 'background_remove':
        return (
          <RemoveBackgroundView
            imageUri={imageUri}
            imageSize={imageSize}
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
            onBack={handleBack}
            onStartProcessing={handleStartProcessing}
            onProgress={handleProgress}
            getAbortSignal={getAbortSignal}
          />
        );
        
      case 'processing':
        return (
          <AIProcessingOverlay
            progress={progress}
            onCancel={handleCancelProcessing}
          />
        );
        
      case 'success':
        return (
          <AISuccessOverlay
            originalUri={imageUri}
            enhancedUri={enhancedImageUri!}
            onApply={handleApplyEnhanced}
            onTryAnother={handleTryAnother}
          />
        );
        
      case 'error':
        return (
          <AIErrorView
            errorMessage={errorMessage || 'Something went wrong'}
            onRetry={handleRetry}
            onCancel={handleSkip}
          />
        );
        
      default:
        return null;
    }
  };
  
  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.indicator}
      backgroundStyle={styles.sheetBackground}
      style={styles.sheet}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom }]}>
        {renderContent()}
      </BottomSheetView>
    </BottomSheet>
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
