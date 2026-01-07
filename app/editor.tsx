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
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack, useNavigation } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { Save, Download, Share2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { TemplateCanvas } from '@/components/TemplateCanvas';
import { processImageForDimensions } from '@/utils/imageProcessing';
import { extractSlots, allSlotsCaptured, getSlotById, getCapturedSlotCount } from '@/utils/slotParser';
import { SlotState, SlotStates } from '@/types';

export default function EditorScreen() {
  const router = useRouter();
  const navigation = useNavigation();
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
  
  // Per-slot state tracking
  const [slotStates, setSlotStates] = useState<SlotStates>({});
  
  // Composed preview state
  const [composedPreviewUri, setComposedPreviewUri] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);

  // Extract slots from template
  const slots = useMemo(() => 
    template ? extractSlots(template) : [], 
    [template]
  );
  
  // Initialize slot states
  useEffect(() => {
    if (slots.length > 0) {
      const initialStates: SlotStates = {};
      slots.forEach(slot => {
        const hasCaptured = capturedImages[slot.layerId]?.uri;
        initialStates[slot.layerId] = {
          state: hasCaptured ? 'ready' : 'empty',
        };
      });
      setSlotStates(initialStates);
    }
  }, [slots, capturedImages]);

  // Set a specific slot's state
  const setSlotState = useCallback((slotId: string, state: SlotState, errorMessage?: string, progress?: number) => {
    setSlotStates(prev => ({
      ...prev,
      [slotId]: { state, errorMessage, progress },
    }));
  }, []);

  // Check if all slots have been captured
  const canDownload = useMemo(() => 
    allSlotsCaptured(slots, capturedImages),
    [slots, capturedImages]
  );

  // Count captured slots for progress display
  const capturedCount = useMemo(() => 
    getCapturedSlotCount(slots, capturedImages),
    [slots, capturedImages]
  );

  // Redirect if no template selected
  useEffect(() => {
    if (!template) {
      Toast.show({
        type: 'error',
        text1: 'No template selected',
        text2: 'Please select a template first',
        position: 'top',
      });
      router.back();
    }
  }, [template, router]);

  // Check if user has made any changes (unsaved work)
  const hasUnsavedChanges = capturedCount > 0;

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
  }, [template, slots, capturedImages, saveDraft, currentProject.draftId, resetProject, router]);

  // Intercept back navigation (iOS gesture and header back button)
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      // Allow navigation if explicitly permitted or no unsaved changes
      if (allowNavigationRef.current || !hasUnsavedChanges) {
        return;
      }

      // Prevent default behavior (going back)
      e.preventDefault();

      // Show confirmation dialog
      showBackConfirmation();
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges, showBackConfirmation]);

  // Handle Android hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (hasUnsavedChanges && !allowNavigationRef.current) {
        showBackConfirmation();
        return true; // Prevent default back behavior
      }
      return false; // Allow default back behavior
    });

    return () => backHandler.remove();
  }, [hasUnsavedChanges, showBackConfirmation]);

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

      // Set processing state for this slot only
      setSlotState(slotId, 'processing');

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

        // Set ready state
        setSlotState(slotId, 'ready');

        Toast.show({
          type: 'success',
          text1: `${slot.label} image added`,
          text2: `Ready for preview`,
          position: 'top',
          visibilityTime: 1500,
        });
      } catch (error) {
        console.error('Failed to process image:', error);
        setSlotState(slotId, 'error', 'Processing failed');
        Toast.show({
          type: 'error',
          text1: 'Processing failed',
          text2: 'Please try again',
          position: 'top',
        });
      }
    },
    [template, slots, setCapturedImage, setSlotState]
  );

  // Navigate to camera screen for a slot
  const takePhoto = useCallback(
    (slotId: string) => {
      setSlotState(slotId, 'capturing');
      router.push(`/capture/${slotId}`);
    },
    [router, setSlotState]
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
      } else {
        // User cancelled, reset state if it was empty
        const currentState = slotStates[slotId]?.state;
        if (currentState === 'capturing') {
          setSlotState(slotId, capturedImages[slotId]?.uri ? 'ready' : 'empty');
        }
      }
    },
    [processImage, slotStates, capturedImages, setSlotState]
  );

  // Show action sheet for slot
  const handleSlotPress = useCallback(
    (slotId: string) => {
      const slot = getSlotById(slots, slotId);
      const slotLabel = slot?.label || 'Photo';
      const currentState = slotStates[slotId]?.state;
      
      // Don't allow interaction during loading states
      if (['processing', 'uploading', 'rendering'].includes(currentState || '')) {
        return;
      }

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
    [slots, slotStates, takePhoto, chooseFromLibrary]
  );

  // Retry handler for error state
  const handleRetry = useCallback((slotId: string) => {
    handleSlotPress(slotId);
  }, [handleSlotPress]);

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
  }, [template, slots, capturedImages, saveDraft, currentProject.draftId, router]);

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

  // Handle download - this will trigger rendering and download
  const handleDownload = useCallback(async () => {
    if (!canDownload || !template?.templatedId) {
      Toast.show({
        type: 'info',
        text1: 'Not ready',
        text2: template?.templatedId 
          ? 'Add all images first' 
          : 'Template not configured for rendering',
        position: 'top',
      });
      return;
    }
    
    // TODO: Implement actual download with render
    // For now, show that it's coming soon
    Toast.show({
      type: 'info',
      text1: 'Download',
      text2: 'Rendering your image...',
      position: 'top',
      visibilityTime: 2000,
    });
  }, [canDownload, template]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (!canDownload) {
      Toast.show({
        type: 'info',
        text1: 'Not ready',
        text2: 'Add all images first',
        position: 'top',
      });
      return;
    }
    
    // TODO: Implement actual share with render
    Toast.show({
      type: 'info',
      text1: 'Share',
      text2: 'Preparing to share...',
      position: 'top',
      visibilityTime: 2000,
    });
  }, [canDownload]);

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
          {/* Template Canvas with dynamic slots and per-slot states */}
          <TemplateCanvas
            template={template}
            capturedImages={capturedImages}
            slotStates={slotStates}
            onSlotPress={handleSlotPress}
            onSlotRetry={handleRetry}
            composedPreviewUri={composedPreviewUri}
            isComposing={isComposing}
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
          <View style={styles.actionRow}>
            {/* Download Button */}
            <TouchableOpacity
              style={[styles.actionButton, !canDownload && styles.actionButtonDisabled]}
              onPress={handleDownload}
              disabled={!canDownload}
              activeOpacity={0.8}
            >
              <Download size={20} color={canDownload ? Colors.light.surface : Colors.light.textTertiary} />
              <Text style={[styles.actionButtonText, !canDownload && styles.actionButtonTextDisabled]}>
                Download
              </Text>
            </TouchableOpacity>

            {/* Share Button */}
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary, !canDownload && styles.actionButtonDisabled]}
              onPress={handleShare}
              disabled={!canDownload}
              activeOpacity={0.8}
            >
              <Share2 size={20} color={canDownload ? Colors.light.text : Colors.light.textTertiary} />
              <Text style={[styles.actionButtonTextSecondary, !canDownload && styles.actionButtonTextDisabled]}>
                Share
              </Text>
            </TouchableOpacity>
          </View>

          {!canDownload && (
            <Text style={styles.helperText}>
              Add all {slots.length} images to download or share
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
});
