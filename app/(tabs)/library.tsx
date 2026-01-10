import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  FolderOpen,
  Plus,
  Square,
  RectangleVertical,
  X,
  Download,
  Share2,
  Trash2,
  Check,
} from 'lucide-react-native';
import { Svg, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { PortfolioItem, TemplateFormat, PublishPlatform } from '@/types';
import { downloadAndSaveToGallery } from '@/services/downloadService';
import { downloadAndShare } from '@/services/shareService';

const { width, height } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 20;
const TILE_WIDTH = (width - GRID_PADDING * 2 - GRID_GAP) / 2;

// Format filter options (same as Create screen)
const formatFilters: { format: TemplateFormat | 'all'; icon: (active: boolean) => React.ReactNode; label: string }[] = [
  { 
    format: '1:1', 
    icon: (active) => <Square size={18} color={active ? Colors.light.accentDark : Colors.light.text} />, 
    label: '1:1' 
  },
  { 
    format: '9:16', 
    icon: (active) => <RectangleVertical size={18} color={active ? Colors.light.accentDark : Colors.light.text} />, 
    label: '9:16' 
  },
];

// Brand colors for platform icons
const BRAND_COLORS = {
  instagram: '#E4405F',
  facebook: '#1877F2',
};

// Instagram icon component with gradient
const InstagramIcon = ({ size = 24 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Defs>
      <LinearGradient id="instagramGradientWork" x1="0%" y1="100%" x2="100%" y2="0%">
        <Stop offset="0%" stopColor="#FCAF45" />
        <Stop offset="25%" stopColor="#F77737" />
        <Stop offset="50%" stopColor="#F56040" />
        <Stop offset="75%" stopColor="#FD1D1D" />
        <Stop offset="100%" stopColor="#E1306C" />
      </LinearGradient>
    </Defs>
    <Path
      d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
      fill="url(#instagramGradientWork)"
    />
  </Svg>
);

// Facebook icon component
const FacebookIcon = ({ size = 24 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={BRAND_COLORS.facebook}>
    <Path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </Svg>
);

// Platform options (same as publish screen)
interface PlatformOption {
  id: PublishPlatform;
  name: string;
  icon: string;
}

const PLATFORM_OPTIONS: PlatformOption[] = [
  { id: 'instagram_post', name: 'Instagram Post', icon: 'instagram' },
  { id: 'facebook_post', name: 'Facebook', icon: 'facebook' },
  { id: 'download', name: 'Save to Photos', icon: 'download' },
  { id: 'share', name: 'Share', icon: 'share' },
];

// Get icon component for platform
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

// Format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

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

// Bottom Sheet Component
interface BottomSheetProps {
  visible: boolean;
  item: PortfolioItem | null;
  onClose: () => void;
  onDelete: () => void;
  onPlatformAction: (platformId: PublishPlatform) => void;
  isProcessing: boolean;
  processingPlatform: string | null;
}

const BottomSheet = ({ 
  visible, 
  item, 
  onClose, 
  onDelete, 
  onPlatformAction,
  isProcessing,
  processingPlatform,
}: BottomSheetProps) => {
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 150,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  if (!item) return null;

  // Calculate preview dimensions
  const previewMaxWidth = width - 80;
  const previewDimensions = item.format === '9:16'
    ? { width: Math.min(previewMaxWidth * 0.5, 150), height: Math.min(previewMaxWidth * 0.5 * (16/9), 267) }
    : { width: Math.min(previewMaxWidth * 0.6, 200), height: Math.min(previewMaxWidth * 0.6, 200) };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.bottomSheetOverlay}>
        <Pressable style={styles.bottomSheetBackdrop} onPress={onClose} />
        <Animated.View 
          style={[
            styles.bottomSheetContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          {/* Handle bar */}
          <View style={styles.bottomSheetHandle}>
            <View style={styles.bottomSheetHandleBar} />
          </View>

          {/* Header with close button */}
          <View style={styles.bottomSheetHeader}>
            <View style={styles.bottomSheetDateContainer}>
              <Text style={styles.bottomSheetDateText}>{formatDate(item.createdAt)}</Text>
              <Text style={styles.bottomSheetFormatText}>{item.format === '1:1' ? 'Square' : 'Vertical'}</Text>
            </View>
            <TouchableOpacity style={styles.bottomSheetCloseButton} onPress={onClose}>
              <X size={20} color={Colors.light.text} />
            </TouchableOpacity>
          </View>

          {/* Preview Image */}
          <View style={styles.bottomSheetPreviewContainer}>
            <View style={[styles.bottomSheetPreview, previewDimensions]}>
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.bottomSheetPreviewImage}
                contentFit="cover"
                transition={200}
              />
            </View>
          </View>

          {/* Platform Options Grid */}
          <View style={styles.platformsSection}>
            <Text style={styles.platformsSectionTitle}>Share to</Text>
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
                    onPress={() => onPlatformAction(platform.id)}
                    disabled={isProcessing}
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

          {/* Delete Button */}
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={onDelete}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            <Trash2 size={18} color={Colors.light.error} />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default function WorkScreen() {
  const {
    portfolio,
    isPortfolioLoading,
    deleteFromPortfolio,
  } = useApp();

  // Format filter state
  const [selectedFormat, setSelectedFormat] = useState<TemplateFormat | 'all'>('1:1');
  
  // Bottom sheet state
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);
  
  // Processing state for share/download actions
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPlatform, setProcessingPlatform] = useState<string | null>(null);
  
  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Filter portfolio by selected format
  const filteredPortfolio = useMemo(() => {
    if (selectedFormat === 'all') return portfolio;
    return portfolio.filter(item => item.format === selectedFormat);
  }, [portfolio, selectedFormat]);

  // Show toast message
  const showToastMessage = useCallback((message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }, []);

  // Handle portfolio item press - open bottom sheet
  const handleItemPress = useCallback((item: PortfolioItem) => {
    setSelectedItem(item);
    setIsBottomSheetVisible(true);
  }, []);

  // Handle close bottom sheet
  const handleCloseBottomSheet = useCallback(() => {
    setIsBottomSheetVisible(false);
    setTimeout(() => setSelectedItem(null), 300);
  }, []);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (!selectedItem) return;

    Alert.alert(
      'Delete',
      'Are you sure you want to remove this from your portfolio?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFromPortfolio(selectedItem.id);
              handleCloseBottomSheet();
            } catch {
              // Error handled silently
            }
          },
        },
      ]
    );
  }, [selectedItem, deleteFromPortfolio, handleCloseBottomSheet]);

  // Handle platform action (share/download)
  const handlePlatformAction = useCallback(async (platformId: PublishPlatform) => {
    if (!selectedItem?.imageUrl) {
      Alert.alert('Error', 'No image available');
      return;
    }

    setIsProcessing(true);
    setProcessingPlatform(platformId);

    try {
      switch (platformId) {
        case 'download':
          const downloadResult = await downloadAndSaveToGallery(selectedItem.imageUrl);
          if (!downloadResult.success) {
            throw new Error(downloadResult.error || 'Download failed');
          }
          showToastMessage('Saved! You can view it in your photo library');
          break;

        case 'share':
        case 'instagram_post':
        case 'facebook_post':
          const shareResult = await downloadAndShare(selectedItem.imageUrl, undefined, {
            mimeType: 'image/jpeg',
            dialogTitle: platformId === 'share' ? 'Share your creation' : `Share to ${platformId === 'instagram_post' ? 'Instagram' : 'Facebook'}`,
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
  }, [selectedItem, showToastMessage]);

  // Handle format filter selection
  const handleFormatSelect = useCallback((format: TemplateFormat | 'all') => {
    setSelectedFormat(format);
  }, []);

  // Handle start creating
  const handleStartCreating = useCallback(() => {
    // Navigate to create tab - handled by tab navigation
  }, []);

  // Render a portfolio card (clean, no overlays)
  const renderPortfolioCard = useCallback(
    (item: PortfolioItem) => {
      // Calculate tile height based on format
      const tileHeight = item.format === '9:16' 
        ? TILE_WIDTH * 1.78 
        : TILE_WIDTH;

      return (
        <Pressable
          key={item.id}
          style={[styles.itemTile, { height: tileHeight }]}
          onPress={() => handleItemPress(item)}
        >
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.itemThumbnail}
            contentFit="cover"
            transition={200}
          />
        </Pressable>
      );
    },
    [handleItemPress]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Work</Text>
      </View>

      {/* Format Filter Row */}
      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          {formatFilters.map((item) => {
            const isActive = selectedFormat === item.format;
            return (
              <TouchableOpacity
                key={item.format}
                style={[
                  styles.formatButton,
                  isActive && styles.formatButtonActive,
                ]}
                onPress={() => handleFormatSelect(item.format)}
                activeOpacity={0.7}
              >
                {item.icon(isActive)}
                <Text style={[
                  styles.formatLabel,
                  isActive && styles.formatLabelActive,
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {isPortfolioLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : filteredPortfolio.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FolderOpen size={48} color={Colors.light.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>
            {portfolio.length === 0 ? 'Build your portfolio' : `No ${selectedFormat} works yet`}
          </Text>
          <Text style={styles.emptyText}>
            {portfolio.length === 0 
              ? 'Your finished creations will appear here. Start creating to showcase your work!'
              : `You haven't created any ${selectedFormat === '1:1' ? 'square' : 'vertical'} content yet.`
            }
          </Text>
          {portfolio.length === 0 && (
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={handleStartCreating}
              activeOpacity={0.8}
            >
              <Plus size={20} color={Colors.light.surface} />
              <Text style={styles.emptyButtonText}>Start Creating</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {filteredPortfolio.map((item) => renderPortfolioCard(item))}
          </View>
        </ScrollView>
      )}

      {/* Bottom Sheet */}
      <BottomSheet
        visible={isBottomSheetVisible}
        item={selectedItem}
        onClose={handleCloseBottomSheet}
        onDelete={handleDelete}
        onPlatformAction={handlePlatformAction}
        isProcessing={isProcessing}
        processingPlatform={processingPlatform}
      />

      {/* Toast */}
      <Toast visible={showToast} message={toastMessage} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  
  // Filter Section
  filterSection: {
    paddingHorizontal: GRID_PADDING,
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  formatButtonActive: {
    borderColor: Colors.light.accent,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  formatLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  formatLabelActive: {
    color: Colors.light.accentDark,
    fontWeight: '600' as const,
  },
  
  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: Colors.light.text,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.surface,
  },
  
  // Grid
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  
  // Portfolio Item Tile (Clean, no overlays)
  itemTile: {
    width: TILE_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  itemThumbnail: {
    width: '100%',
    height: '100%',
  },
  
  // Bottom Sheet Styles
  bottomSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bottomSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bottomSheetContainer: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: height * 0.85,
  },
  bottomSheetHandle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  bottomSheetHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  bottomSheetDateContainer: {
    flex: 1,
  },
  bottomSheetDateText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  bottomSheetFormatText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  bottomSheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Bottom Sheet Preview
  bottomSheetPreviewContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  bottomSheetPreview: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  bottomSheetPreviewImage: {
    width: '100%',
    height: '100%',
  },
  
  // Platform Options
  platformsSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  platformsSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 12,
  },
  platformsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  platformCard: {
    width: (width - 40 - 10) / 2,
    paddingVertical: 16,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformName: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.text,
    textAlign: 'center',
  },
  
  // Delete Button
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FEE8E8',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.light.error,
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
    fontWeight: '500' as const,
    color: Colors.light.surface,
  },
});
