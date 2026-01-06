import { StyleSheet, View, Text, TouchableOpacity, Modal, ActivityIndicator, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ChevronLeft, Coins, Sparkles, Sun, Droplets, Sparkle, Contrast, RefreshCw, X } from "lucide-react-native";
import React, { useState, useCallback } from "react";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";



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

  const creditCost = getCreditCost();
  const canAfford = credits >= creditCost;
  

  const toggleEnhancement = useCallback((id: string) => {
    setSelectedEnhancements(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  }, []);

  const handleImagePress = useCallback((type: 'before' | 'after') => {
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
            <View style={styles.imagesRow}>
              <TouchableOpacity 
                style={styles.imageCard}
                onPress={() => handleImagePress('before')}
                activeOpacity={0.8}
              >
                <Text style={styles.imageLabel}>BEFORE</Text>
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: currentProject.beforeMedia?.uri }}
                    style={styles.mediaImage}
                    contentFit="cover"
                  />
                </View>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.imageCard}
                onPress={() => handleImagePress('after')}
                activeOpacity={0.8}
              >
                <Text style={styles.imageLabel}>AFTER</Text>
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: currentProject.afterMedia?.uri }}
                    style={styles.mediaImage}
                    contentFit="cover"
                  />
                </View>
              </TouchableOpacity>
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
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={22} color={Colors.light.surface} />
                </TouchableOpacity>
                <Text style={styles.fullscreenTitle}>
                  {viewingImage?.type === 'before' ? 'Before' : 'After'}
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
    paddingHorizontal: 20,
  },
  imagesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  imageCard: {
    flex: 1,
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
