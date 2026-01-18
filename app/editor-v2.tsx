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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet from '@gorhom/bottom-sheet';
import ViewShot from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';
import { X, Save, Download } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { downloadAndSaveToGallery } from '@/services/downloadService';
import { usePremiumStatus, usePremiumFeature } from '@/hooks/usePremiumStatus';
import { TemplateCanvas } from '@/components/TemplateCanvas';
import { extractSlots, getSlotById, hasValidCapturedImage, scaleSlots, getCapturedSlotCount } from '@/utils/slotParser';
import { applyAdjustmentsAndCrop } from '@/utils/imageProcessing';
import { renderPreview } from '@/services/renderService';
import {
  ToolDock,
  ContextualToolbar,
  AIEnhancePanel,
  CropToolbar,
} from '@/components/editor-v2';
import {
  ToolType,
  SelectionState,
  DEFAULT_SELECTION,
  AIEnhancementType,
} from '@/components/editor-v2/types';
import {
  createTextOverlay,
  createDateOverlay,
  createLogoOverlay,
  Overlay,
  OverlayTransform,
  TextOverlay,
  DateOverlay,
  LogoOverlay,
  isTextBasedOverlay,
  isLogoOverlay,
  LOGO_SIZE_CONSTRAINTS,
} from '@/types/overlays';
import {
  OverlayLayer,
  OverlayStyleSheet,
  LogoPickerModal,
  LogoActionSheet,
} from '@/components/overlays';
import { saveOverlays, loadOverlays } from '@/services/overlayPersistenceService';
import { saveLocalPreviewFile, createDraftDirectories } from '@/services/localStorageService';

export default function EditorV2Screen() {
  const router = useRouter();
  const { currentProject, setCapturedImage, resetProject, saveDraft, isSavingDraft, refreshDrafts } = useApp();
  const { isPremium } = usePremiumStatus();
  const { requestPremiumAccess } = usePremiumFeature();
  
  const template = currentProject.template;
  const capturedImages = currentProject.capturedImages;

  // Bottom sheet refs
  const aiPanelRef = useRef<BottomSheet>(null);
  const styleSheetRef = useRef<BottomSheet>(null);
  const logoPickerRef = useRef<BottomSheet>(null);
  const logoActionSheetRef = useRef<BottomSheet>(null);

  // ViewShot ref for capturing canvas with overlays
  const viewShotRef = useRef<ViewShot>(null);
  
  // Track when preview image is loaded (for ViewShot capture)
  const isPreviewImageLoadedRef = useRef(false);
  const [isPreviewImageLoaded, setIsPreviewImageLoaded] = useState(false);

  // Preview rendering state (like old editor)
  const [renderedPreviewUri, setRenderedPreviewUri] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Editor state
  const [activeTool, setActiveTool] = useState<ToolType>('photo');
  const [selection, setSelection] = useState<SelectionState>(DEFAULT_SELECTION);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiProcessingType, setAIProcessingType] = useState<AIEnhancementType | null>(null);

  // Download state
  const [isDownloading, setIsDownloading] = useState(false);

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

  // Trigger preview render when photos change (like old editor)
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
          photosToRender[slotId] = media.uri;
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
            console.warn(`[EditorV2] Failed to apply adjustments for ${slotId}, using original:`, adjustError);
            photosToRender[slotId] = media.uri;
          }
        } else {
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
        console.warn('[EditorV2] Preview render failed:', result.error);
        setPreviewError(result.error || 'Could not generate preview');
      }
    } catch (error) {
      console.error('[EditorV2] Preview render error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      setPreviewError(errorMessage);
    } finally {
      setIsRendering(false);
    }
  }, [template?.templatedId, capturedImages, slots]);

  // Helper to serialize adjustments for comparison
  const serializeAdjustments = useCallback((adj: any) => {
    if (!adj) return '';
    return `${adj.translateX || 0}_${adj.translateY || 0}_${adj.scale || 1}_${adj.rotation || 0}`;
  }, []);

  // Reactive preview rendering when images or adjustments change
  useEffect(() => {
    if (!template?.templatedId) return;
    
    const prevImages = prevCapturedImagesRef.current;
    const currentImages = capturedImages;
    
    let hasNewOrChangedImage = false;
    let changeReason = '';
    
    for (const slotId of Object.keys(currentImages)) {
      const current = currentImages[slotId];
      const prev = prevImages[slotId];
      const currentUri = current?.uri;
      const prevUri = prev?.uri;
      
      // Check if URI changed (new image)
      if (currentUri && currentUri !== prevUri) {
        hasNewOrChangedImage = true;
        changeReason = `URI changed for ${slotId}`;
        break;
      }
      
      // Check if adjustments changed (resize/rotate)
      if (currentUri && current?.adjustments) {
        const currentAdj = serializeAdjustments(current.adjustments);
        const prevAdj = serializeAdjustments(prev?.adjustments);
        if (currentAdj !== prevAdj) {
          hasNewOrChangedImage = true;
          changeReason = `Adjustments changed for ${slotId}: prev=${prevAdj} curr=${currentAdj}`;
          break;
        }
      }
    }
    
    // Update ref with both URI and adjustments
    const newPrevImages: Record<string, { uri: string; adjustments?: any } | null> = {};
    for (const [slotId, media] of Object.entries(currentImages)) {
      newPrevImages[slotId] = media ? { uri: media.uri, adjustments: media.adjustments } : null;
    }
    prevCapturedImagesRef.current = newPrevImages;
    
    if (hasNewOrChangedImage) {
      console.log('[EditorV2] Image or adjustment change detected, triggering preview render');
      triggerPreviewRender();
    }
  }, [capturedImages, template?.templatedId, triggerPreviewRender, serializeAdjustments]);

  // Handle preview error (trigger re-render)
  const handlePreviewError = useCallback(() => {
    console.log('[EditorV2] Preview failed to load, triggering re-render');
    setRenderedPreviewUri(null);
    setPreviewError('Preview expired');
    triggerPreviewRender();
  }, [triggerPreviewRender]);

  // Reset preview loaded state when rendered preview URI changes
  useEffect(() => {
    if (renderedPreviewUri) {
      // Reset loaded state when a new preview URL is set
      isPreviewImageLoadedRef.current = false;
      setIsPreviewImageLoaded(false);
    }
  }, [renderedPreviewUri]);

  // Handler for when preview image loads
  const handlePreviewImageLoad = useCallback(() => {
    console.log('[EditorV2] Preview image loaded');
    isPreviewImageLoadedRef.current = true;
    setIsPreviewImageLoaded(true);
  }, []);

  // Handle tool selection
  const handleToolSelect = useCallback((tool: ToolType) => {
    // Deselect current selection when changing tools
    setSelection(DEFAULT_SELECTION);

    if (tool === 'enhance') {
      // Open AI panel (AI features remain premium-gated)
      aiPanelRef.current?.snapToIndex(0);
    } else if (tool === 'text') {
      // Add text overlay (free for all users)
      const newOverlay = createTextOverlay();
      setOverlays(prev => [...prev, newOverlay]);
      setSelectedOverlayId(newOverlay.id);
      // Open style sheet for text customization
      setTimeout(() => {
        styleSheetRef.current?.snapToIndex(0);
      }, 100);
    } else if (tool === 'date') {
      // Add date overlay (free for all users)
      const newOverlay = createDateOverlay();
      setOverlays(prev => [...prev, newOverlay]);
      setSelectedOverlayId(newOverlay.id);
      // Open style sheet for date customization
      setTimeout(() => {
        styleSheetRef.current?.snapToIndex(0);
      }, 100);
    } else if (tool === 'logo') {
      // Open logo picker modal (free for all users)
      logoPickerRef.current?.snapToIndex(0);
    }

    setActiveTool(tool);
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
      styleSheetRef.current?.close();
      logoActionSheetRef.current?.close();
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
      styleSheetRef.current?.close();
      logoActionSheetRef.current?.close();
    }
  }, [selection, selectedOverlayId, pendingManipulationAdjustments, saveManipulationAdjustments]);


  // Handle AI enhancement selection
  const handleAIEnhancement = useCallback((type: AIEnhancementType) => {
    if (!selection.id || selection.type !== 'slot') {
      Alert.alert('Select a photo', 'Please select a photo first to apply AI enhancements.');
      return;
    }

    // TODO: Implement actual AI enhancement
    setIsAIProcessing(true);
    setAIProcessingType(type);

    // Simulate processing
    setTimeout(() => {
      setIsAIProcessing(false);
      setAIProcessingType(null);
      Alert.alert('Coming Soon', `${type} enhancement will be available soon!`);
    }, 1500);
  }, [selection]);

  // Handle AI panel close
  const handleAIPanelClose = useCallback(() => {
    aiPanelRef.current?.close();
  }, []);

  // ============================================
  // Overlay Handlers
  // ============================================

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

  // Select an overlay
  const handleSelectOverlay = useCallback((id: string | null) => {
    console.log('[EditorV2] handleSelectOverlay:', id);
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
    console.log('[EditorV2] Deleted overlay:', id);
  }, [selectedOverlayId]);

  // Delete selected overlay (from style sheet)
  const handleDeleteSelectedOverlay = useCallback(() => {
    if (selectedOverlayId) {
      handleDeleteOverlay(selectedOverlayId);
    }
  }, [selectedOverlayId, handleDeleteOverlay]);

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
    // Open logo action sheet for the newly added logo
    setTimeout(() => {
      logoActionSheetRef.current?.snapToIndex(0);
    }, 100);
    
    console.log('[EditorV2] Added logo overlay from picker:', newOverlay.id);
  }, []);

  // Handle scale change from ScaleSlider / LogoActionSheet
  const handleScaleSliderChange = useCallback((newScale: number) => {
    if (!selectedOverlayId || !selectedOverlay) return;
    
    const updatedTransform: OverlayTransform = {
      ...selectedOverlay.transform,
      scale: newScale,
    };
    
    handleUpdateOverlayTransform(selectedOverlayId, updatedTransform);
  }, [selectedOverlayId, selectedOverlay, handleUpdateOverlayTransform]);

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
    // NOTE: Don't call triggerPreviewRender() here!
    // The useEffect watching capturedImages will automatically trigger it
    // after React processes the state update. Calling it here would use
    // stale closure values (the old adjustments before setCapturedImage).
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

  const handlePhotoAI = useCallback(() => {
    aiPanelRef.current?.snapToIndex(0);
  }, []);

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

  // Capture the canvas with overlays using ViewShot
  // Returns the captured file path (in cache directory)
  const captureCanvasWithOverlays = useCallback(async (): Promise<string | null> => {
    if (!viewShotRef.current) {
      console.warn('[EditorV2] ViewShot ref not available');
      return null;
    }
    
    if (!renderedPreviewUri) {
      console.warn('[EditorV2] No rendered preview available to capture');
      return null;
    }
    
    try {
      // Deselect any selected overlay before capture to hide selection UI
      const wasSelected = selectedOverlayId;
      if (wasSelected) {
        setSelectedOverlayId(null);
      }
      
      console.log('[EditorV2] Preparing to capture canvas with overlays...');
      
      // Wait for the preview image to be loaded
      if (!isPreviewImageLoadedRef.current) {
        console.log('[EditorV2] Waiting for preview image to load...');
        const maxWaitTime = 3000;
        const checkInterval = 100;
        let waitedTime = 0;
        
        while (!isPreviewImageLoadedRef.current && waitedTime < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          waitedTime += checkInterval;
        }
        
        if (!isPreviewImageLoadedRef.current) {
          console.warn('[EditorV2] Preview image did not load within timeout');
        }
      }
      
      // Wait for React to re-render without selection UI
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('[EditorV2] Capturing canvas now...');
      
      const uri = await viewShotRef.current.capture();
      
      if (!uri) {
        console.warn('[EditorV2] ViewShot capture returned null');
        return null;
      }
      
      // Save to cache directory temporarily
      const filename = `canvas_overlay_${Date.now()}.jpg`;
      const destUri = `${FileSystem.cacheDirectory}${filename}`;
      
      await FileSystem.copyAsync({ from: uri, to: destUri });
      
      console.log('[EditorV2] Captured canvas with overlays to cache:', destUri);
      return destUri;
    } catch (error) {
      console.error('[EditorV2] Failed to capture canvas:', error);
      return null;
    }
  }, [renderedPreviewUri, selectedOverlayId]);

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

      // STEP 1: Capture the canvas with overlays FIRST (before any state changes)
      let capturedPreviewPath: string | null = null;
      if (overlays.length > 0 && renderedPreviewUri) {
        console.log('[EditorV2] Step 1: Capturing canvas with overlays BEFORE save...');
        capturedPreviewPath = await captureCanvasWithOverlays();
        if (capturedPreviewPath) {
          console.log('[EditorV2] Preview captured to temp location:', capturedPreviewPath);
        } else {
          console.warn('[EditorV2] Failed to capture preview with overlays');
        }
      }

      // STEP 2: Save the draft to get/confirm the draft ID
      const savedDraft = await saveDraft({
        templateId: template.id,
        beforeImageUri: null,
        afterImageUri: null,
        existingDraftId: currentProject.draftId || undefined,
        capturedImageUris: Object.keys(capturedImageUris).length > 0 ? capturedImageUris : undefined,
        renderedPreviewUrl: renderedPreviewUri,
        wasRenderedAsPremium: isPremium,
      });

      console.log('[EditorV2] Draft saved:', savedDraft?.id);
      
      if (!savedDraft?.id) {
        console.error('[EditorV2] Draft save returned null');
        router.replace('/(tabs)/library');
        return;
      }

      // STEP 3: If we captured a preview with overlays, save it to the draft's local directory
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
          
          // Update the draft with the local preview path
          await saveDraft({
            templateId: template.id,
            beforeImageUri: null,
            afterImageUri: null,
            existingDraftId: savedDraft.id,
            capturedImageUris: Object.keys(capturedImageUris).length > 0 ? capturedImageUris : undefined,
            renderedPreviewUrl: renderedPreviewUri,
            wasRenderedAsPremium: isPremium,
            localPreviewPath: permanentPath,
          });
          console.log('[EditorV2] Draft updated with local preview path');
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
  }, [template, capturedCount, capturedImages, slots, saveDraft, currentProject.draftId, renderedPreviewUri, isPremium, overlays, router, captureCanvasWithOverlays, refreshDrafts]);

  // Handle back/close with unsaved changes check
  // Navigation destination depends on context:
  // - If editing an existing draft (has draftId), go back to Projects tab
  // - If creating new from template (no draftId), go back to Create tab
  const handleClose = useCallback(() => {
    const isEditingExistingDraft = !!currentProject.draftId;
    const navigateBack = () => {
      resetProject();
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
            onPress: navigateBack,
          },
          {
            text: 'Save',
            onPress: handleSaveDraft,
          },
        ],
        { cancelable: true }
      );
    } else {
      // No changes, just leave
      navigateBack();
    }
  }, [hasUnsavedChanges, resetProject, router, handleSaveDraft, currentProject.draftId]);

  // Handle download to gallery
  const handleDownload = useCallback(async () => {
    if (!renderedPreviewUri) {
      Alert.alert('Not Ready', 'Please wait for the preview to finish rendering.');
      return;
    }

    setIsDownloading(true);

    try {
      const result = await downloadAndSaveToGallery(renderedPreviewUri);
      
      if (result.success) {
        Alert.alert('Saved!', 'Image saved to your photo library.');
      } else {
        throw new Error(result.error || 'Download failed');
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
  }, [renderedPreviewUri]);

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
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header - Close left, Save + Download right */}
        <View style={styles.header}>
          {/* Left - Close Button */}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleClose}
          >
            <X size={24} color={Colors.light.text} />
          </TouchableOpacity>

          {/* Middle - Empty spacer */}
          <View style={styles.headerSpacer} />

          {/* Right - Action Buttons */}
          <View style={styles.headerButtonsRight}>
            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.headerActionButton,
                isSavingDraft && styles.headerActionButtonDisabled,
              ]}
              onPress={handleSaveDraft}
              disabled={isSavingDraft || capturedCount === 0}
            >
              {isSavingDraft ? (
                <ActivityIndicator size="small" color={Colors.light.accent} />
              ) : (
                <>
                  <Save size={18} color={capturedCount > 0 ? Colors.light.accent : Colors.light.textTertiary} />
                  <Text style={[
                    styles.headerActionButtonText,
                    capturedCount === 0 && styles.headerActionButtonTextDisabled,
                  ]}>
                    Save
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Download Button */}
            <TouchableOpacity
              style={[
                styles.headerActionButton,
                styles.headerDownloadButton,
                (!renderedPreviewUri || isRendering || isDownloading) && styles.headerActionButtonDisabled,
              ]}
              onPress={handleDownload}
              disabled={!renderedPreviewUri || isRendering || isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color={Colors.light.surface} />
              ) : (
                <>
                  <Download size={18} color={renderedPreviewUri && !isRendering ? Colors.light.surface : Colors.light.textTertiary} />
                  <Text style={[
                    styles.headerDownloadButtonText,
                    (!renderedPreviewUri || isRendering) && styles.headerActionButtonTextDisabled,
                  ]}>
                    Download
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Canvas Area */}
        <Pressable 
          style={styles.canvasArea} 
          onPress={(isCropMode || manipulationSlotData) ? undefined : handleCanvasTap}
          disabled={isCropMode || !!manipulationSlotData}
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
                renderedPreviewUri={renderedPreviewUri}
                isRendering={isRendering}
                onPreviewError={handlePreviewError}
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
                  onAdjustmentChange: handleManipulationAdjustmentChange,
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
                  />
                </View>
              )}
            </ViewShot>
          </View>
          
          {/* Preview error indicator */}
          {previewError && !isRendering && !isCropMode && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>Preview failed to load</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={triggerPreviewRender}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>

        {/* Bottom toolbar - changes based on mode */}
        {isCropMode ? (
          <CropToolbar
            onCancel={handleResizeCancel}
            onDone={handleResizeDone}
            rotation={pendingRotation}
            onRotationChange={handleRotationChange}
          />
        ) : selection.id ? (
          <ContextualToolbar
            selectionType={selection.type}
            visible={true}
            onPhotoReplace={handlePhotoReplace}
            onPhotoResize={handlePhotoResize}
            onPhotoAI={handlePhotoAI}
            onPhotoDelete={handlePhotoDelete}
            onDeselect={() => {
              // Save any pending manipulation adjustments before deselecting
              if (pendingManipulationAdjustments) {
                saveManipulationAdjustments();
              }
              setSelection(DEFAULT_SELECTION);
              setPendingManipulationAdjustments(null);
            }}
          />
        ) : (
          <ToolDock
            activeTool={activeTool}
            onToolSelect={handleToolSelect}
          />
        )}
      </SafeAreaView>

      {/* AI Enhancement Panel */}
      <AIEnhancePanel
        bottomSheetRef={aiPanelRef}
        isPremium={isPremium}
        selectedSlotId={selection.type === 'slot' ? selection.id : null}
        isProcessing={isAIProcessing}
        processingType={aiProcessingType}
        onSelectEnhancement={handleAIEnhancement}
        onRequestPremium={(feature) => requestPremiumAccess(feature)}
        onClose={handleAIPanelClose}
      />

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
  headerActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  headerActionButtonDisabled: {
    opacity: 0.5,
  },
  headerActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.accent,
  },
  headerActionButtonTextDisabled: {
    color: Colors.light.textTertiary,
  },
  headerDownloadButton: {
    backgroundColor: Colors.light.accent,
  },
  headerDownloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.surface,
  },
  canvasArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
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
});
