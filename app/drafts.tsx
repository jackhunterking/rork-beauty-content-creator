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
import { useRouter, Stack } from 'expo-router';
import { ChevronLeft, Trash2, FileEdit, ImageIcon, AlertCircle } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { Draft } from '@/types';

const { width } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 20;
const CARD_WIDTH = width - GRID_PADDING * 2;

export default function DraftsScreen() {
  const router = useRouter();
  const { drafts, templates, deleteDraft, loadDraft, isDraftsLoading, refreshDrafts } = useApp();

  // Get template for a draft
  const getTemplateForDraft = useCallback(
    (templateId: string) => templates.find((t) => t.id === templateId),
    [templates]
  );

  // Get draft status text
  const getDraftStatus = useCallback((draft: Draft) => {
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
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Drafts</Text>
          <View style={styles.headerSpacer} />
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
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.back()}
            >
              <Text style={styles.emptyButtonText}>Start Creating</Text>
            </TouchableOpacity>
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

              return (
                <Pressable
                  key={draft.id}
                  style={[
                    styles.draftCard,
                    !isTemplateAvailable && styles.draftCardDisabled,
                  ]}
                  onPress={() => handleResumeDraft(draft)}
                >
                  {/* Preview images row */}
                  <View style={styles.previewRow}>
                    {/* Before image */}
                    <View style={styles.previewSlot}>
                      <Text style={styles.previewLabel}>BEFORE</Text>
                      <View style={styles.previewImageContainer}>
                        {draft.beforeImageUrl ? (
                          <Image
                            source={{ uri: draft.beforeImageUrl }}
                            style={styles.previewImage}
                            contentFit="cover"
                            transition={200}
                          />
                        ) : (
                          <View style={styles.emptyPreview}>
                            <ImageIcon size={20} color={Colors.light.textTertiary} />
                          </View>
                        )}
                      </View>
                    </View>

                    {/* After image */}
                    <View style={styles.previewSlot}>
                      <Text style={styles.previewLabel}>AFTER</Text>
                      <View style={styles.previewImageContainer}>
                        {draft.afterImageUrl ? (
                          <Image
                            source={{ uri: draft.afterImageUrl }}
                            style={styles.previewImage}
                            contentFit="cover"
                            transition={200}
                          />
                        ) : (
                          <View style={styles.emptyPreview}>
                            <ImageIcon size={20} color={Colors.light.textTertiary} />
                          </View>
                        )}
                      </View>
                    </View>
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
  header: {
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
    fontWeight: '600',
    color: Colors.light.text,
  },
  headerSpacer: {
    width: 40,
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
    fontWeight: '600',
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
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: Colors.light.text,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.surface,
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
  previewRow: {
    flexDirection: 'row',
    gap: 2,
    padding: 12,
    paddingBottom: 8,
  },
  previewSlot: {
    flex: 1,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.light.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  previewImageContainer: {
    aspectRatio: 3 / 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  emptyPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
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

