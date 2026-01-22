import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Star, Square, RectangleVertical, RectangleHorizontal } from "lucide-react-native";
import React, { useCallback, useState, useMemo } from "react";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { Template, TemplateFormat } from "@/types";
import { clearAllImageCache } from "@/services/imageCacheService";
import { getAllFormats, getFormatById, FormatConfig } from "@/constants/formats";
import { useResponsive, getResponsiveTileHeight } from "@/hooks/useResponsive";

// Helper to get icon component for a format config
const getFormatIcon = (config: FormatConfig, active: boolean) => {
  const color = active ? Colors.light.accentDark : Colors.light.text;
  switch (config.icon) {
    case 'square':
      return <Square size={18} color={color} />;
    case 'landscape':
      return <RectangleHorizontal size={18} color={color} />;
    case 'portrait':
    default:
      return <RectangleVertical size={18} color={color} />;
  }
};

// Generate format filters dynamically from centralized config
const formatFilters = getAllFormats().map(config => ({
  format: config.id as TemplateFormat,
  icon: (active: boolean) => getFormatIcon(config, active),
  label: config.id,
}));

export default function CreateScreen() {
  const router = useRouter();
  const { 
    filteredTemplates, 
    setFormat, 
    selectedFormat, 
    selectTemplate, 
    toggleFavourite, 
    isLoading, 
    refetchTemplates,
  } = useApp();

  // Responsive configuration for iPad/iPhone
  const responsive = useResponsive();

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

  // Dynamic tile height based on format and responsive tile width
  const getTileHeight = useCallback((format: TemplateFormat) => {
    const config = getFormatById(format);
    if (config) {
      return getResponsiveTileHeight(responsive.tileWidth, config.aspectRatio);
    }
    // Fallback to square
    return responsive.tileWidth;
  }, [responsive.tileWidth]);

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

  const handleFormatSelect = useCallback((format: TemplateFormat) => {
    setFormat(format);
  }, [setFormat]);

  const handleTemplateSelect = useCallback((template: Template) => {
    // All templates are freely accessible - paywall is at download time
    selectTemplate(template);
    router.push('/editor-v2');
  }, [selectTemplate, router]);

  const handleToggleFavourite = useCallback((e: any, templateId: string) => {
    e.stopPropagation();
    toggleFavourite(templateId);
  }, [toggleFavourite]);

  // Toggle favorites filter
  const handleToggleFavoritesFilter = useCallback(() => {
    setShowFavoritesOnly(prev => !prev);
  }, []);

  // Dynamic styles based on responsive configuration
  const dynamicStyles = useMemo(() => ({
    header: {
      paddingHorizontal: responsive.gridPadding,
    },
    title: {
      fontSize: responsive.headerFontSize,
    },
    templatesSection: {
      paddingHorizontal: responsive.gridPadding,
      alignItems: responsive.isTablet ? 'center' as const : undefined,
    },
    grid: {
      gap: responsive.gridGap,
      maxWidth: responsive.isTablet ? responsive.columns * responsive.tileWidth + (responsive.columns - 1) * responsive.gridGap : undefined,
    },
    templateTile: {
      width: responsive.tileWidth,
    },
  }), [responsive]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, dynamicStyles.header]}>
        <Text style={[styles.title, dynamicStyles.title]}>Create</Text>
        
        {/* Favorites Filter Toggle in Header */}
        <TouchableOpacity
          style={[
            styles.headerFavoritesButton,
            showFavoritesOnly && styles.headerFavoritesButtonActive,
          ]}
          onPress={handleToggleFavoritesFilter}
          activeOpacity={0.7}
        >
          <Star 
            size={18} 
            color={showFavoritesOnly ? Colors.light.accent : Colors.light.textSecondary}
            fill={showFavoritesOnly ? Colors.light.accent : 'transparent'}
          />
          <Text style={[
            styles.headerFavoritesText,
            showFavoritesOnly && styles.headerFavoritesTextActive,
          ]}>
            Favorites
          </Text>
        </TouchableOpacity>
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
          <View style={[styles.templatesSection, dynamicStyles.templatesSection]}>
            {/* Format Filter Row */}
            <View style={[styles.filterRow, { maxWidth: dynamicStyles.grid.maxWidth }]}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScrollContent}
              >
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
              </ScrollView>
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
              <View style={[styles.grid, dynamicStyles.grid]}>
                {displayedTemplates.map((template) => (
                  <Pressable
                    key={template.id}
                    style={[
                      styles.templateTile,
                      dynamicStyles.templateTile,
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
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontWeight: '700' as const,
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  headerFavoritesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  headerFavoritesButtonActive: {
    borderColor: Colors.light.accent,
    backgroundColor: 'rgba(201, 168, 124, 0.12)',
  },
  headerFavoritesText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  headerFavoritesTextActive: {
    color: Colors.light.accent,
    fontWeight: '600' as const,
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
    width: '100%',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 16,
    width: '100%',
  },
  filterScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexGrow: 1,
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
  },
  templateTile: {
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
