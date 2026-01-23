/**
 * Editor V2 - Professional Canvas Editor
 * 
 * Instagram/Photoshop-inspired canvas editor with:
 * - Uses TemplateCanvas with Templated.io rendering (like old editor)
 * - Bottom tool dock for adding elements
 * - Contextual toolbars based on selection
 * - AI enhancement panel (scaffolded for future)
 * 
 * This is a prototype/test screen for the new editing experience.
 */

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import ViewShot from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image as ExpoImage } from 'expo-image';
import { Home, Save, Download, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { getProjectDisplayName } from '@/utils/projectName';
import RenameProjectModal from '@/components/RenameProjectModal';
import { downloadAndSaveToGallery, saveToGallery } from '@/services/downloadService';
import { useTieredSubscription } from '@/hooks/usePremiumStatus';
import { captureEvent, POSTHOG_EVENTS } from '@/services/posthogService';
import { TemplateCanvas } from '@/components/TemplateCanvas';
import { extractSlots, getSlotById, hasValidCapturedImage, scaleSlots, getCapturedSlotCount } from '@/utils/slotParser';
import { applyAdjustmentsAndCrop, ensureLocalUri } from '@/utils/imageProcessing';
import { renderPreview } from '@/services/renderService';
import { uploadTempImage } from '@/services/tempUploadService';
import {
  CropToolbar,
  EditorMainToolbar,
  ElementContextBar,
  TextStylePanel,
  LogoPanel,
  TextEditToolbar,
} from '@/components/editor-v2';
import { enhanceImageWithPolling, AIProcessingProgress, AIProcessingStatus } from '@/services/aiService';
import { AIStudioSheet, AIProcessingOverlay, AISuccessOverlay, AIErrorView, AIAlreadyAppliedToast } from '@/components/ai';
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import type { AIFeatureKey } from '@/types';
import {
  SelectionState,
  DEFAULT_SELECTION,
} from '@/components/editor-v2/types';
import type { 
  MainToolbarItem, 
  TextStylePanelRef, 
  LogoPanelRef,
  ContextBarElementType,
} from '@/components/editor-v2';
import {
  createTextOverlay,
  createDateOverlay,
  createLogoOverlay,
  Overlay,
  OverlayTransform,
  TextOverlay,
  DateOverlay,
  LogoOverlay,
  DateFormat,
  isTextBasedOverlay,
  isLogoOverlay,
  LOGO_SIZE_CONSTRAINTS,
} from '@/types/overlays';
import {
  OverlayLayer,
} from '@/components/overlays';
import { saveOverlays, loadOverlays } from '@/services/overlayPersistenceService';
import { saveLocalPreviewFile, createDraftDirectories } from '@/services/localStorageService';
import { cleanupTempFiles, trackTempFile } from '@/services/tempCleanupService';

export default function EditorV2Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentProject, setCapturedImage, resetProject, saveDraft, isSavingDraft, refreshDrafts, renameDraft, isRenamingDraft, deleteDraft } = useApp();
  
  // Tiered subscription for download paywall and AI features
  const { canDownload, canUseAIStudio, tier, requestProAccess, requestStudioAccess } = useTieredSubscription();
  
  // Backward compatibility: isPremium = any tier above free
  const isPremium = tier !== 'free';
  
  // Legacy requestPremiumAccess wrapper for child components
  const requestPremiumAccess = useCallback(async (feature: string) => {
    if (feature.includes('studio') || feature.includes('ai')) {
      await requestStudioAccess(undefined, feature);
    } else {
      await requestProAccess(undefined, feature);
    }
  }, [requestProAccess, requestStudioAccess]);
  
  
  // Rename modal state
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  
  const template = currentProject.template;
  const capturedImages = currentProject.capturedImages;

  // Bottom sheet refs
  const aiStudioRef = useRef<BottomSheetModal>(null);
  const projectActionsRef = useRef<BottomSheet>(null);
  
  // Canva-style panel refs
  const textStylePanelRef = useRef<TextStylePanelRef>(null);
  const logoPanelRef = useRef<LogoPanelRef>(null);
  // ViewShot ref for capturing canvas with overlays
  const viewShotRef = useRef<ViewShot>(null);
  
  // Track when preview image is loaded (for ViewShot capture)
  const isPreviewImageLoadedRef = useRef(false);
  const [isPreviewImageLoaded, setIsPreviewImageLoaded] = useState(false);

  // NOTE: Preview rendering state removed - photos now rendered client-side via LayeredCanvas
  // Templated.io API only called on-demand when user taps Download

  // Editor state
  const [selection, setSelection] = useState<SelectionState>(DEFAULT_SELECTION);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiProcessingType, setAIProcessingType] = useState<AIFeatureKey | null>(null);
  const [aiProgress, setAIProgress] = useState<AIProcessingProgress | null>(null);
  const [aiSuccessResult, setAISuccessResult] = useState<{ originalUri: string; enhancedUri: string } | null>(null);
  
  // Toast state for "already applied" AI feature feedback
  const [aiAppliedToastVisible, setAIAppliedToastVisible] = useState(false);
  const [aiAppliedToastFeature, setAIAppliedToastFeature] = useState<AIFeatureKey>('auto_quality');
  const [aiError, setAIError] = useState<string | null>(null);
  const aiAbortControllerRef = useRef<AbortController | null>(null);
  
  // AI Studio sheet initial view - tracks which feature to open directly
  const [aiSheetInitialView, setAiSheetInitialView] = useState<AIFeatureKey | 'home'>('home');
  // Navigation trigger - increments each time a feature is clicked to force navigation
  const [aiNavTrigger, setAiNavTrigger] = useState(0);
  
  // Background layer customization state - initialized from draft (LEGACY)
  const [backgroundOverrides, setBackgroundOverrides] = useState<Record<string, string>>(
    currentProject.backgroundOverrides || {}
  );
  
  // Canvas background color state (NEW - for client-side compositing)
  // Initialized from template's default background color
  const [selectedBackgroundColor, setSelectedBackgroundColor] = useState<string>(
    template?.defaultBackgroundColor || '#FFFFFF'
  );
  
  // Theme color state (for theme layers - layers prefixed with 'theme-')
  // Initialized from draft's saved theme color (if loading a draft) OR template's default
  const [selectedThemeColor, setSelectedThemeColor] = useState<string | undefined>(
    currentProject.themeColor || template?.defaultThemeColor
  );
  
  
  // Ref to track overlay interaction - prevents canvas tap from deselecting during overlay tap
  const overlayInteractionRef = useRef<boolean>(false);
  
  // Track if a date overlay was just added (to auto-expand format picker)
  const [justAddedDateId, setJustAddedDateId] = useState<string | null>(null);

  // Download state
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Project display name for header
  const projectDisplayName = useMemo(() => {
    if (currentProject.projectName) {
      return currentProject.projectName;
    }
    // If no name and no draftId, it's a new project - show "New Project"
    if (!currentProject.draftId) {
      return 'New Project';
    }
    // Otherwise, format the date as fallback
    // Note: For loaded drafts, createdAt would be ideal but we don't store it in currentProject
    // We use a placeholder that will be updated once saved
    return 'Untitled';
  }, [currentProject.projectName, currentProject.draftId]);
  
  // Canva-style UI state
  const [activeMainTool, setActiveMainTool] = useState<MainToolbarItem | null>(null);
  const [expandedMainTool, setExpandedMainTool] = useState<MainToolbarItem | null>(null);

  // Track initial state for change detection
  const initialCapturedImagesRef = useRef<Record<string, string | null>>({});
  const initialOverlaysRef = useRef<Overlay[]>([]);
  const hasSetInitialStateRef = useRef(false);
  const hasSetInitialOverlaysRef = useRef(false);

  // Crop/Resize mode state (full resize with rotation)
  const [isCropMode, setIsCropMode] = useState(false);
  const [cropSlotId, setCropSlotId] = useState<string | null>(null);
  const [pendingRotation, setPendingRotation] = useState(0);
  const [pendingCropAdjustments, setPendingCropAdjustments] = useState<{
    scale: number;
    translateX: number;
    translateY: number;
    rotation: number;
  } | null>(null);

  // Manipulation mode state (pan/pinch without rotation - when slot is selected)
  const [pendingManipulationAdjustments, setPendingManipulationAdjustments] = useState<{
    scale: number;
    translateX: number;
    translateY: number;
    rotation: number;
  } | null>(null);

  // Track previous captured images to detect changes (URI and adjustments)
  const prevCapturedImagesRef = useRef<Record<string, { uri: string; adjustments?: any } | null>>({});

  // Window dimensions for canvas sizing
  const { width: screenWidth } = useWindowDimensions();
  const CANVAS_PADDING = 20;

  // Extract slots from template
  const slots = useMemo(() => {
    if (!template) return [];
    return extractSlots(template);
  }, [template]);

  // Calculate canvas display dimensions
  const canvasDimensions = useMemo(() => {
    if (!template) return { width: 0, height: 0 };
    
    const maxCanvasWidth = screenWidth - CANVAS_PADDING * 2;
    const aspectRatio = template.canvasWidth / template.canvasHeight;
    
    let width = maxCanvasWidth;
    let height = width / aspectRatio;
    
    // If too tall, constrain by height
    const maxHeight = screenWidth * 1.2;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    
    return { width, height };
  }, [template, screenWidth]);

  // Scale slots to display dimensions (for crop overlay)
  const scaledSlots = useMemo(() => {
    if (!template) return [];
    return scaleSlots(
      slots,
      template.canvasWidth,
      template.canvasHeight,
      canvasDimensions.width,
      canvasDimensions.height
    );
  }, [template, slots, canvasDimensions]);

  // Get crop slot data
  const cropSlotData = useMemo(() => {
    if (!cropSlotId || !isCropMode) return null;
    
    const scaledSlot = scaledSlots.find(s => s.layerId === cropSlotId);
    const image = capturedImages[cropSlotId];
    
    if (!scaledSlot || !image) return null;
    
    return {
      slot: scaledSlot,
      image,
    };
  }, [cropSlotId, isCropMode, scaledSlots, capturedImages]);

  // Get manipulation mode slot data (when slot is selected, not in crop mode)
  const manipulationSlotData = useMemo(() => {
    // Only active when a slot is selected and we're not in full crop mode
    if (selection.type !== 'slot' || !selection.id || isCropMode) return null;
    
    const scaledSlot = scaledSlots.find(s => s.layerId === selection.id);
    const image = capturedImages[selection.id];
    
    if (!scaledSlot || !image) return null;
    
    return {
      slot: scaledSlot,
      image,
    };
  }, [selection.type, selection.id, isCropMode, scaledSlots, capturedImages]);

  // Count captured slots for save validation
  const capturedCount = useMemo(() => 
    getCapturedSlotCount(slots, capturedImages),
    [slots, capturedImages]
  );
  
  // Get AI enhancements already applied to the currently selected slot's image
  // Used to disable AI feature buttons and show "already applied" feedback
  const selectedSlotAIEnhancements = useMemo(() => {
    if (selection.type !== 'slot' || !selection.id) return [];
    const image = capturedImages[selection.id];
    return image?.aiEnhancementsApplied ?? [];
  }, [selection.type, selection.id, capturedImages]);

  // Track the last loaded draft ID to prevent duplicate loads
  const lastLoadedDraftIdRef = useRef<string | null>(null);
  
  // Track if we've initialized with cached preview (prevents re-render when loading draft)
  const hasInitializedFromCacheRef = useRef(false);

  // Initialize with cached preview URL when loading a draft
  // This prevents unnecessary re-renders when the draft already has a valid preview
  useEffect(() => {
    if (hasInitializedFromCacheRef.current) return;
    if (!template) return;
    
    const cachedPreviewUrl = currentProject.cachedPreviewUrl;
    
    // When loading a draft with a cached preview, use it instead of re-rendering
    if (currentProject.draftId && cachedPreviewUrl) {
      console.log('[EditorV2] Using cached preview URL from draft:', cachedPreviewUrl.substring(0, 50));
      setRenderedPreviewUri(cachedPreviewUrl);
      // Important: Initialize prevCapturedImagesRef so change detection doesn't trigger re-render
      const initialPrevImages: Record<string, { uri: string; adjustments?: any } | null> = {};
      for (const [slotId, media] of Object.entries(capturedImages)) {
        initialPrevImages[slotId] = media ? { uri: media.uri, adjustments: media.adjustments } : null;
      }
      prevCapturedImagesRef.current = initialPrevImages;
      hasInitializedFromCacheRef.current = true;
      return;
    }
    
    // Mark as initialized even if no cached preview, so we only check once
    if (currentProject.draftId) {
      hasInitializedFromCacheRef.current = true;
    }
  }, [currentProject.draftId, currentProject.cachedPreviewUrl, template, capturedImages]);

  // Sync backgroundOverrides when draft is loaded
  useEffect(() => {
    if (currentProject.draftId && currentProject.backgroundOverrides) {
      setBackgroundOverrides(currentProject.backgroundOverrides);
    }
  }, [currentProject.draftId, currentProject.backgroundOverrides]);

  // Sync theme color when draft is loaded (similar to backgroundOverrides sync)
  // This ensures saved theme color from draft overrides the template default
  useEffect(() => {
    if (currentProject.draftId && currentProject.themeColor) {
      setSelectedThemeColor(currentProject.themeColor);
    }
  }, [currentProject.draftId, currentProject.themeColor]);

  // Reset colors to template defaults when template changes (for NEW projects only)
  // Skip reset if we're loading an existing draft with saved customizations
  useEffect(() => {
    if (template) {
      setSelectedBackgroundColor(template.defaultBackgroundColor || '#FFFFFF');
      // Only reset to template default if no saved theme color exists
      // This preserves user customizations when loading a draft
      if (!currentProject.themeColor) {
        setSelectedThemeColor(template.defaultThemeColor);
      }
    }
  }, [template?.id, currentProject.themeColor]);

  // Load overlays when loading a draft (FIX: was missing in EditorV2)
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
          console.log('[EditorV2] No draft ID, cleared overlays');
        }
        return;
      }
      
      // Skip if we already loaded this draft's overlays
      if (lastLoadedDraftIdRef.current === currentProject.draftId && hasSetInitialOverlaysRef.current) {
        console.log('[EditorV2] Overlays already loaded for draft:', currentProject.draftId);
        return;
      }
      
      console.log('[EditorV2] Loading overlays for draft:', currentProject.draftId);
      
      try {
        const savedOverlays = await loadOverlays(currentProject.draftId);
        console.log(`[EditorV2] Loaded ${savedOverlays.length} overlays from draft`);
        
        // Always set overlays (even if empty) to ensure clean state
        setOverlays(savedOverlays);
        
        // Set initial overlay state for change detection
        initialOverlaysRef.current = savedOverlays;
        hasSetInitialOverlaysRef.current = true;
        lastLoadedDraftIdRef.current = currentProject.draftId;
        
        console.log(`[EditorV2] Captured initial overlay state: ${savedOverlays.length} overlays`);
      } catch (error) {
        console.error('[EditorV2] Failed to load overlays:', error);
        // Set empty initial state on error
        setOverlays([]);
        initialOverlaysRef.current = [];
        hasSetInitialOverlaysRef.current = true;
        lastLoadedDraftIdRef.current = currentProject.draftId;
      }
    };
    
    loadDraftOverlays();
  }, [currentProject.draftId]);

  // Capture initial state when template first loads
  useEffect(() => {
    if (hasSetInitialStateRef.current) return;
    if (!template) return;
    
    const initialState: Record<string, string | null> = {};
    for (const [slotId, media] of Object.entries(capturedImages)) {
      initialState[slotId] = media?.uri || null;
    }
    
    initialCapturedImagesRef.current = initialState;
    hasSetInitialStateRef.current = true;
    
    // Note: overlays are now loaded separately in the loadDraftOverlays effect
    // Only capture initial overlay state here if not already set by loadDraftOverlays
    if (!hasSetInitialOverlaysRef.current) {
      initialOverlaysRef.current = [...overlays];
      hasSetInitialOverlaysRef.current = true;
    }
    
    console.log('[EditorV2] Captured initial state:', Object.keys(initialState).length, 'images,', overlays.length, 'overlays');
  }, [template, capturedImages, overlays, currentProject.draftId]);

  // Check if user has made any changes since opening
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

  // NOTE: triggerPreviewRender removed - photos now rendered client-side via LayeredCanvas
  // Templated.io API is only called when user taps Download (see handleDownload)


  // Handler for when preview image loads
  const handlePreviewImageLoad = useCallback(() => {
    console.log('[EditorV2] Preview image loaded');
    isPreviewImageLoadedRef.current = true;
    setIsPreviewImageLoaded(true);
  }, []);

  // Handle slot press (from TemplateCanvas)
  const handleSlotPress = useCallback((slotId: string) => {
    // Save pending manipulation adjustments if selecting a different slot
    if (selection.id && selection.id !== slotId && selection.type === 'slot' && pendingManipulationAdjustments) {
      saveManipulationAdjustments();
    }
    
    // Always deselect overlay when interacting with slots
    if (selection.id) {
      setSelection(DEFAULT_SELECTION);
      setPendingManipulationAdjustments(null);
    }
    // Also deselect any selected overlay
    if (selectedOverlayId) {
      setSelectedOverlayId(null);
    }

    const hasImage = hasValidCapturedImage(slotId, capturedImages);
    
    if (!hasImage) {
      // Empty slot - navigate to fullscreen capture screen
      router.push(`/capture/${slotId}`);
    } else {
      // Has image - select it for contextual actions (manipulation mode will be activated)
      setSelection({
        type: 'slot',
        id: slotId,
        isTransforming: false,
      });
    }
  }, [capturedImages, selection.id, selection.type, router, selectedOverlayId, pendingManipulationAdjustments, saveManipulationAdjustments]);

  // Handle canvas tap (deselect)
  const handleCanvasTap = useCallback(() => {
    // Skip if an overlay interaction is in progress (prevents race condition with overlay tap)
    if (overlayInteractionRef.current) {
      return;
    }
    
    // Save any pending manipulation adjustments before deselecting
    if (selection.id && selection.type === 'slot' && pendingManipulationAdjustments) {
      saveManipulationAdjustments();
    }
    
    if (selection.id) {
      setSelection(DEFAULT_SELECTION);
      setPendingManipulationAdjustments(null);
    }
    // Also deselect any selected overlay
    if (selectedOverlayId) {
      setSelectedOverlayId(null);
    }
    // Exit editing mode
    if (editingOverlayId) {
      setEditingOverlayId(null);
    }
  }, [selection, selectedOverlayId, editingOverlayId, pendingManipulationAdjustments, saveManipulationAdjustments]);


  // Handle AI enhancement selection (called from AIStudioPanel)
  const handleAIEnhancement = useCallback(async (featureKey: AIFeatureKey, presetId?: string) => {
    if (!selection.id || selection.type !== 'slot') {
      Alert.alert('Select a photo', 'Please select a photo first to apply AI enhancements.');
      return;
    }

    const slotId = selection.id;
    const image = capturedImages[slotId];
    
    if (!image?.uri) {
      Alert.alert('No image', 'Please capture a photo first.');
      return;
    }

    // Close AI panel
    aiStudioRef.current?.close();
    
    // Reset any previous state
    setAIError(null);
    setAISuccessResult(null);
    
    // Start processing with overlay
    setIsAIProcessing(true);
    setAIProcessingType(featureKey);
    setAIProgress({
      status: 'submitting',
      message: 'Starting enhancement...',
      progress: 0,
    });

    // Create abort controller for cancellation
    aiAbortControllerRef.current = new AbortController();

    try {
      // Get the image URL - images are now uploaded to Supabase immediately during capture
      // so they should already have public URLs accessible by AI services
      const imageUrl = image.uri;

      // Call the AI enhancement service with progress callbacks
      console.log('[Editor] Calling AI enhance with:', { featureKey, imageUrl: imageUrl.substring(0, 50), slotId, presetId });
      
      const result = await enhanceImageWithPolling(
        {
          featureKey,
          imageUrl,
          draftId: currentProject?.draftId || undefined,
          slotId,
          presetId,
        },
        (progress) => {
          // Update progress state for overlay
          setAIProgress(progress);
        },
        aiAbortControllerRef.current.signal
      );

      if (!result.success || !result.outputUrl) {
        throw new Error(result.error || 'Enhancement failed');
      }

      // Show success overlay with before/after
      setAISuccessResult({
        originalUri: imageUrl,
        enhancedUri: result.outputUrl,
      });
      
      // Update the captured image with the enhanced version
      setCapturedImage(slotId, {
        ...image,
        uri: result.outputUrl,
      });

    } catch (error: any) {
      console.error('[Editor] AI enhancement error:', error);
      
      if (error.message === 'Cancelled') {
        // User cancelled - just close overlay
        setIsAIProcessing(false);
        setAIProcessingType(null);
        setAIProgress(null);
      } else {
        // Show error state - ensure we have a string message
        const errorMsg = error?.message || (typeof error === 'string' ? error : 'Something went wrong. Please try again.');
        setAIError(errorMsg);
      }
    } finally {
      aiAbortControllerRef.current = null;
    }
  }, [selection, capturedImages, currentProject?.draftId, setCapturedImage]);

  // Handle AI cancel
  const handleAICancel = useCallback(() => {
    aiAbortControllerRef.current?.abort();
    setIsAIProcessing(false);
    setAIProcessingType(null);
    setAIProgress(null);
  }, []);

  // Handle AI success dismiss
  const handleAISuccessDismiss = useCallback(() => {
    setAISuccessResult(null);
    setIsAIProcessing(false);
    setAIProcessingType(null);
    setAIProgress(null);
  }, []);

  // Handle AI error retry
  const handleAIRetry = useCallback(() => {
    setAIError(null);
    setIsAIProcessing(false);
    setAIProcessingType(null);
    setAIProgress(null);
    // The user will need to tap the AI feature again
  }, []);

  // Handle AI error dismiss
  const handleAIErrorDismiss = useCallback(() => {
    setAIError(null);
    setIsAIProcessing(false);
    setAIProcessingType(null);
    setAIProgress(null);
  }, []);

  // Handle background layer color change - client-side only, no API needed
  // LayeredCanvas re-renders automatically when backgroundOverrides state changes
  const handleBackgroundLayerColorChange = useCallback((layerId: string, color: string) => {
    setBackgroundOverrides(prev => ({
      ...prev,
      [layerId]: color,
    }));
  }, []);

  // Handle reset all background overrides - client-side only, no API needed
  const handleBackgroundOverridesReset = useCallback(() => {
    setBackgroundOverrides({});
  }, []);


  // ============================================
  // Canva-style Main Toolbar Handlers
  // ============================================
  
  // Handle main toolbar tool selection (Canva-style)
  const handleMainToolbarSelect = useCallback((tool: MainToolbarItem) => {
    // Close any open panels first
    setActiveMainTool(tool === activeMainTool ? null : tool);
    
    if (tool === 'photo') {
      // Photo tool - find first empty slot or navigate to capture
      const firstEmptySlot = slots.find(slot => !hasValidCapturedImage(slot.layerId, capturedImages));
      if (firstEmptySlot) {
        router.push(`/capture/${firstEmptySlot.layerId}`);
      } else if (slots.length > 0) {
        // All slots filled - select first slot for editing
        setSelection({
          type: 'slot',
          id: slots[0].layerId,
          isTransforming: false,
        });
      }
    } else if (tool === 'text') {
      // Add text overlay at top of canvas (visible above keyboard)
      const newOverlay = createTextOverlay({
        transform: { x: 0.5, y: 0.2, scale: 1, rotation: 0 }, // Top center
      });
      // Set interaction flag to prevent canvas tap from dismissing keyboard
      overlayInteractionRef.current = true;
      setTimeout(() => { overlayInteractionRef.current = false; }, 300);
      
      setOverlays(prev => [...prev, newOverlay]);
      setSelectedOverlayId(newOverlay.id);
      // Enter editing mode immediately for new text
      setEditingOverlayId(newOverlay.id);
    } else if (tool === 'date') {
      // Add date overlay at top of canvas (visible above keyboard)
      const newOverlay = createDateOverlay({
        transform: { x: 0.5, y: 0.25, scale: 1, rotation: 0 }, // Top center
      });
      // Set interaction flag to prevent canvas tap from deselecting
      overlayInteractionRef.current = true;
      setTimeout(() => { overlayInteractionRef.current = false; }, 300);
      
      setOverlays(prev => [...prev, newOverlay]);
      setSelectedOverlayId(newOverlay.id);
      // Track that we just added this date (for auto-expanding format picker)
      setJustAddedDateId(newOverlay.id);
      // Clear after a moment so it doesn't keep expanding on re-selection
      setTimeout(() => setJustAddedDateId(null), 500);
    } else if (tool === 'logo') {
      // Open logo picker panel
      logoPanelRef.current?.openPicker();
    } else if (tool === 'ai') {
      // Open AI Studio sheet - shows image carousel to select image
      // The sheet handles the "no images" case with the carousel's empty state
      setAiSheetInitialView('home');
      setAiNavTrigger(prev => prev + 1); // Reset view to home when opening from toolbar
      aiStudioRef.current?.present();
    }
  }, [activeMainTool, slots, capturedImages, router]);

  // Get element type for context bar based on selection
  const contextBarElementType = useMemo((): ContextBarElementType | null => {
    if (selection.type === 'slot') return 'photo';
    if (selectedOverlayId) {
      const overlay = overlays.find(o => o.id === selectedOverlayId);
      if (overlay) {
        if (overlay.type === 'text') return 'text';
        if (overlay.type === 'date') return 'date';
        if (overlay.type === 'logo') return 'logo';
      }
    }
    return null;
  }, [selection.type, selectedOverlayId, overlays]);

  // Check if something is selected (for showing context bar vs main toolbar)
  const hasSelection = selection.id !== null || selectedOverlayId !== null;

  // Handle confirm/done from context bar
  const handleContextBarConfirm = useCallback(() => {
    // Save any pending manipulation adjustments before deselecting
    if (pendingManipulationAdjustments) {
      saveManipulationAdjustments();
    }
    setSelection(DEFAULT_SELECTION);
    setPendingManipulationAdjustments(null);
    setSelectedOverlayId(null);
    setActiveMainTool(null);
    
    // Close panels
    textStylePanelRef.current?.close();
    logoPanelRef.current?.close();
  }, [pendingManipulationAdjustments, saveManipulationAdjustments]);
  
  // Check if we can use client-side compositing (LayeredCanvas)
  const canUseClientSideCompositing = useMemo(() => {
    return !!template?.frameOverlayUrl;
  }, [template?.frameOverlayUrl]);

  // Get the customizable background layer ID (if available)
  const backgroundLayerId = useMemo(() => {
    // customizableBackgroundLayers is an array of layer IDs that can be color-customized
    // Use the first one as the "main" background layer
    return template?.customizableBackgroundLayers?.[0] || null;
  }, [template?.customizableBackgroundLayers]);

  // Check if user has any photos captured
  const hasAnyCapturedPhotos = useMemo(() => {
    return Object.values(capturedImages).some(img => img !== null);
  }, [capturedImages]);

  // Handle canvas background color change - CLIENT-SIDE ONLY (no API calls)
  // Uses LayeredCanvas with transparent frame overlay PNG
  const handleCanvasBackgroundColorChange = useCallback((color: string) => {
    console.log('[EditorV2] BG color change:', { color, canUseClientSide: canUseClientSideCompositing });
    setSelectedBackgroundColor(color);
    
    // Background color changes work instantly via LayeredCanvas
    // Frame overlay PNG has transparent background - color shows through
    if (canUseClientSideCompositing) {
      console.log('[EditorV2] ✓ Using LayeredCanvas for instant BG change (no API call)');
    } else {
      console.log('[EditorV2] ⚠️ Template does not support background changes (no frameOverlayUrl)');
    }
  }, [canUseClientSideCompositing]);

  // Handle theme color change - CLIENT-SIDE ONLY (no API calls)
  // Theme layers (prefixed with 'theme-') are rendered as colored shapes by LayeredCanvas
  const handleThemeColorChange = useCallback((color: string) => {
    setSelectedThemeColor(color);
  }, []);

  // Handle text edit action - enters editing mode with keyboard
  const handleTextEditAction = useCallback(() => {
    if (selectedOverlayId) {
      setEditingOverlayId(selectedOverlayId);
    }
  }, [selectedOverlayId]);

  // Handle text edit done - exits editing mode
  const handleTextEditDone = useCallback(() => {
    setEditingOverlayId(null);
  }, []);

  // Handle text content change during editing
  const handleTextContentChange = useCallback((content: string) => {
    if (editingOverlayId) {
      setOverlays(prev => prev.map(overlay => 
        overlay.id === editingOverlayId && overlay.type === 'text'
          ? { ...overlay, content, updatedAt: new Date().toISOString() }
          : overlay
      ));
    }
  }, [editingOverlayId]);

  // Handle editing overlay color change from TextEditToolbar
  const handleEditingColorChange = useCallback((color: string) => {
    if (editingOverlayId) {
      setOverlays(prev => prev.map(overlay => 
        overlay.id === editingOverlayId && isTextBasedOverlay(overlay)
          ? { ...overlay, color, updatedAt: new Date().toISOString() }
          : overlay
      ));
    }
  }, [editingOverlayId]);

  // Handle editing overlay font change from TextEditToolbar
  const handleEditingFontChange = useCallback((fontFamily: string) => {
    if (editingOverlayId) {
      setOverlays(prev => prev.map(overlay => 
        overlay.id === editingOverlayId && isTextBasedOverlay(overlay)
          ? { ...overlay, fontFamily, updatedAt: new Date().toISOString() }
          : overlay
      ));
    }
  }, [editingOverlayId]);

  // Handle editing overlay font size change from TextEditToolbar
  const handleEditingFontSizeChange = useCallback((fontSize: number) => {
    if (editingOverlayId) {
      setOverlays(prev => prev.map(overlay => 
        overlay.id === editingOverlayId && isTextBasedOverlay(overlay)
          ? { ...overlay, fontSize, updatedAt: new Date().toISOString() }
          : overlay
      ));
    }
  }, [editingOverlayId]);

  // Handle editing overlay format change from TextEditToolbar
  const handleEditingFormatChange = useCallback((format: { bold?: boolean; italic?: boolean; underline?: boolean; strikethrough?: boolean }) => {
    if (editingOverlayId) {
      setOverlays(prev => prev.map(overlay => 
        overlay.id === editingOverlayId && isTextBasedOverlay(overlay)
          ? { ...overlay, ...format, updatedAt: new Date().toISOString() }
          : overlay
      ));
    }
  }, [editingOverlayId]);

  // Handle logo replace action from context bar
  const handleLogoReplaceAction = useCallback(() => {
    logoPanelRef.current?.openPicker();
  }, []);

  // Handle logo opacity action from context bar  
  const handleLogoOpacityAction = useCallback(() => {
    logoPanelRef.current?.openOpacityEditor();
  }, []);

  // Handle logo size action from context bar
  const handleLogoSizeAction = useCallback(() => {
    logoPanelRef.current?.openSizeEditor();
  }, []);

  // Handle logo selected from LogoPanel
  const handleLogoPanelSelect = useCallback((logoData: { uri: string; width: number; height: number }) => {
    const newOverlay = createLogoOverlay(
      logoData.uri,
      logoData.width,
      logoData.height,
      false
    );
    // Set interaction flag to prevent canvas tap from deselecting
    overlayInteractionRef.current = true;
    setTimeout(() => { overlayInteractionRef.current = false; }, 300);
    
    setOverlays(prev => [...prev, newOverlay]);
    setSelectedOverlayId(newOverlay.id);
    
    // Open logo editor panel for the newly added logo (default to size editor)
    setTimeout(() => {
      logoPanelRef.current?.openSizeEditor();
    }, 100);
    
    console.log('[EditorV2] Added logo overlay from panel:', newOverlay.id);
  }, []);

  // Handle logo panel close
  const handleLogoPanelClose = useCallback(() => {
    setActiveMainTool(null);
  }, []);

  // Handle text style panel close
  const handleTextStylePanelClose = useCallback(() => {
    setActiveMainTool(null);
  }, []);

  // Handle inline color change from ElementContextBar
  const handleInlineColorChange = useCallback((color: string) => {
    if (selectedOverlayId) {
      handleUpdateOverlayProperties({ color });
    }
  }, [selectedOverlayId, handleUpdateOverlayProperties]);

  // Handle inline font size change from ElementContextBar
  const handleInlineFontSizeChange = useCallback((fontSize: number) => {
    if (selectedOverlayId) {
      handleUpdateOverlayProperties({ fontSize });
    }
  }, [selectedOverlayId, handleUpdateOverlayProperties]);

  // Handle inline font change from ElementContextBar
  const handleInlineFontChange = useCallback((fontFamily: string) => {
    if (selectedOverlayId) {
      handleUpdateOverlayProperties({ fontFamily });
    }
  }, [selectedOverlayId, handleUpdateOverlayProperties]);

  // Handle inline format change from ElementContextBar
  const handleInlineFormatChange = useCallback((format: { bold?: boolean; italic?: boolean; underline?: boolean; strikethrough?: boolean; textAlign?: string }) => {
    if (selectedOverlayId) {
      handleUpdateOverlayProperties(format as any);
    }
  }, [selectedOverlayId, handleUpdateOverlayProperties]);

  // Handle inline background color change from ElementContextBar
  const handleInlineBackgroundChange = useCallback((backgroundColor: string | undefined) => {
    if (selectedOverlayId) {
      handleUpdateOverlayProperties({ backgroundColor } as any);
    }
  }, [selectedOverlayId, handleUpdateOverlayProperties]);

  // Handle date format change from ElementContextBar
  const handleDateFormatChange = useCallback((format: DateFormat) => {
    if (selectedOverlayId) {
      handleUpdateOverlayProperties({ format } as any);
    }
  }, [selectedOverlayId, handleUpdateOverlayProperties]);

  // Handle date change from ElementContextBar
  const handleDateChange = useCallback((date: Date) => {
    if (selectedOverlayId) {
      handleUpdateOverlayProperties({ date: date.toISOString() } as any);
    }
  }, [selectedOverlayId, handleUpdateOverlayProperties]);

  // Get current color from selected text overlay
  const currentOverlayColor = useMemo(() => {
    const overlay = overlays.find(o => o.id === selectedOverlayId);
    if (overlay && isTextBasedOverlay(overlay)) {
      return (overlay as any).color || '#FFFFFF';
    }
    return '#FFFFFF';
  }, [overlays, selectedOverlayId]);

  // Get current font size from selected text overlay
  // Note: Direct dependency on overlays ensures re-computation when any overlay changes
  const currentOverlayFontSize = useMemo(() => {
    const overlay = overlays.find(o => o.id === selectedOverlayId);
    if (overlay && isTextBasedOverlay(overlay)) {
      return (overlay as any).fontSize || 24;
    }
    return 24;
  }, [overlays, selectedOverlayId]);

  // Get current font from selected text overlay
  const currentOverlayFont = useMemo(() => {
    const overlay = overlays.find(o => o.id === selectedOverlayId);
    if (overlay && isTextBasedOverlay(overlay)) {
      return (overlay as any).fontFamily || 'System';
    }
    return 'System';
  }, [overlays, selectedOverlayId]);

  // Get current format from selected text overlay
  const currentOverlayFormat = useMemo(() => {
    const overlay = overlays.find(o => o.id === selectedOverlayId);
    if (overlay && isTextBasedOverlay(overlay)) {
      const typedOverlay = overlay as any;
      return {
        bold: typedOverlay.bold || false,
        italic: typedOverlay.italic || false,
        underline: typedOverlay.underline || false,
        strikethrough: typedOverlay.strikethrough || false,
        textAlign: typedOverlay.textAlign || 'center',
      };
    }
    return {};
  }, [overlays, selectedOverlayId]);

  // Get current background color from selected text/date overlay
  const currentOverlayBackgroundColor = useMemo(() => {
    const overlay = overlays.find(o => o.id === selectedOverlayId);
    if (overlay && isTextBasedOverlay(overlay)) {
      return (overlay as any).backgroundColor || undefined;
    }
    return undefined;
  }, [overlays, selectedOverlayId]);

  // Get current date format from selected date overlay
  const currentOverlayDateFormat = useMemo(() => {
    const overlay = overlays.find(o => o.id === selectedOverlayId);
    if (overlay && overlay.type === 'date') {
      return (overlay as DateOverlay).format || 'medium';
    }
    return 'medium';
  }, [overlays, selectedOverlayId]);

  // Get current date from selected date overlay
  const currentOverlayDate = useMemo(() => {
    const overlay = overlays.find(o => o.id === selectedOverlayId);
    if (overlay && overlay.type === 'date') {
      return new Date((overlay as DateOverlay).date);
    }
    return new Date();
  }, [overlays, selectedOverlayId]);

  // Compute auto-expand option for context bar
  const contextBarAutoExpandOption = useMemo(() => {
    // Auto-expand date format picker when a date was just added
    if (justAddedDateId && selectedOverlayId === justAddedDateId) {
      return 'dateFormat' as const;
    }
    return undefined;
  }, [justAddedDateId, selectedOverlayId]);

  // ============================================
  // Overlay Handlers
  // ============================================

  // Get currently selected overlay
  const selectedOverlay = useMemo(() => 
    overlays.find(o => o.id === selectedOverlayId) || null,
    [overlays, selectedOverlayId]
  );

  // Handle duplicate overlay (by ID - for OverlayLayer)
  const handleDuplicateOverlayById = useCallback((id: string) => {
    const overlayToDuplicate = overlays.find(o => o.id === id);
    if (!overlayToDuplicate) return;
    
    // Create a copy with a new ID and slightly offset position
    const now = new Date().toISOString();
    const duplicatedOverlay: Overlay = {
      ...overlayToDuplicate,
      id: `overlay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transform: {
        ...overlayToDuplicate.transform,
        x: Math.min(0.9, overlayToDuplicate.transform.x + 0.05), // Offset slightly
        y: Math.min(0.9, overlayToDuplicate.transform.y + 0.05),
      },
      createdAt: now,
      updatedAt: now,
    };
    
    setOverlays(prev => [...prev, duplicatedOverlay]);
    setSelectedOverlayId(duplicatedOverlay.id);
  }, [overlays]);

  // Get the overlay being edited
  const editingOverlay = useMemo(() => 
    overlays.find(o => o.id === editingOverlayId) || null,
    [overlays, editingOverlayId]
  );

  // Get editing overlay content (for text overlays)
  const editingOverlayContent = useMemo(() => {
    if (editingOverlay && editingOverlay.type === 'text') {
      return (editingOverlay as TextOverlay).content || '';
    }
    return '';
  }, [editingOverlay]);

  // Get editing overlay color
  const editingOverlayColor = useMemo(() => {
    if (editingOverlay && isTextBasedOverlay(editingOverlay)) {
      return (editingOverlay as any).color || '#FFFFFF';
    }
    return '#FFFFFF';
  }, [editingOverlay]);

  // Get editing overlay font
  const editingOverlayFont = useMemo(() => {
    if (editingOverlay && isTextBasedOverlay(editingOverlay)) {
      return (editingOverlay as any).fontFamily || 'System';
    }
    return 'System';
  }, [editingOverlay]);

  // Get editing overlay font size
  const editingOverlayFontSize = useMemo(() => {
    if (editingOverlay && isTextBasedOverlay(editingOverlay)) {
      return (editingOverlay as any).fontSize || 24;
    }
    return 24;
  }, [editingOverlay]);

  // Get editing overlay format
  const editingOverlayFormat = useMemo(() => {
    if (editingOverlay && isTextBasedOverlay(editingOverlay)) {
      const overlay = editingOverlay as any;
      return {
        bold: overlay.bold || false,
        italic: overlay.italic || false,
        underline: overlay.underline || false,
        strikethrough: overlay.strikethrough || false,
        textAlign: overlay.textAlign || 'center',
      };
    }
    return { bold: false, italic: false, underline: false, strikethrough: false, textAlign: 'center' };
  }, [editingOverlay]);

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

  // Select an overlay
  const handleSelectOverlay = useCallback((id: string | null) => {
    // Set interaction flag to prevent canvas tap from interfering
    if (id !== null) {
      overlayInteractionRef.current = true;
      // Clear the flag after a short delay (allows tap event to fully propagate)
      setTimeout(() => {
        overlayInteractionRef.current = false;
      }, 100);
    }
    
    setSelectedOverlayId(id);
    // Context bar will appear automatically based on selection
  }, []);

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
    }
    console.log('[EditorV2] Deleted overlay:', id);
  }, [selectedOverlayId]);

  // Delete selected overlay (from style sheet)
  const handleDeleteSelectedOverlay = useCallback(() => {
    if (selectedOverlayId) {
      handleDeleteOverlay(selectedOverlayId);
    }
  }, [selectedOverlayId, handleDeleteOverlay]);

  // Handle scale change from ScaleSlider
  const handleScaleSliderChange = useCallback((newScale: number) => {
    if (!selectedOverlayId || !selectedOverlay) return;
    
    const updatedTransform: OverlayTransform = {
      ...selectedOverlay.transform,
      scale: newScale,
    };
    
    handleUpdateOverlayTransform(selectedOverlayId, updatedTransform);
  }, [selectedOverlayId, selectedOverlay, handleUpdateOverlayTransform]);

  // Handle opacity change from LogoPanel
  const handleLogoOpacityChange = useCallback((newOpacity: number) => {
    if (!selectedOverlayId || !selectedOverlay || !isLogoOverlay(selectedOverlay)) return;
    
    setOverlays(prev => prev.map(overlay => 
      overlay.id === selectedOverlayId && isLogoOverlay(overlay)
        ? { ...overlay, opacity: newOpacity, updatedAt: new Date().toISOString() }
        : overlay
    ));
  }, [selectedOverlayId, selectedOverlay]);

  // Canva-style contextual toolbar actions
  const handlePhotoReplace = useCallback(() => {
    if (selection.id) {
      // Navigate to fullscreen capture screen to replace the image
      router.push(`/capture/${selection.id}`);
    }
  }, [selection, router]);

  const handlePhotoResize = useCallback(() => {
    if (selection.id && capturedImages[selection.id]) {
      // First, save any pending manipulation adjustments
      if (pendingManipulationAdjustments) {
        const currentImage = capturedImages[selection.id];
        if (currentImage) {
          const updatedAdjustments = {
            ...(currentImage.adjustments || { scale: 1, translateX: 0, translateY: 0, rotation: 0 }),
            scale: pendingManipulationAdjustments.scale,
            translateX: pendingManipulationAdjustments.translateX,
            translateY: pendingManipulationAdjustments.translateY,
            rotation: pendingManipulationAdjustments.rotation,
          };
          setCapturedImage(selection.id, {
            ...currentImage,
            adjustments: updatedAdjustments,
          });
        }
        setPendingManipulationAdjustments(null);
      }
      
      // Enter inline resize mode (full crop with rotation)
      const image = capturedImages[selection.id];
      setCropSlotId(selection.id);
      setIsCropMode(true);
      // Initialize rotation from existing adjustments (including any just saved)
      const savedAdjustments = pendingManipulationAdjustments || image.adjustments;
      setPendingRotation(savedAdjustments?.rotation || 0);
      // Clear selection while in resize mode
      setSelection(DEFAULT_SELECTION);
    }
  }, [selection, capturedImages, pendingManipulationAdjustments, setCapturedImage]);

  // Resize mode handlers
  const handleResizeCancel = useCallback(() => {
    setIsCropMode(false);
    setCropSlotId(null);
    setPendingCropAdjustments(null);
    setPendingRotation(0);
  }, []);

  const handleResizeDone = useCallback(() => {
    if (cropSlotId) {
      const currentImage = capturedImages[cropSlotId];
      if (currentImage) {
        // Merge adjustments with rotation
        const finalAdjustments = {
          ...(currentImage.adjustments || { scale: 1, translateX: 0, translateY: 0, rotation: 0 }),
          ...(pendingCropAdjustments || {}),
          rotation: pendingRotation,
        };
        setCapturedImage(cropSlotId, {
          ...currentImage,
          adjustments: finalAdjustments,
        });
      }
    }
    setIsCropMode(false);
    setCropSlotId(null);
    setPendingCropAdjustments(null);
    setPendingRotation(0);
    // NOTE: No API call needed - LayeredCanvas re-renders automatically
    // when capturedImages state updates
  }, [cropSlotId, pendingCropAdjustments, pendingRotation, capturedImages, setCapturedImage]);

  // Handle adjustment changes from CropOverlay
  const handleCropAdjustmentChange = useCallback((adjustments: {
    scale: number;
    translateX: number;
    translateY: number;
    rotation: number;
  }) => {
    setPendingCropAdjustments(adjustments);
  }, []);

  // Handle adjustment changes from ManipulationOverlay (pan/pinch only)
  const handleManipulationAdjustmentChange = useCallback((adjustments: {
    scale: number;
    translateX: number;
    translateY: number;
    rotation: number;
  }) => {
    setPendingManipulationAdjustments(adjustments);
  }, []);

  // Save pending manipulation adjustments to the captured image
  const saveManipulationAdjustments = useCallback(() => {
    if (!selection.id || selection.type !== 'slot' || !pendingManipulationAdjustments) return;
    
    const currentImage = capturedImages[selection.id];
    if (!currentImage) return;
    
    // Merge with existing adjustments (rotation stays the same since manipulation doesn't change it)
    const finalAdjustments = {
      ...(currentImage.adjustments || { scale: 1, translateX: 0, translateY: 0, rotation: 0 }),
      scale: pendingManipulationAdjustments.scale,
      translateX: pendingManipulationAdjustments.translateX,
      translateY: pendingManipulationAdjustments.translateY,
      // rotation passes through from pendingManipulationAdjustments (unchanged)
      rotation: pendingManipulationAdjustments.rotation,
    };
    
    console.log('[EditorV2] Saving manipulation adjustments for slot:', selection.id, finalAdjustments);
    
    setCapturedImage(selection.id, {
      ...currentImage,
      adjustments: finalAdjustments,
    });
    
    setPendingManipulationAdjustments(null);
  }, [selection.id, selection.type, pendingManipulationAdjustments, capturedImages, setCapturedImage]);

  // Handle rotation change from slider
  const handleRotationChange = useCallback((rotation: number) => {
    setPendingRotation(rotation);
  }, []);

  // Handle AI feature selection from inline menu (context bar - photo already selected)
  // OPTIMIZED: Opens sheet instantly - image preparation is deferred to enhance action
  const handleAIFeatureSelect = useCallback((featureKey: AIFeatureKey) => {
    if (selection.type !== 'slot' || !selection.id) {
      return;
    }
    
    // Just set the feature view and open immediately - NO image processing here
    // Images are prepared lazily when user actually clicks "Enhance"
    setAiSheetInitialView(featureKey);
    setAiNavTrigger(prev => prev + 1);
    aiStudioRef.current?.present();
  }, [selection]);
  
  // Handle tap on already-applied AI feature - shows toast explaining why re-applying is disabled
  const handleAlreadyAppliedTap = useCallback((featureKey: AIFeatureKey) => {
    setAIAppliedToastFeature(featureKey);
    setAIAppliedToastVisible(true);
  }, []);
  
  // Dismiss the already-applied toast
  const handleDismissAppliedToast = useCallback(() => {
    setAIAppliedToastVisible(false);
  }, []);

  // Handle AI feature selection from main toolbar (may not have photo selected)
  // OPTIMIZED: Opens sheet instantly - image preparation is deferred to enhance action
  const handleMainToolbarAISelect = useCallback((featureKey: AIFeatureKey) => {
    // Check if a photo slot is selected
    if (selection.type !== 'slot' || !selection.id) {
      // Need to select a photo first - find first slot with an image
      const firstFilledSlot = slots.find(slot => hasValidCapturedImage(slot.layerId, capturedImages));
      if (firstFilledSlot) {
        // Select the slot first
        setSelection({
          type: 'slot',
          id: firstFilledSlot.layerId,
          isTransforming: false,
        });
        
        // Set feature view and open after brief delay for selection to update
        setAiSheetInitialView(featureKey);
        setAiNavTrigger(prev => prev + 1);
        setTimeout(() => {
          aiStudioRef.current?.present();
        }, 50);
      } else {
        // No photos yet - prompt to add one
        Alert.alert(
          'Add a Photo First',
          'Please add a photo to your template before using AI features.',
          [{ text: 'OK' }]
        );
      }
      return;
    }
    
    // Photo already selected - just open the sheet immediately
    setAiSheetInitialView(featureKey);
    setAiNavTrigger(prev => prev + 1);
    aiStudioRef.current?.present();
  }, [selection, slots, capturedImages]);

  const handlePhotoDelete = useCallback(() => {
    if (selection.id) {
      Alert.alert(
        'Delete Photo',
        'Are you sure you want to remove this photo?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              setCapturedImage(selection.id!, null);
              setSelection(DEFAULT_SELECTION);
            },
          },
        ]
      );
    }
  }, [selection, setCapturedImage]);

  // Capture the composed canvas using ViewShot
  // This captures the full template composition: photos + frame + background + overlays
  // Returns the captured file path (in cache directory)
  const captureCanvasWithOverlays = useCallback(async (): Promise<string | null> => {
    if (!viewShotRef.current) {
      console.warn('[EditorV2] ViewShot ref not available');
      return null;
    }
    
    // LayeredCanvas renders photos client-side with template frame
    // We need at least one photo to have something meaningful to capture
    if (capturedCount === 0) {
      console.warn('[EditorV2] No photos to capture');
      return null;
    }
    
    try {
      // Track what was selected so we know if we need to wait for re-render
      const wasOverlaySelected = selectedOverlayId;
      const wasSlotSelected = selection.id !== null;
      const hadAnySelection = wasOverlaySelected || wasSlotSelected;
      
      // Deselect any selected overlay before capture to hide selection UI
      if (wasOverlaySelected) {
        setSelectedOverlayId(null);
      }
      
      // Deselect any selected slot before capture to hide manipulation grid UI
      if (wasSlotSelected) {
        setSelection(DEFAULT_SELECTION);
        setPendingManipulationAdjustments(null);
      }
      
      console.log('[EditorV2] Preparing to capture canvas with overlays...', { wasOverlaySelected, wasSlotSelected });
      
      // Brief wait for React to re-render without selection UI
      // This ensures the selection grid and manipulation overlays are hidden
      if (hadAnySelection) {
        // Wait for UI to update after clearing selections
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      console.log('[EditorV2] Capturing canvas now...');
      
      const uri = await viewShotRef.current.capture();
      
      if (!uri) {
        console.warn('[EditorV2] ViewShot capture returned null');
        return null;
      }
      
      // Track the ViewShot temp file for cleanup
      trackTempFile(uri);
      
      // Save to cache directory temporarily
      const filename = `canvas_overlay_${Date.now()}.jpg`;
      const destUri = `${FileSystem.cacheDirectory}${filename}`;
      
      await FileSystem.copyAsync({ from: uri, to: destUri });
      
      // Track the copied file for cleanup as well
      trackTempFile(destUri);
      
      console.log('[EditorV2] Captured canvas with overlays to cache:', destUri);
      return destUri;
    } catch (error) {
      console.error('[EditorV2] Failed to capture canvas:', error);
      return null;
    }
  }, [capturedCount, selectedOverlayId, selection.id]);

  // Handle save draft action
  const handleSaveDraft = useCallback(async () => {
    if (!template) return;

    if (capturedCount === 0) {
      Alert.alert(
        'Nothing to Save',
        'Add at least one image before saving.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    try {
      // Build capturedImageUris map with ALL slot images
      // CRITICAL FIX: Apply adjustments (rotation, scale, translate) to images BEFORE saving
      // This ensures the saved images have the user's edits baked in
      const capturedImageUris: Record<string, string> = {};
      
      for (const [slotId, media] of Object.entries(capturedImages)) {
        if (!media?.uri) continue;
        
        const slot = getSlotById(slots, slotId);
        if (!slot) {
          // No slot info, save raw image
          capturedImageUris[slotId] = media.uri;
          continue;
        }
        
        // Check if image has adjustments that need to be applied
        const adjustments = media.adjustments;
        const hasNonDefaultAdjustments = adjustments && (
          adjustments.translateX !== 0 ||
          adjustments.translateY !== 0 ||
          adjustments.scale !== 1.0 ||
          (adjustments.rotation !== undefined && adjustments.rotation !== 0)
        );
        
        if (hasNonDefaultAdjustments && adjustments) {
          // Apply adjustments and crop to exact slot size BEFORE saving
          try {
            console.log(`[EditorV2] Applying adjustments for ${slotId} before save:`, adjustments);
            const processed = await applyAdjustmentsAndCrop(
              media.uri,
              media.width,
              media.height,
              slot.width,
              slot.height,
              adjustments
            );
            capturedImageUris[slotId] = processed.uri;
            console.log(`[EditorV2] Processed image for ${slotId}:`, processed.uri.substring(0, 50));
          } catch (adjustError) {
            console.warn(`[EditorV2] Failed to apply adjustments for ${slotId}, using original:`, adjustError);
            capturedImageUris[slotId] = media.uri;
          }
        } else {
          // No adjustments needed, use original
          capturedImageUris[slotId] = media.uri;
        }
      }

      console.log('[EditorV2] Saving draft with slots:', Object.keys(capturedImageUris), 'overlays:', overlays.length);

      // STEP 1: Capture the canvas FIRST (before any state changes)
      // LayeredCanvas renders photos client-side with template frame, so we capture the composed view
      // This ensures the thumbnail shows the full template composition, not just a raw photo
      let capturedPreviewPath: string | null = null;
      if (capturedCount > 0) {
        console.log('[EditorV2] Step 1: Capturing canvas with composed view BEFORE save...');
        capturedPreviewPath = await captureCanvasWithOverlays();
        
        if (capturedPreviewPath) {
          console.log('[EditorV2] Preview captured to temp location:', capturedPreviewPath);
        } else {
          console.warn('[EditorV2] Failed to capture preview with overlays');
        }
      }

      // STEP 2: Build adjustments and backgroundInfo maps from capturedImages
      // Store adjustments separately since we can't bake them into remote images
      const capturedImageAdjustments: Record<string, { scale: number; translateX: number; translateY: number; rotation: number }> = {};
      const capturedImageBackgroundInfo: Record<string, {
        type: 'solid' | 'gradient' | 'transparent';
        solidColor?: string;
        gradient?: {
          type: 'linear';
          colors: [string, string];
          direction: 'vertical' | 'horizontal' | 'diagonal-tl' | 'diagonal-tr';
        };
      }> = {};
      
      for (const [slotId, media] of Object.entries(capturedImages)) {
        if (media?.adjustments) {
          capturedImageAdjustments[slotId] = {
            scale: media.adjustments.scale,
            translateX: media.adjustments.translateX,
            translateY: media.adjustments.translateY,
            rotation: media.adjustments.rotation || 0,
          };
        }
        // Also extract backgroundInfo for transparent PNGs
        if (media?.backgroundInfo) {
          capturedImageBackgroundInfo[slotId] = media.backgroundInfo;
        }
      }
      
      console.log('[EditorV2] Saving adjustments:', capturedImageAdjustments);
      console.log('[EditorV2] Saving backgroundInfo:', capturedImageBackgroundInfo);

      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-v2.tsx:handleSaveDraft',message:'Saving draft with backgroundInfo',data:{slotIds:Object.keys(capturedImageBackgroundInfo),backgroundInfoCount:Object.keys(capturedImageBackgroundInfo).length,sampleBgInfo:Object.values(capturedImageBackgroundInfo)[0]},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'save-bg-info'})}).catch(()=>{});
      // #endregion

      // STEP 3: Save the draft to get/confirm the draft ID
      // NOTE: renderedPreviewUrl is null since we use client-side rendering now
      const savedDraft = await saveDraft({
        templateId: template.id,
        beforeImageUri: null,
        afterImageUri: null,
        existingDraftId: currentProject.draftId || undefined,
        capturedImageUris: Object.keys(capturedImageUris).length > 0 ? capturedImageUris : undefined,
        renderedPreviewUrl: null, // No longer using API preview URL
        wasRenderedAsPremium: isPremium,
        backgroundOverrides: Object.keys(backgroundOverrides).length > 0 ? backgroundOverrides : null,
        capturedImageAdjustments: Object.keys(capturedImageAdjustments).length > 0 ? capturedImageAdjustments : null,
        themeColor: selectedThemeColor || null,
        capturedImageBackgroundInfo: Object.keys(capturedImageBackgroundInfo).length > 0 ? capturedImageBackgroundInfo : null,
      });

      console.log('[EditorV2] Draft saved:', savedDraft?.id);
      
      if (!savedDraft?.id) {
        console.error('[EditorV2] Draft save returned null');
        router.replace('/(tabs)/library');
        return;
      }

      // STEP 3: If we captured a preview, save it to the draft's local directory
      // NOTE: localPreviewPath is client-side only (not stored in DB), so we save locally
      // but don't need a second saveDraft() call - that was causing ~430ms unnecessary delay
      let finalPreviewPath: string | null = null;
      if (capturedPreviewPath) {
        console.log('[EditorV2] Step 3: Saving captured preview to draft renders directory:', savedDraft.id);
        await createDraftDirectories(savedDraft.id);
        const permanentPath = await saveLocalPreviewFile(savedDraft.id, capturedPreviewPath, 'default');
        if (permanentPath) {
          finalPreviewPath = permanentPath;
          console.log('[EditorV2] Preview with overlays saved to:', permanentPath);
          
          // Clear expo-image cache to ensure the drafts screen shows the fresh preview
          // This is necessary because the file path doesn't change, only the content
          try {
            await ExpoImage.clearMemoryCache();
            console.log('[EditorV2] Cleared expo-image memory cache');
          } catch (cacheError) {
            console.warn('[EditorV2] Failed to clear image cache:', cacheError);
          }
        }
      }

      // STEP 4: Save overlays to local storage
      try {
        console.log('[EditorV2] Saving overlays for draft:', savedDraft.id, 'count:', overlays.length);
        await saveOverlays(savedDraft.id, overlays);
        console.log(`[EditorV2] Successfully saved ${overlays.length} overlays with draft`);
      } catch (overlayError) {
        console.error('[EditorV2] Failed to save overlays:', overlayError);
        // Non-critical, continue navigation
      }
      
      // Update initial state refs after successful save
      const newInitialState: Record<string, string | null> = {};
      for (const [slotId, media] of Object.entries(capturedImages)) {
        newInitialState[slotId] = media?.uri || null;
      }
      initialCapturedImagesRef.current = newInitialState;
      initialOverlaysRef.current = [...overlays];
      
      // Ensure drafts list is refreshed with fresh data BEFORE navigation
      // This guarantees the timestamp will be up-to-date when the screen renders
      await refreshDrafts();
      console.log('[EditorV2] Projects refreshed before navigation');
      
      router.replace('/(tabs)/library');
    } catch (error) {
      console.error('[EditorV2] Failed to save draft:', error);
      Alert.alert('Error', 'Failed to save draft. Please try again.');
    }
  }, [template, capturedCount, capturedImages, slots, saveDraft, currentProject.draftId, isPremium, overlays, router, captureCanvasWithOverlays, refreshDrafts, backgroundOverrides, selectedThemeColor]);

  // Handle back/close with unsaved changes check
  // Navigation destination depends on context:
  // - If editing an existing draft (has draftId), go back to Projects tab
  // - If creating new from template (no draftId), go back to Create tab
  const handleClose = useCallback(() => {
    const isEditingExistingDraft = !!currentProject.draftId;
    
    const navigateBack = (discardingNewProject: boolean = false) => {
      // If discarding a NEW project (no draft ID yet), cleanup temp uploads
      // For existing drafts, images are already saved so no cleanup needed
      const wasSaved = isEditingExistingDraft || !discardingNewProject;
      resetProject(wasSaved);
      
      // Navigate to the appropriate tab based on context
      if (isEditingExistingDraft) {
        // Came from Projects tab (editing existing draft) - go back to Projects
        router.replace('/(tabs)/library');
      } else {
        // Came from Create tab (new template) - go back to Create
        router.replace('/(tabs)');
      }
    };

    if (hasUnsavedChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. What would you like to do?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => navigateBack(!isEditingExistingDraft), // Discard new project
          },
          {
            text: 'Save',
            onPress: handleSaveDraft,
          },
        ],
        { cancelable: true }
      );
    } else {
      // No changes, just leave (existing draft images stay, no new uploads to clean)
      navigateBack(false);
    }
  }, [hasUnsavedChanges, resetProject, router, handleSaveDraft, currentProject.draftId]);

  // Execute the actual download to gallery
  const executeDownload = useCallback(async () => {
    setIsDownloading(true);

    try {
      console.log('[EditorV2] Starting download using ViewShot capture...');
      
      // Capture exactly what's displayed on screen - the single source of truth
      // This includes: photos with adjustments, frame overlay, background color, overlays
      const capturedUri = await captureCanvasWithOverlays();
      
      if (!capturedUri) {
        throw new Error('Failed to capture canvas. Please try again.');
      }
      
      console.log('[EditorV2] Canvas captured, saving to gallery...');
      
      // Save the captured local image directly to gallery (no download needed)
      const downloadResult = await saveToGallery(capturedUri);
      
      if (downloadResult.success) {
        Alert.alert('Saved!', 'Image saved to your photo library.');
      } else {
        throw new Error(downloadResult.error || 'Download failed');
      }
    } catch (error) {
      console.error('[EditorV2] Download failed:', error);
      Alert.alert(
        'Download Failed',
        error instanceof Error ? error.message : 'Something went wrong'
      );
    } finally {
      setIsDownloading(false);
    }
  }, [captureCanvasWithOverlays]);

  // Handle download to gallery - checks subscription tier first
  const handleDownload = useCallback(async () => {
    // #region agent log
    console.log('🔴🔴🔴 [DEBUG-DOWNLOAD] ENTRY - canDownload:', canDownload, 'tier:', tier);
    // #endregion
    
    // Check if we have any photos to render
    const hasPhotos = Object.values(capturedImages).some(img => img !== null);
    if (!hasPhotos) {
      Alert.alert('No Photos', 'Please add at least one photo before downloading.');
      return;
    }

    // Track the download attempt
    captureEvent(POSTHOG_EVENTS.PREMIUM_FEATURE_ATTEMPTED, {
      feature: 'download_from_editor',
      current_tier: tier,
    });

    // #region agent log
    console.log('🔴🔴🔴 [DEBUG-DOWNLOAD] BEFORE CHECK - canDownload:', canDownload, 'tier:', tier, 'willAllow:', canDownload === true);
    // #endregion

    // If user has Pro or Studio tier, execute download immediately
    if (canDownload) {
      // #region agent log
      console.log('🔴🔴🔴 [DEBUG-DOWNLOAD] ALLOWING DOWNLOAD - canDownload is TRUE');
      // #endregion
      await executeDownload();
      return;
    }

    // User is Free tier - show Pro paywall with preview image
    console.log(`[EditorV2] User is ${tier} tier, showing Pro paywall for download`);
    
    // Capture preview for dynamic paywall content
    let cloudPreviewUrl = '';
    try {
      const capturedUri = await captureCanvasWithOverlays();
      if (capturedUri) {
        console.log('[EditorV2] Uploading preview for paywall...');
        cloudPreviewUrl = await uploadTempImage(capturedUri, 'paywall-preview');
        console.log('[EditorV2] Preview uploaded for paywall');
      }
    } catch (error) {
      console.warn('[EditorV2] Failed to upload preview for paywall:', error);
    }
    
    // Show paywall - DO NOT pass callback, we verify access explicitly after
    // #region agent log
    console.log('🔴🔴🔴 [DEBUG-DOWNLOAD] Calling requestProAccess (no callback)');
    // #endregion
    await requestProAccess(undefined, 'download_from_editor', cloudPreviewUrl);
    
    // CRITICAL: After paywall, we do NOT auto-execute download
    // User must tap download button again to verify they now have access
    // This prevents any Superwall callback bugs from granting unauthorized access
    // #region agent log
    console.log('🔴🔴🔴 [DEBUG-DOWNLOAD] Paywall flow complete - user must tap download again to verify access');
    // #endregion
  }, [capturedImages, canDownload, tier, captureCanvasWithOverlays, requestProAccess]);

  // Handle opening project actions bottom sheet
  const handleOpenProjectActions = useCallback(() => {
    projectActionsRef.current?.snapToIndex(0);
  }, []);

  // Handle closing project actions bottom sheet
  const handleCloseProjectActions = useCallback(() => {
    projectActionsRef.current?.close();
  }, []);

  // Handle rename action from action sheet
  const handleOpenRenameModal = useCallback(() => {
    handleCloseProjectActions();
    // Small delay to let the bottom sheet close first
    setTimeout(() => {
      setIsRenameModalVisible(true);
    }, 200);
  }, [handleCloseProjectActions]);

  const handleSaveRename = useCallback(async (newName: string | null) => {
    // If we have a draft ID, save to backend
    if (currentProject.draftId) {
      try {
        await renameDraft(currentProject.draftId, newName);
      } catch (error) {
        console.error('[EditorV2] Failed to rename project:', error);
        Alert.alert('Error', 'Failed to rename project. Please try again.');
        return;
      }
    }
    // Note: For new projects (no draftId), the name will be saved when the draft is first saved
    setIsRenameModalVisible(false);
  }, [currentProject.draftId, renameDraft]);

  const handleCancelRename = useCallback(() => {
    setIsRenameModalVisible(false);
  }, []);

  // Handle delete project from action sheet
  const handleDeleteProject = useCallback(() => {
    handleCloseProjectActions();
    
    Alert.alert(
      'Delete Project',
      'Are you sure you want to delete this project? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (currentProject.draftId) {
              try {
                await deleteDraft(currentProject.draftId);
              } catch (error) {
                console.error('[EditorV2] Failed to delete project:', error);
              }
            }
            // Navigate back to projects after delete
            // Draft was deleted, cleanup any temp uploads (wasSaved: false)
            resetProject(false);
            router.replace('/(tabs)/library');
          },
        },
      ]
    );
  }, [currentProject.draftId, resetProject, router, handleCloseProjectActions, deleteDraft]);

  // Handle navigating to home/projects
  const handleGoHome = useCallback(() => {
    const isEditingExistingDraft = !!currentProject.draftId;
    
    if (hasUnsavedChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. What would you like to do?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => {
              // If discarding a new project, cleanup temp uploads
              // For existing drafts, images are already saved
              resetProject(isEditingExistingDraft);
              router.replace('/(tabs)/library');
            },
          },
          {
            text: 'Save',
            onPress: handleSaveDraft,
          },
        ],
        { cancelable: true }
      );
    } else {
      // No changes, just leave (no new uploads to clean)
      resetProject(true);
      router.replace('/(tabs)/library');
    }
  }, [hasUnsavedChanges, resetProject, router, handleSaveDraft, currentProject.draftId]);

  // Cleanup effect - runs when editor unmounts
  // Cleans up temp files and memory cache to prevent accumulation
  useEffect(() => {
    return () => {
      console.log('[EditorV2] Cleanup on unmount');
      // Clean up any pending temp files from ViewShot captures and image processing
      cleanupTempFiles().catch(err => {
        console.warn('[EditorV2] Cleanup error:', err);
      });
      // Clear memory cache for images (disk cache persists for reuse)
      ExpoImage.clearMemoryCache().catch(() => {});
    };
  }, []);

  // Redirect if no template
  useEffect(() => {
    if (!template) {
      router.back();
    }
  }, [template, router]);

  if (!template) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <BottomSheetModalProvider>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header - Home left, Actions right (save, download, more) */}
        <View style={styles.header}>
          {/* Left - Home Button */}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleGoHome}
          >
            <Home size={24} color={Colors.light.text} />
          </TouchableOpacity>

          {/* Middle - Spacer (no project name) */}
          <View style={styles.headerSpacer} />

          {/* Right - Action Buttons */}
          <View style={styles.headerButtonsRight}>
            {/* Save Button (icon only) */}
            <TouchableOpacity
              style={[
                styles.headerIconButton,
                isSavingDraft && styles.headerActionButtonDisabled,
              ]}
              onPress={handleSaveDraft}
              disabled={isSavingDraft || capturedCount === 0}
            >
              {isSavingDraft ? (
                <ActivityIndicator size="small" color={Colors.light.accent} />
              ) : (
                <Save size={20} color={capturedCount > 0 ? Colors.light.accent : Colors.light.textTertiary} />
              )}
            </TouchableOpacity>

            {/* Download Button (icon only) - triggers on-demand API render */}
            <TouchableOpacity
              style={[
                styles.headerIconButton,
                styles.headerDownloadButton,
                (capturedCount === 0 || isDownloading) && styles.headerActionButtonDisabled,
              ]}
              onPress={handleDownload}
              disabled={capturedCount === 0 || isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color={Colors.light.surface} />
              ) : (
                <Download size={20} color={capturedCount > 0 ? Colors.light.surface : Colors.light.textTertiary} />
              )}
            </TouchableOpacity>

            {/* More Options Button (3 dots) */}
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={handleOpenProjectActions}
            >
              <MoreHorizontal size={20} color={Colors.light.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Canvas Area */}
        <Pressable 
          style={styles.canvasArea} 
          onPress={isCropMode ? undefined : handleCanvasTap}
          disabled={isCropMode}
        >
          {/* Canvas wrapper for positioning overlay layer */}
          <View style={styles.canvasWrapper}>
            {/* ViewShot wrapper for capturing canvas with overlays */}
            <ViewShot
              ref={viewShotRef}
              options={{
                format: 'jpg',
                quality: 0.95,
                result: 'tmpfile',
              }}
              style={[styles.viewShotWrapper, { width: canvasDimensions.width, height: canvasDimensions.height }]}
            >
              {/* TemplateCanvas handles rendering, slot targets, selection, manipulation, and crop mode */}
              <TemplateCanvas
                template={template}
                onSlotPress={isCropMode ? () => {} : handleSlotPress}
                renderedPreviewUri={null}
                isRendering={false}
                onPreviewLoad={handlePreviewImageLoad}
                selectedSlotId={isCropMode ? null : (selection.type === 'slot' ? selection.id : null)}
                manipulationMode={manipulationSlotData && !isCropMode ? {
                  slotId: selection.id!,
                  imageUri: manipulationSlotData.image.uri,
                  imageWidth: manipulationSlotData.image.width,
                  imageHeight: manipulationSlotData.image.height,
                  initialScale: manipulationSlotData.image.adjustments?.scale || 1,
                  initialTranslateX: manipulationSlotData.image.adjustments?.translateX || 0,
                  initialTranslateY: manipulationSlotData.image.adjustments?.translateY || 0,
                  rotation: manipulationSlotData.image.adjustments?.rotation || 0,
                  backgroundInfo: manipulationSlotData.image.backgroundInfo,
                  onAdjustmentChange: handleManipulationAdjustmentChange,
                  onTapOutsideSlot: handleCanvasTap,
                } : null}
                cropMode={isCropMode && cropSlotData ? {
                  slotId: cropSlotId!,
                  imageUri: cropSlotData.image.uri,
                  imageWidth: cropSlotData.image.width,
                  imageHeight: cropSlotData.image.height,
                  initialScale: cropSlotData.image.adjustments?.scale || 1,
                  initialTranslateX: cropSlotData.image.adjustments?.translateX || 0,
                  initialTranslateY: cropSlotData.image.adjustments?.translateY || 0,
                  initialRotation: cropSlotData.image.adjustments?.rotation || 0,
                  rotation: pendingRotation,
                  onAdjustmentChange: handleCropAdjustmentChange,
                } : null}
                backgroundColor={selectedBackgroundColor}
                themeColor={selectedThemeColor}
                capturedImages={capturedImages}
                useClientSideCompositing={!!template?.frameOverlayUrl}
              />
              
              {/* Overlay Layer - renders overlays on top of canvas (hidden during manipulation/crop) */}
              {!isCropMode && !manipulationSlotData && canvasDimensions.width > 0 && (
                <View style={[
                  styles.overlayContainer, 
                  { 
                    width: canvasDimensions.width, 
                    height: canvasDimensions.height 
                  }
                ]}>
                  <OverlayLayer
                    overlays={overlays}
                    selectedOverlayId={selectedOverlayId}
                    canvasWidth={canvasDimensions.width}
                    canvasHeight={canvasDimensions.height}
                    onSelectOverlay={handleSelectOverlay}
                    onUpdateOverlayTransform={handleUpdateOverlayTransform}
                    onDeleteOverlay={handleDeleteOverlay}
                    onDuplicateOverlay={handleDuplicateOverlayById}
                  />
                </View>
              )}
            </ViewShot>
          </View>
          
        </Pressable>

        {/* Bottom toolbar - changes based on mode */}
        {isCropMode ? (
          <CropToolbar
            onCancel={handleResizeCancel}
            onDone={handleResizeDone}
            rotation={pendingRotation}
            onRotationChange={handleRotationChange}
          />
        ) : hasSelection ? (
          <ElementContextBar
            elementType={contextBarElementType}
            visible={true}
            currentColor={currentOverlayColor}
            currentFontSize={currentOverlayFontSize}
            currentFont={currentOverlayFont}
            currentFormat={currentOverlayFormat}
            currentBackgroundColor={currentOverlayBackgroundColor}
            currentDate={currentOverlayDate}
            currentDateFormat={currentOverlayDateFormat}
            autoExpandOption={contextBarAutoExpandOption}
            onPhotoReplace={handlePhotoReplace}
            onPhotoAdjust={handlePhotoResize}
            onPhotoResize={handlePhotoResize}
            isPremium={isPremium}
            isAIProcessing={isAIProcessing}
            aiProcessingType={aiProcessingType}
            aiEnhancementsApplied={selectedSlotAIEnhancements}
            onAIFeatureSelect={handleAIFeatureSelect}
            onAlreadyAppliedTap={handleAlreadyAppliedTap}
            onRequestPremium={(feature) => requestPremiumAccess(feature)}
            onTextEdit={handleTextEditAction}
            onTextFont={handleInlineFontChange}
            onTextColor={handleInlineColorChange}
            onTextSize={handleInlineFontSizeChange}
            onTextFormat={handleInlineFormatChange}
            onTextBackground={handleInlineBackgroundChange}
            onDateChange={handleDateChange}
            onDateFormatChange={handleDateFormatChange}
            onLogoReplace={handleLogoReplaceAction}
            onLogoOpacity={handleLogoOpacityAction}
            onLogoSize={handleLogoSizeAction}
            canvasBackgroundColor={selectedBackgroundColor}
            onCanvasBackgroundColorChange={handleCanvasBackgroundColorChange}
            themeColor={selectedThemeColor}
            onThemeColorChange={handleThemeColorChange}
            onConfirm={handleContextBarConfirm}
          />
        ) : (
          <EditorMainToolbar
            activeTool={activeMainTool}
            onToolSelect={handleMainToolbarSelect}
            visible={true}
            expandedTool={expandedMainTool}
            onExpandedToolChange={setExpandedMainTool}
            backgroundColor={selectedBackgroundColor}
            onBackgroundColorChange={handleCanvasBackgroundColorChange}
            themeColor={selectedThemeColor}
            onThemeColorChange={handleThemeColorChange}
          />
        )}
      </SafeAreaView>

      {/* Text Edit Toolbar - appears above keyboard when editing text */}
      <TextEditToolbar
        initialContent={editingOverlayContent}
        currentColor={editingOverlayColor}
        currentFont={editingOverlayFont}
        currentFontSize={editingOverlayFontSize}
        currentFormat={editingOverlayFormat}
        onContentChange={handleTextContentChange}
        onColorChange={handleEditingColorChange}
        onFontChange={handleEditingFontChange}
        onFontSizeChange={handleEditingFontSizeChange}
        onFormatChange={handleEditingFormatChange}
        onDone={handleTextEditDone}
        visible={!!editingOverlayId}
      />

      {/* AI Studio Sheet - OPTIMIZED: Opens instantly, image prep deferred to enhance action */}
      <AIStudioSheet
        bottomSheetRef={aiStudioRef}
        slots={slots}
        capturedImages={capturedImages}
        selectedSlotId={selection.type === 'slot' ? selection.id : null}
        isPremium={isPremium}
        initialView={aiSheetInitialView}
        navTrigger={aiNavTrigger}
        onApply={(slotId, enhancedUri, featureKey, backgroundInfo) => {
          // #region agent log
          fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-v2.tsx:onApply',message:'AI onApply called',data:{slotId,featureKey,hasBackgroundInfo:!!backgroundInfo,backgroundInfoType:backgroundInfo?.type,solidColor:backgroundInfo?.solidColor},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          // Update the captured image with the enhanced version
          // Reset adjustments to default - enhanced image replaces at full size
          const existingImage = capturedImages[slotId];
          if (existingImage) {
            // Track which AI enhancements have been applied to prevent duplicate processing
            const existingEnhancements = existingImage.aiEnhancementsApplied ?? [];
            const updatedEnhancements = existingEnhancements.includes(featureKey)
              ? existingEnhancements
              : [...existingEnhancements, featureKey];
            
            // For background replacement, the enhancedUri IS the transparent PNG
            // Cache it so color changes don't require re-running birefnet
            const transparentPngUrl = (featureKey === 'background_replace' && backgroundInfo)
              ? enhancedUri
              : existingImage.transparentPngUrl;
            
            setCapturedImage(slotId, {
              ...existingImage,
              uri: enhancedUri,
              adjustments: { scale: 1, translateX: 0, translateY: 0, rotation: 0 },
              aiEnhancementsApplied: updatedEnhancements,
              originalUri: existingImage.originalUri ?? existingImage.uri,
              // Store background info for transparent PNG display
              backgroundInfo: backgroundInfo,
              // Cache transparent PNG URL for color changes
              transparentPngUrl: transparentPngUrl,
            });
          }
          // Clear pending manipulation if we modified the currently selected slot
          if (selection.id === slotId) {
            setPendingManipulationAdjustments(null);
          }
          setAiSheetInitialView('home');
          aiStudioRef.current?.dismiss();
        }}
        onSkip={() => {
          setAiSheetInitialView('home');
          aiStudioRef.current?.dismiss();
        }}
        onAddImage={() => {
          aiStudioRef.current?.dismiss();
          const firstEmptySlot = slots.find(slot => !capturedImages[slot.layerId]?.uri);
          if (firstEmptySlot) {
            router.push(`/capture/${firstEmptySlot.layerId}`);
          }
        }}
      />

      {/* Text Style Panel - compact panel for text/date overlays */}
      <TextStylePanel
        ref={textStylePanelRef}
        overlay={selectedOverlay}
        onUpdateOverlay={handleUpdateOverlayProperties}
        onDeleteOverlay={handleDeleteSelectedOverlay}
        onClose={handleTextStylePanelClose}
      />

      {/* Logo Panel - compact panel for logo overlays */}
      <LogoPanel
        ref={logoPanelRef}
        selectedLogo={selectedOverlay && isLogoOverlay(selectedOverlay) ? selectedOverlay : null}
        currentScale={selectedOverlay?.transform.scale ?? 1}
        currentOpacity={selectedOverlay && isLogoOverlay(selectedOverlay) ? (selectedOverlay as LogoOverlay).opacity ?? 1 : 1}
        onSelectLogo={handleLogoPanelSelect}
        onScaleChange={handleScaleSliderChange}
        onOpacityChange={handleLogoOpacityChange}
        onDeleteLogo={handleDeleteSelectedOverlay}
        onClose={handleLogoPanelClose}
      />

      {/* Rename Project Modal */}
      <RenameProjectModal
        visible={isRenameModalVisible}
        currentName={currentProject.projectName || null}
        onSave={handleSaveRename}
        onCancel={handleCancelRename}
        isLoading={isRenamingDraft}
      />

      {/* Project Actions Bottom Sheet */}
      <BottomSheet
        ref={projectActionsRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
            opacity={0.5}
            pressBehavior="close"
          />
        )}
        handleIndicatorStyle={styles.bottomSheetIndicator}
      >
        <BottomSheetView style={[styles.bottomSheetContent, { paddingBottom: insets.bottom + 12 }]}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{projectDisplayName}</Text>
            <TouchableOpacity
              style={styles.sheetCloseButton}
              onPress={handleCloseProjectActions}
              activeOpacity={0.7}
            >
              <X size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.sheetDivider} />

          {/* Actions */}
          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleOpenRenameModal}
              activeOpacity={0.7}
            >
              <Pencil size={22} color={Colors.light.text} />
              <Text style={styles.actionText}>Rename</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleDeleteProject}
              activeOpacity={0.7}
            >
              <Trash2 size={22} color={Colors.light.error} />
              <Text style={[styles.actionText, styles.actionTextDestructive]}>
                Delete Project
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>

      {/* AI Processing Overlay */}
      {isAIProcessing && aiProgress && !aiSuccessResult && !aiError && (
        <AIProcessingOverlay
          progress={aiProgress.progress || 0}
          message={aiProgress.message}
          featureKey={aiProcessingType || 'auto_quality'}
          onCancel={handleAICancel}
        />
      )}

      {/* AI Success Overlay */}
      {aiSuccessResult && (
        <AISuccessOverlay
          originalUri={aiSuccessResult.originalUri}
          enhancedUri={aiSuccessResult.enhancedUri}
          onKeepEnhanced={handleAISuccessDismiss}
          onRevert={() => {
            // Revert to original image
            if (selection.id && capturedImages[selection.id]) {
              setCapturedImage(selection.id, {
                ...capturedImages[selection.id],
                uri: aiSuccessResult.originalUri,
              });
            }
            handleAISuccessDismiss();
          }}
        />
      )}

      {/* AI Error View */}
      {aiError && (
        <View style={styles.aiErrorOverlay}>
          <AIErrorView
            error={aiError}
            onRetry={handleAIRetry}
            onDismiss={handleAIErrorDismiss}
          />
        </View>
      )}

      {/* AI Already Applied Toast - shows when user taps disabled AI feature */}
      <AIAlreadyAppliedToast
        visible={aiAppliedToastVisible}
        featureKey={aiAppliedToastFeature}
        onDismiss={handleDismissAppliedToast}
      />
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    flex: 1,
  },
  headerButtonsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  headerActionButtonDisabled: {
    opacity: 0.5,
  },
  headerDownloadButton: {
    backgroundColor: Colors.light.accent,
  },
  canvasArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  canvasWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  viewShotWrapper: {
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
  errorBanner: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgb(255, 59, 48)',
  },
  retryButton: {
    backgroundColor: 'rgb(255, 59, 48)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Bottom Sheet Styles
  bottomSheetIndicator: {
    backgroundColor: Colors.light.border,
    width: 36,
  },
  bottomSheetContent: {
    paddingHorizontal: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
  },
  sheetCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  sheetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  sheetActions: {
    paddingTop: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  actionText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  actionTextDestructive: {
    color: Colors.light.error,
  },
  // AI Error Overlay
  aiErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    zIndex: 1000,
  },
});
