import { StyleSheet, View, Text, TouchableOpacity, Modal, ActivityIndicator, ScrollView, Switch, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ChevronLeft, Coins, Sparkles, Sun, Droplets, Sparkle, Contrast, Eye, RefreshCw, X } from "lucide-react-native";
import React, { useState, useCallback, useRef } from "react";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_WIDTH = SCREEN_WIDTH - 40;

type EnhancementOption = {
  id: string;
  label: string;
  icon: typeof Sun;
};

const enhancementOptions: EnhancementOption[] = [
  { id: 'lighting', label: 'Brighten Image', icon: Sun },
  { id: 'clarity', label: 'Make it Sharper', icon: Sparkle },
  { id: 'color', label: 'Fix Colors', icon: Droplets },
  { id: 'contrast', label: 'Add Depth', icon: Contrast },
];

export default function GenerateScreen() {
  const router = useRouter();
  const { currentProject, credits, getCreditCost, spendCredits, saveToLibrary } = useApp();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedEnhancements, setSelectedEnhancements] = useState<string[]>([]);
  const [viewingImage, setViewingImage] = useState<{ uri: string; type: 'before' | 'after' } | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<ScrollView>(null);

  const creditCost = getCreditCost();
  const canAfford = credits >= creditCost;
  

  const toggleEnhancement = useCallback((id: string) => {
    setSelectedEnhancements(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  }, []);

  const handleViewImage = useCallback((type: 'before' | 'after') => {
    const media = type === 'before' ? currentProject.beforeMedia : currentProject.afterMedia;
    if (media) {
      setViewingImage({ uri: media.uri, type });
    }
  }, [currentProject.beforeMedia, currentProject.afterMedia]);

  const handleRetake = useCallback((type: 'before' | 'after') => {
    if (type === 'before') {
      router.push('/capture/before');
    } else {
      router.push('/capture/after');
    }
  }, [router]);

  const getImageAspectRatio = useCallback((media: { width: number; height: number } | null) => {
    if (!media || !media.width || !media.height) return 4 / 3;
    return media.width / media.height;
  }, []);

  const beforeAspectRatio = getImageAspectRatio(currentProject.beforeMedia);
  const afterAspectRatio = getImageAspectRatio(currentProject.afterMedia);

  const handleScroll = useCallback((event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / CAROUSEL_WIDTH);
    setActiveSlide(index);
  }, []);

  const currentType = activeSlide === 0 ? 'before' : 'after';

  const handleGenerate = useCallback(() => {
    if (!canAfford) return;
    setShowConfirmModal(true);
  }, [canAfford]);

  const handleConfirm = useCallback(async () => {
    setShowConfirmModal(false);
    setIsGenerating(true);

    await new Promise(resolve => setTimeout(resolve, 2500));

    spendCredits(creditCost);
    
    const newAsset = {
      id: Date.now().toString(),
      type: currentProject.contentType as 'single' | 'carousel',
      projectId: Date.now().toString(),
      themeId: currentProject.themeId || '',
      thumbnailUri: currentProject.afterMedia?.uri || '',
      outputUris: currentProject.contentType === 'carousel' 
        ? [
            currentProject.beforeMedia?.uri || '',
            currentProject.afterMedia?.uri || '',
            currentProject.afterMedia?.uri || '',
          ]
        : [currentProject.afterMedia?.uri || ''],
      createdAt: new Date().toISOString(),
      creditCost,
    };

    saveToLibrary(newAsset);
    
    setIsGenerating(false);
    router.push({
      pathname: '/result',
      params: { assetId: newAsset.id }
    });
  }, [creditCost, currentProject, spendCredits, saveToLibrary, router]);

  if (isGenerating) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
          <Text style={styles.loadingText}>Generating...</Text>
          <Text style={styles.loadingSubtext}>Applying clinic-safe enhancements</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Generate</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.mediaSection}>
            <View style={styles.carouselHeader}>
              <View style={styles.tabIndicators}>
                <TouchableOpacity 
                  style={[styles.tabButton, activeSlide === 0 && styles.tabButtonActive]}
                  onPress={() => carouselRef.current?.scrollTo({ x: 0, animated: true })}
                >
                  <Text style={[styles.tabText, activeSlide === 0 && styles.tabTextActive]}>Before</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.tabButton, activeSlide === 1 && styles.tabButtonActive]}
                  onPress={() => carouselRef.current?.scrollTo({ x: CAROUSEL_WIDTH, animated: true })}
                >
                  <Text style={[styles.tabText, activeSlide === 1 && styles.tabTextActive]}>After</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.carouselContainer}>
              <ScrollView
                ref={carouselRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                style={styles.carousel}
                contentContainerStyle={styles.carouselContent}
              >
                <View style={[styles.carouselSlide, { width: CAROUSEL_WIDTH }]}>
                  <View style={[styles.imageContainer, { aspectRatio: beforeAspectRatio }]}>
                    <Image
                      source={{ uri: currentProject.beforeMedia?.uri }}
                      style={styles.mediaImage}
                      contentFit="contain"
                    />
                  </View>
                </View>
                <View style={[styles.carouselSlide, { width: CAROUSEL_WIDTH }]}>
                  <View style={[styles.imageContainer, { aspectRatio: afterAspectRatio }]}>
                    <Image
                      source={{ uri: currentProject.afterMedia?.uri }}
                      style={styles.mediaImage}
                      contentFit="contain"
                    />
                  </View>
                </View>
              </ScrollView>
            </View>

            <View style={styles.carouselActions}>
              <TouchableOpacity 
                style={styles.carouselActionButton} 
                onPress={() => handleViewImage(currentType)}
              >
                <Eye size={18} color={Colors.light.text} />
                <Text style={styles.carouselActionText}>View Full</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.carouselActionButton} 
                onPress={() => handleRetake(currentType)}
              >
                <RefreshCw size={18} color={Colors.light.text} />
                <Text style={styles.carouselActionText}>Retake</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pageIndicator}>
              <View style={[styles.dot, activeSlide === 0 && styles.dotActive]} />
              <View style={[styles.dot, activeSlide === 1 && styles.dotActive]} />
            </View>
          </View>

          <View style={styles.enhancementsSection}>
            <Text style={styles.sectionTitle}>Enhancement Options</Text>
            <View style={styles.optionsList}>
              {enhancementOptions.map((option) => {
                const IconComponent = option.icon;
                const isSelected = selectedEnhancements.includes(option.id);
                return (
                  <View
                    key={option.id}
                    style={styles.optionRow}
                  >
                    <View style={styles.optionLeft}>
                      <View style={styles.optionIconCircle}>
                        <IconComponent 
                          size={18} 
                          color={Colors.light.accent} 
                        />
                      </View>
                      <Text style={styles.optionLabel}>
                        {option.label}
                      </Text>
                    </View>
                    <Switch
                      value={isSelected}
                      onValueChange={() => toggleEnhancement(option.id)}
                      trackColor={{ false: Colors.light.border, true: Colors.light.text }}
                      thumbColor={isSelected ? Colors.light.accent : Colors.light.surface}
                      ios_backgroundColor={Colors.light.border}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomSection}>
          <View style={styles.creditInfo}>
            <Coins size={18} color={Colors.light.accent} />
            <Text style={styles.creditText}>
              Costs <Text style={styles.creditAmount}>{creditCost} credit{creditCost > 1 ? 's' : ''}</Text>
            </Text>
            <Text style={styles.creditBalance}>({credits} available)</Text>
          </View>

          <TouchableOpacity 
            style={[styles.generateButton, !canAfford && styles.generateButtonDisabled]}
            onPress={handleGenerate}
            disabled={!canAfford}
            activeOpacity={0.8}
          >
            <Sparkles size={20} color={Colors.light.surface} />
            <Text style={styles.generateButtonText}>Generate</Text>
          </TouchableOpacity>

          {!canAfford && (
            <Text style={styles.insufficientText}>Insufficient credits</Text>
          )}
        </View>

        <Modal
          visible={showConfirmModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowConfirmModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Confirm Generation</Text>
              {selectedEnhancements.length > 0 && (
                <View style={styles.modalEnhancementsList}>
                  {selectedEnhancements.map((enhId) => {
                    const enhancement = enhancementOptions.find(e => e.id === enhId);
                    if (!enhancement) return null;
                    const IconComponent = enhancement.icon;
                    return (
                      <View key={enhId} style={styles.modalEnhancementRow}>
                        <View style={styles.modalEnhancementLeft}>
                          <View style={styles.modalEnhancementIconCircle}>
                            <IconComponent size={16} color={Colors.light.accent} />
                          </View>
                          <Text style={styles.modalEnhancementLabel}>{enhancement.label}</Text>
                        </View>
                        <View style={styles.modalEnhancementToggle}>
                          <View style={styles.modalEnhancementToggleThumb} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.modalCancelButton}
                  onPress={() => setShowConfirmModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalConfirmButton}
                  onPress={handleConfirm}
                >
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={!!viewingImage}
          transparent
          animationType="fade"
          onRequestClose={() => setViewingImage(null)}
        >
          <View style={styles.fullscreenModal}>
            <SafeAreaView style={styles.fullscreenSafeArea} edges={['top', 'bottom']}>
              <View style={styles.fullscreenHeader}>
                <TouchableOpacity 
                  style={styles.fullscreenCloseButton} 
                  onPress={() => setViewingImage(null)}
                >
                  <X size={24} color={Colors.light.surface} />
                </TouchableOpacity>
                <Text style={styles.fullscreenTitle}>
                  {viewingImage?.type === 'before' ? 'Before' : 'After'}
                </Text>
                <View style={{ width: 40 }} />
              </View>
              <View style={styles.fullscreenImageContainer}>
                <Image
                  source={{ uri: viewingImage?.uri }}
                  style={styles.fullscreenImage}
                  contentFit="contain"
                />
              </View>
              <View style={styles.fullscreenActions}>
                <TouchableOpacity 
                  style={styles.fullscreenRetakeButton} 
                  onPress={() => {
                    const type = viewingImage?.type;
                    setViewingImage(null);
                    if (type) handleRetake(type);
                  }}
                >
                  <RefreshCw size={18} color={Colors.light.surface} />
                  <Text style={styles.fullscreenRetakeText}>Retake</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  content: {
    flex: 1,
  },
  mediaSection: {
    paddingTop: 8,
  },
  carouselHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  tabIndicators: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: Colors.light.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  tabTextActive: {
    color: Colors.light.text,
    fontWeight: '600' as const,
  },
  carouselContainer: {
    paddingHorizontal: 20,
  },
  carousel: {
    flexGrow: 0,
  },
  carouselContent: {
    alignItems: 'center',
  },
  carouselSlide: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
    maxHeight: 260,
  },
  carouselActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 20,
    marginTop: 14,
  },
  carouselActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
  },
  carouselActionText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.border,
  },
  dotActive: {
    backgroundColor: Colors.light.text,
    width: 18,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  enhancementsSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 14,
  },
  optionsList: {
    gap: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  optionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.light.text,
    flex: 1,
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  creditInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 14,
  },
  creditText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  creditAmount: {
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  creditBalance: {
    fontSize: 13,
    color: Colors.light.textTertiary,
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
    fontWeight: '600' as const,
    color: Colors.light.surface,
  },
  insufficientText: {
    fontSize: 13,
    color: Colors.light.error,
    textAlign: 'center',
    marginTop: 10,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.light.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.light.surface,
    marginTop: 20,
  },
  loadingSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.light.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 8,
  },

  modalEnhancementsList: {
    marginTop: 16,
    marginBottom: 20,
    gap: 8,
  },
  modalEnhancementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surfaceSecondary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  modalEnhancementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalEnhancementIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEnhancementLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.text,
    flex: 1,
  },
  modalEnhancementToggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.light.text,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 2,
  },
  modalEnhancementToggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.light.accent,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: Colors.light.text,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.surface,
  },
  fullscreenModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  fullscreenSafeArea: {
    flex: 1,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fullscreenCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.light.surface,
  },
  fullscreenImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenActions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  fullscreenRetakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
  },
  fullscreenRetakeText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.surface,
  },
});
