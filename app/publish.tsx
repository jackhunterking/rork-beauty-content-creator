import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Image } from 'expo-image';
import { 
  Download, 
  Share2, 
  Check,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { TemplateFormat, PlatformOption, PublishPlatform } from '@/types';
import { downloadAndSaveToGallery } from '@/services/downloadService';
import { downloadAndShare } from '@/services/shareService';
import { createPortfolioItem } from '@/services/portfolioService';
import { uploadToStorage } from '@/services/imageUploadService';

const { width } = Dimensions.get('window');
const PREVIEW_PADDING = 40;

// Platform options - simplified to Save to Photos and Share
const PLATFORM_OPTIONS: PlatformOption[] = [
  { 
    id: 'download', 
    name: 'Save to Photos', 
    icon: 'download', 
    supportedFormats: ['1:1', '9:16'] 
  },
  { 
    id: 'share', 
    name: 'Share', 
    icon: 'share', 
    supportedFormats: ['1:1', '9:16'] 
  },
];

// Toast component for save confirmation
const Toast = ({ visible, message }: { visible: boolean; message: string }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.toastContent}>
        <View style={styles.toastIconContainer}>
          <Check size={16} color={Colors.light.surface} />
        </View>
        <Text style={styles.toastText}>{message}</Text>
      </View>
    </Animated.View>
  );
};

// Get icon component for platform
const getPlatformIcon = (iconName: string, size: number) => {
  switch (iconName) {
    case 'download':
      return <Download size={size} color={Colors.light.text} />;
    case 'share':
      return <Share2 size={size} color={Colors.light.text} />;
    default:
      return <Share2 size={size} color={Colors.light.text} />;
  }
};

export default function PublishScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    draftId: string;
    templateId: string;
    templateName: string;
    previewUri: string;
    format: string;
    hasWatermark: string;
  }>();

  const { deleteDraft, resetProject, refreshPortfolio } = useApp();

  // Parse params
  const draftId = params.draftId || undefined;
  const templateId = params.templateId;
  const templateName = params.templateName || 'Untitled';
  const previewUri = params.previewUri;
  const format = (params.format || '1:1') as TemplateFormat;
  const hasWatermark = params.hasWatermark === 'true';

  // State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPlatform, setProcessingPlatform] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isCreatingPortfolio, setIsCreatingPortfolio] = useState(true);

  // Track if portfolio was created to avoid duplicate creation
  const portfolioCreatedRef = useRef(false);

  // Calculate preview dimensions based on format
  const previewDimensions = useMemo(() => {
    const maxWidth = width - PREVIEW_PADDING * 2;
    if (format === '9:16') {
      const height = Math.min(maxWidth * (16 / 9), 350);
      return { width: height * (9 / 16), height };
    }
    if (format === '4:5') {
      const height = Math.min(maxWidth * (5 / 4), 350);
      return { width: height * (4 / 5), height };
    }
    // 1:1
    const squareSize = Math.min(maxWidth, 300);
    return { width: squareSize, height: squareSize };
  }, [format]);

  // Get format display text
  const formatDisplayText = useMemo(() => {
    if (format === '4:5') {
      return 'Portrait (4:5) - Perfect for Instagram Posts';
    }
    if (format === '1:1') {
      return 'Square (1:1) - Perfect for Facebook and carousel posts';
    }
    return 'Vertical (9:16) - Perfect for Instagram Stories and TikTok';
  }, [format]);

  // Auto-create portfolio item on mount (draft becomes work)
  useEffect(() => {
    const createPortfolio = async () => {
      if (portfolioCreatedRef.current || !previewUri || !templateId) {
        setIsCreatingPortfolio(false);
        return;
      }

      portfolioCreatedRef.current = true;

      try {
        console.log('[Publish] Creating portfolio item...');
        
        // IMPORTANT: If previewUri is a local file path (file://), we need to upload it
        // to Supabase storage to get a permanent cloud URL. Local file paths only exist
        // on the device and will break when app is reinstalled or viewed on another device.
        let finalImageUrl = previewUri;
        
        if (previewUri.startsWith('file://')) {
          console.log('[Publish] Uploading local preview to cloud storage...');
          try {
            // Upload to Supabase storage and get permanent cloud URL
            const cloudUrl = await uploadToStorage(previewUri, `portfolio-${templateId}`);
            finalImageUrl = cloudUrl;
            console.log('[Publish] Preview uploaded to cloud:', cloudUrl);
          } catch (uploadError) {
            console.error('[Publish] Failed to upload preview to cloud:', uploadError);
            // Fall back to original URL - this will cause issues but better than failing entirely
            // The user can still share/download from the current session
          }
        } else {
          console.log('[Publish] Using existing cloud URL:', previewUri);
        }
        
        const item = await createPortfolioItem({
          draftId,
          templateId,
          templateName,
          imageUrl: finalImageUrl,
          format,
          hasWatermark,
          publishedTo: [],
        });

        console.log('[Publish] Portfolio item created:', item.id);

        // Refresh portfolio so Work tab shows the new item
        refreshPortfolio();

        // Delete the draft if it exists (it's now a work)
        if (draftId) {
          try {
            console.log('[Publish] Deleting draft:', draftId);
            await deleteDraft(draftId);
            console.log('[Publish] Draft deleted successfully');
          } catch (error) {
            console.warn('[Publish] Failed to delete draft:', error);
          }
        }

        // Note: Don't reset project here - it causes the Editor (still in stack) to redirect
        // We'll reset when user clicks Done

      } catch (error) {
        console.error('[Publish] Failed to create portfolio item:', error);
        Alert.alert('Error', 'Failed to save your work. Please try again.');
      } finally {
        setIsCreatingPortfolio(false);
      }
    };

    createPortfolio();
  }, [previewUri, templateId, templateName, draftId, format, hasWatermark, deleteDraft, refreshPortfolio]);

  // Show toast and auto-hide
  const showToastMessage = useCallback((message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }, []);

  // Handle platform action
  const handlePlatformAction = useCallback(async (platformId: PublishPlatform) => {
    if (!previewUri) {
      Alert.alert('Error', 'No preview image available');
      return;
    }

    setIsProcessing(true);
    setProcessingPlatform(platformId);

    try {
      // Execute platform-specific action
      switch (platformId) {
        case 'download':
          const downloadResult = await downloadAndSaveToGallery(previewUri);
          if (!downloadResult.success) {
            throw new Error(downloadResult.error || 'Download failed');
          }
          // Show toast for save to photos
          showToastMessage('Saved! You can view it in your photo library');
          break;

        case 'share':
          const shareResult = await downloadAndShare(previewUri, undefined, {
            mimeType: 'image/jpeg',
            dialogTitle: 'Share your creation',
          });
          if (!shareResult.success) {
            throw new Error(shareResult.error || 'Share failed');
          }
          break;
      }

    } catch (error) {
      console.error('Platform action failed:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Something went wrong'
      );
    } finally {
      setIsProcessing(false);
      setProcessingPlatform(null);
    }
  }, [previewUri, showToastMessage]);

  // Handle Done button - reset project and navigate to home
  const handleDone = useCallback(() => {
    // Reset the current project state before leaving
    resetProject();
    router.replace('/(tabs)');
  }, [router, resetProject]);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Publish',
          headerBackVisible: false,
          headerLeft: () => null,
          gestureEnabled: false,
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Format Badge at Top */}
          <View style={styles.formatBadgeContainer}>
            <View style={styles.formatBadge}>
              <Text style={styles.formatBadgeText}>{formatDisplayText}</Text>
            </View>
          </View>

          {/* Preview Image */}
          <View style={styles.previewSection}>
            <View style={[styles.previewContainer, previewDimensions]}>
              {isCreatingPortfolio ? (
                <View style={styles.previewLoading}>
                  <ActivityIndicator size="large" color={Colors.light.accent} />
                  <Text style={styles.previewLoadingText}>Saving to portfolio...</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: previewUri }}
                  style={styles.previewImage}
                  contentFit="contain"
                  transition={200}
                />
              )}
            </View>
          </View>

          {/* Platform Options */}
          <View style={styles.platformsSection}>
            <Text style={styles.sectionTitle}>Share to</Text>
            
            <View style={styles.platformsGrid}>
              {PLATFORM_OPTIONS.map((platform) => {
                const isThisPlatformProcessing = processingPlatform === platform.id;
                
                return (
                  <TouchableOpacity
                    key={platform.id}
                    style={[
                      styles.platformCard,
                      isProcessing && !isThisPlatformProcessing && styles.platformCardDisabled,
                    ]}
                    onPress={() => handlePlatformAction(platform.id)}
                    disabled={isProcessing || isCreatingPortfolio}
                    activeOpacity={0.7}
                  >
                    <View style={styles.platformIconContainer}>
                      {isThisPlatformProcessing ? (
                        <ActivityIndicator size="small" color={Colors.light.accent} />
                      ) : (
                        getPlatformIcon(platform.icon, 28)
                      )}
                    </View>
                    <Text style={styles.platformName}>{platform.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Done Button at Bottom */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={handleDone}
            disabled={isCreatingPortfolio}
            activeOpacity={0.8}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Toast Notification */}
        <Toast visible={showToast} message={toastMessage} />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Format Badge
  formatBadgeContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  formatBadge: {
    backgroundColor: Colors.light.surfaceSecondary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  formatBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  
  // Preview Section
  previewSection: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  previewContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewLoading: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  previewLoadingText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  
  // Platforms Section
  platformsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 16,
  },
  platformsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  platformCard: {
    width: (width - 40 - 12) / 2, // 2 columns with gap
    paddingVertical: 16,
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 10,
  },
  platformCardDisabled: {
    opacity: 0.5,
  },
  platformIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
    textAlign: 'center',
  },

  // Bottom Section
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
  },
  doneButton: {
    backgroundColor: Colors.light.text,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.surface,
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: Colors.light.text,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toastIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.surface,
  },
});
