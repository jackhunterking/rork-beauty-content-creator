import { StyleSheet, View, Text, TouchableOpacity, Modal, ActivityIndicator, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ChevronLeft, Coins, Sparkles, Wand2, RefreshCw, X, Lock, AlertCircle } from "lucide-react-native";
import React, { useState, useCallback, useMemo } from "react";
import Toast from "react-native-toast-message";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { extractSlots } from "@/utils/slotParser";
import { renderTemplate } from "@/services/renderService";

type GenerateState = 'idle' | 'uploading' | 'rendering' | 'complete' | 'error';

type EnhancementOption = {
  id: string;
  label: string;
  icon: typeof Wand2;
  comingSoon?: boolean;
};

const enhancementOptions: EnhancementOption[] = [
  { id: 'skin', label: 'Improve Skin', icon: Wand2, comingSoon: true },
];

export default function GenerateScreen() {
  const router = useRouter();
  const { currentProject, credits, getCreditCost, spendCredits, saveToWork, deleteDraft } = useApp();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [generateState, setGenerateState] = useState<GenerateState>('idle');
  const [selectedEnhancements, setSelectedEnhancements] = useState<string[]>([]);
  const [viewingImage, setViewingImage] = useState<{ uri: string; label: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const template = currentProject.template;
  const capturedImages = currentProject.capturedImages;
  const creditCost = getCreditCost();
  const canAfford = credits >= creditCost;

  // Extract slots from template
  const slots = useMemo(() => 
    template ? extractSlots(template) : [], 
    [template]
  );

  const toggleEnhancement = useCallback((id: string) => {
    setSelectedEnhancements(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  }, []);

  const handleImagePress = useCallback((slotId: string, label: string) => {
    const media = capturedImages[slotId];
    if (media?.uri) {
      setViewingImage({ uri: media.uri, label });
    }
  }, [capturedImages]);

  const handleRetake = useCallback((slotId: string) => {
    router.push(`/capture/${slotId}`);
  }, [router]);

  const handleGenerate = useCallback(() => {
    if (!canAfford) return;
    setShowConfirmModal(true);
  }, [canAfford]);

  const handleConfirm = useCallback(async () => {
    setShowConfirmModal(false);
    setGenerateState('uploading');
    setErrorMessage(null);

    try {
      // Check if template has a Templated.io ID
      if (!template?.templatedId) {
        // Fallback to mock generation for templates without Templated.io
        console.log('Template does not have templatedId, using mock generation');
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        spendCredits(creditCost);
        
        // Get first captured image for thumbnail
        const firstSlot = slots[0];
        const thumbnailUri = firstSlot ? capturedImages[firstSlot.layerId]?.uri : '';
        
        const newAsset = {
          id: Date.now().toString(),
          type: currentProject.contentType as 'single' | 'carousel',
          projectId: Date.now().toString(),
          themeId: template?.id || '',
          thumbnailUri: thumbnailUri || '',
          outputUris: [thumbnailUri || ''],
          createdAt: new Date().toISOString(),
          creditCost,
        };

        saveToWork(newAsset);
        
        // Auto-delete the draft after successful generation
        if (currentProject.draftId) {
          try {
            await deleteDraft(currentProject.draftId);
          } catch (error) {
            console.log('Failed to clean up draft:', error);
          }
        }
        
        setGenerateState('complete');
        router.push({
          pathname: '/result',
          params: { assetId: newAsset.id }
        });
        return;
      }

      // Real Templated.io rendering flow
      setGenerateState('rendering');
      
      const { renderUrl } = await renderTemplate(
        template.templatedId,
        capturedImages
      );

      setGenerateState('complete');
      
      // Spend credits after successful render
      spendCredits(creditCost);

      // Save to work
      const newAsset = {
        id: Date.now().toString(),
        type: currentProject.contentType as 'single' | 'carousel',
        projectId: Date.now().toString(),
        themeId: template.id,
        thumbnailUri: renderUrl,
        outputUris: [renderUrl],
        createdAt: new Date().toISOString(),
        creditCost,
      };

      saveToWork(newAsset);

      // Auto-delete the draft after successful generation
      if (currentProject.draftId) {
        try {
          await deleteDraft(currentProject.draftId);
        } catch (error) {
          console.log('Failed to clean up draft:', error);
        }
      }

      router.push({
        pathname: '/result',
        params: { assetId: newAsset.id }
      });
      
    } catch (error) {
      console.error('Generation failed:', error);
      setGenerateState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Generation failed. Please try again.');
      
      Toast.show({
        type: 'error',
        text1: 'Generation Failed',
        text2: error instanceof Error ? error.message : 'Please try again',
        position: 'top',
        visibilityTime: 4000,
      });
    }
  }, [template, capturedImages, slots, creditCost, currentProject, spendCredits, saveToWork, deleteDraft, router]);

  const handleRetry = useCallback(() => {
    setGenerateState('idle');
    setErrorMessage(null);
  }, []);

  // Loading/Processing state
  if (generateState !== 'idle' && generateState !== 'error') {
    const stateMessages = {
      uploading: { title: 'Uploading...', subtitle: 'Preparing your images' },
      rendering: { title: 'Generating...', subtitle: 'Applying clinic-safe enhancements' },
      complete: { title: 'Complete!', subtitle: 'Your content is ready' },
    };
    
    const message = stateMessages[generateState as keyof typeof stateMessages];
    
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
          <Text style={styles.loadingText}>{message.title}</Text>
          <Text style={styles.loadingSubtext}>{message.subtitle}</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (generateState === 'error') {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <AlertCircle size={48} color={Colors.light.error} />
          <Text style={styles.errorTitle}>Generation Failed</Text>
          <Text style={styles.errorSubtext}>{errorMessage || 'Something went wrong'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <RefreshCw size={18} color={Colors.light.surface} />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
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
            <View style={styles.imagesRow}>
              {slots.map((slot) => {
                const media = capturedImages[slot.layerId];
                return (
                  <TouchableOpacity 
                    key={slot.layerId}
                    style={styles.imageCard}
                    onPress={() => handleImagePress(slot.layerId, slot.label)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.imageLabel}>{slot.label.toUpperCase()}</Text>
                    <View style={styles.imageContainer}>
                      {media?.uri ? (
                        <Image
                          source={{ uri: media.uri }}
                          style={styles.mediaImage}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.placeholderContainer}>
                          <Text style={styles.placeholderText}>No image</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
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
                    style={[styles.optionRow, option.comingSoon && styles.optionRowDisabled]}
                  >
                    <View style={styles.optionLeft}>
                      <View style={[styles.optionIconCircle, option.comingSoon && styles.optionIconCircleDisabled]}>
                        <IconComponent 
                          size={18} 
                          color={option.comingSoon ? Colors.light.textTertiary : Colors.light.accent} 
                        />
                      </View>
                      <Text style={[styles.optionLabel, option.comingSoon && styles.optionLabelDisabled]}>
                        {option.label}
                      </Text>
                      <View style={styles.aiBadge}>
                        <Text style={styles.aiBadgeText}>AI</Text>
                      </View>
                    </View>
                    {option.comingSoon ? (
                      <View style={styles.comingSoonBadge}>
                        <Lock size={12} color={Colors.light.textTertiary} />
                        <Text style={styles.comingSoonText}>Coming Soon</Text>
                      </View>
                    ) : (
                      <Switch
                        value={isSelected}
                        onValueChange={() => toggleEnhancement(option.id)}
                        trackColor={{ false: Colors.light.border, true: Colors.light.text }}
                        thumbColor={isSelected ? Colors.light.accent : Colors.light.surface}
                        ios_backgroundColor={Colors.light.border}
                      />
                    )}
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
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={22} color={Colors.light.surface} />
                </TouchableOpacity>
                <Text style={styles.fullscreenTitle}>
                  {viewingImage?.label}
                </Text>
                <View style={styles.headerSpacer} />
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
                    // Find the slot by label
                    const slot = slots.find(s => s.label === viewingImage?.label);
                    setViewingImage(null);
                    if (slot) handleRetake(slot.layerId);
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
    paddingHorizontal: 20,
  },
  imagesRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  imageCard: {
    flex: 1,
    minWidth: '45%',
  },
  imageLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: Colors.light.textTertiary,
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
  },
  optionLabelDisabled: {
    color: Colors.light.textTertiary,
  },
  optionRowDisabled: {
    opacity: 0.8,
  },
  optionIconCircleDisabled: {
    backgroundColor: Colors.light.border,
  },
  aiBadge: {
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.surface,
    letterSpacing: 0.5,
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  comingSoonText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.light.textTertiary,
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
  errorTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.light.surface,
    marginTop: 20,
  },
  errorSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.light.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.surface,
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
    backgroundColor: 'rgba(0,0,0,0.97)',
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
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.97)',
  },
  fullscreenCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 36,
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
