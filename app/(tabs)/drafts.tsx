import React, { useCallback, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Trash2, FileEdit, ImageIcon, AlertCircle } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { Draft } from '@/types';

const { width } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 20;
const CARD_WIDTH = width - GRID_PADDING * 2;

// Placeholder logo URL - update this when you have a logo
// This will be shown when no rendered preview is available
const PLACEHOLDER_LOGO_URL: string | null = null;

export default function DraftsScreen() {
  const router = useRouter();
  const { drafts, templates, deleteDraft, loadDraft, isDraftsLoading } = useApp();

  // Get template for a draft
  const getTemplateForDraft = useCallback(
    (templateId: string) => templates.find((t) => t.id === templateId),
    [templates]
  );

  // Get the best available preview URI for a draft
  // Priority: local path > remote URL > first captured image > null
  const getPreviewUri = useCallback((draft: Draft): string | null => {
    // Priority 1: Local preview path (instant, no network)
    if (draft.localPreviewPath) {
      return draft.localPreviewPath;
    }
    
    // Priority 2: Remote rendered preview URL
    if (draft.renderedPreviewUrl) {
      return draft.renderedPreviewUrl;
    }
    
    // Priority 3: First captured image as thumbnail
    // Check before image first, then after
    if (draft.beforeImageUrl) {
      return draft.beforeImageUrl;
    }
    if (draft.afterImageUrl) {
      return draft.afterImageUrl;
    }
    
    // Priority 4: Check capturedImageUrls if available
    if (draft.capturedImageUrls) {
      const firstImage = Object.values(draft.capturedImageUrls)[0];
      if (firstImage) {
        return firstImage;
      }
    }
    
    return null;
  }, []);

  // Get draft status text
  const getDraftStatus = useCallback((draft: Draft) => {
    // If we have a rendered preview (local or remote), it's ready
    if (draft.localPreviewPath || draft.renderedPreviewUrl) {
      if (draft.beforeImageUrl && draft.afterImageUrl) {
        return 'Ready to download';
      }
      return 'In progress';
    }
    if (draft.beforeImageUrl && draft.afterImageUrl) {
      return 'Ready to generate';
    }
    if (draft.beforeImageUrl || draft.afterImageUrl) {
      return draft.beforeImageUrl ? 'Before added' : 'After added';
    }
    return 'Just started';
  }, []);

  // Get draft status color
  const getDraftStatusColor = useCallback((draft: Draft) => {
    const hasPreview = draft.localPreviewPath || draft.renderedPreviewUrl;
    if (hasPreview && draft.beforeImageUrl && draft.afterImageUrl) {
      return Colors.light.success;
    }
    if (draft.beforeImageUrl && draft.afterImageUrl) {
      return Colors.light.success;
    }
    if (draft.beforeImageUrl || draft.afterImageUrl) {
      return Colors.light.accent;
    }
    return Colors.light.textTertiary;
  }, []);

  // Format date
  const formatDate = useCallback((dateString: string) => {
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
  }, []);

  // Handle resume draft
  const handleResumeDraft = useCallback(
    (draft: Draft) => {
      const template = getTemplateForDraft(draft.templateId);
      
      if (!template) {
        Alert.alert(
          'Template Not Available',
          'The template used for this draft is no longer available. Would you like to delete this draft?',
          [
            { text: 'Keep Draft', style: 'cancel' },
            {
              text: 'Delete Draft',
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteDraft(draft.id);
                  Toast.show({
                    type: 'success',
                    text1: 'Draft deleted',
                    position: 'top',
                    visibilityTime: 2000,
                  });
                } catch {
                  Toast.show({
                    type: 'error',
                    text1: 'Failed to delete draft',
                    position: 'top',
                  });
                }
              },
            },
          ]
        );
        return;
      }

      // Load the draft into the current project and navigate to editor
      loadDraft(draft, template);
      router.push('/editor');
    },
    [getTemplateForDraft, loadDraft, deleteDraft, router]
  );

  // Handle delete draft
  const handleDeleteDraft = useCallback(
    (e: any, draft: Draft) => {
      e.stopPropagation();
      
      Alert.alert(
        'Delete Draft',
        'Are you sure you want to delete this draft? This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteDraft(draft.id);
                Toast.show({
                  type: 'success',
                  text1: 'Draft deleted',
                  position: 'top',
                  visibilityTime: 2000,
                });
              } catch {
                Toast.show({
                  type: 'error',
                  text1: 'Failed to delete draft',
                  position: 'top',
                });
              }
            },
          },
        ]
      );
    },
    [deleteDraft]
  );

  // Sort drafts by updated date (most recent first)
  const sortedDrafts = useMemo(
    () => [...drafts].sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ),
    [drafts]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Drafts</Text>
      </View>

      {isDraftsLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
          <Text style={styles.loadingText}>Loading drafts...</Text>
        </View>
      ) : sortedDrafts.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FileEdit size={48} color={Colors.light.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No drafts yet</Text>
          <Text style={styles.emptyText}>
            Start creating and save your progress to continue later
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {sortedDrafts.map((draft) => {
            const template = getTemplateForDraft(draft.templateId);
            const isTemplateAvailable = !!template;
            const status = getDraftStatus(draft);
            const statusColor = getDraftStatusColor(draft);
            const previewUri = getPreviewUri(draft);

            return (
              <Pressable
                key={draft.id}
                style={[
                  styles.draftCard,
                  !isTemplateAvailable && styles.draftCardDisabled,
                ]}
                onPress={() => handleResumeDraft(draft)}
              >
                {/* Preview section - uses fallback chain: local > remote > captured image > placeholder */}
                <View style={styles.previewSection}>
                  {previewUri ? (
                    // Show preview from best available source (local path, remote URL, or captured image)
                    <View style={styles.renderedPreviewContainer}>
                      <Image
                        source={{ uri: previewUri }}
                        style={styles.renderedPreview}
                        contentFit="contain"
                        transition={200}
                        cachePolicy="memory-disk"
                      />
                    </View>
                  ) : (
                    // Fallback: Show placeholder only when no images at all
                    <View style={styles.placeholderContainer}>
                      {PLACEHOLDER_LOGO_URL ? (
                        <Image
                          source={{ uri: PLACEHOLDER_LOGO_URL }}
                          style={styles.placeholderLogo}
                          contentFit="contain"
                        />
                      ) : (
                        <View style={styles.placeholderIconContainer}>
                          <ImageIcon size={32} color={Colors.light.textTertiary} />
                          <Text style={styles.placeholderText}>No preview yet</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Card footer */}
                <View style={styles.cardFooter}>
                  <View style={styles.cardInfo}>
                    {!isTemplateAvailable && (
                      <View style={styles.warningBadge}>
                        <AlertCircle size={12} color={Colors.light.error} />
                        <Text style={styles.warningText}>Template unavailable</Text>
                      </View>
                    )}
                    {isTemplateAvailable && (
                      <View style={styles.statusRow}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: statusColor },
                          ]}
                        />
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {status}
                        </Text>
                        <Text style={styles.dateText}>
                          • {formatDate(draft.updatedAt)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Delete button */}
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={(e) => handleDeleteDraft(e, draft)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 size={18} color={Colors.light.error} />
                  </TouchableOpacity>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
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
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 8,
    paddingBottom: 20,
    gap: GRID_GAP,
  },
  draftCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.light.surface,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  draftCardDisabled: {
    opacity: 0.7,
  },
  previewSection: {
    padding: 12,
    paddingBottom: 8,
  },
  renderedPreviewContainer: {
    aspectRatio: 1, // Square by default, image will fit within
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renderedPreview: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderLogo: {
    width: '50%',
    height: '50%',
  },
  placeholderIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  cardInfo: {
    flex: 1,
    marginRight: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginLeft: 4,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.error,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
