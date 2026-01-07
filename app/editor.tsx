import React, { useState, useCallback, useEffect } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { Save, Sparkles } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { TemplateCanvas } from '@/components/TemplateCanvas';
import { processImageForSlot } from '@/utils/imageProcessing';

type SlotType = 'before' | 'after';

export default function EditorScreen() {
  const router = useRouter();
  const { currentProject, setBeforeMedia, setAfterMedia, saveDraft, isSavingDraft } = useApp();
  const template = currentProject.template;

  // Initialize from currentProject (supports both fresh start and draft restoration)
  const [beforeUri, setBeforeUri] = useState<string | null>(
    currentProject.beforeMedia?.uri || null
  );
  const [afterUri, setAfterUri] = useState<string | null>(
    currentProject.afterMedia?.uri || null
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSlot, setActiveSlot] = useState<SlotType | null>(null);

  // Sync state when currentProject changes (e.g., when loading a draft)
  useEffect(() => {
    setBeforeUri(currentProject.beforeMedia?.uri || null);
    setAfterUri(currentProject.afterMedia?.uri || null);
  }, [currentProject.beforeMedia?.uri, currentProject.afterMedia?.uri]);

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

  const canGenerate = beforeUri && afterUri;
  const isEditingDraft = !!currentProject.draftId;

  // Process image for the slot
  const processImage = useCallback(
    async (uri: string, width: number, height: number, slotType: SlotType) => {
      if (!template) return;

      const slot = slotType === 'before' ? template.beforeSlot : template.afterSlot;
      setIsProcessing(true);

      try {
        const processed = await processImageForSlot(uri, width, height, slot);

        if (slotType === 'before') {
          setBeforeUri(processed.uri);
          setBeforeMedia({
            uri: processed.uri,
            width: processed.width,
            height: processed.height,
          });
        } else {
          setAfterUri(processed.uri);
          setAfterMedia({
            uri: processed.uri,
            width: processed.width,
            height: processed.height,
          });
        }

        Toast.show({
          type: 'success',
          text1: `${slotType === 'before' ? 'Before' : 'After'} image added`,
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
        setActiveSlot(null);
      }
    },
    [template, setBeforeMedia, setAfterMedia]
  );

  // Take photo with camera
  const takePhoto = useCallback(
    async (slotType: SlotType) => {
      setActiveSlot(slotType);

      // Navigate to camera screen with slot info
      router.push({
        pathname: slotType === 'before' ? '/capture/before' : '/capture/after',
      });
    },
    [router]
  );

  // Choose from library
  const chooseFromLibrary = useCallback(
    async (slotType: SlotType) => {
      setActiveSlot(slotType);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await processImage(asset.uri, asset.width, asset.height, slotType);
      } else {
        setActiveSlot(null);
      }
    },
    [processImage]
  );

  // Show action sheet for slot
  const handleSlotPress = useCallback(
    (slotType: SlotType) => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Take Photo', 'Choose from Library'],
            cancelButtonIndex: 0,
            title: `Add ${slotType === 'before' ? 'Before' : 'After'} Image`,
          },
          (buttonIndex) => {
            if (buttonIndex === 1) {
              takePhoto(slotType);
            } else if (buttonIndex === 2) {
              chooseFromLibrary(slotType);
            }
          }
        );
      } else {
        // Android: Use Alert as a simple alternative
        Alert.alert(
          `Add ${slotType === 'before' ? 'Before' : 'After'} Image`,
          'Choose an option',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Take Photo', onPress: () => takePhoto(slotType) },
            { text: 'Choose from Library', onPress: () => chooseFromLibrary(slotType) },
          ]
        );
      }
    },
    [takePhoto, chooseFromLibrary]
  );

  // Actually perform the save operation
  const performSaveDraft = useCallback(async () => {
    if (!template) return;

    try {
      await saveDraft({
        templateId: template.id,
        beforeImageUri: beforeUri,
        afterImageUri: afterUri,
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
  }, [template, beforeUri, afterUri, saveDraft, currentProject.draftId, router]);

  // Save draft - shows confirmation dialog first
  const handleSaveDraft = useCallback(() => {
    if (!template) return;

    // Need at least one image to save
    if (!beforeUri && !afterUri) {
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
          text: 'Save Draft',
          onPress: performSaveDraft,
        },
      ],
      { cancelable: true }
    );
  }, [template, beforeUri, afterUri, performSaveDraft]);

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
                <Save size={22} color={Colors.light.accent} />
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
          {/* Template Canvas */}
          <TemplateCanvas
            template={template}
            beforeUri={beforeUri}
            afterUri={afterUri}
            onSlotPress={handleSlotPress}
          />

          {/* Instructions */}
          <View style={styles.instructions}>
            <Text style={styles.instructionText}>
              Tap on each slot to add your before and after photos
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
              {canGenerate ? 'Generate' : 'Add both images to continue'}
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
    padding: 8,
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
