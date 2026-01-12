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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Save, Sparkles, RefreshCw, Crown, ChevronLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { TemplateCanvas } from '@/components/TemplateCanvas';
import { processImageForDimensions } from '@/utils/imageProcessing';
import { extractSlots, allSlotsCaptured, getSlotById, getCapturedSlotCount } from '@/utils/slotParser';
import { renderPreview } from '@/services/renderService';
import { usePremiumStatus, usePremiumFeature } from '@/hooks/usePremiumStatus';
import { saveRenderedPreview, createDraftDirectories } from '@/services/localStorageService';

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
  const isDiscardingRef = useRef(false);
  
  // Rendered preview state (from Templated.io)
  const [renderedPreviewUri, setRenderedPreviewUri] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  
  // Generate button animation state
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Local preview path (cached on device for instant access)
  const [localPreviewPath, setLocalPreviewPath] = useState<string | null>(null);
  
  // Track if images have been modified by user since draft was loaded
  const [imagesModifiedSinceLoad, setImagesModifiedSinceLoad] = useState(false);
  const hasInitializedFromCacheRef = useRef(false);
  
  // Track the initial state of captured images when draft/template loads
  const initialCapturedImagesRef = useRef<Record<string, string | null>>({});
  const hasSetInitialStateRef = useRef(false);
  
  // Track current template ID to detect template changes
  const currentTemplateIdRef = useRef<string | null>(null);
  
  // Track if a preview save is in progress to prevent overlapping saves
  const isSavingPreviewRef = useRef(false);
  
  // Track the last rendered preview URL to detect actual changes
  const lastSavedPreviewUrlRef = useRef<string | null>(null);

  // Premium status for watermark control
  const { isPremium, isLoading: isPremiumLoading } = usePremiumStatus();
  const { requestPremiumAccess, paywallState } = usePremiumFeature();

  // Extract slots from template
  const slots = useMemo(() => 
    template ? extractSlots(template) : [], 
    [template]
  );

  // Check if ready to proceed to publish:
  // 1. All slots must have images
  // 2. Preview must be rendered (renderedPreviewUri exists)
  // 3. Not currently rendering
  // 4. No preview error
  const canProceed = useMemo(() => 
    allSlotsCaptured(slots, capturedImages) && 
    !!renderedPreviewUri && 
    !isRendering && 
    !previewError,
    [slots, capturedImages, renderedPreviewUri, isRendering, previewError]
  );
  
  // Check if all slots are filled (separate from canProceed for UI messaging)
  const allSlotsFilled = useMemo(() => 
    allSlotsCaptured(slots, capturedImages),
    [slots, capturedImages]
  );

  // Count captured slots for progress display
  const capturedCount = useMemo(() => 
    getCapturedSlotCount(slots, capturedImages),
    [slots, capturedImages]
  );

  // Track previous capturedImages to detect actual changes
  const prevCapturedImagesRef = useRef<Record<string, { uri: string } | null>>({});

  // Reset all refs when template changes
  useEffect(() => {
    const newTemplateId = template?.id || null;
    
    if (currentTemplateIdRef.current !== newTemplateId) {
      console.log('[Editor] Template changed, resetting all refs');
      
      hasInitializedFromCacheRef.current = false;
      hasSetInitialStateRef.current = false;
      prevCapturedImagesRef.current = {};
      initialCapturedImagesRef.current = {};
      allowNavigationRef.current = false;
      isSavingPreviewRef.current = false;
      lastSavedPreviewUrlRef.current = null;
      
      setRenderedPreviewUri(null);
      setLocalPreviewPath(null);
      setImagesModifiedSinceLoad(false);
      
      currentTemplateIdRef.current = newTemplateId;
    }
  }, [template?.id]);

  // Capture initial state when draft/template first loads
  useEffect(() => {
    if (hasSetInitialStateRef.current) return;
    if (!template) return;
    
    const initialState: Record<string, string | null> = {};
    for (const [slotId, media] of Object.entries(capturedImages)) {
      initialState[slotId] = media?.uri || null;
    }
    
    initialCapturedImagesRef.current = initialState;
    hasSetInitialStateRef.current = true;
    
    console.log('[Editor] Captured initial state:', Object.keys(initialState).length, 'images');
  }, [template, capturedImages]);

  // Initialize with cached preview when loading a draft
  useEffect(() => {
    if (hasInitializedFromCacheRef.current) return;
    
    const cachedLocalPath = currentProject.localPreviewPath;
    const cachedPreviewUrl = currentProject.cachedPreviewUrl;
    const wasRenderedAsPremium = currentProject.wasRenderedAsPremium;
    
    const premiumStatusMatch = wasRenderedAsPremium === null || wasRenderedAsPremium === isPremium;
    
    if (currentProject.draftId && premiumStatusMatch) {
      if (cachedLocalPath) {
        console.log('[Editor] Using local preview file from draft:', cachedLocalPath);
        setRenderedPreviewUri(cachedLocalPath);
        setLocalPreviewPath(cachedLocalPath);
        prevCapturedImagesRef.current = { ...capturedImages };
        hasInitializedFromCacheRef.current = true;
        return;
      }
      
      if (cachedPreviewUrl) {
        console.log('[Editor] Using cached preview URL from draft');
        setRenderedPreviewUri(cachedPreviewUrl);
        prevCapturedImagesRef.current = { ...capturedImages };
        hasInitializedFromCacheRef.current = true;
        return;
      }
    }
    
    if (currentProject.draftId && (cachedLocalPath || cachedPreviewUrl) && !premiumStatusMatch) {
      console.log('[Editor] Premium status changed, will re-render preview');
      hasInitializedFromCacheRef.current = true;
      setImagesModifiedSinceLoad(true);
      return;
    }
    
    if (currentProject.draftId) {
      hasInitializedFromCacheRef.current = true;
    }
  }, [currentProject.draftId, currentProject.cachedPreviewUrl, currentProject.localPreviewPath, currentProject.wasRenderedAsPremium, isPremium, capturedImages]);

  // Trigger preview render when photos change
  const triggerPreviewRender = useCallback(async () => {
    if (!template?.templatedId) return;
    
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
    setPreviewError(null);
    
    try {
      const result = await renderPreview({
        templateId: template.templatedId,
        slotImages: photosToRender,
        hideWatermark: isPremium,
      });
      
      if (result.success && result.renderUrl) {
        setRenderedPreviewUri(result.renderUrl);
        setPreviewError(null);
      } else {
        console.warn('Preview render failed:', result.error);
        setPreviewError(result.error || 'Could not generate preview');
      }
    } catch (error) {
      console.error('Preview render error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      setPreviewError(errorMessage);
    } finally {
      setIsRendering(false);
    }
  }, [template?.templatedId, capturedImages, isPremium]);

  // Reactive preview rendering
  useEffect(() => {
    if (!template?.templatedId) return;
    
    const prevImages = prevCapturedImagesRef.current;
    const currentImages = capturedImages;
    
    const currentSlotIds = Object.keys(currentImages);
    
    let hasNewOrChangedImage = false;
    let changedSlotId: string | null = null;
    
    for (const slotId of currentSlotIds) {
      const currentUri = currentImages[slotId]?.uri;
      const prevUri = prevImages[slotId]?.uri;
      
      if (currentUri && currentUri !== prevUri) {
        hasNewOrChangedImage = true;
        changedSlotId = slotId;
        break;
      }
    }
    
    if (hasNewOrChangedImage) {
      console.log(`[Editor] Image change detected in slot: ${changedSlotId}`);
    }
    
    const newPrevImages: Record<string, { uri: string } | null> = {};
    for (const [slotId, media] of Object.entries(currentImages)) {
      newPrevImages[slotId] = media ? { uri: media.uri } : null;
    }
    prevCapturedImagesRef.current = newPrevImages;
    
    if (hasNewOrChangedImage) {
      if (renderedPreviewUri && !imagesModifiedSinceLoad && currentProject.draftId) {
        console.log('[Editor] Skipping render - using cached preview from draft');
        return;
      }
      
      setImagesModifiedSinceLoad(true);
      
      console.log('[Editor] Triggering preview render');
      triggerPreviewRender();
    }
  }, [capturedImages, template?.templatedId, triggerPreviewRender, renderedPreviewUri, imagesModifiedSinceLoad, currentProject.draftId]);

  // Auto-save preview locally when render completes
  useEffect(() => {
    const savePreviewLocally = async () => {
      if (!renderedPreviewUri || !currentProject.draftId) return;
      
      if (renderedPreviewUri.startsWith('file://')) {
        return;
      }
      
      if (lastSavedPreviewUrlRef.current === renderedPreviewUri) {
        return;
      }
      
      if (isSavingPreviewRef.current) {
        return;
      }
      
      isSavingPreviewRef.current = true;
      
      try {
        console.log('[Editor] Auto-saving preview locally for draft:', currentProject.draftId);
        
        await createDraftDirectories(currentProject.draftId);
        
        const savedPath = await saveRenderedPreview(
          currentProject.draftId,
          renderedPreviewUri,
          'default'
        );
        
        if (savedPath) {
          console.log('[Editor] Preview saved locally:', savedPath);
          lastSavedPreviewUrlRef.current = renderedPreviewUri;
          setLocalPreviewPath(savedPath);
        }
      } catch (error) {
        console.error('[Editor] Failed to save preview locally:', error);
      } finally {
        isSavingPreviewRef.current = false;
      }
    };
    
    savePreviewLocally();
  }, [renderedPreviewUri, currentProject.draftId]);

  // Redirect if no template selected
  useEffect(() => {
    if (!template) {
      if (isDiscardingRef.current) {
        isDiscardingRef.current = false;
        return;
      }
      
      router.back();
    }
  }, [template, router]);

  // Check if user has made any ACTUAL changes since opening
  const hasUnsavedChanges = useMemo(() => {
    if (capturedCount === 0) return false;
    if (!hasSetInitialStateRef.current) return false;
    
    const initialState = initialCapturedImagesRef.current;
    
    const allSlotIds = new Set([
      ...Object.keys(capturedImages),
      ...Object.keys(initialState),
    ]);
    
    for (const slotId of allSlotIds) {
      const currentUri = capturedImages[slotId]?.uri || null;
      const initialUri = initialState[slotId] || null;
      
      if (currentUri !== initialUri) {
        return true;
      }
    }
    
    return false;
  }, [capturedImages, capturedCount]);

  // Handle back navigation confirmation
  const showBackConfirmation = useCallback(() => {
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
            isDiscardingRef.current = true;
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
                renderedPreviewUrl: renderedPreviewUri,
                wasRenderedAsPremium: isPremium,
                localPreviewPath: localPreviewPath,
              });
              allowNavigationRef.current = true;
              router.back();
            } catch (error) {
              console.error('Failed to save draft:', error);
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [template, slots, capturedImages, saveDraft, currentProject.draftId, resetProject, router, renderedPreviewUri, isPremium, localPreviewPath]);

  // Handle back button press with unsaved changes check
  const handleBackPress = useCallback(() => {
    if (hasUnsavedChanges && !allowNavigationRef.current) {
      showBackConfirmation();
    } else {
      router.back();
    }
  }, [hasUnsavedChanges, showBackConfirmation, router]);

  const isEditingDraft = !!currentProject.draftId;

  // Process image for a specific slot
  const processImage = useCallback(
    async (uri: string, width: number, height: number, slotId: string) => {
      if (!template) return;

      const slot = getSlotById(slots, slotId);
      
      if (!slot) {
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
      } catch (error) {
        console.error('Failed to process image:', error);
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

  // Handle cached preview failing to load
  const handlePreviewError = useCallback(() => {
    console.log('[Editor] Cached preview failed to load, triggering re-render');
    setRenderedPreviewUri(null);
    setPreviewError('Preview expired');
    setImagesModifiedSinceLoad(true);
    triggerPreviewRender();
  }, [triggerPreviewRender]);

  // Handle retry button press when preview fails
  const handleRetryPreview = useCallback(() => {
    console.log('[Editor] User requested preview retry');
    setPreviewError(null);
    triggerPreviewRender();
  }, [triggerPreviewRender]);

  // Handle Remove Watermark toggle
  const handleRemoveWatermarkToggle = useCallback(async () => {
    if (isPremium) return;
    
    await requestPremiumAccess('remove_watermark', () => {
      console.log('[Editor] Watermark removal unlocked!');
    });
  }, [isPremium, requestPremiumAccess]);

  // Perform save draft operation
  const performSaveDraft = useCallback(async (navigateAfterSave: boolean = true) => {
    if (!template) return;

    const beforeSlot = slots.find(s => s.layerId.includes('before'));
    const afterSlot = slots.find(s => s.layerId.includes('after'));
    const beforeUri = beforeSlot ? capturedImages[beforeSlot.layerId]?.uri : null;
    const afterUri = afterSlot ? capturedImages[afterSlot.layerId]?.uri : null;

    // Build capturedImageUris map with ALL slot images
    const capturedImageUris: Record<string, string> = {};
    for (const [slotId, media] of Object.entries(capturedImages)) {
      if (media?.uri) {
        capturedImageUris[slotId] = media.uri;
      }
    }

    try {
      await saveDraft({
        templateId: template.id,
        beforeImageUri: beforeUri || null,
        afterImageUri: afterUri || null,
        existingDraftId: currentProject.draftId || undefined,
        capturedImageUris: Object.keys(capturedImageUris).length > 0 ? capturedImageUris : undefined,
        renderedPreviewUrl: renderedPreviewUri,
        wasRenderedAsPremium: isPremium,
        localPreviewPath: localPreviewPath,
      });
      
      if (navigateAfterSave) {
        router.push('/(tabs)');
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  }, [template, slots, capturedImages, saveDraft, currentProject.draftId, router, renderedPreviewUri, isPremium, localPreviewPath]);

  // Save draft - shows confirmation dialog first
  const handleSaveDraft = useCallback(() => {
    if (!template) return;

    if (capturedCount === 0) {
      Alert.alert(
        'Nothing to Save',
        'Add at least one image before saving a draft.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

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

  // Handle Generate button - show animation then navigate to publish screen
  const handleGenerate = useCallback(async () => {
    if (!canProceed || !template || isGenerating) return;
    
    // Start generation animation
    setIsGenerating(true);
    
    // Auto-save draft if there are unsaved changes (without navigation)
    // This ensures all captured images are persisted before going to publish
    if (hasUnsavedChanges) {
      try {
        await performSaveDraft(false);
      } catch (error) {
        console.error('Failed to auto-save before generate:', error);
        // Continue to publish even if save fails - images are still in memory
      }
    }
    
    // After animation delay, navigate to publish screen
    // Use replace() so Editor is removed from stack and won't react to state changes
    setTimeout(() => {
      router.replace({
        pathname: '/publish',
        params: {
          draftId: currentProject.draftId || '',
          templateId: template.id,
          templateName: template.name,
          previewUri: renderedPreviewUri || '',
          format: template.format,
          hasWatermark: (!isPremium).toString(),
        }
      });
      
      // Reset generating state after navigation
      setTimeout(() => setIsGenerating(false), 500);
    }, 1500);
  }, [canProceed, currentProject.draftId, template, renderedPreviewUri, isPremium, router, isGenerating, hasUnsavedChanges, performSaveDraft]);

  if (!template) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: isEditingDraft ? 'Edit Draft' : 'Editor',
          headerLeft: () => (
            <TouchableOpacity
              style={styles.headerBackButton}
              onPress={handleBackPress}
              activeOpacity={0.7}
            >
              <ChevronLeft size={24} color={Colors.light.text} />
              <Text style={styles.headerBackText}>Back</Text>
            </TouchableOpacity>
          ),
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
        </ScrollView>

        {/* Bottom Action Bar */}
        <View style={styles.bottomSection}>
          {/* Remove Watermark Toggle - only show for FREE users when preview is ready */}
          {allSlotsFilled && !isRendering && !isPremium && !isPremiumLoading && (
            <TouchableOpacity
              style={styles.watermarkToggleRow}
              onPress={handleRemoveWatermarkToggle}
              disabled={paywallState === 'presenting'}
              activeOpacity={0.7}
            >
              <View style={styles.watermarkToggleLeft}>
                <Crown 
                  size={18} 
                  color={Colors.light.textSecondary} 
                />
                <Text style={styles.watermarkToggleText}>
                  Remove Watermark
                </Text>
              </View>
              <Switch
                value={false}
                onValueChange={handleRemoveWatermarkToggle}
                disabled={paywallState === 'presenting'}
                trackColor={{ 
                  false: Colors.light.border, 
                  true: Colors.light.accent 
                }}
                thumbColor={Colors.light.surface}
                ios_backgroundColor={Colors.light.border}
              />
            </TouchableOpacity>
          )}

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

          {/* Generate Button */}
          <TouchableOpacity
            style={[
              styles.generateButton, 
              (!canProceed || isGenerating) && styles.generateButtonDisabled,
              isGenerating && styles.generateButtonGenerating,
            ]}
            onPress={handleGenerate}
            disabled={!canProceed || isGenerating}
            activeOpacity={0.8}
          >
            {isGenerating ? (
              <>
                <ActivityIndicator size="small" color={Colors.light.surface} />
                <Text style={styles.generateButtonText}>Generating...</Text>
              </>
            ) : (
              <>
                <Sparkles 
                  size={20} 
                  color={canProceed ? Colors.light.surface : Colors.light.textTertiary} 
                />
                <Text style={[styles.generateButtonText, !canProceed && styles.generateButtonTextDisabled]}>
                  Generate
                </Text>
              </>
            )}
          </TouchableOpacity>

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
  headerBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 8,
    marginLeft: -8,
  },
  headerBackText: {
    fontSize: 17,
    fontWeight: '400',
    color: Colors.light.text,
    marginLeft: -2,
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
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.text,
    paddingVertical: 16,
    borderRadius: 14,
  },
  generateButtonDisabled: {
    backgroundColor: Colors.light.border,
  },
  generateButtonGenerating: {
    backgroundColor: Colors.light.accent,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.surface,
  },
  generateButtonTextDisabled: {
    color: Colors.light.textTertiary,
  },
  helperText: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    marginTop: 12,
  },
  watermarkToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  watermarkToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  watermarkToggleText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.textSecondary,
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
