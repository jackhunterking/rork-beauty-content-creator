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
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import BottomSheet from '@gorhom/bottom-sheet';
import ViewShot from 'react-native-view-shot';
import { Save, Sparkles, RefreshCw, ChevronLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { TemplateCanvas } from '@/components/TemplateCanvas';
import { 
  processImageForAdjustment, 
  applyAdjustmentsAndCrop, 
  DEFAULT_ADJUSTMENTS 
} from '@/utils/imageProcessing';
import { extractSlots, allSlotsCaptured, getSlotById, getCapturedSlotCount, hasValidCapturedImage } from '@/utils/slotParser';
import { renderPreview } from '@/services/renderService';
import { usePremiumStatus, usePremiumFeature } from '@/hooks/usePremiumStatus';
import { saveRenderedPreview, createDraftDirectories, saveLocalPreviewFile } from '@/services/localStorageService';
import { 
  OverlayLayer, 
  OverlayActionBar, 
  OverlayStyleSheet,
  ScaleSlider,
  LogoPickerModal,
  LogoActionSheet,
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
  isLogoOverlay,
  LOGO_SIZE_CONSTRAINTS,
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
  
  // Track if we have a manually captured preview with overlays
  // When true, auto-save should NOT overwrite the local preview file
  const hasManualCapturedPreviewRef = useRef(false);

  // Premium status (kept for wasRenderedAsPremium tracking and paywall state)
  const { isPremium } = usePremiumStatus();
  const { paywallState } = usePremiumFeature();

  // Window dimensions for canvas sizing
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const CANVAS_PADDING = 20;
  
  // Detect tablet for responsive layout adjustments
  const isTablet = screenWidth >= 768;
  const MAX_CANVAS_WIDTH_TABLET = 500; // Constrain canvas on iPad for better proportion
  
  // Overlay state
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const styleSheetRef = useRef<BottomSheet>(null);
  const logoPickerRef = useRef<BottomSheet>(null);
  const logoActionSheetRef = useRef<BottomSheet>(null);
  
  // Track initial overlay state for change detection
  const initialOverlaysRef = useRef<Overlay[]>([]);
  const hasSetInitialOverlaysRef = useRef(false);
  
  // ViewShot ref for capturing canvas with overlays
  const viewShotRef = useRef<ViewShot>(null);
  
  // Track when the preview image is loaded and ready for capture
  // Use a ref so we can check it inside async callbacks without stale closure issues
  const isPreviewImageLoadedRef = useRef(false);
  
  // Also track with state for UI updates if needed
  const [isPreviewImageLoaded, setIsPreviewImageLoaded] = useState(false);
  
  // Reset preview loaded state when rendered preview URI changes
  useEffect(() => {
    if (renderedPreviewUri) {
      // Reset loaded state when a new preview URL is set
      // The image will set it to true via onLoad callback
      isPreviewImageLoadedRef.current = false;
      setIsPreviewImageLoaded(false);
    }
  }, [renderedPreviewUri]);
  
  // Handler for when preview image loads
  const handlePreviewImageLoad = useCallback(() => {
    console.log('[Editor] Preview image loaded');
    isPreviewImageLoadedRef.current = true;
    setIsPreviewImageLoaded(true);
  }, []);

  // Calculate canvas dimensions (matching TemplateCanvas logic, with iPad constraints)
  const canvasDimensions = useMemo(() => {
    if (!template) return { width: 0, height: 0 };
    
    // On tablets, constrain canvas to a max width for better proportion
    const baseMaxWidth = screenWidth - CANVAS_PADDING * 2;
    const maxCanvasWidth = isTablet ? Math.min(baseMaxWidth, MAX_CANVAS_WIDTH_TABLET) : baseMaxWidth;
    const aspectRatio = template.canvasWidth / template.canvasHeight;
    
    let width = maxCanvasWidth;
    let height = width / aspectRatio;
    
    // Constrain height - use a larger max height on tablets
    const maxHeight = isTablet ? screenHeight * 0.6 : screenWidth * 1.2;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    
    return { width, height };
  }, [template, screenWidth, screenHeight, isTablet]);

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

  // Track previous capturedImages to detect actual changes (including adjustments)
  const prevCapturedImagesRef = useRef<Record<string, { uri: string; adjustments?: { translateX: number; translateY: number; scale: number } } | null>>({});

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
      hasManualCapturedPreviewRef.current = false;
      
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
  // IMPORTANT: Prefer Templated.io URL over local preview in the editor
  // because local preview may have overlays baked in, which causes duplication
  // when the overlay layer is also rendered on top.
  // Local preview (with baked overlays) is still used for draft list thumbnails.
  useEffect(() => {
    if (hasInitializedFromCacheRef.current) return;
    
    const cachedLocalPath = currentProject.localPreviewPath;
    const cachedPreviewUrl = currentProject.cachedPreviewUrl;
    const wasRenderedAsPremium = currentProject.wasRenderedAsPremium;
    
    const premiumStatusMatch = wasRenderedAsPremium === null || wasRenderedAsPremium === isPremium;
    
    if (currentProject.draftId && premiumStatusMatch) {
      // PRIORITY: Use Templated.io URL (clean render without baked overlays)
      // This prevents duplication when overlay layer is rendered on top
      if (cachedPreviewUrl) {
        console.log('[Editor] Using cached preview URL from draft (clean render)');
        setRenderedPreviewUri(cachedPreviewUrl);
        prevCapturedImagesRef.current = { ...capturedImages };
        hasInitializedFromCacheRef.current = true;
        // Keep track of local path for saving, but don't use for display
        if (cachedLocalPath) {
          setLocalPreviewPath(cachedLocalPath);
        }
        return;
      }
      
      // Fallback: Only use local preview if no Templated.io URL available
      // Note: This may cause overlay duplication if local preview has baked overlays
      if (cachedLocalPath) {
        console.log('[Editor] Using local preview file from draft (fallback, no URL available):', cachedLocalPath);
        setRenderedPreviewUri(cachedLocalPath);
        setLocalPreviewPath(cachedLocalPath);
        prevCapturedImagesRef.current = { ...capturedImages };
        hasInitializedFromCacheRef.current = true;
        hasManualCapturedPreviewRef.current = true;
        lastSavedPreviewUrlRef.current = cachedLocalPath;
        return;
      }
    }
    
    if (currentProject.draftId && (cachedLocalPath || cachedPreviewUrl) && !premiumStatusMatch) {
      console.log('[Editor] Premium status changed, will re-render preview');
      hasInitializedFromCacheRef.current = true;
      setImagesModifiedSinceLoad(true);
      // Reset manual capture flag since we need to re-render
      hasManualCapturedPreviewRef.current = false;
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
    let changeReason: string | null = null;
    
    for (const slotId of currentSlotIds) {
      const current = currentImages[slotId];
      const prev = prevImages[slotId];
      const currentUri = current?.uri;
      const prevUri = prev?.uri;
      
      // Check if URI changed
      if (currentUri && currentUri !== prevUri) {
        hasNewOrChangedImage = true;
        changedSlotId = slotId;
        changeReason = 'uri';
        break;
      }
      
      // Check if adjustments changed (for existing images)
      if (currentUri && currentUri === prevUri && current?.adjustments && prev?.adjustments) {
        const currAdj = current.adjustments;
        const prevAdj = prev.adjustments;
        if (currAdj.translateX !== prevAdj.translateX ||
            currAdj.translateY !== prevAdj.translateY ||
            currAdj.scale !== prevAdj.scale) {
          hasNewOrChangedImage = true;
          changedSlotId = slotId;
          changeReason = 'adjustments';
          break;
        }
      }
      
      // Check if new adjustments were added to an image that had none before
      if (currentUri && currentUri === prevUri && current?.adjustments && !prev?.adjustments) {
        const currAdj = current.adjustments;
        if (currAdj.translateX !== 0 || currAdj.translateY !== 0 || currAdj.scale !== 1.0) {
          hasNewOrChangedImage = true;
          changedSlotId = slotId;
          changeReason = 'new-adjustments';
          break;
        }
      }
    }
    
    if (hasNewOrChangedImage) {
      console.log(`[Editor] Image change detected in slot: ${changedSlotId}, reason: ${changeReason}`);
    }
    
    const newPrevImages: Record<string, { uri: string; adjustments?: { translateX: number; translateY: number; scale: number } } | null> = {};
    for (const [slotId, media] of Object.entries(currentImages)) {
      newPrevImages[slotId] = media ? { uri: media.uri, adjustments: media.adjustments } : null;
    }
    prevCapturedImagesRef.current = newPrevImages;
    
    if (hasNewOrChangedImage) {
      // Check if we should skip rendering because we already have a valid cached preview
      // Only skip if ALL current images match the initial loaded images
      // (meaning no NEW images have been added by the user)
      if (renderedPreviewUri && !imagesModifiedSinceLoad && currentProject.draftId && hasSetInitialStateRef.current) {
        const initialState = initialCapturedImagesRef.current;
        const currentSlotCount = Object.keys(currentImages).filter(id => currentImages[id]?.uri).length;
        const initialSlotCount = Object.keys(initialState).filter(id => initialState[id]).length;
        
        // Check if images actually match the initial state
        const imagesMatchInitial = currentSlotCount === initialSlotCount && 
          Object.keys(currentImages).every(slotId => {
            const currentUri = currentImages[slotId]?.uri || null;
            const initialUri = initialState[slotId] || null;
            return currentUri === initialUri;
          });
        
        if (imagesMatchInitial) {
          console.log('[Editor] Skipping render - images match initial state, using cached preview');
          return;
        } else {
          console.log('[Editor] Images differ from initial state - will re-render');
        }
      }
      
      setImagesModifiedSinceLoad(true);
      
      // Reset manual capture flag since the images changed - old preview is invalid
      // This allows auto-save to work for the new render
      hasManualCapturedPreviewRef.current = false;
      
      console.log('[Editor] Triggering preview render');
      triggerPreviewRender();
    }
  }, [capturedImages, template?.templatedId, triggerPreviewRender, renderedPreviewUri, imagesModifiedSinceLoad, currentProject.draftId]);

  // Auto-save preview locally when render completes
  // IMPORTANT: This should NOT overwrite manually captured previews with overlays
  useEffect(() => {
    const savePreviewLocally = async () => {
      if (!renderedPreviewUri || !currentProject.draftId) return;
      
      // Skip if this is already a local file
      if (renderedPreviewUri.startsWith('file://')) {
        console.log('[Editor] Auto-save: Skipping - preview is already a local file');
        return;
      }
      
      // Skip if we have a manually captured preview (with overlays)
      // This prevents overwriting the good preview with a Templated.io URL that has no overlays
      if (hasManualCapturedPreviewRef.current) {
        console.log('[Editor] Auto-save: Skipping - manual captured preview exists (preserving overlays)');
        return;
      }
      
      // Skip if already saved this URL
      if (lastSavedPreviewUrlRef.current === renderedPreviewUri) {
        console.log('[Editor] Auto-save: Skipping - already saved this URL');
        return;
      }
      
      // Skip if a save is already in progress
      if (isSavingPreviewRef.current) {
        console.log('[Editor] Auto-save: Skipping - save already in progress');
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
            // Navigate to the appropriate tab based on context
            if (currentProject.draftId) {
              // Came from Projects tab (editing existing draft) - go back to Projects
              router.replace('/(tabs)/library');
            } else {
              // Came from Create tab (new template) - go back to Create
              router.replace('/(tabs)');
            }
          },
        },
        {
          text: 'Save Draft',
          onPress: async () => {
            if (!template) return;
            try {
              // CRITICAL: Capture the preview with overlays FIRST, BEFORE any save operations
              // This prevents race conditions where state updates from saving cause the canvas to re-render
              let capturedPreviewPath: string | null = null;
              
              if (overlays.length > 0 && renderedPreviewUri) {
                console.log('[Editor] Back save: Capturing canvas with overlays BEFORE save...');
                capturedPreviewPath = await captureCanvasWithOverlays();
                if (capturedPreviewPath) {
                  console.log('[Editor] Back save: Preview captured to temp location:', capturedPreviewPath);
                } else {
                  console.warn('[Editor] Back save: Failed to capture preview with overlays');
                }
              }
              
              // Step 2: Save the draft to get/confirm the draft ID
              const savedDraft = await saveDraft({
                templateId: template.id,
                beforeImageUri: beforeUri || null,
                afterImageUri: afterUri || null,
                existingDraftId: currentProject.draftId || undefined,
                capturedImageUris: Object.keys(capturedImageUris).length > 0 ? capturedImageUris : undefined,
                renderedPreviewUrl: renderedPreviewUri,
                wasRenderedAsPremium: isPremium,
                localPreviewPath: localPreviewPath,
              });
              
              if (!savedDraft) {
                console.error('[Editor] Draft save returned null');
                allowNavigationRef.current = true;
                // Navigate to the appropriate tab based on context
                if (currentProject.draftId) {
                  router.replace('/(tabs)/library');
                } else {
                  router.replace('/(tabs)');
                }
                return;
              }
              
              console.log('[Editor] Draft saved via back button:', savedDraft.id);
              
              // Step 3: If we captured a preview with overlays, move it to the correct location
              if (capturedPreviewPath) {
                console.log('[Editor] Back save: Saving captured preview to draft renders directory:', savedDraft.id);
                const permanentPath = await saveLocalPreviewFile(savedDraft.id, capturedPreviewPath, 'default');
                if (permanentPath) {
                  console.log('[Editor] Back save: Preview with overlays saved to:', permanentPath);
                  
                  // Mark that we have a manually captured preview
                  hasManualCapturedPreviewRef.current = true;
                  lastSavedPreviewUrlRef.current = permanentPath;
                  
                  // Update the draft with the correct preview path
                  await saveDraft({
                    templateId: template.id,
                    beforeImageUri: beforeUri || null,
                    afterImageUri: afterUri || null,
                    existingDraftId: savedDraft.id,
                    capturedImageUris: Object.keys(capturedImageUris).length > 0 ? capturedImageUris : undefined,
                    renderedPreviewUrl: renderedPreviewUri,
                    wasRenderedAsPremium: isPremium,
                    localPreviewPath: permanentPath,
                  });
                }
              }
              
              // Step 4: Always save overlays (even if empty to clear old ones)
              try {
                await saveOverlays(savedDraft.id, overlays);
                console.log(`[Editor] Saved ${overlays.length} overlays via back button`);
              } catch (overlayError) {
                console.error('[Editor] Failed to save overlays:', overlayError);
                // Non-critical, continue navigation
              }
              
              allowNavigationRef.current = true;
              router.replace('/drafts');
            } catch (error) {
              console.error('Failed to save draft:', error);
              // Still navigate back even if save failed
              allowNavigationRef.current = true;
              // Navigate to the appropriate tab based on context
              if (currentProject.draftId) {
                router.replace('/(tabs)/library');
              } else {
                router.replace('/(tabs)');
              }
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [template, slots, capturedImages, saveDraft, currentProject.draftId, resetProject, router, renderedPreviewUri, isPremium, localPreviewPath, overlays, captureCanvasWithOverlays]);

  // Handle back button press with unsaved changes check
  // Navigation destination depends on context:
  // - If editing an existing draft (has draftId), go back to Projects tab
  // - If creating new from template (no draftId), go back to Create tab
  const handleBackPress = useCallback(() => {
    if (hasUnsavedChanges && !allowNavigationRef.current) {
      showBackConfirmation();
    } else {
      // Navigate to the appropriate tab based on context
      if (currentProject.draftId) {
        // Came from Projects tab (editing existing draft) - go back to Projects
        router.replace('/(tabs)/library');
      } else {
        // Came from Create tab (new template) - go back to Create
        router.replace('/(tabs)');
      }
    }
  }, [hasUnsavedChanges, showBackConfirmation, router, currentProject.draftId]);

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

  // Choose from library for a slot - navigates to capture screen with the selected image
  const chooseFromLibrary = useCallback(
    async (slotId: string) => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Navigate to capture screen with the library image
        // CaptureScreen will handle processing and show the adjustment UI (Retake/Continue)
        router.push({
          pathname: `/capture/${slotId}`,
          params: {
            uri: encodeURIComponent(asset.uri),
            width: asset.width.toString(),
            height: asset.height.toString(),
          },
        });
      }
    },
    [router]
  );

  // Navigate to capture screen for adjusting an existing slot image
  const adjustPosition = useCallback(
    (slotId: string) => {
      const existingImage = capturedImages[slotId];
      if (existingImage?.uri) {
        // Navigate to capture screen with the existing image for adjustment
        router.push({
          pathname: `/capture/${slotId}`,
          params: {
            uri: encodeURIComponent(existingImage.uri),
            width: existingImage.width.toString(),
            height: existingImage.height.toString(),
          },
        });
      }
    },
    [router, capturedImages]
  );

  // Handle tapping on canvas background (deselect overlay)
  const handleCanvasTap = useCallback(() => {
    if (selectedOverlayId) {
      console.log('[Editor] Canvas tapped - deselecting overlay');
      setSelectedOverlayId(null);
      styleSheetRef.current?.close();
      logoActionSheetRef.current?.close();
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
        logoActionSheetRef.current?.close();
      }
      
      if (isRendering) {
        return;
      }

      const slot = getSlotById(slots, slotId);
      const slotLabel = slot?.label || 'Photo';
      
      // Debug: Log what we're checking
      const capturedMedia = capturedImages[slotId];
      console.log('[Editor] Slot pressed:', {
        slotId,
        slotLabel,
        hasCapturedMedia: !!capturedMedia,
        capturedMediaUri: capturedMedia?.uri?.substring(0, 50),
        allSlotIds: Object.keys(capturedImages),
      });
      
      // Use consistent helper function for robust image validation
      const hasImage = hasValidCapturedImage(slotId, capturedImages);
      console.log('[Editor] hasImage result:', hasImage);

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

  // Open logo picker modal
  const handleOpenLogoPickerModal = useCallback(() => {
    logoPickerRef.current?.snapToIndex(0);
  }, []);

  // Close logo picker modal
  const handleLogoPickerClose = useCallback(() => {
    logoPickerRef.current?.close();
  }, []);

  // Handle logo selection from logo picker modal
  const handleLogoSelected = useCallback((logoData: { uri: string; width: number; height: number }) => {
    const newOverlay = createLogoOverlay(
      logoData.uri,
      logoData.width,
      logoData.height,
      false
    );
    setOverlays(prev => [...prev, newOverlay]);
    setSelectedOverlayId(newOverlay.id);
    console.log('[Editor] Added logo overlay from picker:', newOverlay.id);
  }, []);

  // Select an overlay
  const handleSelectOverlay = useCallback((id: string | null) => {
    console.log('[Editor] handleSelectOverlay:', id);
    setSelectedOverlayId(id);
    
    if (id) {
      const overlay = overlays.find(o => o.id === id);
      if (overlay) {
        if (isTextBasedOverlay(overlay)) {
          // Open style sheet for text-based overlays
          styleSheetRef.current?.snapToIndex(0);
          logoActionSheetRef.current?.close();
        } else if (isLogoOverlay(overlay)) {
          // Open logo action sheet for logo overlays
          logoActionSheetRef.current?.snapToIndex(0);
          styleSheetRef.current?.close();
        }
      }
    } else {
      // Close both sheets when deselecting
      styleSheetRef.current?.close();
      logoActionSheetRef.current?.close();
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
      logoActionSheetRef.current?.close();
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

  // Get scale constraints for selected overlay
  const selectedOverlayScaleConstraints = useMemo(() => {
    if (!selectedOverlay) {
      return { minScale: 0.2, maxScale: 3.0 };
    }
    
    if (isLogoOverlay(selectedOverlay)) {
      return {
        minScale: LOGO_SIZE_CONSTRAINTS.minScale,
        maxScale: LOGO_SIZE_CONSTRAINTS.maxScale,
      };
    }
    
    // Text/Date overlays have different constraints
    return {
      minScale: 0.5,
      maxScale: 2.5,
    };
  }, [selectedOverlay]);

  // Handle scale change from ScaleSlider
  const handleScaleSliderChange = useCallback((newScale: number) => {
    if (!selectedOverlayId || !selectedOverlay) return;
    
    const updatedTransform: OverlayTransform = {
      ...selectedOverlay.transform,
      scale: newScale,
    };
    
    handleUpdateOverlayTransform(selectedOverlayId, updatedTransform);
  }, [selectedOverlayId, selectedOverlay, handleUpdateOverlayTransform]);

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

    try {
      // CRITICAL: Capture the preview with overlays FIRST, BEFORE any save operations
      // This prevents race conditions where state updates from saving cause the canvas to re-render
      let capturedPreviewPath: string | null = null;
      
      if (overlays.length > 0 && renderedPreviewUri) {
        console.log('[Editor] Step 1: Capturing canvas with overlays BEFORE save...');
        capturedPreviewPath = await captureCanvasWithOverlays();
        if (capturedPreviewPath) {
          console.log('[Editor] Preview captured to temp location:', capturedPreviewPath);
        } else {
          console.warn('[Editor] Failed to capture preview with overlays');
        }
      }
      
      // Step 2: Save the draft to get/confirm the draft ID
      const savedDraft = await saveDraft({
        templateId: template.id,
        beforeImageUri: beforeUri || null,
        afterImageUri: afterUri || null,
        existingDraftId: currentProject.draftId || undefined,
        capturedImageUris: Object.keys(capturedImageUris).length > 0 ? capturedImageUris : undefined,
        renderedPreviewUrl: renderedPreviewUri,
        wasRenderedAsPremium: isPremium,
        localPreviewPath: localPreviewPath, // Use existing preview initially
      });
      
      console.log('[Editor] Draft saved successfully:', savedDraft?.id);
      
      if (!savedDraft) {
        console.error('[Editor] Draft save returned null');
        return;
      }
      
      // Step 3: If we captured a preview with overlays, move it to the correct location
      let finalPreviewPath = localPreviewPath;
      
      if (capturedPreviewPath) {
        console.log('[Editor] Step 3: Saving captured preview to draft renders directory:', savedDraft.id);
        const permanentPath = await saveLocalPreviewFile(savedDraft.id, capturedPreviewPath, 'default');
        if (permanentPath) {
          finalPreviewPath = permanentPath;
          console.log('[Editor] Preview with overlays saved to:', permanentPath);
          
          // CRITICAL: Mark that we have a manually captured preview
          // This prevents auto-save from overwriting with Templated.io URL (no overlays)
          hasManualCapturedPreviewRef.current = true;
          lastSavedPreviewUrlRef.current = permanentPath;
          
          // Update local state to use the captured preview
          setLocalPreviewPath(permanentPath);
          setRenderedPreviewUri(permanentPath);
          
          // Update the draft with the correct preview path
          console.log('[Editor] Updating draft with new preview path');
          await saveDraft({
            templateId: template.id,
            beforeImageUri: beforeUri || null,
            afterImageUri: afterUri || null,
            existingDraftId: savedDraft.id,
            capturedImageUris: Object.keys(capturedImageUris).length > 0 ? capturedImageUris : undefined,
            renderedPreviewUrl: renderedPreviewUri,
            wasRenderedAsPremium: isPremium,
            localPreviewPath: finalPreviewPath,
          });
        } else {
          console.warn('[Editor] Failed to save preview to permanent location');
        }
      }
      
      // Step 4: Always save overlays (even if empty to clear old overlays)
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
      
      if (navigateAfterSave) {
        router.replace('/drafts');
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
  // Returns the captured file path (in cache directory)
  // The caller is responsible for moving it to the correct location after getting the draft ID
  const captureCanvasWithOverlays = useCallback(async (): Promise<string | null> => {
    if (!viewShotRef.current) {
      console.warn('[Editor] ViewShot ref not available');
      return null;
    }
    
    // Check that we have a rendered preview to capture
    if (!renderedPreviewUri) {
      console.warn('[Editor] No rendered preview available to capture');
      return null;
    }
    
    try {
      // Store current selection to restore later if needed
      const wasSelected = selectedOverlayId;
      
      // Deselect any selected overlay before capture to hide selection UI
      if (wasSelected) {
        setSelectedOverlayId(null);
      }
      
      console.log('[Editor] Preparing to capture canvas with overlays...');
      console.log('[Editor] Current state: renderedPreviewUri exists:', !!renderedPreviewUri);
      console.log('[Editor] Current state: isPreviewImageLoaded (ref):', isPreviewImageLoadedRef.current);
      console.log('[Editor] Current state: overlays count:', overlays.length);
      
      // Wait for the preview image to be loaded if it isn't already
      // This ensures we capture the rendered preview, not a placeholder
      // Use the ref to check the current value (avoids stale closure)
      if (!isPreviewImageLoadedRef.current) {
        console.log('[Editor] Waiting for preview image to load...');
        // Wait up to 3 seconds for the image to load
        const maxWaitTime = 3000;
        const checkInterval = 100;
        let waitedTime = 0;
        
        while (!isPreviewImageLoadedRef.current && waitedTime < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          waitedTime += checkInterval;
        }
        
        if (!isPreviewImageLoadedRef.current) {
          console.warn('[Editor] Preview image did not load within timeout, proceeding anyway');
        } else {
          console.log('[Editor] Preview image loaded after', waitedTime, 'ms');
        }
      }
      
      // Wait for React to re-render without selection UI and ensure image is displayed
      // Use a longer delay to ensure the view is fully updated
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('[Editor] Capturing canvas now...');
      
      // Capture the view
      const uri = await viewShotRef.current.capture();
      
      if (!uri) {
        console.warn('[Editor] ViewShot capture returned null');
        return null;
      }
      
      // Save to cache directory for temporary use
      // The file will be moved to the correct location after draft is saved
      const filename = `canvas_overlay_${Date.now()}.jpg`;
      const destUri = `${FileSystem.cacheDirectory}${filename}`;
      
      // Copy from temp to cache
      await FileSystem.copyAsync({ from: uri, to: destUri });
      
      console.log('[Editor] Captured canvas with overlays to cache:', destUri);
      return destUri;
    } catch (error) {
      console.error('[Editor] Failed to capture canvas:', error);
      return null;
    }
  }, [renderedPreviewUri, selectedOverlayId, overlays.length]);

  // Handle Generate button - show animation then navigate to publish screen
  const handleGenerate = useCallback(async () => {
    if (!canProceed || !template || isGenerating) return;
    
    // Start generation animation
    setIsGenerating(true);
    
    // CRITICAL: Capture the preview with overlays FIRST, BEFORE any save operations
    // This prevents race conditions where state updates from saving cause the canvas to re-render
    let capturedPreviewUri: string | null = null;
    
    if (overlays.length > 0 && renderedPreviewUri) {
      console.log('[Editor] Generate: Capturing canvas with overlays BEFORE save...');
      capturedPreviewUri = await captureCanvasWithOverlays();
      if (capturedPreviewUri) {
        console.log('[Editor] Generate: Preview captured:', capturedPreviewUri);
      } else {
        console.warn('[Editor] Generate: Failed to capture preview with overlays');
      }
    }
    
    // Auto-save draft if there are unsaved changes (without navigation)
    // This ensures all captured images are persisted before going to publish
    if (hasUnsavedChanges) {
      try {
        // If we captured a preview, we need to save it properly
        // But performSaveDraft will capture again, so let's just call it
        // and handle the preview separately
        await performSaveDraft(false);
      } catch (error) {
        console.error('Failed to auto-save before generate:', error);
        // Continue to publish even if save fails - images are still in memory
      }
    }
    
    // Determine final preview URI
    // Use the captured preview if we have one, otherwise use the rendered preview
    let finalPreviewUri = capturedPreviewUri || renderedPreviewUri || '';
    
    console.log('[Editor] Generate: Final preview URI:', finalPreviewUri.substring(0, 50) + '...');
    
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
            contentContainerStyle={[
              styles.contentContainer, 
              isTablet && styles.contentContainerTablet
            ]}
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
                  onPreviewLoad={handlePreviewImageLoad}
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
              
              {/* Scale Slider - positioned outside ViewShot so it's not captured */}
              {canvasDimensions.height > 0 && (
                <ScaleSlider
                  visible={!!selectedOverlayId}
                  currentScale={selectedOverlay?.transform.scale ?? 1}
                  minScale={selectedOverlayScaleConstraints.minScale}
                  maxScale={selectedOverlayScaleConstraints.maxScale}
                  onScaleChange={handleScaleSliderChange}
                  canvasHeight={canvasDimensions.height}
                />
              )}
            </View>
          </ScrollView>
        </Pressable>

        {/* Bottom Action Bar */}
        <View style={[
          styles.bottomSection, 
          isTablet && { maxWidth: MAX_CANVAS_WIDTH_TABLET + 40, alignSelf: 'center', width: '100%' }
        ]}>
          {/* Overlay Action Bar - show as soon as template is selected */}
          {template && (
            <OverlayActionBar
              disabled={isGenerating || paywallState === 'presenting'}
              onAddOverlay={handleAddOverlay}
              onRequestLogoModal={handleOpenLogoPickerModal}
            />
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

      {/* Logo Picker Modal - for selecting/uploading logo overlays */}
      <LogoPickerModal
        bottomSheetRef={logoPickerRef}
        onSelectLogo={handleLogoSelected}
        onClose={handleLogoPickerClose}
      />

      {/* Logo Action Sheet - for resizing and deleting logo overlays */}
      <LogoActionSheet
        bottomSheetRef={logoActionSheetRef}
        overlay={selectedOverlay && isLogoOverlay(selectedOverlay) ? selectedOverlay : null}
        currentScale={selectedOverlay?.transform.scale ?? 1}
        onScaleChange={handleScaleSliderChange}
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
  contentContainerTablet: {
    alignItems: 'center',
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
