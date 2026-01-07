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
import { Save, Sparkles } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { TemplateCanvas } from '@/components/TemplateCanvas';
import { processImageForDimensions } from '@/utils/imageProcessing';
import { extractSlots, allSlotsCaptured, getSlotById, getCapturedSlotCount } from '@/utils/slotParser';

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
  const [isProcessing, setIsProcessing] = useState(false);

  // Extract slots from template
  const slots = useMemo(() => 
    template ? extractSlots(template) : [], 
    [template]
  );

  // Check if all slots have been captured
  const canGenerate = useMemo(() => 
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

      setIsProcessing(true);

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

        Toast.show({
          type: 'success',
          text1: `${slot.label} image added`,
          text2: `Cropped to ${processed.width}×${processed.height}`,
          position: 'top',
          visibilityTime: 2000,
        });
      } catch (error) {
        console.error('Failed to process image:', error);
        Toast.show({
          type: 'error',
          text1: 'Processing failed',
          text2: 'Please try again',
          position: 'top',
        });
      } finally {
        setIsProcessing(false);
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
    [slots, takePhoto, chooseFromLibrary]
  );

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

  // Navigate to generate screen
  const handleGenerate = useCallback(() => {
    if (!canGenerate) return;
    router.push('/generate');
  }, [canGenerate, router]);

  if (!template) {
    return null;
  }

  if (isProcessing) {
    return (
      <View style={styles.processingContainer}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={styles.processingText}>Processing image...</Text>
      </View>
    );
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
                  <Save size={22} color={Colors.light.accent} />
                  <Text style={styles.headerSaveText}>Save Draft</Text>
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
          {/* Template Canvas with dynamic slots */}
          <TemplateCanvas
            template={template}
            capturedImages={capturedImages}
            onSlotPress={handleSlotPress}
          />

          {/* Instructions */}
          <View style={styles.instructions}>
            <Text style={styles.instructionText}>
              {getInstructionText()}
            </Text>
          </View>
        </ScrollView>

        {/* Bottom section */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[styles.generateButton, !canGenerate && styles.generateButtonDisabled]}
            onPress={handleGenerate}
            disabled={!canGenerate}
            activeOpacity={0.8}
          >
            <Sparkles size={20} color={Colors.light.surface} />
            <Text style={styles.generateButtonText}>
              {canGenerate ? 'Generate' : `Add all ${slots.length} images to continue`}
            </Text>
          </TouchableOpacity>
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
  processingContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  headerSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  headerSaveText: {
    fontSize: 16,
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
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.surface,
  },
});
