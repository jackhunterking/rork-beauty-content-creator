import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Dimensions, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Star, Image as ImageIcon, Layers, Video, Square, RectangleVertical, Clock, ChevronRight } from "lucide-react-native";
import React, { useCallback, useState, useMemo } from "react";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { ContentType, Template, TemplateFormat, Draft } from "@/types";
import { clearAllImageCache } from "@/services/imageCacheService";
import { extractSlots } from "@/utils/slotParser";

const { width } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 20;
const TILE_WIDTH = (width - GRID_PADDING * 2 - GRID_GAP) / 2;
const DRAFT_CARD_WIDTH = 140;

// Dynamic tile height based on format
const getTileHeight = (format: TemplateFormat) => {
  switch (format) {
    case '9:16':
      return TILE_WIDTH * 1.78; // 9:16 ratio
    case '1:1':
    default:
      return TILE_WIDTH; // 1:1 ratio
  }
};

const contentTypes: { type: ContentType; icon: React.ReactNode; label: string; disabled?: boolean }[] = [
  { type: 'single', icon: <ImageIcon size={20} color={Colors.light.text} />, label: 'Single' },
  { type: 'carousel', icon: <Layers size={20} color={Colors.light.textTertiary} />, label: 'Carousel', disabled: true },
  { type: 'video', icon: <Video size={20} color={Colors.light.textTertiary} />, label: 'Video', disabled: true },
];

const formatFilters: { format: TemplateFormat; icon: (active: boolean) => React.ReactNode; label: string }[] = [
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

// Format relative time
const formatTimeAgo = (dateString: string) => {
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

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function CreateScreen() {
  const router = useRouter();
  const { 
    filteredTemplates, 
    currentProject, 
    setContentType, 
    setFormat, 
    selectedFormat, 
    selectTemplate, 
    toggleFavourite, 
    isLoading, 
    refetchTemplates,
    drafts,
    templates,
    loadDraft,
    isDraftsLoading,
  } = useApp();

  // Local state for favorites filter
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  // Pull-to-refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filter templates by favorites if toggle is on
  const displayedTemplates = useMemo(() => {
    if (showFavoritesOnly) {
      return filteredTemplates.filter(t => t.isFavourite);
    }
    return filteredTemplates;
  }, [filteredTemplates, showFavoritesOnly]);

  // Get the best available preview URI for a draft
  const getDraftPreviewUri = useCallback((draft: Draft): string | null => {
    if (draft.localPreviewPath) return draft.localPreviewPath;
    if (draft.renderedPreviewUrl) return draft.renderedPreviewUrl;
    if (draft.beforeImageUrl) return draft.beforeImageUrl;
    if (draft.afterImageUrl) return draft.afterImageUrl;
    if (draft.capturedImageUrls) {
      const firstImage = Object.values(draft.capturedImageUrls)[0];
      if (firstImage) return firstImage;
    }
    return null;
  }, []);

  // Get template for a draft
  const getTemplateForDraft = useCallback((templateId: string) => 
    templates.find(t => t.id === templateId), 
    [templates]
  );

  // Get slot progress for a draft
  const getDraftSlotProgress = useCallback((draft: Draft, template: Template | undefined) => {
    if (!template) return { filled: 0, total: 2 };
    const slots = extractSlots(template);
    const total = slots.length;
    let filled = 0;
    
    // Check new format
    if (draft.capturedImageUrls) {
      filled = Object.keys(draft.capturedImageUrls).length;
    } else {
      // Legacy format
      if (draft.beforeImageUrl) filled++;
      if (draft.afterImageUrl) filled++;
    }
    
    return { filled, total };
  }, []);
  
  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await clearAllImageCache();
      await refetchTemplates();
    } catch (error) {
      console.error('Failed to refresh templates:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchTemplates]);

  const handleContentTypeSelect = useCallback((type: ContentType) => {
    if (type === 'video' || type === 'carousel') return;
    setContentType(type);
  }, [setContentType]);

  const handleFormatSelect = useCallback((format: TemplateFormat) => {
    setFormat(format);
  }, [setFormat]);

  const handleTemplateSelect = useCallback((template: Template) => {
    selectTemplate(template);
    router.push('/editor');
  }, [selectTemplate, router]);

  const handleToggleFavourite = useCallback((e: any, templateId: string) => {
    e.stopPropagation();
    toggleFavourite(templateId);
  }, [toggleFavourite]);

  // Handle resume draft
  const handleResumeDraft = useCallback((draft: Draft) => {
    const template = getTemplateForDraft(draft.templateId);
    if (!template) return;
    
    loadDraft(draft, template);
    router.push('/editor');
  }, [getTemplateForDraft, loadDraft, router]);

  // Toggle favorites filter
  const handleToggleFavoritesFilter = useCallback(() => {
    setShowFavoritesOnly(prev => !prev);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Create</Text>
      </View>

      <View style={styles.typeSelector}>
        {contentTypes.map((item) => (
          <TouchableOpacity
            key={item.type}
            style={[
              styles.typeButton,
              currentProject.contentType === item.type && styles.typeButtonActive,
              item.disabled && styles.typeButtonDisabled,
            ]}
            onPress={() => handleContentTypeSelect(item.type)}
            disabled={item.disabled}
            activeOpacity={0.7}
          >
            {item.icon}
            <Text style={[
              styles.typeLabel,
              currentProject.contentType === item.type && styles.typeLabelActive,
              item.disabled && styles.typeLabelDisabled,
            ]}>
              {item.label}
            </Text>
            {item.disabled && (
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>Soon</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
          <Text style={styles.loadingText}>Loading templates...</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.light.accent}
              colors={[Colors.light.accent]}
            />
          }
        >
          {/* Drafts Section */}
          {drafts.length > 0 && (
            <View style={styles.draftsSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Clock size={18} color={Colors.light.textSecondary} />
                  <Text style={styles.sectionTitle}>Drafts</Text>
                  <View style={styles.draftCountBadge}>
                    <Text style={styles.draftCountText}>{drafts.length}</Text>
                  </View>
                </View>
              </View>
              
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.draftsScrollContent}
              >
                {drafts.map((draft) => {
                  const template = getTemplateForDraft(draft.templateId);
                  const previewUri = getDraftPreviewUri(draft);
                  const progress = getDraftSlotProgress(draft, template);
                  
                  return (
                    <TouchableOpacity
                      key={draft.id}
                      style={styles.draftCard}
                      onPress={() => handleResumeDraft(draft)}
                      activeOpacity={0.8}
                    >
                      {previewUri ? (
                        <Image
                          source={{ uri: previewUri }}
                          style={styles.draftThumbnail}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <View style={styles.draftPlaceholder}>
                          <ImageIcon size={24} color={Colors.light.textTertiary} />
                        </View>
                      )}
                      
                      {/* Progress indicator */}
                      <View style={styles.draftProgressBadge}>
                        <Text style={styles.draftProgressText}>
                          {progress.filled}/{progress.total}
                        </Text>
                      </View>
                      
                      {/* Time ago */}
                      <View style={styles.draftFooter}>
                        <Text style={styles.draftTimeText} numberOfLines={1}>
                          {formatTimeAgo(draft.updatedAt)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Templates Section */}
          <View style={styles.templatesSection}>
            <Text style={styles.templatesSectionTitle}>Templates</Text>
            
            {/* Format Filter Row with Favorites Toggle */}
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
              
              {/* Spacer */}
              <View style={styles.filterSpacer} />
              
              {/* Favorites Filter Toggle */}
              <TouchableOpacity
                style={[
                  styles.favoritesFilterButton,
                  showFavoritesOnly && styles.favoritesFilterButtonActive,
                ]}
                onPress={handleToggleFavoritesFilter}
                activeOpacity={0.7}
              >
                <Star 
                  size={16} 
                  color={showFavoritesOnly ? Colors.light.accent : Colors.light.textSecondary}
                  fill={showFavoritesOnly ? Colors.light.accent : 'transparent'}
                />
                <Text style={[
                  styles.favoritesFilterText,
                  showFavoritesOnly && styles.favoritesFilterTextActive,
                ]}>
                  Favorites
                </Text>
              </TouchableOpacity>
            </View>

            {/* Templates Grid */}
            {displayedTemplates.length === 0 ? (
              <View style={styles.emptyTemplates}>
                <Star size={32} color={Colors.light.textTertiary} />
                <Text style={styles.emptyTemplatesText}>
                  {showFavoritesOnly 
                    ? 'No favorite templates yet' 
                    : 'No templates available'}
                </Text>
                {showFavoritesOnly && (
                  <TouchableOpacity 
                    style={styles.clearFilterButton}
                    onPress={() => setShowFavoritesOnly(false)}
                  >
                    <Text style={styles.clearFilterText}>Show all templates</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.grid}>
                {displayedTemplates.map((template) => (
                  <Pressable
                    key={template.id}
                    style={[
                      styles.templateTile,
                      { height: getTileHeight(template.format) }
                    ]}
                    onPress={() => handleTemplateSelect(template)}
                  >
                    <Image
                      source={{ uri: template.thumbnail }}
                      style={styles.templateThumbnail}
                      contentFit="cover"
                      transition={200}
                    />
                    <TouchableOpacity
                      style={[styles.favouriteButton, template.isFavourite && styles.favouriteButtonActive]}
                      onPress={(e) => handleToggleFavourite(e, template.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Star
                        size={16}
                        color={template.isFavourite ? Colors.light.accent : Colors.light.surface}
                        fill={template.isFavourite ? Colors.light.accent : 'transparent'}
                      />
                    </TouchableOpacity>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  typeSelector: {
    flexDirection: 'row',
    paddingHorizontal: GRID_PADDING,
    gap: 10,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  typeButtonActive: {
    borderColor: Colors.light.accent,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  typeButtonDisabled: {
    opacity: 0.5,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  typeLabelActive: {
    color: Colors.light.accentDark,
  },
  typeLabelDisabled: {
    color: Colors.light.textTertiary,
  },
  comingSoonBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.surface,
    textTransform: 'uppercase',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  
  // Drafts Section
  draftsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    paddingHorizontal: GRID_PADDING,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  draftCountBadge: {
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  draftCountText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.surface,
  },
  draftsScrollContent: {
    paddingHorizontal: GRID_PADDING,
    gap: 12,
  },
  draftCard: {
    width: DRAFT_CARD_WIDTH,
    height: DRAFT_CARD_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  draftThumbnail: {
    width: '100%',
    height: '100%',
  },
  draftPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftProgressBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  draftProgressText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.surface,
  },
  draftFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  draftTimeText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.light.surface,
  },
  
  // Templates Section
  templatesSection: {
    paddingHorizontal: GRID_PADDING,
  },
  templatesSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  filterSpacer: {
    flex: 1,
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
  favoritesFilterButton: {
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
  favoritesFilterButtonActive: {
    borderColor: Colors.light.accent,
    backgroundColor: 'rgba(201, 168, 124, 0.12)',
  },
  favoritesFilterText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  favoritesFilterTextActive: {
    color: Colors.light.accent,
    fontWeight: '600' as const,
  },
  emptyTemplates: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTemplatesText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  clearFilterButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  clearFilterText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.accent,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  templateTile: {
    width: TILE_WIDTH,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.light.glassEdge,
    shadowColor: Colors.light.glassShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  templateThumbnail: {
    width: '100%',
    height: '100%',
  },
  favouriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favouriteButtonActive: {
    backgroundColor: Colors.light.surface,
  },
});
