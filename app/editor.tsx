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
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import BottomSheet from '@gorhom/bottom-sheet';
import ViewShot from 'react-native-view-shot';
import { Save, Sparkles, RefreshCw, Crown, ChevronLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { TemplateCanvas } from '@/components/TemplateCanvas';
import { 
  processImageForAdjustment, 
  applyAdjustmentsAndCrop, 
  DEFAULT_ADJUSTMENTS 
} from '@/utils/imageProcessing';
import { extractSlots, allSlotsCaptured, getSlotById, getCapturedSlotCount } from '@/utils/slotParser';
import { renderPreview } from '@/services/renderService';
import { usePremiumStatus, usePremiumFeature } from '@/hooks/usePremiumStatus';
import { saveRenderedPreview, createDraftDirectories } from '@/services/localStorageService';
import { 
  OverlayLayer, 
  OverlayActionBar, 
  OverlayStyleSheet 
} from '@/components/overlays';
import {
  Overlay,
  OverlayType,
  OverlayTransform,
  TextOverlay,
  DateOverlay,
  createTextOverlay,
  createDateOverlay,
  createLogoOverlay,
  isTextBasedOverlay,
} from '@/types/overlays';
import { 
  saveOverlays, 
  loadOverlays 
} from '@/services/overlayPersistenceService';

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

  // Window dimensions for canvas sizing
  const { width: screenWidth } = useWindowDimensions();
  const CANVAS_PADDING = 20;
  
  // Overlay state
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const styleSheetRef = useRef<BottomSheet>(null);
  
  // Track initial overlay state for change detection
  const initialOverlaysRef = useRef<Overlay[]>([]);
  const hasSetInitialOverlaysRef = useRef(false);
  
  // ViewShot ref for capturing canvas with overlays
  const viewShotRef = useRef<ViewShot>(null);

  // Calculate canvas dimensions (matching TemplateCanvas logic)
  const canvasDimensions = useMemo(() => {
    if (!template) return { width: 0, height: 0 };
    
    const maxCanvasWidth = screenWidth - CANVAS_PADDING * 2;
    const aspectRatio = template.canvasWidth / template.canvasHeight;
    
    let width = maxCanvasWidth;
    let height = width / aspectRatio;
    
    const maxHeight = screenWidth * 1.2;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    
    return { width, height };
  }, [template, screenWidth]);

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
      
      // Reset overlays when template changes - but don't reset lastLoadedDraftIdRef here
      // It will be handled by the overlay loading effect
      setOverlays([]);
      setSelectedOverlayId(null);
      initialOverlaysRef.current = [];
      hasSetInitialOverlaysRef.current = false;
      // Force re-load overlays for this draft by clearing lastLoadedDraftIdRef
      // This ensures overlays are loaded even if the draft ID hasn't changed
      
      currentTemplateIdRef.current = newTemplateId;
    }
  }, [template?.id]);

  // Track the last loaded draft ID to prevent duplicate loads
  const lastLoadedDraftIdRef = useRef<string | null>(null);

  // Load overlays when loading a draft
  useEffect(() => {
    const loadDraftOverlays = async () => {
      // No draft - reset overlays and initial state
      if (!currentProject.draftId) {
        if (lastLoadedDraftIdRef.current !== null) {
          // We had a draft before but now we don't - clear overlays
          setOverlays([]);
          initialOverlaysRef.current = [];
          hasSetInitialOverlaysRef.current = true;
          lastLoadedDraftIdRef.current = null;
          console.log('[Editor] No draft ID, cleared overlays');
        }
        return;
      }
      
      // Skip if we already loaded this draft's overlays
      if (lastLoadedDraftIdRef.current === currentProject.draftId && hasSetInitialOverlaysRef.current) {
        console.log('[Editor] Overlays already loaded for draft:', currentProject.draftId);
        return;
      }
      
      console.log('[Editor] Loading overlays for draft:', currentProject.draftId);
      
      try {
        const savedOverlays = await loadOverlays(currentProject.draftId);
        console.log(`[Editor] Loaded ${savedOverlays.length} overlays from draft`);
        
        // Always set overlays (even if empty) to ensure clean state
        setOverlays(savedOverlays);
        
        // Set initial overlay state for change detection
        initialOverlaysRef.current = savedOverlays;
        hasSetInitialOverlaysRef.current = true;
        lastLoadedDraftIdRef.current = currentProject.draftId;
        
        console.log(`[Editor] Captured initial overlay state: ${savedOverlays.length} overlays`);
      } catch (error) {
        console.error('[Editor] Failed to load overlays:', error);
        // Set empty initial state on error
        setOverlays([]);
        initialOverlaysRef.current = [];
        hasSetInitialOverlaysRef.current = true;
        lastLoadedDraftIdRef.current = currentProject.draftId;
      }
    };
    
    loadDraftOverlays();
  }, [currentProject.draftId]);

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
  // Applies image adjustments (pan/zoom) before uploading to Templated.io
  const triggerPreviewRender = useCallback(async () => {
    if (!template?.templatedId) return;
    
    // Filter images that have URIs
    const imagesToProcess = Object.entries(capturedImages).filter(
      ([_, media]) => media?.uri
    );
    
    if (imagesToProcess.length === 0) {
      setRenderedPreviewUri(null);
      setPreviewError(null);
      return;
    }
    
    setIsRendering(true);
    setPreviewError(null);
    
    try {
      // Apply adjustments to each image before uploading
      const photosToRender: Record<string, string> = {};
      
      for (const [slotId, media] of imagesToProcess) {
        if (!media) continue;
        
        const slot = getSlotById(slots, slotId);
        if (!slot) {
          // If no slot info, use original image
          photosToRender[slotId] = media.uri;
          continue;
        }
        
        // Check if image has adjustments that need to be applied
        const adjustments = media.adjustments;
        const hasNonDefaultAdjustments = adjustments && (
          adjustments.translateX !== 0 ||
          adjustments.translateY !== 0 ||
          adjustments.scale !== 1.0
        );
        
        if (hasNonDefaultAdjustments && adjustments) {
          // Apply adjustments and crop to exact slot size
          try {
            const processed = await applyAdjustmentsAndCrop(
              media.uri,
              media.width,
              media.height,
              slot.width,
              slot.height,
              adjustments
            );
            photosToRender[slotId] = processed.uri;
          } catch (adjustError) {
            console.warn(`[Editor] Failed to apply adjustments for ${slotId}, using original:`, adjustError);
            photosToRender[slotId] = media.uri;
          }
        } else {
          // No adjustments, use original image
          photosToRender[slotId] = media.uri;
        }
      }
      
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
  }, [template?.templatedId, capturedImages, slots, isPremium]);

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

  // Check if user has made any ACTUAL changes since opening (including overlays)
  const hasUnsavedChanges = useMemo(() => {
    // Check image changes
    if (capturedCount > 0 && hasSetInitialStateRef.current) {
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
    }
    
    // Check overlay changes
    if (hasSetInitialOverlaysRef.current) {
      const initialOverlays = initialOverlaysRef.current;
      
      // Different number of overlays means changes
      if (overlays.length !== initialOverlays.length) {
        return true;
      }
      
      // Check if any overlay was modified
      for (let i = 0; i < overlays.length; i++) {
        const current = overlays[i];
        const initial = initialOverlays.find(o => o.id === current.id);
        
        if (!initial) {
          // New overlay added
          return true;
        }
        
        // Check if overlay was modified (compare updatedAt)
        if (current.updatedAt !== initial.updatedAt) {
          return true;
        }
      }
    }
    
    return false;
  }, [capturedImages, capturedCount, overlays]);

  // Handle back navigation confirmation
  const showBackConfirmation = useCallback(() => {
    const beforeSlot = slots.find(s => s.layerId.includes('before'));
    const afterSlot = slots.find(s => s.layerId.includes('after'));
    const beforeUri = beforeSlot ? capturedImages[beforeSlot.layerId]?.uri : null;
    const afterUri = afterSlot ? capturedImages[afterSlot.layerId]?.uri : null;

    // Build capturedImageUris map with ALL slot images for proper save
    const capturedImageUris: Record<string, string> = {};
    for (const [slotId, media] of Object.entries(capturedImages)) {
      if (media?.uri) {
        capturedImageUris[slotId] = media.uri;
      }
    }

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
              // Capture preview with overlays if there are any
              let previewToSave = localPreviewPath;
              if (overlays.length > 0 && renderedPreviewUri) {
                const capturedPreview = await captureCanvasWithOverlays();
                if (capturedPreview) {
                  previewToSave = capturedPreview;
                  console.log('[Editor] Using captured preview with overlays for back save');
                }
              }
              
              const savedDraft = await saveDraft({
                templateId: template.id,
                beforeImageUri: beforeUri || null,
                afterImageUri: afterUri || null,
                existingDraftId: currentProject.draftId || undefined,
                capturedImageUris: Object.keys(capturedImageUris).length > 0 ? capturedImageUris : undefined,
                renderedPreviewUrl: renderedPreviewUri,
                wasRenderedAsPremium: isPremium,
                localPreviewPath: previewToSave,
              });
              
              // Always save overlays (even if empty to clear old ones)
              if (savedDraft) {
                try {
                  await saveOverlays(savedDraft.id, overlays);
                  console.log(`[Editor] Saved ${overlays.length} overlays via back button`);
                } catch (overlayError) {
                  console.error('[Editor] Failed to save overlays:', overlayError);
                  // Non-critical, continue navigation
                }
              }
              
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
  }, [template, slots, capturedImages, saveDraft, currentProject.draftId, resetProject, router, renderedPreviewUri, isPremium, localPreviewPath, overlays, captureCanvasWithOverlays]);

  // Handle back button press with unsaved changes check
  const handleBackPress = useCallback(() => {
    if (hasUnsavedChanges && !allowNavigationRef.current) {
      showBackConfirmation();
    } else {
      router.back();
    }
  }, [hasUnsavedChanges, showBackConfirmation, router]);

  const isEditingDraft = !!currentProject.draftId;

  // Process image for a specific slot (keeps oversized for adjustment)
  const processImage = useCallback(
    async (uri: string, width: number, height: number, slotId: string) => {
      if (!template) return;

      const slot = getSlotById(slots, slotId);
      
      if (!slot) {
        return;
      }

      try {
        const processed = await processImageForAdjustment(
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
          adjustments: DEFAULT_ADJUSTMENTS,
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

  // Choose from library for a slot - navigates to adjustment screen
  const chooseFromLibrary = useCallback(
    async (slotId: string) => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // First process the image to keep it oversized for adjustment
        const slot = getSlotById(slots, slotId);
        if (!slot) return;

        try {
          const processed = await processImageForAdjustment(
            asset.uri, 
            asset.width, 
            asset.height, 
            slot.width, 
            slot.height
          );

          // Navigate to adjustment screen with the processed image
          router.push({
            pathname: `/adjust/${slotId}`,
            params: {
              uri: encodeURIComponent(processed.uri),
              width: processed.width.toString(),
              height: processed.height.toString(),
              isNew: 'true',
            },
          });
        } catch (error) {
          console.error('Failed to process image:', error);
        }
      }
    },
    [slots, router]
  );

  // Navigate to adjustment screen for an existing slot image
  const adjustPosition = useCallback(
    (slotId: string) => {
      router.push(`/adjust/${slotId}`);
    },
    [router]
  );

  // Handle tapping on canvas background (deselect overlay)
  const handleCanvasTap = useCallback(() => {
    if (selectedOverlayId) {
      console.log('[Editor] Canvas tapped - deselecting overlay');
      setSelectedOverlayId(null);
      styleSheetRef.current?.close();
    }
  }, [selectedOverlayId]);

  // Show action sheet for slot
  const handleSlotPress = useCallback(
    (slotId: string) => {
      // Always deselect overlay when interacting with slots
      if (selectedOverlayId) {
        console.log('[Editor] Slot pressed - deselecting overlay');
        setSelectedOverlayId(null);
        styleSheetRef.current?.close();
      }
      
      if (isRendering) {
        return;
      }

      const slot = getSlotById(slots, slotId);
      const slotLabel = slot?.label || 'Photo';
      const hasImage = !!capturedImages[slotId]?.uri; // Fix: check for URI existence, not just object

      if (hasImage) {
        // Slot has an image - show options to adjust, replace, or remove
        if (Platform.OS === 'ios') {
          ActionSheetIOS.showActionSheetWithOptions(
            {
              options: ['Cancel', 'Adjust Position', 'Take New Photo', 'Choose from Library'],
              cancelButtonIndex: 0,
              title: `${slotLabel} Image`,
              message: 'Adjust position or replace the current image',
            },
            (buttonIndex) => {
              if (buttonIndex === 1) {
                adjustPosition(slotId);
              } else if (buttonIndex === 2) {
                takePhoto(slotId);
              } else if (buttonIndex === 3) {
                chooseFromLibrary(slotId);
              }
            }
          );
        } else {
          Alert.alert(
            `${slotLabel} Image`,
            'Adjust position or replace the current image',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Adjust Position', onPress: () => adjustPosition(slotId) },
              { text: 'Take New Photo', onPress: () => takePhoto(slotId) },
              { text: 'Choose from Library', onPress: () => chooseFromLibrary(slotId) },
            ]
          );
        }
      } else {
        // Slot is empty - show options to add an image
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
      }
    },
    [slots, isRendering, capturedImages, takePhoto, chooseFromLibrary, adjustPosition, selectedOverlayId]
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

  // ============================================
  // Overlay Handlers
  // ============================================

  // Add a new overlay
  const handleAddOverlay = useCallback((
    type: OverlayType,
    imageData?: { uri: string; width: number; height: number }
  ) => {
    let newOverlay: Overlay;

    switch (type) {
      case 'text':
        newOverlay = createTextOverlay();
        break;
      case 'date':
        newOverlay = createDateOverlay();
        break;
      case 'logo':
        if (!imageData) {
          console.warn('[Editor] Logo overlay requires image data');
          return;
        }
        newOverlay = createLogoOverlay(
          imageData.uri,
          imageData.width,
          imageData.height,
          false // Not from brand kit by default
        );
        break;
      default:
        return;
    }

    setOverlays(prev => [...prev, newOverlay]);
    setSelectedOverlayId(newOverlay.id);
    
    // Open style sheet for text-based overlays
    if (type === 'text' || type === 'date') {
      setTimeout(() => {
        styleSheetRef.current?.snapToIndex(0);
      }, 100);
    }
    
    console.log(`[Editor] Added ${type} overlay:`, newOverlay.id);
  }, []);

  // Request premium for overlay feature
  // onPremiumGranted callback is executed only if user successfully subscribes
  const handleRequestPremiumForOverlay = useCallback(async (
    featureName: string,
    onPremiumGranted?: () => void
  ) => {
    await requestPremiumAccess(featureName, () => {
      console.log(`[Editor] ${featureName} - premium access granted via Superwall`);
      // Execute the feature callback if provided
      // This allows the overlay to be added automatically after subscribing
      if (onPremiumGranted) {
        onPremiumGranted();
      }
    });
  }, [requestPremiumAccess]);

  // Select an overlay
  const handleSelectOverlay = useCallback((id: string | null) => {
    console.log('[Editor] handleSelectOverlay:', id);
    setSelectedOverlayId(id);
    
    // Open style sheet if selecting a text-based overlay
    if (id) {
      const overlay = overlays.find(o => o.id === id);
      if (overlay && isTextBasedOverlay(overlay)) {
        styleSheetRef.current?.snapToIndex(0);
      }
    } else {
      styleSheetRef.current?.close();
    }
  }, [overlays]);

  // Update overlay transform (position, scale, rotation)
  const handleUpdateOverlayTransform = useCallback((id: string, transform: OverlayTransform) => {
    setOverlays(prev => prev.map(overlay => 
      overlay.id === id 
        ? { ...overlay, transform, updatedAt: new Date().toISOString() }
        : overlay
    ));
  }, []);

  // Update overlay properties (for text styling)
  const handleUpdateOverlayProperties = useCallback((updates: Partial<TextOverlay | DateOverlay>) => {
    if (!selectedOverlayId) return;
    
    setOverlays(prev => prev.map(overlay => 
      overlay.id === selectedOverlayId
        ? { ...overlay, ...updates, updatedAt: new Date().toISOString() }
        : overlay
    ));
  }, [selectedOverlayId]);

  // Delete an overlay
  const handleDeleteOverlay = useCallback((id: string) => {
    setOverlays(prev => prev.filter(overlay => overlay.id !== id));
    if (selectedOverlayId === id) {
      setSelectedOverlayId(null);
      styleSheetRef.current?.close();
    }
    console.log('[Editor] Deleted overlay:', id);
  }, [selectedOverlayId]);

  // Delete selected overlay (from style sheet)
  const handleDeleteSelectedOverlay = useCallback(() => {
    if (selectedOverlayId) {
      handleDeleteOverlay(selectedOverlayId);
    }
  }, [selectedOverlayId, handleDeleteOverlay]);

  // Get currently selected overlay
  const selectedOverlay = useMemo(() => 
    overlays.find(o => o.id === selectedOverlayId) || null,
    [overlays, selectedOverlayId]
  );

  // Perform save draft operation
  const performSaveDraft = useCallback(async (navigateAfterSave: boolean = true) => {
    if (!template) return;

    console.log('[Editor] performSaveDraft called:', {
      templateId: template.id,
      draftId: currentProject.draftId,
      overlayCount: overlays.length,
      hasRenderedPreview: !!renderedPreviewUri,
      navigateAfterSave,
    });

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
    
    console.log('[Editor] Slots to save:', Object.keys(capturedImageUris));

    // Determine the best preview to save
    // If there are overlays, capture the canvas with overlays
    let previewToSave = localPreviewPath;
    
    if (overlays.length > 0 && renderedPreviewUri) {
      console.log('[Editor] Capturing canvas with overlays for draft preview');
      const capturedPreview = await captureCanvasWithOverlays();
      if (capturedPreview) {
        previewToSave = capturedPreview;
        console.log('[Editor] Using captured preview with overlays:', capturedPreview);
      } else {
        console.warn('[Editor] Failed to capture preview with overlays, using original');
      }
    }

    try {
      const savedDraft = await saveDraft({
        templateId: template.id,
        beforeImageUri: beforeUri || null,
        afterImageUri: afterUri || null,
        existingDraftId: currentProject.draftId || undefined,
        capturedImageUris: Object.keys(capturedImageUris).length > 0 ? capturedImageUris : undefined,
        renderedPreviewUrl: renderedPreviewUri,
        wasRenderedAsPremium: isPremium,
        localPreviewPath: previewToSave, // Use the preview with overlays if available
      });
      
      console.log('[Editor] Draft saved successfully:', savedDraft?.id);
      
      // Always save overlays (even if empty to clear old overlays)
      if (savedDraft) {
        try {
          console.log('[Editor] Saving overlays for draft:', savedDraft.id, 'count:', overlays.length);
          await saveOverlays(savedDraft.id, overlays);
          console.log(`[Editor] Successfully saved ${overlays.length} overlays with draft`);
          // Update initial state after successful save
          initialOverlaysRef.current = [...overlays];
        } catch (overlayError) {
          console.error('[Editor] Failed to save overlays:', overlayError);
          // Non-critical, don't throw
        }
      }
      
      if (navigateAfterSave) {
        router.push('/(tabs)');
      }
    } catch (error) {
      console.error('[Editor] Failed to save draft:', error);
    }
  }, [template, slots, capturedImages, saveDraft, currentProject.draftId, router, renderedPreviewUri, isPremium, localPreviewPath, overlays, captureCanvasWithOverlays]);

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

  // Capture the canvas with overlays using ViewShot
  const captureCanvasWithOverlays = useCallback(async (): Promise<string | null> => {
    if (!viewShotRef.current) {
      console.warn('[Editor] ViewShot ref not available');
      return null;
    }
    
    try {
      // Deselect any selected overlay before capture to hide selection UI
      setSelectedOverlayId(null);
      
      // Small delay to ensure selection UI is hidden
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Capture the view
      const uri = await viewShotRef.current.capture();
      
      if (uri) {
        // Save the captured image to a permanent location
        const filename = `canvas_overlay_${Date.now()}.jpg`;
        const destUri = `${FileSystem.cacheDirectory}${filename}`;
        
        // Move from temp to cache
        await FileSystem.copyAsync({ from: uri, to: destUri });
        
        console.log('[Editor] Captured canvas with overlays:', destUri);
        return destUri;
      }
      
      return null;
    } catch (error) {
      console.error('[Editor] Failed to capture canvas:', error);
      return null;
    }
  }, []);

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
    
    // Determine final preview URI
    // If there are overlays, capture the canvas with overlays
    // Otherwise, use the rendered preview from Templated.io
    let finalPreviewUri = renderedPreviewUri || '';
    
    if (overlays.length > 0) {
      console.log('[Editor] Capturing canvas with overlays for final generation');
      const capturedUri = await captureCanvasWithOverlays();
      if (capturedUri) {
        finalPreviewUri = capturedUri;
        console.log('[Editor] Using captured canvas URI:', finalPreviewUri);
      } else {
        console.warn('[Editor] Capture failed, falling back to rendered preview');
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
          previewUri: finalPreviewUri,
          format: template.format,
          hasWatermark: (!isPremium).toString(),
        }
      });
      
      // Reset generating state after navigation
      setTimeout(() => setIsGenerating(false), 500);
    }, 1000); // Reduced delay since we already waited for capture
  }, [canProceed, currentProject.draftId, template, renderedPreviewUri, isPremium, router, isGenerating, hasUnsavedChanges, performSaveDraft, overlays, captureCanvasWithOverlays]);

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

        {/* Content - Pressable to deselect overlays when tapping outside */}
        <Pressable style={styles.contentPressable} onPress={handleCanvasTap}>
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Template Canvas with rendered preview from Templated.io */}
            <View style={styles.canvasWrapper}>
              {/* ViewShot wrapper for capturing canvas with overlays */}
              <ViewShot
                ref={viewShotRef}
                options={{
                  format: 'jpg',
                  quality: 0.95,
                  result: 'tmpfile',
                }}
                style={[styles.canvasAndOverlayWrapper, { width: canvasDimensions.width, height: canvasDimensions.height }]}
              >
                <TemplateCanvas
                  template={template}
                  onSlotPress={handleSlotPress}
                  renderedPreviewUri={renderedPreviewUri}
                  isRendering={isRendering}
                  onPreviewError={handlePreviewError}
                  isPremium={isPremium}
                />
                
                {/* Overlay Layer - renders overlays on top of canvas */}
                {canvasDimensions.width > 0 && (
                  <View style={[styles.overlayContainer, { width: canvasDimensions.width, height: canvasDimensions.height }]}>
                    <OverlayLayer
                      overlays={overlays}
                      selectedOverlayId={selectedOverlayId}
                      canvasWidth={canvasDimensions.width}
                      canvasHeight={canvasDimensions.height}
                      onSelectOverlay={handleSelectOverlay}
                      onUpdateOverlayTransform={handleUpdateOverlayTransform}
                      onDeleteOverlay={handleDeleteOverlay}
                    />
                  </View>
                )}
              </ViewShot>
            </View>
          </ScrollView>
        </Pressable>

        {/* Bottom Action Bar */}
        <View style={styles.bottomSection}>
          {/* Overlay Action Bar - show as soon as template is selected */}
          {template && (
            <OverlayActionBar
              isPremium={isPremium}
              disabled={isGenerating || paywallState === 'presenting'}
              onAddOverlay={handleAddOverlay}
              onRequestPremium={handleRequestPremiumForOverlay}
            />
          )}

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

      {/* Overlay Style Sheet - for customizing text/date overlays */}
      <OverlayStyleSheet
        bottomSheetRef={styleSheetRef}
        overlay={selectedOverlay}
        onUpdateOverlay={handleUpdateOverlayProperties}
        onDeleteOverlay={handleDeleteSelectedOverlay}
      />
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
  contentPressable: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  canvasWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  // Canvas and overlay container wrapper - ensures overlay aligns with canvas
  canvasAndOverlayWrapper: {
    position: 'relative',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
    borderRadius: 6,
    pointerEvents: 'box-none',
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
