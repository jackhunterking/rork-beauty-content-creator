/**
 * Editor V2 - Professional Canvas Editor
 * 
 * Instagram/Photoshop-inspired canvas editor with:
 * - Direct manipulation (tap to select, pinch/pan to transform)
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
  useWindowDimensions,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { X, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { usePremiumStatus, usePremiumFeature } from '@/hooks/usePremiumStatus';
import { extractSlots, scaleSlots } from '@/utils/slotParser';
import { processImageForAdjustment, DEFAULT_ADJUSTMENTS } from '@/utils/imageProcessing';
import {
  ToolDock,
  ContextualToolbar,
  AIEnhancePanel,
  CameraSheet,
  EditableSlot,
} from '@/components/editor-v2';
import {
  ToolType,
  SelectionState,
  TransformState,
  SlotWithTransform,
  DEFAULT_SELECTION,
  DEFAULT_TRANSFORM,
  AIEnhancementType,
} from '@/components/editor-v2/types';
import {
  createTextOverlay,
  createDateOverlay,
  Overlay,
} from '@/types/overlays';

const CANVAS_PADDING = 16;

export default function EditorV2Screen() {
  const router = useRouter();
  const { currentProject, setCapturedImage, resetProject } = useApp();
  const { isPremium } = usePremiumStatus();
  const { requestPremiumAccess } = usePremiumFeature();
  
  const template = currentProject.template;
  const capturedImages = currentProject.capturedImages;

  // Window dimensions for canvas sizing
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Bottom sheet refs
  const cameraSheetRef = useRef<BottomSheet>(null);
  const aiPanelRef = useRef<BottomSheet>(null);

  // Editor state
  const [activeTool, setActiveTool] = useState<ToolType>('photo');
  const [selection, setSelection] = useState<SelectionState>(DEFAULT_SELECTION);
  const [slotTransforms, setSlotTransforms] = useState<Record<string, TransformState>>({});
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [capturingSlotId, setCapturingSlotId] = useState<string | null>(null);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiProcessingType, setAIProcessingType] = useState<AIEnhancementType | null>(null);

  // Calculate canvas dimensions
  const canvasDimensions = useMemo(() => {
    if (!template) return { width: 0, height: 0, scale: 1 };

    const maxWidth = screenWidth - CANVAS_PADDING * 2;
    const maxHeight = screenHeight * 0.6; // Leave room for toolbar
    const aspectRatio = template.canvasWidth / template.canvasHeight;

    let width = maxWidth;
    let height = width / aspectRatio;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    const scale = width / template.canvasWidth;

    return { width, height, scale };
  }, [template, screenWidth, screenHeight]);

  // Extract and scale slots
  const slots = useMemo(() => {
    if (!template) return [];
    return extractSlots(template);
  }, [template]);

  // Create SlotWithTransform objects
  const slotsWithTransform = useMemo((): SlotWithTransform[] => {
    return slots.map(slot => ({
      ...slot,
      media: capturedImages[slot.layerId] || null,
      transform: slotTransforms[slot.layerId] || DEFAULT_TRANSFORM,
      aiEnhanced: false, // TODO: Track AI enhancement state
    }));
  }, [slots, capturedImages, slotTransforms]);

  // Preview URL for the template background
  const previewUrl = useMemo(() => {
    if (!template) return null;
    return template.templatedPreviewUrl || template.thumbnail;
  }, [template]);

  // Check if all slots have images
  const allSlotsFilled = useMemo(() => {
    return slots.every(slot => capturedImages[slot.layerId]?.uri);
  }, [slots, capturedImages]);

  // Handle tool selection
  const handleToolSelect = useCallback((tool: ToolType) => {
    // Deselect current selection when changing tools
    setSelection(DEFAULT_SELECTION);

    if (tool === 'enhance') {
      // Open AI panel
      aiPanelRef.current?.snapToIndex(0);
    } else if (tool === 'text') {
      // Add text overlay (premium check)
      if (!isPremium) {
        requestPremiumAccess('add_text_overlay', () => {
          const newOverlay = createTextOverlay();
          setOverlays(prev => [...prev, newOverlay]);
        });
      } else {
        const newOverlay = createTextOverlay();
        setOverlays(prev => [...prev, newOverlay]);
      }
    } else if (tool === 'date') {
      // Add date overlay (premium check)
      if (!isPremium) {
        requestPremiumAccess('add_date_overlay', () => {
          const newOverlay = createDateOverlay();
          setOverlays(prev => [...prev, newOverlay]);
        });
      } else {
        const newOverlay = createDateOverlay();
        setOverlays(prev => [...prev, newOverlay]);
      }
    } else if (tool === 'logo') {
      // TODO: Open logo picker
      if (!isPremium) {
        requestPremiumAccess('add_logo_overlay');
      } else {
        Alert.alert('Logo', 'Logo picker coming soon');
      }
    }

    setActiveTool(tool);
  }, [isPremium, requestPremiumAccess]);

  // Handle slot press
  const handleSlotPress = useCallback((slotId: string) => {
    const slot = slotsWithTransform.find(s => s.layerId === slotId);
    
    if (!slot?.media?.uri) {
      // Empty slot - open camera
      setCapturingSlotId(slotId);
      cameraSheetRef.current?.snapToIndex(0);
    } else {
      // Has image - select it
      setSelection({
        type: 'slot',
        id: slotId,
        isTransforming: false,
      });
    }
  }, [slotsWithTransform]);

  // Handle canvas tap (deselect)
  const handleCanvasTap = useCallback(() => {
    if (selection.id) {
      setSelection(DEFAULT_SELECTION);
    }
  }, [selection]);

  // Handle transform change
  const handleTransformChange = useCallback((slotId: string, transform: Partial<TransformState>) => {
    setSlotTransforms(prev => ({
      ...prev,
      [slotId]: {
        ...(prev[slotId] || DEFAULT_TRANSFORM),
        ...transform,
      },
    }));
  }, []);

  // Handle photo capture from camera sheet
  const handlePhotoCapture = useCallback(async (uri: string, width: number, height: number) => {
    if (!capturingSlotId || !template) return;

    const slot = slots.find(s => s.layerId === capturingSlotId);
    if (!slot) return;

    try {
      // Process image for the slot
      const processed = await processImageForAdjustment(
        uri,
        width,
        height,
        slot.width,
        slot.height
      );

      // Set the captured image
      setCapturedImage(capturingSlotId, {
        uri: processed.uri,
        width: processed.width,
        height: processed.height,
        adjustments: DEFAULT_ADJUSTMENTS,
      });

      // Select the newly added image
      setSelection({
        type: 'slot',
        id: capturingSlotId,
        isTransforming: false,
      });
    } catch (error) {
      console.error('Failed to process captured image:', error);
    }

    setCapturingSlotId(null);
  }, [capturingSlotId, template, slots, setCapturedImage]);

  // Handle camera sheet close
  const handleCameraClose = useCallback(() => {
    setCapturingSlotId(null);
  }, []);

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

  // Contextual toolbar actions
  const handlePhotoReplace = useCallback(() => {
    if (selection.id) {
      setCapturingSlotId(selection.id);
      cameraSheetRef.current?.snapToIndex(0);
    }
  }, [selection]);

  const handlePhotoAdjust = useCallback(() => {
    // Already in adjust mode when selected
    Alert.alert('Adjust', 'Pinch to zoom, drag to pan, two-finger rotate');
  }, []);

  const handlePhotoAI = useCallback(() => {
    aiPanelRef.current?.snapToIndex(0);
  }, []);

  const handlePhotoRemove = useCallback(() => {
    if (selection.id) {
      setCapturedImage(selection.id, null);
      setSelection(DEFAULT_SELECTION);
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

    // TODO: Navigate to export/publish
    Alert.alert('Success', 'Ready to export! (Coming soon)');
  }, [allSlotsFilled]);

  // Get selected slot for contextual toolbar positioning
  const selectedSlot = useMemo(() => {
    if (selection.type === 'slot' && selection.id) {
      return slotsWithTransform.find(s => s.layerId === selection.id);
    }
    return null;
  }, [selection, slotsWithTransform]);

  // Calculate contextual toolbar anchor position
  const contextualToolbarAnchorY = useMemo(() => {
    if (!selectedSlot) return 0;
    const scaledY = selectedSlot.y * canvasDimensions.scale;
    const scaledHeight = selectedSlot.height * canvasDimensions.scale;
    // Position below the slot + some margin for handles
    return scaledY + scaledHeight + 80; // 80px = header + canvas padding + handle offset
  }, [selectedSlot, canvasDimensions.scale]);

  // Redirect if no template
  useEffect(() => {
    if (!template) {
      router.back();
    }
  }, [template, router]);

  if (!template) {
    return null;
  }

  // Get label for capturing slot
  const capturingSlotLabel = capturingSlotId
    ? slots.find(s => s.layerId === capturingSlotId)?.label || 'Photo'
    : 'Photo';

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
        <Pressable style={styles.canvasArea} onPress={handleCanvasTap}>
          <View
            style={[
              styles.canvas,
              {
                width: canvasDimensions.width,
                height: canvasDimensions.height,
              },
            ]}
          >
            {/* Template Background */}
            <Image
              source={{ uri: previewUrl }}
              style={styles.templateBackground}
              contentFit="cover"
            />

            {/* Editable Slots */}
            {slotsWithTransform.map(slot => (
              <EditableSlot
                key={slot.layerId}
                slot={slot}
                isSelected={selection.id === slot.layerId}
                canvasScale={canvasDimensions.scale}
                onPress={() => handleSlotPress(slot.layerId)}
                onTransformChange={handleTransformChange}
              />
            ))}
          </View>

          {/* Contextual Toolbar */}
          <ContextualToolbar
            selectionType={selection.type}
            visible={!!selection.id}
            anchorY={contextualToolbarAnchorY}
            isPremium={isPremium}
            onPhotoReplace={handlePhotoReplace}
            onPhotoAdjust={handlePhotoAdjust}
            onPhotoAI={handlePhotoAI}
            onPhotoRemove={handlePhotoRemove}
          />
        </Pressable>

        {/* Bottom Tool Dock */}
        <ToolDock
          activeTool={activeTool}
          onToolSelect={handleToolSelect}
          isPremium={isPremium}
        />
      </SafeAreaView>

      {/* Camera Sheet */}
      <CameraSheet
        bottomSheetRef={cameraSheetRef}
        slotLabel={capturingSlotLabel}
        onCapture={handlePhotoCapture}
        onClose={handleCameraClose}
      />

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
    paddingHorizontal: CANVAS_PADDING,
  },
  canvas: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    // Border
    borderWidth: 1,
    borderColor: Colors.light.glassEdge,
  },
  templateBackground: {
    ...StyleSheet.absoluteFillObject,
  },
});
