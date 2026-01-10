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
import { Svg, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { TemplateFormat, PlatformOption, PublishPlatform } from '@/types';
import { downloadAndSaveToGallery } from '@/services/downloadService';
import { downloadAndShare } from '@/services/shareService';
import { createPortfolioItem } from '@/services/portfolioService';

const { width } = Dimensions.get('window');
const PREVIEW_PADDING = 40;

// Brand colors
const BRAND_COLORS = {
  instagram: '#E4405F',
  facebook: '#1877F2',
};

// Instagram icon component with gradient
const InstagramIcon = ({ size = 24 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Defs>
      <LinearGradient id="instagramGradient" x1="0%" y1="100%" x2="100%" y2="0%">
        <Stop offset="0%" stopColor="#FCAF45" />
        <Stop offset="25%" stopColor="#F77737" />
        <Stop offset="50%" stopColor="#F56040" />
        <Stop offset="75%" stopColor="#FD1D1D" />
        <Stop offset="100%" stopColor="#E1306C" />
      </LinearGradient>
    </Defs>
    <Path
      d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
      fill="url(#instagramGradient)"
    />
  </Svg>
);

// Facebook icon component
const FacebookIcon = ({ size = 24 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={BRAND_COLORS.facebook}>
    <Path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </Svg>
);

// Platform options - simplified to 4 options for 2x2 grid
const PLATFORM_OPTIONS: PlatformOption[] = [
  { 
    id: 'instagram_post', 
    name: 'Instagram Post', 
    icon: 'instagram', 
    supportedFormats: ['1:1', '9:16'] 
  },
  { 
    id: 'facebook_post', 
    name: 'Facebook', 
    icon: 'facebook', 
    supportedFormats: ['1:1', '9:16'] 
  },
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

// Get icon component for platform with native colors
const getPlatformIcon = (iconName: string, size: number) => {
  switch (iconName) {
    case 'instagram':
      return <InstagramIcon size={size} />;
    case 'facebook':
      return <FacebookIcon size={size} />;
    case 'download':
      return <Download size={size} color={Colors.light.text} />;
    case 'share':
      return <Share2 size={size} color={Colors.light.text} />;
    default:
      return <Share2 size={size} color={Colors.light.text} />;
  }
};

// Get platform display name
const getPlatformName = (platformId: PublishPlatform): string => {
  const platform = PLATFORM_OPTIONS.find(p => p.id === platformId);
  return platform?.name || platformId;
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
    // 1:1
    const squareSize = Math.min(maxWidth, 300);
    return { width: squareSize, height: squareSize };
  }, [format]);

  // Get format display text
  const formatDisplayText = useMemo(() => {
    if (format === '1:1') {
      return 'Square (1:1) - Perfect for Instagram posts and Facebook feed';
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
        const item = await createPortfolioItem({
          draftId,
          templateId,
          templateName,
          imageUrl: previewUri,
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

        case 'instagram_post':
        case 'facebook_post':
          // Open native share sheet
          const socialResult = await downloadAndShare(previewUri, undefined, {
            mimeType: 'image/jpeg',
            dialogTitle: `Share to ${getPlatformName(platformId)}`,
          });
          if (!socialResult.success) {
            throw new Error(socialResult.error || 'Share failed');
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
