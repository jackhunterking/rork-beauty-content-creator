import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Image } from 'expo-image';
import {
  Download, 
  Share2, 
  Check,
  RefreshCw,
  AlertCircle,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { TemplateFormat, PlatformOption, PublishPlatform } from '@/types';
import { downloadAndSaveToGallery } from '@/services/downloadService';
import { downloadAndShare } from '@/services/shareService';
import { createPortfolioItem } from '@/services/portfolioService';
import { uploadToStorage } from '@/services/imageUploadService';
import { getAllFormatIds, getFormatById, getDefaultFormat } from '@/constants/formats';
import { useResponsive } from '@/hooks/useResponsive';
import { usePremiumStatus, usePremiumFeature } from '@/hooks/usePremiumStatus';

// Platform options - simplified to Save to Photos and Share
// Supported formats use centralized config so new formats are automatically included
const PLATFORM_OPTIONS: PlatformOption[] = [
  { 
    id: 'download', 
    name: 'Save to Photos', 
    icon: 'download', 
    supportedFormats: getAllFormatIds() as TemplateFormat[]
  },
  { 
    id: 'share', 
    name: 'Share', 
    icon: 'share', 
    supportedFormats: getAllFormatIds() as TemplateFormat[]
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
  }>();

  const { deleteDraft, resetProject, refreshPortfolio } = useApp();
  
  // Premium status for download paywall
  const { isPremium, isLoading: isPremiumLoading } = usePremiumStatus();
  const { requestPremiumAccess, paywallState } = usePremiumFeature();
  
  // Responsive configuration
  const responsive = useResponsive();

  // Parse params
  const draftId = params.draftId || undefined;
  const templateId = params.templateId;
  const templateName = params.templateName || 'Untitled';
  const previewUri = params.previewUri;
  const format = (params.format || getDefaultFormat()) as TemplateFormat;

  // State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPlatform, setProcessingPlatform] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isCreatingPortfolio, setIsCreatingPortfolio] = useState(true);
  const [portfolioSaveError, setPortfolioSaveError] = useState<string | null>(null);
  const [portfolioSaved, setPortfolioSaved] = useState(false);

  // Track if portfolio was created to avoid duplicate creation
  const portfolioCreatedRef = useRef(false);

  // Calculate preview dimensions based on format - uses centralized config with responsive adjustments
  const previewDimensions = useMemo(() => {
    const maxWidth = Math.min(responsive.maxPreviewWidth, responsive.screenWidth - 80);
    const config = getFormatById(format);
    
    if (!config) {
      // Fallback to square
      const squareSize = Math.min(maxWidth, 300);
      return { width: squareSize, height: squareSize };
    }
    
    // Calculate dimensions based on aspect ratio
    // For tall formats (aspectRatio < 1), constrain by height
    // For wide formats (aspectRatio >= 1), constrain by width
    if (config.aspectRatio < 1) {
      // Portrait/vertical - constrain by height
      const maxHeight = responsive.isTablet ? 400 : 350;
      const height = maxHeight;
      const widthFromHeight = height * config.aspectRatio;
      return { width: Math.min(widthFromHeight, maxWidth), height };
    } else {
      // Square or landscape - constrain by width
      const previewWidth = Math.min(maxWidth, responsive.isTablet ? 350 : 300);
      const previewHeight = previewWidth / config.aspectRatio;
      return { width: previewWidth, height: previewHeight };
    }
  }, [format, responsive]);

  // Get format display text - uses centralized config
  const formatDisplayText = useMemo(() => {
    const config = getFormatById(format);
    if (!config) {
      return `${format} format`;
    }
    
    // Use description if available, otherwise construct from label
    if (config.description) {
      return `${config.label} (${config.id}) - ${config.description}`;
    }
    return `${config.label} (${config.id})`;
  }, [format]);

  // Extract error message for better UX
  const getErrorMessage = useCallback((error: unknown): string => {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('format')) {
        return 'This format is not supported. Please try again.';
      } else if (msg.includes('authenticated') || msg.includes('user must be')) {
        return 'Please sign in to save to your portfolio.';
      } else if (msg.includes('storage') || msg.includes('upload')) {
        return 'Failed to upload image. Please check your connection.';
      } else if (msg.includes('network') || msg.includes('fetch')) {
        return 'Network error. Please check your connection and try again.';
      }
    }
    return 'Failed to save to your portfolio. Please try again.';
  }, []);

  // Show toast and auto-hide
  const showToastMessage = useCallback((message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }, []);

  // Portfolio creation function (reusable for retry)
  const saveToPortfolio = useCallback(async (): Promise<boolean> => {
    if (!previewUri || !templateId) {
      return false;
    }

    setIsCreatingPortfolio(true);
    setPortfolioSaveError(null);

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
          throw new Error('Failed to upload image to storage');
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
        publishedTo: [],
      });

      console.log('[Publish] Portfolio item created:', item.id);

      // Refresh portfolio so Portfolio tab shows the new item
      refreshPortfolio();

      // Delete the draft if it exists (it's now in portfolio)
      if (draftId) {
        try {
          console.log('[Publish] Deleting draft:', draftId);
          await deleteDraft(draftId);
          console.log('[Publish] Draft deleted successfully');
        } catch (error) {
          console.warn('[Publish] Failed to delete draft:', error);
        }
      }

      setPortfolioSaved(true);
      return true;

    } catch (error) {
      console.error('[Publish] Failed to create portfolio item:', error);
      const errorMessage = getErrorMessage(error);
      setPortfolioSaveError(errorMessage);
      return false;
    } finally {
      setIsCreatingPortfolio(false);
    }
  }, [previewUri, templateId, templateName, draftId, format, deleteDraft, refreshPortfolio, getErrorMessage]);

  // Auto-create portfolio item on mount (draft becomes portfolio item)
  useEffect(() => {
    const createPortfolio = async () => {
      if (portfolioCreatedRef.current || !previewUri || !templateId) {
        setIsCreatingPortfolio(false);
        return;
      }

      portfolioCreatedRef.current = true;
      await saveToPortfolio();
    };

    createPortfolio();
  }, [previewUri, templateId, saveToPortfolio]);

  // Handle retry portfolio save
  const handleRetryPortfolioSave = useCallback(async () => {
    const success = await saveToPortfolio();
    if (success) {
      showToastMessage('Saved to portfolio!');
    }
  }, [saveToPortfolio, showToastMessage]);

  // Execute the actual platform action (download/share)
  const executePlatformAction = useCallback(async (platformId: PublishPlatform) => {
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

  // Handle platform action - checks premium status and shows paywall if needed
  const handlePlatformAction = useCallback(async (platformId: PublishPlatform) => {
    if (!previewUri) {
      Alert.alert('Error', 'No preview image available');
      return;
    }

    // If user is premium, execute action immediately
    if (isPremium) {
      await executePlatformAction(platformId);
      return;
    }

    // User is not premium - show paywall
    // The action name helps Superwall display relevant messaging
    const actionName = platformId === 'download' ? 'download_image' : 'share_image';
    
    await requestPremiumAccess(actionName, async () => {
      // This callback is only executed if user successfully subscribes
      console.log(`[Publish] Premium access granted for ${actionName}, executing action`);
      await executePlatformAction(platformId);
    });
  }, [previewUri, isPremium, executePlatformAction, requestPremiumAccess]);

  // Handle Done button - reset project and navigate to home
  const handleDone = useCallback(() => {
    // Reset the current project state before leaving
    resetProject();
    router.replace('/(tabs)');
  }, [router, resetProject]);

  // Dynamic styles for responsive layout
  const dynamicStyles = useMemo(() => {
    const contentMaxWidth = responsive.isTablet ? 500 : responsive.screenWidth;
    const platformCardWidth = responsive.isTablet 
      ? (contentMaxWidth - 40 - 12) / 2 
      : (responsive.screenWidth - 40 - 12) / 2;
    
    return {
      scrollContent: {
        alignItems: responsive.isTablet ? 'center' as const : undefined,
      },
      contentContainer: {
        width: '100%' as const,
        maxWidth: contentMaxWidth,
      },
      platformCard: {
        width: platformCardWidth,
      },
    };
  }, [responsive]);

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
          contentContainerStyle={[styles.scrollContent, dynamicStyles.scrollContent]}
          showsVerticalScrollIndicator={false}
        >
          <View style={dynamicStyles.contentContainer}>
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
              
              {/* Portfolio Save Error with Retry */}
              {portfolioSaveError && !isCreatingPortfolio && (
                <View style={styles.portfolioErrorContainer}>
                  <View style={styles.portfolioErrorContent}>
                    <AlertCircle size={18} color={Colors.light.error} />
                    <Text style={styles.portfolioErrorText}>{portfolioSaveError}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={handleRetryPortfolioSave}
                    activeOpacity={0.8}
                  >
                    <RefreshCw size={14} color={Colors.light.surface} />
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Portfolio Saved Success */}
              {portfolioSaved && !portfolioSaveError && !isCreatingPortfolio && (
                <View style={styles.portfolioSuccessContainer}>
                  <Check size={16} color={Colors.light.success} />
                  <Text style={styles.portfolioSuccessText}>Saved to portfolio</Text>
                </View>
              )}
            </View>

            {/* Platform Options */}
            <View style={styles.platformsSection}>
              <Text style={styles.sectionTitle}>Share to</Text>
              
              <View style={styles.platformsGrid}>
                {PLATFORM_OPTIONS.map((platform) => {
                  const isThisPlatformProcessing = processingPlatform === platform.id;
                  const isDisabled = isProcessing || isCreatingPortfolio || isPremiumLoading || paywallState === 'presenting';
                  
                  return (
                    <TouchableOpacity
                      key={platform.id}
                      style={[
                        styles.platformCard,
                        dynamicStyles.platformCard,
                        isDisabled && !isThisPlatformProcessing && styles.platformCardDisabled,
                      ]}
                      onPress={() => handlePlatformAction(platform.id)}
                      disabled={isDisabled}
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
          </View>
        </ScrollView>

        {/* Done Button at Bottom */}
        <View style={[styles.bottomSection, { maxWidth: dynamicStyles.contentContainer.maxWidth, alignSelf: responsive.isTablet ? 'center' : undefined, width: '100%' }]}>
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

  // Portfolio Error
  portfolioErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEE8E8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  portfolioErrorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  portfolioErrorText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.error,
    flex: 1,
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
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.surface,
  },

  // Portfolio Success
  portfolioSuccessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 12,
  },
  portfolioSuccessText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.success,
  },
});
