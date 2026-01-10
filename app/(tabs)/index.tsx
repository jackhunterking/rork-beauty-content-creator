import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Dimensions, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Star, Image as ImageIcon, Layers, Video, Square, RectangleVertical, Clock } from "lucide-react-native";
import React, { useCallback, useState, useMemo } from "react";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { ContentType, Template, TemplateFormat } from "@/types";
import { clearAllImageCache } from "@/services/imageCacheService";

const { width } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 20;
const TILE_WIDTH = (width - GRID_PADDING * 2 - GRID_GAP) / 2;

// Dynamic tile height based on format
const getTileHeight = (format: TemplateFormat) => {
  switch (format) {
    case '4:5':
      return TILE_WIDTH * 1.25; // 4:5 ratio (Instagram Posts)
    case '9:16':
      return TILE_WIDTH * 1.78; // 9:16 ratio (Stories/Reels)
    case '1:1':
    default:
      return TILE_WIDTH; // 1:1 ratio (Square)
  }
};

const contentTypes: { type: ContentType; icon: React.ReactNode; label: string; disabled?: boolean }[] = [
  { type: 'single', icon: <ImageIcon size={20} color={Colors.light.text} />, label: 'Single' },
  { type: 'carousel', icon: <Layers size={20} color={Colors.light.textTertiary} />, label: 'Carousel', disabled: true },
  { type: 'video', icon: <Video size={20} color={Colors.light.textTertiary} />, label: 'Video', disabled: true },
];

const formatFilters: { format: TemplateFormat; icon: (active: boolean) => React.ReactNode; label: string }[] = [
  { 
    format: '4:5', 
    icon: (active) => <RectangleVertical size={18} color={active ? Colors.light.accentDark : Colors.light.text} />, 
    label: '4:5' 
  },
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

  // Toggle favorites filter
  const handleToggleFavoritesFilter = useCallback(() => {
    setShowFavoritesOnly(prev => !prev);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Create</Text>
        {drafts.length > 0 && (
          <TouchableOpacity 
            style={styles.draftsHeaderButton}
            onPress={() => router.push('/drafts')}
            activeOpacity={0.7}
          >
            <Clock size={20} color={Colors.light.text} />
            <Text style={styles.draftsHeaderText}>Drafts</Text>
            <View style={styles.draftsHeaderBadge}>
              <Text style={styles.draftsHeaderBadgeText}>{drafts.length}</Text>
            </View>
          </TouchableOpacity>
        )}
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
          {/* Templates Section */}
          <View style={styles.templatesSection}>
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
  draftsHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  draftsHeaderText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  draftsHeaderBadge: {
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  draftsHeaderBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.surface,
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
  
  // Templates Section
  templatesSection: {
    paddingHorizontal: GRID_PADDING,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
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
