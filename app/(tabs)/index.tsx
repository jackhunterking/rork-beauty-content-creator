import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Dimensions, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Star, Image as ImageIcon, Layers, Video, FileEdit, Square, RectangleVertical } from "lucide-react-native";
import React, { useCallback } from "react";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { ContentType, Template, TemplateFormat } from "@/types";

const { width } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 20;
const TILE_WIDTH = (width - GRID_PADDING * 2 - GRID_GAP) / 2;

// Dynamic tile height based on format
const getTileHeight = (format: TemplateFormat) => {
  switch (format) {
    case 'vertical':
      return TILE_WIDTH * 1.78; // 9:16 ratio
    case 'square':
    default:
      return TILE_WIDTH; // 1:1 ratio
  }
};

const contentTypes: { type: ContentType; icon: React.ReactNode; label: string; disabled?: boolean }[] = [
  { type: 'single', icon: <ImageIcon size={20} color={Colors.light.text} />, label: 'Single' },
  { type: 'carousel', icon: <Layers size={20} color={Colors.light.textTertiary} />, label: 'Carousel', disabled: true },
  { type: 'video', icon: <Video size={20} color={Colors.light.textTertiary} />, label: 'Video', disabled: true },
];

const formatFilters: { format: TemplateFormat | 'all'; icon: (active: boolean) => React.ReactNode; label: string }[] = [
  { 
    format: 'all', 
    icon: (active) => <Layers size={18} color={active ? Colors.light.accentDark : Colors.light.text} />, 
    label: 'All' 
  },
  { 
    format: 'square', 
    icon: (active) => <Square size={18} color={active ? Colors.light.accentDark : Colors.light.text} />, 
    label: 'Square' 
  },
  { 
    format: 'vertical', 
    icon: (active) => <RectangleVertical size={18} color={active ? Colors.light.accentDark : Colors.light.text} />, 
    label: 'Story' 
  },
];

export default function CreateScreen() {
  const router = useRouter();
  const { filteredTemplates, currentProject, setContentType, setFormat, selectedFormat, selectTemplate, toggleFavourite, isLoading, drafts } = useApp();

  const draftCount = drafts.length;

  const handleDraftsPress = useCallback(() => {
    router.push('/drafts');
  }, [router]);

  const handleContentTypeSelect = useCallback((type: ContentType) => {
    if (type === 'video' || type === 'carousel') return;
    setContentType(type);
  }, [setContentType]);

  const handleFormatSelect = useCallback((format: TemplateFormat | 'all') => {
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Create</Text>
        <TouchableOpacity 
          style={styles.draftsButton} 
          onPress={handleDraftsPress}
          activeOpacity={0.7}
        >
          <FileEdit size={20} color={Colors.light.text} />
          <Text style={styles.draftsButtonText}>Drafts</Text>
          {draftCount > 0 && (
            <View style={styles.draftsBadge}>
              <Text style={styles.draftsBadgeText}>{draftCount > 9 ? '9+' : draftCount}</Text>
            </View>
          )}
        </TouchableOpacity>
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

      {/* Format Filter */}
      <View style={styles.formatSelector}>
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

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
          <Text style={styles.loadingText}>Loading templates...</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {filteredTemplates.map((template) => (
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
                {/* Template name */}
                <View style={styles.templateNameContainer}>
                  <Text style={styles.templateName} numberOfLines={1}>
                    {template.name}
                  </Text>
                </View>
              </Pressable>
            ))}
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
  draftsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 20,
  },
  draftsButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  draftsBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  draftsBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.surface,
  },
  typeSelector: {
    flexDirection: 'row',
    paddingHorizontal: GRID_PADDING,
    gap: 10,
    marginBottom: 12,
  },
  formatSelector: {
    flexDirection: 'row',
    paddingHorizontal: GRID_PADDING,
    gap: 8,
    marginBottom: 16,
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
  gridContainer: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  templateTile: {
    width: TILE_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
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
  templateNameContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  templateName: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.surface,
  },
});
