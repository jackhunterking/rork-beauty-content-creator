import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, Stack } from 'expo-router';
import { Image as ImageIcon, Square, RectangleVertical, RectangleHorizontal, Clock, ChevronLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { Draft, TemplateFormat } from '@/types';
import { getDraftPreviewUri } from '@/services/imageUtils';
import { getAllFormats, getDefaultFormat, getFormatById, getFormatLabel, FormatConfig } from '@/constants/formats';
import { useResponsive, getResponsiveTileHeight } from '@/hooks/useResponsive';

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

export default function DraftsScreen() {
  const router = useRouter();
  const { 
    drafts,
    templates,
    loadDraft,
    isDraftsLoading,
    refreshDrafts,
  } = useApp();

  // Responsive configuration
  const responsive = useResponsive();

  // Refresh drafts whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      refreshDrafts();
    }, [refreshDrafts])
  );

  // Local state for format filter - use centralized default
  const [selectedFormat, setSelectedFormat] = useState<TemplateFormat>(getDefaultFormat() as TemplateFormat);

  // Handle back navigation explicitly - always go to Create tab
  const handleBackPress = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  // Get template for a draft
  const getTemplateForDraft = useCallback((templateId: string) => 
    templates.find(t => t.id === templateId), 
    [templates]
  );

  // Dynamic tile height calculation
  const getTileHeight = useCallback((format: TemplateFormat) => {
    const config = getFormatById(format);
    if (config) {
      return getResponsiveTileHeight(responsive.tileWidth, config.aspectRatio);
    }
    return responsive.tileWidth;
  }, [responsive.tileWidth]);

  // Filter drafts by format
  const filteredDrafts = useMemo(() => {
    return drafts.filter(draft => {
      const template = getTemplateForDraft(draft.templateId);
      return template?.format === selectedFormat;
    });
  }, [drafts, selectedFormat, getTemplateForDraft, templates.length]);

  // Handle format filter selection
  const handleFormatSelect = useCallback((format: TemplateFormat) => {
    setSelectedFormat(format);
  }, []);

  // Handle resume draft
  const handleResumeDraft = useCallback((draft: Draft) => {
    const template = getTemplateForDraft(draft.templateId);
    if (!template) return;
    
    loadDraft(draft, template);
    router.push('/editor-v2');
  }, [getTemplateForDraft, loadDraft, router]);

  // Dynamic styles
  const dynamicStyles = useMemo(() => ({
    filterSection: {
      paddingHorizontal: responsive.gridPadding,
    },
    gridContainer: {
      paddingHorizontal: responsive.gridPadding,
      alignItems: responsive.isTablet ? 'center' as const : undefined,
    },
    grid: {
      gap: responsive.gridGap,
      maxWidth: responsive.isTablet 
        ? responsive.columns * responsive.tileWidth + (responsive.columns - 1) * responsive.gridGap 
        : undefined,
    },
    draftTile: {
      width: responsive.tileWidth,
    },
  }), [responsive]);

  if (isDraftsLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Stack.Screen
          options={{
            title: 'Drafts',
            headerBackVisible: false,
            headerLeft: () => (
              <TouchableOpacity
                style={styles.headerBackButton}
                onPress={handleBackPress}
                activeOpacity={0.7}
              >
                <ChevronLeft size={24} color={Colors.light.text} />
                <Text style={styles.headerBackText}>Back</Text>
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
          <Text style={styles.loadingText}>Loading drafts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Drafts',
          headerBackVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              style={styles.headerBackButton}
              onPress={handleBackPress}
              activeOpacity={0.7}
            >
              <ChevronLeft size={24} color={Colors.light.text} />
              <Text style={styles.headerBackText}>Back</Text>
            </TouchableOpacity>
          ),
        }}
      />
      {/* Format Filter Row */}
      <View style={[styles.filterSection, dynamicStyles.filterSection]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
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

      {filteredDrafts.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Clock size={48} color={Colors.light.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>
            {drafts.length === 0 ? 'No drafts yet' : `No ${selectedFormat} drafts`}
          </Text>
          <Text style={styles.emptyText}>
            {drafts.length === 0 
              ? 'Your saved drafts will appear here. Start creating and save your progress!'
              : `You don't have any ${getFormatLabel(selectedFormat)} drafts yet.`
            }
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.gridContainer, dynamicStyles.gridContainer]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.grid, dynamicStyles.grid]}>
            {filteredDrafts.map((draft) => {
              const template = getTemplateForDraft(draft.templateId);
              const previewUri = getDraftPreviewUri(draft);
              const format = template?.format || '1:1';
              
              return (
                <Pressable
                  key={draft.id}
                  style={[
                    styles.draftTile,
                    dynamicStyles.draftTile,
                    { height: getTileHeight(format) }
                  ]}
                  onPress={() => handleResumeDraft(draft)}
                >
                  {previewUri ? (
                    <Image
                      key={`draft-preview-${draft.id}-${draft.updatedAt}`}
                      source={{ uri: previewUri }}
                      style={styles.draftThumbnail}
                      contentFit="cover"
                      transition={200}
                      // For local files, disable disk caching to ensure fresh content
                      // Local preview files change content without changing path
                      cachePolicy={previewUri.startsWith('file://') ? 'memory' : 'memory-disk'}
                    />
                  ) : (
                    <View style={styles.draftPlaceholder}>
                      <ImageIcon size={32} color={Colors.light.textTertiary} />
                    </View>
                  )}
                </Pressable>
              );
            })}
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
  headerBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 8,
    marginLeft: -8,
  },
  headerBackText: {
    fontSize: 17,
    fontWeight: '400' as const,
    color: Colors.light.text,
    marginLeft: -2,
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
  
  // Filter Section
  filterSection: {
    paddingTop: 16,
    paddingBottom: 16,
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
  
  // Empty State
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
  
  // Grid
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    paddingBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  
  // Draft Tile
  draftTile: {
    borderRadius: 12,
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
  draftThumbnail: {
    width: '100%',
    height: '100%',
  },
  draftPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
