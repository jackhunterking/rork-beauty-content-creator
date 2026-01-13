import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, Stack } from 'expo-router';
import { Image as ImageIcon, Square, RectangleVertical, RectangleHorizontal, Clock, ChevronLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { Draft, Template, TemplateFormat } from '@/types';
import { extractSlots } from '@/utils/slotParser';
import { getDraftPreviewUri } from '@/services/imageUtils';
import { getAllFormats, getDefaultFormat, getFormatById, getFormatLabel, FormatConfig } from '@/constants/formats';

const { width } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 20;
const TILE_WIDTH = (width - GRID_PADDING * 2 - GRID_GAP) / 2;

// Dynamic tile height based on format - uses centralized config
const getTileHeight = (format: TemplateFormat) => {
  const config = getFormatById(format);
  if (config) {
    // Use inverse of aspect ratio to get height multiplier
    return TILE_WIDTH / config.aspectRatio;
  }
  // Fallback to square
  return TILE_WIDTH;
};

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

export default function DraftsScreen() {
  const router = useRouter();
  const { 
    drafts,
    templates,
    loadDraft,
    isDraftsLoading,
    refreshDrafts,
  } = useApp();

  // DEBUG: Log drafts and templates on every render
  console.log('[DraftsScreen] Render:', {
    draftsCount: drafts.length,
    templatesCount: templates.length,
    isDraftsLoading,
    draftIds: drafts.map(d => d.id.substring(0, 8)),
    draftTemplateIds: drafts.map(d => d.templateId.substring(0, 8)),
  });

  // Refresh drafts whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      console.log('[DraftsScreen] Screen focused - refreshing drafts');
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

  // Filter drafts by format
  const filteredDrafts = useMemo(() => {
    // DEBUG: Log each draft's template matching
    const results = drafts.map(draft => {
      const template = getTemplateForDraft(draft.templateId);
      const matches = template?.format === selectedFormat;
      console.log('[DraftsScreen] Draft filter:', {
        draftId: draft.id.substring(0, 8),
        templateId: draft.templateId.substring(0, 8),
        templateFound: !!template,
        templateFormat: template?.format,
        selectedFormat,
        matches,
      });
      return { draft, matches };
    });
    
    const filtered = results.filter(r => r.matches).map(r => r.draft);
    console.log('[DraftsScreen] Filter result:', {
      selectedFormat,
      totalDrafts: drafts.length,
      matchingDrafts: filtered.length,
    });
    
    return filtered;
  }, [drafts, selectedFormat, getTemplateForDraft]);

  // Handle format filter selection
  const handleFormatSelect = useCallback((format: TemplateFormat) => {
    setSelectedFormat(format);
  }, []);

  // Handle resume draft
  const handleResumeDraft = useCallback((draft: Draft) => {
    const template = getTemplateForDraft(draft.templateId);
    if (!template) return;
    
    loadDraft(draft, template);
    router.push('/editor');
  }, [getTemplateForDraft, loadDraft, router]);

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
      <View style={styles.filterSection}>
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
        </View>
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
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {filteredDrafts.map((draft) => {
              const template = getTemplateForDraft(draft.templateId);
              const previewUri = getDraftPreviewUri(draft);
              const progress = getDraftSlotProgress(draft, template);
              const format = template?.format || '1:1';
              
              return (
                <Pressable
                  key={draft.id}
                  style={[
                    styles.draftTile,
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
                    />
                  ) : (
                    <View style={styles.draftPlaceholder}>
                      <ImageIcon size={32} color={Colors.light.textTertiary} />
                    </View>
                  )}
                  
                  {/* Progress badge */}
                  <View style={styles.progressBadge}>
                    <Text style={styles.progressText}>
                      {progress.filled}/{progress.total}
                    </Text>
                  </View>
                  
                  {/* Time overlay */}
                  <View style={styles.timeOverlay}>
                    <Text style={styles.timeText} numberOfLines={1}>
                      {formatTimeAgo(draft.updatedAt)}
                    </Text>
                  </View>
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
    paddingHorizontal: GRID_PADDING,
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
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  
  // Draft Tile
  draftTile: {
    width: TILE_WIDTH,
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
  progressBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.surface,
  },
  timeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.light.surface,
  },
});
