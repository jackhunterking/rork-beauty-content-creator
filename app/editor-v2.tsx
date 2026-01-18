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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet from '@gorhom/bottom-sheet';
import { X, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { usePremiumStatus, usePremiumFeature } from '@/hooks/usePremiumStatus';
import { TemplateCanvas } from '@/components/TemplateCanvas';
import { extractSlots, getSlotById, allSlotsCaptured, hasValidCapturedImage, scaleSlots } from '@/utils/slotParser';
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
  Overlay,
} from '@/types/overlays';

export default function EditorV2Screen() {
  const router = useRouter();
  const { currentProject, setCapturedImage, resetProject } = useApp();
  const { isPremium } = usePremiumStatus();
  const { requestPremiumAccess } = usePremiumFeature();
  
  const template = currentProject.template;
  const capturedImages = currentProject.capturedImages;

  // Bottom sheet refs
  const aiPanelRef = useRef<BottomSheet>(null);

  // Preview rendering state (like old editor)
  const [renderedPreviewUri, setRenderedPreviewUri] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Editor state
  const [activeTool, setActiveTool] = useState<ToolType>('photo');
  const [selection, setSelection] = useState<SelectionState>(DEFAULT_SELECTION);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiProcessingType, setAIProcessingType] = useState<AIEnhancementType | null>(null);

  // Crop/Resize mode state
  const [isCropMode, setIsCropMode] = useState(false);
  const [cropSlotId, setCropSlotId] = useState<string | null>(null);
  const [pendingRotation, setPendingRotation] = useState(0);
  const [pendingCropAdjustments, setPendingCropAdjustments] = useState<{
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

  // Check if all slots have images
  const allSlotsFilled = useMemo(() => {
    return allSlotsCaptured(slots, capturedImages);
  }, [slots, capturedImages]);

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
    
    for (const slotId of Object.keys(currentImages)) {
      const current = currentImages[slotId];
      const prev = prevImages[slotId];
      const currentUri = current?.uri;
      const prevUri = prev?.uri;
      
      // Check if URI changed (new image)
      if (currentUri && currentUri !== prevUri) {
        hasNewOrChangedImage = true;
        break;
      }
      
      // Check if adjustments changed (resize/rotate)
      if (currentUri && current?.adjustments) {
        const currentAdj = serializeAdjustments(current.adjustments);
        const prevAdj = serializeAdjustments(prev?.adjustments);
        if (currentAdj !== prevAdj) {
          hasNewOrChangedImage = true;
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
    } else if (tool === 'date') {
      // Add date overlay (free for all users)
      const newOverlay = createDateOverlay();
      setOverlays(prev => [...prev, newOverlay]);
    } else if (tool === 'logo') {
      // TODO: Open logo picker (free for all users)
      Alert.alert('Logo', 'Logo picker coming soon');
    }

    setActiveTool(tool);
  }, []);

  // Handle slot press (from TemplateCanvas)
  const handleSlotPress = useCallback((slotId: string) => {
    // Always deselect overlay when interacting with slots
    if (selection.id) {
      setSelection(DEFAULT_SELECTION);
    }

    const hasImage = hasValidCapturedImage(slotId, capturedImages);
    
    if (!hasImage) {
      // Empty slot - navigate to fullscreen capture screen
      router.push(`/capture/${slotId}`);
    } else {
      // Has image - select it for contextual actions
      setSelection({
        type: 'slot',
        id: slotId,
        isTransforming: false,
      });
    }
  }, [capturedImages, selection.id, router]);

  // Handle canvas tap (deselect)
  const handleCanvasTap = useCallback(() => {
    if (selection.id) {
      setSelection(DEFAULT_SELECTION);
    }
  }, [selection]);


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

  // Canva-style contextual toolbar actions
  const handlePhotoReplace = useCallback(() => {
    if (selection.id) {
      // Navigate to fullscreen capture screen to replace the image
      router.push(`/capture/${selection.id}`);
    }
  }, [selection, router]);

  const handlePhotoResize = useCallback(() => {
    if (selection.id && capturedImages[selection.id]) {
      // Enter inline resize mode
      const image = capturedImages[selection.id];
      setCropSlotId(selection.id);
      setIsCropMode(true);
      // Initialize rotation from existing adjustments
      setPendingRotation(image.adjustments?.rotation || 0);
      // Clear selection while in resize mode
      setSelection(DEFAULT_SELECTION);
    }
  }, [selection, capturedImages]);

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
    // Trigger re-render after resize
    triggerPreviewRender();
  }, [cropSlotId, pendingCropAdjustments, pendingRotation, capturedImages, setCapturedImage, triggerPreviewRender]);

  // Handle adjustment changes from CropOverlay
  const handleCropAdjustmentChange = useCallback((adjustments: {
    scale: number;
    translateX: number;
    translateY: number;
    rotation: number;
  }) => {
    setPendingCropAdjustments(adjustments);
  }, []);

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

  // Handle back/close
  const handleClose = useCallback(() => {
    Alert.alert(
      'Leave Editor?',
      'Your changes will not be saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            resetProject();
            router.back();
          },
        },
      ]
    );
  }, [resetProject, router]);

  // Handle done/proceed
  const handleDone = useCallback(() => {
    if (!allSlotsFilled) {
      Alert.alert('Incomplete', 'Please fill all photo slots before proceeding.');
      return;
    }

    if (!renderedPreviewUri) {
      Alert.alert('Processing', 'Please wait for the preview to finish rendering.');
      return;
    }

    // TODO: Navigate to export/publish
    Alert.alert('Success', 'Ready to export! (Coming soon)');
  }, [allSlotsFilled, renderedPreviewUri]);

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
        {/* Minimal Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleClose}
          >
            <X size={24} color={Colors.light.text} />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            {template.name}
          </Text>

          <TouchableOpacity
            style={[
              styles.headerButton,
              styles.headerButtonDone,
              !allSlotsFilled && styles.headerButtonDisabled,
            ]}
            onPress={handleDone}
            disabled={!allSlotsFilled}
          >
            <Check size={24} color={allSlotsFilled ? Colors.light.surface : Colors.light.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Canvas Area */}
        <Pressable 
          style={styles.canvasArea} 
          onPress={isCropMode ? undefined : handleCanvasTap}
          disabled={isCropMode}
        >
          {/* TemplateCanvas handles rendering, slot targets, selection, and crop mode */}
          <TemplateCanvas
            template={template}
            onSlotPress={isCropMode ? () => {} : handleSlotPress}
            renderedPreviewUri={renderedPreviewUri}
            isRendering={isRendering}
            onPreviewError={handlePreviewError}
            selectedSlotId={isCropMode ? null : (selection.type === 'slot' ? selection.id : null)}
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
            onDeselect={() => setSelection(DEFAULT_SELECTION)}
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
  headerButtonDone: {
    backgroundColor: Colors.light.accent,
  },
  headerButtonDisabled: {
    backgroundColor: Colors.light.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  canvasArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
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
