import React, { useCallback, useMemo, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Image as ImageIcon, Square, RectangleVertical, Clock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { Draft, Template, TemplateFormat } from '@/types';
import { extractSlots } from '@/utils/slotParser';

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
  } = useApp();

  // Local state for format filter
  const [selectedFormat, setSelectedFormat] = useState<TemplateFormat>('4:5');

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

  // Filter drafts by format
  const filteredDrafts = useMemo(() => {
    return drafts.filter(draft => {
      const template = getTemplateForDraft(draft.templateId);
      return template?.format === selectedFormat;
    });
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
          <Text style={styles.loadingText}>Loading drafts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
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
              : `You don't have any ${selectedFormat === '1:1' ? 'square' : 'vertical'} drafts yet.`
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
