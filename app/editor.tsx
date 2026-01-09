import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActionSheetIOS,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { Save, Download, Share2, RefreshCw } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { TemplateCanvas } from '@/components/TemplateCanvas';
import { processImageForDimensions } from '@/utils/imageProcessing';
import { extractSlots, allSlotsCaptured, getSlotById, getCapturedSlotCount } from '@/utils/slotParser';
import { renderPreview } from '@/services/renderService';
import { downloadAndSaveToGallery } from '@/services/downloadService';
import { downloadAndShare } from '@/services/shareService';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';

export default function EditorScreen() {
  const router = useRouter();
  const { 
    currentProject, 
    setCapturedImage, 
    saveDraft, 
    isSavingDraft, 
    resetProject 
  } = useApp();
  const template = currentProject.template;
  const capturedImages = currentProject.capturedImages;
  
  // Track if we should allow navigation (after user confirms)
  const allowNavigationRef = useRef(false);
  
  // Track if we're intentionally discarding/resetting the project
  // This prevents the "no template" useEffect from triggering a second back navigation
  const isDiscardingRef = useRef(false);
  
  // Rendered preview state (from Templated.io)
  const [renderedPreviewUri, setRenderedPreviewUri] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  
  // Track if images have been modified by user since draft was loaded
  // Used to skip unnecessary API calls when reopening drafts
  const [imagesModifiedSinceLoad, setImagesModifiedSinceLoad] = useState(false);
  const hasInitializedFromCacheRef = useRef(false);
  
  // Track the initial state of captured images when draft/template loads
  // Used to determine if user made actual changes (for back button prompt)
  const initialCapturedImagesRef = useRef<Record<string, string | null>>({});
  const hasSetInitialStateRef = useRef(false);
  
  // Track current template ID to detect template changes
  const currentTemplateIdRef = useRef<string | null>(null);
  
  // Download/share state
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Premium status for watermark control
  const { isPremium } = usePremiumStatus();

  // Extract slots from template
  const slots = useMemo(() => 
    template ? extractSlots(template) : [], 
    [template]
  );

  // Check if ready to download/share:
  // 1. All slots must have images
  // 2. Preview must be rendered (renderedPreviewUri exists)
  // 3. Not currently rendering
  // 4. No preview error
  const canDownload = useMemo(() => 
    allSlotsCaptured(slots, capturedImages) && 
    !!renderedPreviewUri && 
    !isRendering && 
    !previewError,
    [slots, capturedImages, renderedPreviewUri, isRendering, previewError]
  );
  
  // Check if all slots are filled (separate from canDownload for UI messaging)
  const allSlotsFilled = useMemo(() => 
    allSlotsCaptured(slots, capturedImages),
    [slots, capturedImages]
  );

  // Count captured slots for progress display
  const capturedCount = useMemo(() => 
    getCapturedSlotCount(slots, capturedImages),
    [slots, capturedImages]
  );

  // Track previous capturedImages to detect actual changes (not just reference changes)
  const prevCapturedImagesRef = useRef<Record<string, { uri: string } | null>>({});

  // Reset all refs when template changes (handles navigating from Create page)
  // This ensures clicking a new template always starts with fresh state
  useEffect(() => {
    const newTemplateId = template?.id || null;
    
    // If template ID changed, reset all refs
    if (currentTemplateIdRef.current !== newTemplateId) {
      console.log('[Editor] Template changed, resetting all refs');
      
      // Reset all tracking refs
      hasInitializedFromCacheRef.current = false;
      hasSetInitialStateRef.current = false;
      prevCapturedImagesRef.current = {};
      initialCapturedImagesRef.current = {};
      allowNavigationRef.current = false;
      
      // Reset state
      setRenderedPreviewUri(null);
      setImagesModifiedSinceLoad(false);
      
      // Update tracked template ID
      currentTemplateIdRef.current = newTemplateId;
    }
  }, [template?.id]);

  // Capture initial state when draft/template first loads
  // This is used to determine if user made actual changes
  useEffect(() => {
    // Only set initial state once per template session
    if (hasSetInitialStateRef.current) return;
    
    // Wait until we have a template
    if (!template) return;
    
    // Capture the initial state of captured images
    const initialState: Record<string, string | null> = {};
    for (const [slotId, media] of Object.entries(capturedImages)) {
      initialState[slotId] = media?.uri || null;
    }
    
    initialCapturedImagesRef.current = initialState;
    hasSetInitialStateRef.current = true;
    
    console.log('[Editor] Captured initial state:', Object.keys(initialState).length, 'images');
  }, [template, capturedImages]);

  // Initialize with cached preview URL when loading a draft
  // This avoids an unnecessary Templated.io API call
  useEffect(() => {
    // Only run once when the draft is first loaded
    if (hasInitializedFromCacheRef.current) return;
    
    const cachedPreviewUrl = currentProject.cachedPreviewUrl;
    const wasRenderedAsPremium = currentProject.wasRenderedAsPremium;
    
    // Check if we have a cached preview and premium status matches
    // If premium status changed, we need to re-render (watermark difference)
    const premiumStatusMatch = wasRenderedAsPremium === null || wasRenderedAsPremium === isPremium;
    
    if (currentProject.draftId && cachedPreviewUrl && premiumStatusMatch) {
      console.log('[Editor] Using cached preview URL from draft');
      setRenderedPreviewUri(cachedPreviewUrl);
      // Initialize prevCapturedImages with current state to prevent immediate re-render
      prevCapturedImagesRef.current = { ...capturedImages };
      hasInitializedFromCacheRef.current = true;
    } else if (currentProject.draftId && cachedPreviewUrl && !premiumStatusMatch) {
      console.log('[Editor] Premium status changed, will re-render preview');
      // Mark as initialized but don't use cache - let the normal flow re-render
      hasInitializedFromCacheRef.current = true;
      setImagesModifiedSinceLoad(true);
    } else if (currentProject.draftId) {
      // Draft without cached preview - mark as initialized
      hasInitializedFromCacheRef.current = true;
    }
  }, [currentProject.draftId, currentProject.cachedPreviewUrl, currentProject.wasRenderedAsPremium, isPremium, capturedImages]);

  // Trigger preview render when photos change
  const triggerPreviewRender = useCallback(async () => {
    if (!template?.templatedId) return;
    
    // Only render if we have at least one photo
    const photosToRender: Record<string, string> = {};
    for (const [slotId, media] of Object.entries(capturedImages)) {
      if (media?.uri) {
        photosToRender[slotId] = media.uri;
      }
    }
    
    if (Object.keys(photosToRender).length === 0) {
      setRenderedPreviewUri(null);
      setPreviewError(null);
      return;
    }
    
    setIsRendering(true);
    setPreviewError(null); // Clear any previous error
    
    try {
      const result = await renderPreview({
        templateId: template.templatedId,
        slotImages: photosToRender,
        hideWatermark: isPremium,
      });
      
      if (result.success && result.renderUrl) {
        setRenderedPreviewUri(result.renderUrl);
        setPreviewError(null); // Clear error on success
      } else {
        console.warn('Preview render failed:', result.error);
        setPreviewError(result.error || 'Could not generate preview');
        Toast.show({
          type: 'error',
          text1: 'Preview failed',
          text2: 'Tap Retry to try again',
          position: 'top',
        });
      }
    } catch (error) {
      console.error('Preview render error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      setPreviewError(errorMessage);
      Toast.show({
        type: 'error',
        text1: 'Preview error',
        text2: 'Tap Retry to try again',
        position: 'top',
      });
    } finally {
      setIsRendering(false);
    }
  }, [template?.templatedId, capturedImages, isPremium]);

  // REACTIVE PREVIEW RENDERING
  // Automatically trigger preview render when capturedImages changes
  // This handles BOTH paths: camera capture return AND library pick
  useEffect(() => {
    // Skip if no template configured for rendering
    if (!template?.templatedId) return;
    
    // Compare current images to previous to detect actual changes
    const prevImages = prevCapturedImagesRef.current;
    const currentImages = capturedImages;
    
    // Check if any slot has a NEW or CHANGED image
    let hasNewOrChangedImage = false;
    for (const slotId of Object.keys(currentImages)) {
      const currentUri = currentImages[slotId]?.uri;
      const prevUri = prevImages[slotId]?.uri;
      
      // New image added or image changed
      if (currentUri && currentUri !== prevUri) {
        hasNewOrChangedImage = true;
        break;
      }
    }
    
    // Update ref BEFORE triggering render to prevent loops
    prevCapturedImagesRef.current = { ...currentImages };
    
    // Only trigger if there's an actual new/changed image
    if (hasNewOrChangedImage) {
      // If we have a cached preview and user hasn't modified images yet,
      // skip the API call - we're just loading the draft
      if (renderedPreviewUri && !imagesModifiedSinceLoad && currentProject.draftId) {
        console.log('[Editor] Skipping render - using cached preview from draft');
        return;
      }
      
      // Mark that user has modified images (for future saves)
      setImagesModifiedSinceLoad(true);
      
      console.log('[Editor] Detected image change, triggering preview render');
      triggerPreviewRender();
    }
  }, [capturedImages, template?.templatedId, triggerPreviewRender, renderedPreviewUri, imagesModifiedSinceLoad, currentProject.draftId]);

  // Redirect if no template selected
  // Skip this if we're intentionally discarding (to prevent double navigation)
  useEffect(() => {
    if (!template) {
      // If we're discarding, don't auto-navigate - the discard handler already navigates
      if (isDiscardingRef.current) {
        isDiscardingRef.current = false; // Reset the flag
        return;
      }
      
      Toast.show({
        type: 'error',
        text1: 'No template selected',
        text2: 'Please select a template first',
        position: 'top',
      });
      router.back();
    }
  }, [template, router]);

  // Check if user has made any ACTUAL changes since opening
  // Compare current captured images to initial state
  const hasUnsavedChanges = useMemo(() => {
    // If no images at all, no changes
    if (capturedCount === 0) return false;
    
    // If initial state hasn't been set yet, assume no changes
    if (!hasSetInitialStateRef.current) return false;
    
    const initialState = initialCapturedImagesRef.current;
    
    // Check if any slot has changed from initial state
    // Case 1: New image added (wasn't in initial state)
    // Case 2: Image changed (different URI than initial)
    // Case 3: Image removed (was in initial but not now)
    
    // Get all slot IDs from both current and initial
    const allSlotIds = new Set([
      ...Object.keys(capturedImages),
      ...Object.keys(initialState),
    ]);
    
    for (const slotId of allSlotIds) {
      const currentUri = capturedImages[slotId]?.uri || null;
      const initialUri = initialState[slotId] || null;
      
      if (currentUri !== initialUri) {
        // Found a change
        return true;
      }
    }
    
    // No changes detected
    return false;
  }, [capturedImages, capturedCount]);

  // Handle back navigation confirmation
  const showBackConfirmation = useCallback(() => {
    // Get first captured image URIs for legacy save
    const beforeSlot = slots.find(s => s.layerId.includes('before'));
    const afterSlot = slots.find(s => s.layerId.includes('after'));
    const beforeUri = beforeSlot ? capturedImages[beforeSlot.layerId]?.uri : null;
    const afterUri = afterSlot ? capturedImages[afterSlot.layerId]?.uri : null;

    Alert.alert(
      'Unsaved Changes',
      'You have unsaved changes. What would you like to do?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            allowNavigationRef.current = true;
            isDiscardingRef.current = true; // Prevent double navigation from template-null useEffect
            resetProject();
            router.back();
          },
        },
        {
          text: 'Save Draft',
          onPress: async () => {
            if (!template) return;
            try {
              await saveDraft({
                templateId: template.id,
                beforeImageUri: beforeUri || null,
                afterImageUri: afterUri || null,
                existingDraftId: currentProject.draftId || undefined,
                // Save the current preview URL so it can be reused when reopening
                renderedPreviewUrl: renderedPreviewUri,
                // Track premium status at time of render for cache invalidation
                wasRenderedAsPremium: isPremium,
              });
              Toast.show({
                type: 'success',
                text1: 'Draft saved',
                text2: 'You can continue later from Drafts',
                position: 'top',
                visibilityTime: 2000,
              });
              allowNavigationRef.current = true;
              router.back();
            } catch (error) {
              console.error('Failed to save draft:', error);
              Toast.show({
                type: 'error',
                text1: 'Save failed',
                text2: 'Please try again',
                position: 'top',
              });
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [template, slots, capturedImages, saveDraft, currentProject.draftId, resetProject, router, renderedPreviewUri, isPremium]);

  // Prevent back navigation when there are unsaved changes
  // usePreventRemove works properly with native-stack navigators (Expo Router)
  usePreventRemove(
    hasUnsavedChanges && !allowNavigationRef.current,
    ({ data }) => {
      showBackConfirmation();
    }
  );

  const isEditingDraft = !!currentProject.draftId;

  // Process image for a specific slot
  const processImage = useCallback(
    async (uri: string, width: number, height: number, slotId: string) => {
      if (!template) return;

      // Find the slot by ID
      const slot = getSlotById(slots, slotId);
      
      if (!slot) {
        Toast.show({
          type: 'error',
          text1: 'Template error',
          text2: 'Could not find slot dimensions',
          position: 'top',
        });
        return;
      }

      try {
        const processed = await processImageForDimensions(
          uri, 
          width, 
          height, 
          slot.width, 
          slot.height
        );

        setCapturedImage(slotId, {
          uri: processed.uri,
          width: processed.width,
          height: processed.height,
        });
        // useEffect will automatically trigger preview render when capturedImages changes
      } catch (error) {
        console.error('Failed to process image:', error);
        Toast.show({
          type: 'error',
          text1: 'Processing failed',
          text2: 'Please try again',
          position: 'top',
        });
      }
    },
    [template, slots, setCapturedImage]
  );

  // Navigate to camera screen for a slot
  const takePhoto = useCallback(
    (slotId: string) => {
      router.push(`/capture/${slotId}`);
    },
    [router]
  );

  // Choose from library for a slot
  const chooseFromLibrary = useCallback(
    async (slotId: string) => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await processImage(asset.uri, asset.width, asset.height, slotId);
      }
    },
    [processImage]
  );

  // Show action sheet for slot
  const handleSlotPress = useCallback(
    (slotId: string) => {
      // Don't allow interaction while rendering
      if (isRendering) {
        return;
      }

      const slot = getSlotById(slots, slotId);
      const slotLabel = slot?.label || 'Photo';

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Take Photo', 'Choose from Library'],
            cancelButtonIndex: 0,
            title: `Add ${slotLabel} Image`,
          },
          (buttonIndex) => {
            if (buttonIndex === 1) {
              takePhoto(slotId);
            } else if (buttonIndex === 2) {
              chooseFromLibrary(slotId);
            }
          }
        );
      } else {
        // Android: Use Alert as a simple alternative
        Alert.alert(
          `Add ${slotLabel} Image`,
          'Choose an option',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Take Photo', onPress: () => takePhoto(slotId) },
            { text: 'Choose from Library', onPress: () => chooseFromLibrary(slotId) },
          ]
        );
      }
    },
    [slots, isRendering, takePhoto, chooseFromLibrary]
  );

  // Handle cached preview failing to load (e.g., expired URL)
  const handlePreviewError = useCallback(() => {
    console.log('[Editor] Cached preview failed to load, triggering re-render');
    // Clear the invalid cached preview
    setRenderedPreviewUri(null);
    setPreviewError('Preview expired');
    // Mark that we need to re-render
    setImagesModifiedSinceLoad(true);
    // Trigger a fresh render
    triggerPreviewRender();
  }, [triggerPreviewRender]);

  // Handle retry button press when preview fails
  const handleRetryPreview = useCallback(() => {
    console.log('[Editor] User requested preview retry');
    setPreviewError(null);
    triggerPreviewRender();
  }, [triggerPreviewRender]);

  // Actually perform the save operation
  const performSaveDraft = useCallback(async () => {
    if (!template) return;

    // Get before/after URIs for legacy draft storage
    const beforeSlot = slots.find(s => s.layerId.includes('before'));
    const afterSlot = slots.find(s => s.layerId.includes('after'));
    const beforeUri = beforeSlot ? capturedImages[beforeSlot.layerId]?.uri : null;
    const afterUri = afterSlot ? capturedImages[afterSlot.layerId]?.uri : null;

    try {
      await saveDraft({
        templateId: template.id,
        beforeImageUri: beforeUri || null,
        afterImageUri: afterUri || null,
        existingDraftId: currentProject.draftId || undefined,
        // Save the current preview URL so it can be reused when reopening
        renderedPreviewUrl: renderedPreviewUri,
        // Track premium status at time of render for cache invalidation
        wasRenderedAsPremium: isPremium,
      });
      
      Toast.show({
        type: 'success',
        text1: 'Draft saved',
        text2: 'You can continue later from Drafts',
        position: 'top',
        visibilityTime: 2000,
      });
      
      // Navigate back to drafts screen
      router.push('/drafts');
    } catch (error) {
      console.error('Failed to save draft:', error);
      Toast.show({
        type: 'error',
        text1: 'Save failed',
        text2: 'Please try again',
        position: 'top',
      });
    }
  }, [template, slots, capturedImages, saveDraft, currentProject.draftId, router, renderedPreviewUri, isPremium]);

  // Save draft - shows confirmation dialog first
  const handleSaveDraft = useCallback(() => {
    if (!template) return;

    // Need at least one image to save
    if (capturedCount === 0) {
      Toast.show({
        type: 'info',
        text1: 'Nothing to save',
        text2: 'Add at least one image first',
        position: 'top',
        visibilityTime: 2000,
      });
      return;
    }

    // Show native confirmation dialog
    Alert.alert(
      'Save Draft',
      'Would you like to save this as a draft? You can continue editing it later.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Save',
          onPress: performSaveDraft,
        },
      ],
      { cancelable: true }
    );
  }, [template, capturedCount, performSaveDraft]);

  // Handle download - use already rendered preview URL and save to camera roll
  const handleDownload = useCallback(async () => {
    // Guard: Check if we have a rendered preview ready
    if (!renderedPreviewUri) {
      Toast.show({
        type: 'info',
        text1: 'Not ready',
        text2: 'Please wait for preview to complete',
        position: 'top',
      });
      return;
    }
    
    setIsDownloading(true);
    
    try {
      Toast.show({
        type: 'info',
        text1: 'Saving...',
        text2: 'Downloading your image',
        position: 'top',
        visibilityTime: 2000,
      });
      
      // Download from the already-rendered preview URL and save to gallery
      const result = await downloadAndSaveToGallery(renderedPreviewUri);
      
      if (!result.success) {
        throw new Error(result.error || 'Download failed');
      }
      
      Toast.show({
        type: 'success',
        text1: 'Downloaded!',
        text2: 'Image saved to your photo library',
        position: 'top',
        visibilityTime: 3000,
      });
    } catch (error) {
      console.error('Download failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Download failed',
        text2: 'Try changing an image to refresh the preview',
        position: 'top',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [renderedPreviewUri]);

  // Handle share - use already rendered preview URL and open share sheet
  const handleShare = useCallback(async () => {
    // Guard: Check if we have a rendered preview ready
    if (!renderedPreviewUri) {
      Toast.show({
        type: 'info',
        text1: 'Not ready',
        text2: 'Please wait for preview to complete',
        position: 'top',
      });
      return;
    }
    
    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Toast.show({
        type: 'error',
        text1: 'Sharing not available',
        text2: 'Your device does not support sharing',
        position: 'top',
      });
      return;
    }
    
    setIsSharing(true);
    
    try {
      Toast.show({
        type: 'info',
        text1: 'Preparing...',
        text2: 'Getting your image ready to share',
        position: 'top',
        visibilityTime: 2000,
      });
      
      // Download from the already-rendered preview URL and share
      const result = await downloadAndShare(renderedPreviewUri, undefined, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Share your creation',
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Share failed');
      }
      
    } catch (error) {
      console.error('Share failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Share failed',
        text2: 'Try changing an image to refresh the preview',
        position: 'top',
      });
    } finally {
      setIsSharing(false);
    }
  }, [renderedPreviewUri]);

  if (!template) {
    return null;
  }

  // Generate instruction text based on slot count
  const getInstructionText = () => {
    if (slots.length === 0) {
      return 'This template has no image slots configured';
    }
    if (slots.length === 1) {
      return `Tap on the slot to add your ${slots[0].label.toLowerCase()} photo`;
    }
    return `Tap on each slot to add your photos (${capturedCount}/${slots.length} added)`;
  };

  const isProcessing = isDownloading || isSharing;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: isEditingDraft ? 'Edit Draft' : 'Editor',
          headerRight: () => (
            <TouchableOpacity
              style={[styles.headerSaveButton, isSavingDraft && styles.saveButtonDisabled]}
              onPress={handleSaveDraft}
              disabled={isSavingDraft}
            >
              {isSavingDraft ? (
                <ActivityIndicator size="small" color={Colors.light.accent} />
              ) : (
                <>
                  <Save size={20} color={Colors.light.accent} />
                  <Text style={styles.headerSaveText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {/* Saving indicator */}
        {isSavingDraft && (
          <View style={styles.savingBanner}>
            <ActivityIndicator size="small" color={Colors.light.surface} />
            <Text style={styles.savingText}>Saving draft...</Text>
          </View>
        )}

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Template Canvas with rendered preview from Templated.io */}
          <TemplateCanvas
            template={template}
            onSlotPress={handleSlotPress}
            renderedPreviewUri={renderedPreviewUri}
            isRendering={isRendering}
            onPreviewError={handlePreviewError}
            isPremium={isPremium}
          />

          {/* Instructions */}
          <View style={styles.instructions}>
            <Text style={styles.instructionText}>
              {getInstructionText()}
            </Text>
          </View>
        </ScrollView>

        {/* Bottom Action Bar */}
        <View style={styles.bottomSection}>
          {/* Preview Error with Retry Button */}
          {previewError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Preview failed</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRetryPreview}
                activeOpacity={0.8}
              >
                <RefreshCw size={16} color={Colors.light.surface} />
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.actionRow}>
            {/* Download Button */}
            <TouchableOpacity
              style={[styles.actionButton, (!canDownload || isProcessing) && styles.actionButtonDisabled]}
              onPress={handleDownload}
              disabled={!canDownload || isProcessing}
              activeOpacity={0.8}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color={Colors.light.surface} />
              ) : (
                <Download size={20} color={canDownload && !isProcessing ? Colors.light.surface : Colors.light.textTertiary} />
              )}
              <Text style={[styles.actionButtonText, (!canDownload || isProcessing) && styles.actionButtonTextDisabled]}>
                {isDownloading ? 'Saving...' : 'Download'}
              </Text>
            </TouchableOpacity>

            {/* Share Button */}
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary, (!canDownload || isProcessing) && styles.actionButtonDisabled]}
              onPress={handleShare}
              disabled={!canDownload || isProcessing}
              activeOpacity={0.8}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color={Colors.light.text} />
              ) : (
                <Share2 size={20} color={canDownload && !isProcessing ? Colors.light.text : Colors.light.textTertiary} />
              )}
              <Text style={[styles.actionButtonTextSecondary, (!canDownload || isProcessing) && styles.actionButtonTextDisabled]}>
                {isSharing ? 'Sharing...' : 'Share'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Helper text - shows different messages based on state */}
          {!allSlotsFilled && !isRendering && (
            <Text style={styles.helperText}>
              Complete all slots to continue
            </Text>
          )}
          
          {allSlotsFilled && isRendering && (
            <Text style={styles.helperText}>
              Generating preview...
            </Text>
          )}
          
          {/* Premium upsell hint - only show when ready */}
          {!isPremium && canDownload && (
            <Text style={styles.watermarkHint}>
              Includes "Made with Resulta" watermark
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  safeArea: {
    flex: 1,
  },
  headerSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  headerSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.accent,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  savingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.accent,
    paddingVertical: 8,
  },
  savingText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.surface,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  instructions: {
    marginTop: 24,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.text,
    paddingVertical: 16,
    borderRadius: 14,
  },
  actionButtonSecondary: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  actionButtonDisabled: {
    backgroundColor: Colors.light.border,
    borderColor: Colors.light.border,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.surface,
  },
  actionButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  actionButtonTextDisabled: {
    color: Colors.light.textTertiary,
  },
  helperText: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    marginTop: 12,
  },
  watermarkHint: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FEE8E8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.error,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.error,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.surface,
  },
});
